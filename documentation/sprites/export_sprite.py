"""Writes an 8-pixel-wide animation in every format PlayerEditor.vue can import: an
Aseprite sheet (strip PNG + .json), one PNG per frame and one batari Basic
.spr file per frame, plus a preview strip and an animated GIF."""
import json
import os

from PIL import Image

WIDTH = 8
FRAME_MS = 100  # 6 NTSC frames each on import
ON, OFF = (255, 255, 255), (0, 0, 0)


def parse_frames(frames):
    frames = [[[1 if c == '#' else 0 for c in row.strip()] for row in f.strip().splitlines()] for f in frames]
    assert all(len(f) == len(frames[0]) and all(len(r) == WIDTH for r in f) for f in frames)
    return frames


def frame_image(frame, scale=1):
    img = Image.new('RGB', (WIDTH, len(frame)), OFF)
    for y, row in enumerate(frame):
        for x, on in enumerate(row):
            if on:
                img.putpixel((x, y), ON)
    return img.resize((WIDTH * scale, len(frame) * scale), Image.NEAREST) if scale > 1 else img


def export(frames, out, sheet_name, frame_prefix, tag, frame_ms=FRAME_MS, lift=None):
    """frames: list of strings of 8-character rows of '#' and '.', all the
    same height; files land in out. lift (pixels per frame) only affects the
    GIF, which then shows the sprite raised the way the game would raise it."""
    frames = parse_frames(frames)
    height = len(frames[0])
    strip = Image.new('RGB', (WIDTH * len(frames), height), OFF)
    preview = Image.new('RGB', ((WIDTH + 1) * len(frames) * 16, height * 16), (40, 40, 40))
    for i, frame in enumerate(frames):
        img = frame_image(frame)
        strip.paste(img, (i * WIDTH, 0))
        preview.paste(frame_image(frame, 16), (i * (WIDTH + 1) * 16, 0))
        img.save(os.path.join(out, f'{frame_prefix}_{i + 1}.png'))
        # parseSpriteFile (src/utils/wide-sprite.js) merges each pair of .spr rows
        # into one pixel row (bB's double-height rows), so every row is written twice.
        rows = [f"  %{''.join(map(str, row))}" for row in frame for _ in range(2)]
        with open(os.path.join(out, f'{frame_prefix}_{i + 1}.spr'), 'w') as f:
            f.write('  player0:\n' + '\n'.join(rows) + '\nend\n')
    strip.save(os.path.join(out, f'{sheet_name}.png'))
    preview.save(os.path.join(out, 'preview.png'))
    gif = [frame_image(frame, 16) for frame in frames]
    if lift:
        top = max(lift)
        for i, l in enumerate(lift):
            canvas = Image.new('RGB', (WIDTH * 16, (height + top) * 16), OFF)
            canvas.paste(gif[i], (0, (top - l) * 16))
            gif[i] = canvas
    gif[0].save(os.path.join(out, f'{sheet_name}.gif'), save_all=True, append_images=gif[1:], duration=frame_ms, loop=0)

    sheet = {
        'frames': [
            {
                'filename': f'{tag} {i}.aseprite',
                'frame': {'x': i * WIDTH, 'y': 0, 'w': WIDTH, 'h': height},
                'rotated': False,
                'trimmed': False,
                'spriteSourceSize': {'x': 0, 'y': 0, 'w': WIDTH, 'h': height},
                'sourceSize': {'w': WIDTH, 'h': height},
                'duration': frame_ms,
            }
            for i in range(len(frames))
        ],
        'meta': {
            'app': 'https://www.aseprite.org/',
            'image': f'{sheet_name}.png',
            'format': 'RGB888',
            'size': {'w': WIDTH * len(frames), 'h': height},
            'scale': '1',
            'frameTags': [{'name': tag, 'from': 0, 'to': len(frames) - 1, 'direction': 'forward'}],
        },
    }
    with open(os.path.join(out, f'{sheet_name}.json'), 'w') as f:
        json.dump(sheet, f, indent=2)
        f.write('\n')
