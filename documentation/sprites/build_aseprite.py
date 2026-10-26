#!/usr/bin/env python3
"""Compiles every animation in this folder into one Aseprite file,
player-animations.aseprite, with a tag per animation. Also writes the same
frames as an Aseprite-style sprite sheet (player-animations.png + .json), which
PlayerEditor.vue's "Import from Aseprite" turns into one animation per tag.

Reads each animation folder's generated strip and .json, so re-run each
folder's generate.py first after changing its frames.

The .aseprite file is written directly, following
https://github.com/aseprite/aseprite/blob/main/docs/ase-file-specs.md:
8x8 RGBA canvas, one layer, white pixels on transparent."""
import json
import os
import struct
import zlib

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
NAME = 'player-animations'
SIZE = 8
ON = (255, 255, 255, 255)
OFF = (0, 0, 0, 0)

# Folder order is the tag order in the file.
ANIMATIONS = [
    'idle-8x8',
    'run-cycle-8x8',
    'standing-jump-8x8',
    'running-jump-8x8',
    'cannonball-jump-8x8',
    'cannonball-loop-8x8',
    'fall-start-8x8',
    'fall-8x8',
    'hard-landing-8x8',
    'wall-bounce-8x8',
    'door-open-8x8',
    'climb-8x8',
]

# Distinct tag colours so the animations stand apart on Aseprite's timeline.
TAG_COLORS = [
    (0x4c, 0xaf, 0x50), (0x21, 0x96, 0xf3), (0xff, 0x98, 0x00), (0x9c, 0x27, 0xb0),
    (0xf4, 0x43, 0x36), (0x00, 0xbc, 0xd4), (0x79, 0x55, 0x48), (0x3f, 0x51, 0xb5),
    (0xe9, 0x1e, 0x63), (0x8b, 0xc3, 0x4a), (0xff, 0xc1, 0x07), (0x60, 0x7d, 0x8b),
]


def load():
    """Returns [(tag, [(pixels, duration_ms), ...]), ...] from the folders."""
    animations = []
    for folder in ANIMATIONS:
        with open(os.path.join(HERE, folder, f'{folder}.json')) as f:
            sheet = json.load(f)
        strip = Image.open(os.path.join(HERE, folder, sheet['meta']['image'])).convert('RGB')
        frames = []
        for frame in sheet['frames']:
            r = frame['frame']
            tile = strip.crop((r['x'], r['y'], r['x'] + r['w'], r['y'] + r['h']))
            assert tile.size == (SIZE, SIZE), folder
            pixels = [[sum(tile.getpixel((x, y))) > 96 for x in range(SIZE)] for y in range(SIZE)]
            frames.append((pixels, frame['duration']))
        animations.append((sheet['meta']['frameTags'][0]['name'], frames))
    return animations


def ase_string(text):
    data = text.encode('utf-8')
    return struct.pack('<H', len(data)) + data


def chunk(kind, data):
    return struct.pack('<IH', 6 + len(data), kind) + data


def layer_chunk(name):
    # flags: visible | editable; normal layer, child level 0, blend normal, opaque
    return chunk(0x2004, struct.pack('<HHHHHHB3x', 3, 0, 0, 0, 0, 0, 255) + ase_string(name))


def cel_chunk(pixels):
    raw = b''.join(bytes(ON if on else OFF) for row in pixels for on in row)
    # layer 0 at (0, 0), opaque, compressed image cel, z-index 0
    header = struct.pack('<HhhBHh5x', 0, 0, 0, 255, 2, 0)
    return chunk(0x2005, header + struct.pack('<HH', SIZE, SIZE) + zlib.compress(raw))


def color_profile_chunk():
    return chunk(0x2007, struct.pack('<HHI8x', 1, 0, 0))  # sRGB


def palette_chunk():
    entries = [OFF, ON]
    data = struct.pack('<III8x', len(entries), 0, len(entries) - 1)
    for rgba in entries:
        data += struct.pack('<H4B', 0, *rgba)
    return chunk(0x2019, data)


def tags_chunk(tags):
    data = struct.pack('<H8x', len(tags))
    for (name, start, end), rgb in zip(tags, TAG_COLORS):
        # forward, repeat forever; then the colour (deprecated field Aseprite still reads)
        data += struct.pack('<HHBH6x3Bx', start, end, 0, 0, *rgb) + ase_string(name)
    return chunk(0x2018, data)


def frame_block(chunks, duration):
    body = b''.join(chunks)
    n = len(chunks)
    return struct.pack('<IHHH2xI', 16 + len(body), 0xF1FA, min(n, 0xFFFF), duration, n) + body


def write_aseprite(animations, path):
    tags, frames, index = [], [], 0
    for name, anim in animations:
        tags.append((name, index, index + len(anim) - 1))
        frames += anim
        index += len(anim)
    blocks = []
    for i, (pixels, duration) in enumerate(frames):
        chunks = [color_profile_chunk(), palette_chunk(), layer_chunk('player'), tags_chunk(tags)] if i == 0 else []
        blocks.append(frame_block(chunks + [cel_chunk(pixels)], duration))
    body = b''.join(blocks)
    header = struct.pack('<IHHHHHIHII', 128 + len(body), 0xA5E0, len(frames), SIZE, SIZE, 32, 1, 100, 0, 0)
    header += struct.pack('<B3xHBBhhHH', 0, 2, 1, 1, 0, 0, 16, 16)
    header += bytes(128 - len(header))
    with open(path, 'wb') as f:
        f.write(header + body)
    return tags, frames


def write_sheet(tags, frames):
    strip = Image.new('RGB', (SIZE * len(frames), SIZE), (0, 0, 0))
    for i, (pixels, _) in enumerate(frames):
        for y, row in enumerate(pixels):
            for x, on in enumerate(row):
                if on:
                    strip.putpixel((i * SIZE + x, y), (255, 255, 255))
    strip.save(os.path.join(HERE, f'{NAME}.png'))
    sheet = {
        'frames': [
            {
                'filename': f'{NAME} {i}.aseprite',
                'frame': {'x': i * SIZE, 'y': 0, 'w': SIZE, 'h': SIZE},
                'rotated': False,
                'trimmed': False,
                'spriteSourceSize': {'x': 0, 'y': 0, 'w': SIZE, 'h': SIZE},
                'sourceSize': {'w': SIZE, 'h': SIZE},
                'duration': duration,
            }
            for i, (_, duration) in enumerate(frames)
        ],
        'meta': {
            'app': 'https://www.aseprite.org/',
            'image': f'{NAME}.png',
            'format': 'RGB888',
            'size': {'w': SIZE * len(frames), 'h': SIZE},
            'scale': '1',
            'frameTags': [
                {'name': name, 'from': start, 'to': end, 'direction': 'forward',
                 'color': '#{:02x}{:02x}{:02x}ff'.format(*rgb)}
                for (name, start, end), rgb in zip(tags, TAG_COLORS)
            ],
        },
    }
    with open(os.path.join(HERE, f'{NAME}.json'), 'w') as f:
        json.dump(sheet, f, indent=2)
        f.write('\n')


if __name__ == '__main__':
    tags, frames = write_aseprite(load(), os.path.join(HERE, f'{NAME}.aseprite'))
    write_sheet(tags, frames)
    for name, start, end in tags:
        print(f'{name}: frames {start + 1}-{end + 1}')
