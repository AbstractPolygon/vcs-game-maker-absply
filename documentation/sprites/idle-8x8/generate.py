#!/usr/bin/env python3
"""Generates the 8x8, 6-frame idle in this folder (see
../export_sprite.py for the formats). Same character as ../run-cycle-8x8."""
import os
import sys

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from export_sprite import export  # noqa: E402

# Facing right, with the front foot planted ahead of the back one and both
# arms down at the sides, bouncing gently up and down with overlapping action:
# going down the hips drop first, then the arms, then the head; coming up the
# arms lead, then the hips, with the head last. Each frame moves one part by
# one pixel and no pose repeats. 100 ms (6 NTSC frames) per frame.
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
    # 2 knees bend, hips drop
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
    # 3 arms follow
    """
    ....##..
    ....##..
    ....#...
    ....#...
    ...###..
    ..#.#.#.
    ...#.#..
    ..#...#.
    """,
    # 4 head follows: fully low
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
    # 5 arms lead back up
    """
    ........
    ....##..
    ....##..
    ...###..
    ..#.#.#.
    ....#...
    ...#.#..
    ..#...#.
    """,
    # 6 legs straighten; the head comes up last as it loops
    """
    ........
    ....##..
    ....##..
    ...###..
    ..#.#.#.
    ...#.#..
    ..#..#..
    ..#...#.
    """,
]
export(FRAMES, os.path.dirname(os.path.abspath(__file__)), 'idle-8x8', 'idle', 'idle')
