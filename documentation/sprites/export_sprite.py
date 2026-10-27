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


def frame_image(frame, scale=1, pixel_width=1):
    img = Image.new('RGB', (WIDTH, len(frame)), OFF)
    for y, row in enumerate(frame):
        for x, on in enumerate(row):
            if on:
                img.putpixel((x, y), ON)
    if scale == 1 and pixel_width == 1:
        return img
    return img.resize((WIDTH * scale * pixel_width, len(frame) * scale), Image.NEAREST)


def export(frames, out, sheet_name, frame_prefix, tag, frame_ms=FRAME_MS, pixel_width=1):
    """frames: list of strings of 8-character rows of '#' and '.', all the
    same height; files land in out. frame_ms is one time for every frame or a
    list with a time per frame. pixel_width is 2 or 4 for a sprite shown at
    double or quad width on the VCS (NUSIZ): the frame files stay 8 pixels wide
    and only the preview and GIF are drawn with pixels that much wider than
    they are tall."""
    pw = pixel_width
    frames = parse_frames(frames)
    durations = frame_ms if isinstance(frame_ms, list) else [frame_ms] * len(frames)
    assert len(durations) == len(frames)
    height = len(frames[0])
    strip = Image.new('RGB', (WIDTH * len(frames), height), OFF)
    preview = Image.new('RGB', ((WIDTH * pw + 1) * len(frames) * 16, height * 16), (40, 40, 40))
    for i, frame in enumerate(frames):
        img = frame_image(frame)
        strip.paste(img, (i * WIDTH, 0))
        preview.paste(frame_image(frame, 16, pw), (i * (WIDTH * pw + 1) * 16, 0))
        img.save(os.path.join(out, f'{frame_prefix}_{i + 1}.png'))
        # parseSpriteFile (src/utils/wide-sprite.js) merges each pair of .spr rows
        # into one pixel row (bB's double-height rows), so every row is written twice.
        rows = [f"  %{''.join(map(str, row))}" for row in frame for _ in range(2)]
        with open(os.path.join(out, f'{frame_prefix}_{i + 1}.spr'), 'w') as f:
            f.write('  player0:\n' + '\n'.join(rows) + '\nend\n')
    strip.save(os.path.join(out, f'{sheet_name}.png'))
    preview.save(os.path.join(out, 'preview.png'))
    gif = [frame_image(frame, 16, pw) for frame in frames]
    gif[0].save(os.path.join(out, f'{sheet_name}.gif'), save_all=True, append_images=gif[1:], duration=durations, loop=0)

    sheet = {
        'frames': [
            {
                'filename': f'{tag} {i}.aseprite',
                'frame': {'x': i * WIDTH, 'y': 0, 'w': WIDTH, 'h': height},
                'rotated': False,
                'trimmed': False,
                'spriteSourceSize': {'x': 0, 'y': 0, 'w': WIDTH, 'h': height},
                'sourceSize': {'w': WIDTH, 'h': height},
                'duration': durations[i],
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
