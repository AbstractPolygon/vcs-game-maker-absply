#!/usr/bin/env python3
"""Generates the 8x8, 8-frame idle in this folder (see
../export_sprite.py for the formats). Same character as ../run-cycle-8x8."""
import os
import sys

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from export_sprite import export  # noqa: E402

# Facing right, with the front foot planted ahead of the back one and both
# arms down at the sides, bouncing gently up and down with overlapping action:
# going down the hips drop first, then the back arm, then the front arm, then
# the head; coming up the back arm leads, then the front arm, then the hips,
# with the head last. Each frame moves one part by one pixel and no pose
# repeats. 100 ms (6 NTSC frames) per frame.
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
    # 3 back arm follows
    """
    ....##..
    ....##..
    ....#...
    ....##..
    ...##.#.
    ..#.#...
    ...#.#..
    ..#...#.
    """,
    # 4 front arm follows
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
    # 5 head follows: fully low
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
    # 6 back arm leads back up
    """
    ........
    ....##..
    ....##..
    ...##...
    ..#.##..
    ....#.#.
    ...#.#..
    ..#...#.
    """,
    # 7 front arm follows up
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
    # 8 legs straighten; the head comes up last as it loops
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
