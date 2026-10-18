"""Writes an 8x8 animation in every format PlayerEditor.vue can import: an
Aseprite sheet (strip PNG + .json), one PNG per frame and one batari Basic
.spr file per frame, plus a preview strip and an animated GIF."""
import json
import os

from PIL import Image

SIZE = 8
FRAME_MS = 100  # 6 NTSC frames each on import
ON, OFF = (255, 255, 255), (0, 0, 0)


def parse_frames(frames):
    frames = [[[1 if c == '#' else 0 for c in row.strip()] for row in f.strip().splitlines()] for f in frames]
    assert all(len(f) == SIZE and all(len(r) == SIZE for r in f) for f in frames)
    return frames


def frame_image(frame, scale=1):
    img = Image.new('RGB', (SIZE, SIZE), OFF)
    for y, row in enumerate(frame):
        for x, on in enumerate(row):
            if on:
                img.putpixel((x, y), ON)
    return img.resize((SIZE * scale, SIZE * scale), Image.NEAREST) if scale > 1 else img


def export(frames, out, sheet_name, frame_prefix, tag):
    """frames: list of 8-line strings of '#' and '.'; files land in out."""
    frames = parse_frames(frames)
    strip = Image.new('RGB', (SIZE * len(frames), SIZE), OFF)
    preview = Image.new('RGB', ((SIZE + 1) * len(frames) * 16, SIZE * 16), (40, 40, 40))
    for i, frame in enumerate(frames):
        img = frame_image(frame)
        strip.paste(img, (i * SIZE, 0))
        preview.paste(frame_image(frame, 16), (i * (SIZE + 1) * 16, 0))
        img.save(os.path.join(out, f'{frame_prefix}_{i + 1}.png'))
        # parseSpriteFile (src/utils/wide-sprite.js) merges each pair of .spr rows
        # into one pixel row (bB's double-height rows), so every row is written twice.
        rows = [f"  %{''.join(map(str, row))}" for row in frame for _ in range(2)]
        with open(os.path.join(out, f'{frame_prefix}_{i + 1}.spr'), 'w') as f:
            f.write('  player0:\n' + '\n'.join(rows) + '\nend\n')
    strip.save(os.path.join(out, f'{sheet_name}.png'))
    preview.save(os.path.join(out, 'preview.png'))
    gif = [frame_image(frame, 16) for frame in frames]
    gif[0].save(os.path.join(out, f'{sheet_name}.gif'), save_all=True, append_images=gif[1:], duration=FRAME_MS, loop=0)

    sheet = {
        'frames': [
            {
                'filename': f'{tag} {i}.aseprite',
                'frame': {'x': i * SIZE, 'y': 0, 'w': SIZE, 'h': SIZE},
                'rotated': False,
                'trimmed': False,
                'spriteSourceSize': {'x': 0, 'y': 0, 'w': SIZE, 'h': SIZE},
                'sourceSize': {'w': SIZE, 'h': SIZE},
                'duration': FRAME_MS,
            }
            for i in range(len(frames))
        ],
        'meta': {
            'app': 'https://www.aseprite.org/',
            'image': f'{sheet_name}.png',
            'format': 'RGB888',
            'size': {'w': SIZE * len(frames), 'h': SIZE},
            'scale': '1',
            'frameTags': [{'name': tag, 'from': 0, 'to': len(frames) - 1, 'direction': 'forward'}],
        },
    }
    with open(os.path.join(out, f'{sheet_name}.json'), 'w') as f:
        json.dump(sheet, f, indent=2)
        f.write('\n')
