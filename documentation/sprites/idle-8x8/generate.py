#!/usr/bin/env python3
"""Generates the 8x8, 8-frame standing idle in this folder (see
../export_sprite.py for the formats). Same character as ../run-cycle-8x8."""
import os
import sys

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from export_sprite import export  # noqa: E402

# Facing right, standing in place and breathing: the chest swells and the
# shoulders rise a pixel, then the head and shoulders settle a pixel below
# where they started. Poses repeat to hold each part of the breath, rather
# than using longer per-frame durations, so the .spr and .png imports (one
# duration for every frame) play at the same pace as the GIF. 250 ms (15 NTSC
# frames) per frame.
FRAMES = [
    # 1 standing, arms at the sides
    """
    ....##..
    ....##..
    ....#...
    ...###..
    ...#.#..
    ....#...
    ...#.#..
    ...#.#..
    """,
    # 2 breathing in: shoulders rise a pixel
    """
    ....##..
    ....##..
    ...###..
    ...###..
    ...#.#..
    ....#...
    ...#.#..
    ...#.#..
    """,
    # 3 holding the breath
    """
    ....##..
    ....##..
    ...###..
    ...###..
    ...#.#..
    ....#...
    ...#.#..
    ...#.#..
    """,
    # 4 holding the breath
    """
    ....##..
    ....##..
    ...###..
    ...###..
    ...#.#..
    ....#...
    ...#.#..
    ...#.#..
    """,
    # 5 breathing out
    """
    ....##..
    ....##..
    ....#...
    ...###..
    ...#.#..
    ....#...
    ...#.#..
    ...#.#..
    """,
    # 6 head and shoulders drop a pixel
    """
    ........
    ....##..
    ....##..
    ...###..
    ...#.#..
    ....#...
    ...#.#..
    ...#.#..
    """,
    # 7 resting
    """
    ........
    ....##..
    ....##..
    ...###..
    ...#.#..
    ....#...
    ...#.#..
    ...#.#..
    """,
    # 8 resting, then breathing in again
    """
    ........
    ....##..
    ....##..
    ...###..
    ...#.#..
    ....#...
    ...#.#..
    ...#.#..
    """,
]
export(FRAMES, os.path.dirname(os.path.abspath(__file__)), 'idle-8x8', 'idle', 'idle', frame_ms=250)
