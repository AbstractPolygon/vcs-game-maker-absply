#!/usr/bin/env python3
"""Compiles the player's animations in this folder into one Aseprite file,
player-animations.aseprite, with a tag per animation, and each prop's into its
own file (trampoline.aseprite, double-jump.aseprite and the saw-blade*.aseprite
files). Also writes the same frames as an Aseprite-style sprite sheet
(<name>.png + .json), which PlayerEditor.vue's "Import from Aseprite" turns
into one animation per tag.

Reads each animation folder's generated strip and .json, so re-run each
folder's generate.py first after changing its frames.

The .aseprite file is written directly, following
https://github.com/aseprite/aseprite/blob/main/docs/ase-file-specs.md:
8 pixels wide RGBA canvas as tall as the frames, one layer, white pixels on
transparent. A double- or quad-wide sprite gets Aseprite's 2:1 or 4:1 pixel ratio, so it shows
as it will on the VCS."""
import json
import os
import struct
import zlib

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
WIDTH = 8
ON = (255, 255, 255, 255)
OFF = (0, 0, 0, 0)

# Folder order is the tag order in each file. Props are kept out of the
# player's file so they import as their own sprites.
PLAYER = [
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
    'shrink-8x8',
]
FILES = {
    'player-animations': PLAYER,
    'trampoline': ['trampoline-8x8'],
    'double-jump': ['double-jump-8x8'],
    'saw-blade': ['saw-blade-8x8'],
    'saw-blade-large': ['saw-blade-large-8x16'],
    'saw-blade-huge': ['saw-blade-huge-8x32'],
}
# Files drawn at double or quad width on the VCS (NUSIZ), and how many times
# wider than tall their pixels are.
PIXEL_WIDTH = {'saw-blade-large': 2, 'saw-blade-huge': 4}

# Distinct tag colours so the animations stand apart on Aseprite's timeline.
TAG_COLORS = [
    (0x4c, 0xaf, 0x50), (0x21, 0x96, 0xf3), (0xff, 0x98, 0x00), (0x9c, 0x27, 0xb0),
    (0xf4, 0x43, 0x36), (0x00, 0xbc, 0xd4), (0x79, 0x55, 0x48), (0x3f, 0x51, 0xb5),
    (0xe9, 0x1e, 0x63), (0x8b, 0xc3, 0x4a), (0xff, 0xc1, 0x07), (0x60, 0x7d, 0x8b),
    (0xcd, 0xdc, 0x39),
]


def load(folders):
    """Returns [(tag, [(pixels, duration_ms), ...]), ...] from the folders."""
    animations = []
    for folder in folders:
        with open(os.path.join(HERE, folder, f'{folder}.json')) as f:
            sheet = json.load(f)
        strip = Image.open(os.path.join(HERE, folder, sheet['meta']['image'])).convert('RGB')
        frames = []
        for frame in sheet['frames']:
            r = frame['frame']
            tile = strip.crop((r['x'], r['y'], r['x'] + r['w'], r['y'] + r['h']))
            assert tile.width == WIDTH, folder
            pixels = [[sum(tile.getpixel((x, y))) > 96 for x in range(WIDTH)] for y in range(tile.height)]
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
    return chunk(0x2005, header + struct.pack('<HH', WIDTH, len(pixels)) + zlib.compress(raw))


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


def write_aseprite(animations, path, pixel_width=1):
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
    height = len(frames[0][0])
    assert all(len(pixels) == height for pixels, _ in frames)
    header = struct.pack('<IHHHHHIHII', 128 + len(body), 0xA5E0, len(frames), WIDTH, height, 32, 1, 100, 0, 0)
    header += struct.pack('<B3xHBBhhHH', 0, 2, pixel_width, 1, 0, 0, 16, 16)
    header += bytes(128 - len(header))
    with open(path, 'wb') as f:
        f.write(header + body)
    return tags, frames


def write_sheet(name, tags, frames):
    height = len(frames[0][0])
    strip = Image.new('RGB', (WIDTH * len(frames), height), (0, 0, 0))
    for i, (pixels, _) in enumerate(frames):
        for y, row in enumerate(pixels):
            for x, on in enumerate(row):
                if on:
                    strip.putpixel((i * WIDTH + x, y), (255, 255, 255))
    strip.save(os.path.join(HERE, f'{name}.png'))
    sheet = {
        'frames': [
            {
                'filename': f'{name} {i}.aseprite',
                'frame': {'x': i * WIDTH, 'y': 0, 'w': WIDTH, 'h': height},
                'rotated': False,
                'trimmed': False,
                'spriteSourceSize': {'x': 0, 'y': 0, 'w': WIDTH, 'h': height},
                'sourceSize': {'w': WIDTH, 'h': height},
                'duration': duration,
            }
            for i, (_, duration) in enumerate(frames)
        ],
        'meta': {
            'app': 'https://www.aseprite.org/',
            'image': f'{name}.png',
            'format': 'RGB888',
            'size': {'w': WIDTH * len(frames), 'h': height},
            'scale': '1',
            'frameTags': [
                {'name': tag, 'from': start, 'to': end, 'direction': 'forward',
                 'color': '#{:02x}{:02x}{:02x}ff'.format(*rgb)}
                for (tag, start, end), rgb in zip(tags, TAG_COLORS)
            ],
        },
    }
    with open(os.path.join(HERE, f'{name}.json'), 'w') as f:
        json.dump(sheet, f, indent=2)
        f.write('\n')


if __name__ == '__main__':
    for name, folders in FILES.items():
        path = os.path.join(HERE, f'{name}.aseprite')
        tags, frames = write_aseprite(load(folders), path, PIXEL_WIDTH.get(name, 1))
        write_sheet(name, tags, frames)
        print(f'{name}.aseprite:')
        for tag, start, end in tags:
            print(f'  {tag}: frames {start + 1}-{end + 1}')
