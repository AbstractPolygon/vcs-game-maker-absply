#!/usr/bin/env python3
"""Generates the 8x8, 8-frame idle in this folder (see
../export_sprite.py for the formats). Same character as ../run-cycle-8x8."""
import os
import sys

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from export_sprite import export  # noqa: E402

# Facing right, with the front foot planted ahead of the back one and both
# arms down at the sides, bouncing gently up and down with the head kept
# upright. Each step moves just one part by one pixel: the knees bend and the
# hips drop, the head and shoulders follow, then back up the same way. The legs
# only ever switch between straight and bent, so neither knee twitches.
# 100 ms (6 NTSC frames) per frame.
FRAMES = [
    # 1 standing, arms down at the sides
    """
    ....##..
    ....##..
    ....#...
    ...###..
    ..#.#.#.
    ...#.#..
    ..#..#..
    ..#...#.
    """,
    # 2 standing
    """
    ....##..
    ....##..
    ....#...
    ...###..
    ..#.#.#.
    ...#.#..
    ..#..#..
    ..#...#.
    """,
    # 3 knees bend, hips drop
    """
    ....##..
    ....##..
    ....#...
    ...###..
    ..#.#.#.
    ....#...
    ...#.#..
    ..#...#.
    """,
    # 4 head and shoulders follow down
    """
    ........
    ....##..
    ....##..
    ....#...
    ...###..
    ..#.#.#.
    ...#.#..
    ..#...#.
    """,
    # 5 holding low
    """
    ........
    ....##..
    ....##..
    ....#...
    ...###..
    ..#.#.#.
    ...#.#..
    ..#...#.
    """,
    # 6 head and shoulders rise
    """
    ....##..
    ....##..
    ....#...
    ...###..
    ..#.#.#.
    ....#...
    ...#.#..
    ..#...#.
    """,
    # 7 legs straighten
    """
    ....##..
    ....##..
    ....#...
    ...###..
    ..#.#.#.
    ...#.#..
    ..#..#..
    ..#...#.
    """,
    # 8 standing, then round again
    """
    ....##..
    ....##..
    ....#...
    ...###..
    ..#.#.#.
    ...#.#..
    ..#..#..
    ..#...#.
    """,
]
export(FRAMES, os.path.dirname(os.path.abspath(__file__)), 'idle-8x8', 'idle', 'idle')
