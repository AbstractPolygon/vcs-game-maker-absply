#!/usr/bin/env python3
"""Generates the 8x8, 12-frame double jump power-up in this folder (see
../export_sprite.py for the formats). A prop, not the player."""
import os
import sys

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from export_sprite import export  # noqa: E402

# The double jump power-up, two stacked chevrons, spinning on its vertical axis.
# It narrows one pixel per frame from 8 wide to 2 (edge on) and widens back
# out. On the odd widths, which can't be centred, the nearer half is drawn a
# pixel wider: the left half on the way in, the right half on the way out. The
# shape is symmetrical and one colour, so its back looks the same as its front
# and one loop is a full turn. Frame times follow a real spin: it lingers face
# on, where the width barely changes, and passes quickly through edge on.
# Frame 1 is the power-up face on.
FRAMES = [
    # 1 face on, 8 wide
    """
    ...##...
    ..#..#..
    .#....#.
    #..##..#
    ..####..
    .##..##.
    ##....##
    #......#
    """,
    # 2 turning, 7 wide, left edge nearer
    """
    ...##...
    ..#..#..
    .#...#..
    #..##.#.
    ..####..
    .##..##.
    ##...##.
    #.....#.
    """,
    # 3 6 wide
    """
    ...##...
    ..#..#..
    ..#..#..
    .#.##.#.
    ..####..
    ..#..#..
    .##..##.
    .#....#.
    """,
    # 4 5 wide
    """
    ...##...
    ..#.#...
    ..#..#..
    .#.###..
    ..###...
    ..#.##..
    .##..#..
    .#...#..
    """,
    # 5 4 wide
    """
    ...##...
    ...##...
    ..#..#..
    ..####..
    ...##...
    ..####..
    ..#..#..
    ..#..#..
    """,
    # 6 3 wide
    """
    ...##...
    ...##...
    ..#.#...
    ..###...
    ...##...
    ..###...
    ..#.#...
    ..#.#...
    """,
    # 7 edge on, 2 wide
    """
    ...##...
    ...##...
    ...##...
    ...##...
    ...##...
    ...##...
    ...##...
    ...##...
    """,
    # 8 turning back, 3 wide, right edge nearer
    """
    ...##...
    ...##...
    ...#.#..
    ...###..
    ...##...
    ...###..
    ...#.#..
    ...#.#..
    """,
    # 9 4 wide
    """
    ...##...
    ...##...
    ..#..#..
    ..####..
    ...##...
    ..####..
    ..#..#..
    ..#..#..
    """,
    # 10 5 wide
    """
    ...##...
    ...#.#..
    ..#..#..
    ..###.#.
    ...###..
    ..##.#..
    ..#..##.
    ..#...#.
    """,
    # 11 6 wide
    """
    ...##...
    ..#..#..
    ..#..#..
    .#.##.#.
    ..####..
    ..#..#..
    .##..##.
    .#....#.
    """,
    # 12 7 wide
    """
    ...##...
    ..#..#..
    ..#...#.
    .#.##..#
    ..####..
    .##..##.
    .##...##
    .#.....#
    """,
]

# NTSC frames: 6, 4, 3, 2, 2, 2, 2, 2, 2, 2, 3, 4
FRAME_MS = [100, 67, 50, 33, 33, 33, 33, 33, 33, 33, 50, 67]

export(FRAMES, os.path.dirname(os.path.abspath(__file__)), 'double-jump-8x8', 'double_jump', 'double-jump', frame_ms=FRAME_MS)
