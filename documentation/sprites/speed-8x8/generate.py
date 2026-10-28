#!/usr/bin/env python3
"""Generates the 8x8, 8-frame speed pickup in this folder (see
../export_sprite.py for the formats). A prop, not the player."""
import os
import sys

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from export_sprite import export  # noqa: E402

# A speed boost: a stopwatch, a round face with the button on top, its hand
# sweeping round fast, an eighth of a turn a frame, so it goes all the way
# round in under half a second. Drawn in the 7 columns around the hand's pivot
# so the face is round (the last column stays empty). Loops.
FRAMES = [
    # 1 the hand at 12 o'clock
    """
    ...#....
    ..###...
    .#.#.#..
    #..#..#.
    #..#..#.
    #.....#.
    .#...#..
    ..###...
    """,
    # 2 the hand at half past 1
    """
    ...#....
    ..###...
    .#...#..
    #...#.#.
    #..#..#.
    #.....#.
    .#...#..
    ..###...
    """,
    # 3 the hand at 3 o'clock
    """
    ...#....
    ..###...
    .#...#..
    #.....#.
    #..####.
    #.....#.
    .#...#..
    ..###...
    """,
    # 4 the hand at half past 4
    """
    ...#....
    ..###...
    .#...#..
    #.....#.
    #..#..#.
    #...#.#.
    .#...#..
    ..###...
    """,
    # 5 the hand at 6 o'clock
    """
    ...#....
    ..###...
    .#...#..
    #.....#.
    #..#..#.
    #..#..#.
    .#.#.#..
    ..###...
    """,
    # 6 the hand at half past 7
    """
    ...#....
    ..###...
    .#...#..
    #.....#.
    #..#..#.
    #.#...#.
    .#...#..
    ..###...
    """,
    # 7 the hand at 9 o'clock
    """
    ...#....
    ..###...
    .#...#..
    #.....#.
    ####..#.
    #.....#.
    .#...#..
    ..###...
    """,
    # 8 the hand at half past 10
    """
    ...#....
    ..###...
    .#...#..
    #.#...#.
    #..#..#.
    #.....#.
    .#...#..
    ..###...
    """,
]

export(FRAMES, os.path.dirname(os.path.abspath(__file__)), 'speed-8x8', 'speed', 'speed', frame_ms=50)
