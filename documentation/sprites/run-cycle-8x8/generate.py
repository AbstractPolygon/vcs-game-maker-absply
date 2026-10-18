#!/usr/bin/env python3
"""Generates the 8x8, 8-frame run cycle in this folder in every format
PlayerEditor.vue can import: an Aseprite sheet (strip PNG + .json),
one PNG per frame, and one batari Basic .spr file per frame, plus an
animated GIF preview."""
import json
import os

from PIL import Image

# Facing right. A 1-bit silhouette can't tell the left limbs from the right,
# so the two halves of a stride look identical: these 8 frames cover a single
# step (one foot landing to the other foot landing) and loop as a full run.
# The arms swing opposite each other, from fully back to fully forward.
FRAMES = [
    # 1 landing: front foot reaches the ground, arms at full swing
    """
    ....##..
    ....##..
    ....#.#.
    ...###..
    ..#.#...
    ...#.#..
    .##..#..
    ......#.
    """,
    # 2 front knee bends to take the weight, back heel lifts
    """
    ....##..
    ....##..
    ....#.#.
    ...###..
    ...##...
    .#.##...
    ..#..#..
    .....#..
    """,
    # 3 back heel kicks up behind, bent at the knee
    """
    ....##..
    ....##..
    ....#...
    ...####.
    ....#...
    ..#.##..
    ...#.#..
    .....#..
    """,
    # 4 standing leg under the body, back foot tucked up
    """
    ....##..
    ....##..
    ....#...
    ....##..
    ...##.#.
    ....#...
    ...##...
    ....##..
    """,
    # 5 passing: swinging knee comes through, arms at the sides
    """
    ....##..
    ....##..
    ....#...
    ....##..
    ....#...
    ....##..
    ....##..
    ...##...
    """,
    # 6 standing leg behind the body, swinging knee forward
    """
    ....##..
    ....##..
    ....#...
    ....##..
    ...##.#.
    ....###.
    ...#..#.
    ...#....
    """,
    # 7 push off: back leg extends, front knee high
    """
    ....##..
    ....##..
    ....#...
    ...####.
    ....#...
    ...#.##.
    ...#...#
    ..#.....
    """,
    # 8 toe-off: front leg reaches out for the next landing
    """
    ....##..
    ....##..
    ....#.#.
    ...###..
    ...##...
    ...#.#..
    ..#...##
    .#......
    """,
]
FRAMES = [[[1 if c == '#' else 0 for c in row.strip()] for row in f.strip().splitlines()] for f in FRAMES]
assert len(FRAMES) == 8 and all(len(f) == 8 and all(len(r) == 8 for r in f) for f in FRAMES)

SIZE = 8
FRAME_MS = 100  # 6 NTSC frames each on import
ON, OFF = (255, 255, 255), (0, 0, 0)
OUT = os.path.dirname(os.path.abspath(__file__))


def frame_image(frame, scale=1):
    img = Image.new('RGB', (SIZE, SIZE), OFF)
    for y, row in enumerate(frame):
        for x, on in enumerate(row):
            if on:
                img.putpixel((x, y), ON)
    return img.resize((SIZE * scale, SIZE * scale), Image.NEAREST) if scale > 1 else img


strip = Image.new('RGB', (SIZE * len(FRAMES), SIZE), OFF)
preview = Image.new('RGB', ((SIZE + 1) * len(FRAMES) * 16, SIZE * 16), (40, 40, 40))
for i, frame in enumerate(FRAMES):
    img = frame_image(frame)
    strip.paste(img, (i * SIZE, 0))
    preview.paste(frame_image(frame, 16), (i * (SIZE + 1) * 16, 0))
    img.save(os.path.join(OUT, f'run_{i + 1}.png'))
    # parseSpriteFile (src/utils/wide-sprite.js) merges each pair of .spr rows
    # into one pixel row (bB's double-height rows), so every row is written twice.
    rows = [f"  %{''.join(map(str, row))}" for row in frame for _ in range(2)]
    with open(os.path.join(OUT, f'run_{i + 1}.spr'), 'w') as f:
        f.write('  player0:\n' + '\n'.join(rows) + '\nend\n')
strip.save(os.path.join(OUT, 'run-cycle-8x8.png'))
preview.save(os.path.join(OUT, 'preview.png'))
gif = [frame_image(frame, 16) for frame in FRAMES]
gif[0].save(os.path.join(OUT, 'run-cycle-8x8.gif'), save_all=True, append_images=gif[1:], duration=FRAME_MS, loop=0)

sheet = {
    'frames': [
        {
            'filename': f'run {i}.aseprite',
            'frame': {'x': i * SIZE, 'y': 0, 'w': SIZE, 'h': SIZE},
            'rotated': False,
            'trimmed': False,
            'spriteSourceSize': {'x': 0, 'y': 0, 'w': SIZE, 'h': SIZE},
            'sourceSize': {'w': SIZE, 'h': SIZE},
            'duration': FRAME_MS,
        }
        for i in range(len(FRAMES))
    ],
    'meta': {
        'app': 'https://www.aseprite.org/',
        'image': 'run-cycle-8x8.png',
        'format': 'RGB888',
        'size': {'w': SIZE * len(FRAMES), 'h': SIZE},
        'scale': '1',
        'frameTags': [{'name': 'run', 'from': 0, 'to': len(FRAMES) - 1, 'direction': 'forward'}],
    },
}
with open(os.path.join(OUT, 'run-cycle-8x8.json'), 'w') as f:
    json.dump(sheet, f, indent=2)
    f.write('\n')
