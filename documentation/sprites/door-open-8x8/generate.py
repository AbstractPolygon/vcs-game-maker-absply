#!/usr/bin/env python3
"""Generates the 8x8, 8-frame door opening in this folder (see
../export_sprite.py for the formats). Same character as ../run-cycle-8x8."""
import os
import sys

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from export_sprite import export  # noqa: E402

# Facing right, opening a door just past the right edge. The feet stay planted
# in the idle's stance the whole time; only the upper body moves. Only the
# player is drawn: the game draws the door and swaps it to open around frames
# 6-7. Starts and ends on the idle's first frame.
FRAMES = [
    # 1 standing, as in the idle
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
    # 2 turns side-on to the door, arms down
    """
    ....##..
    ....##..
    ....#...
    ....##..
    ....#...
    ....#...
    ...#.#..
    ...#.#..
    """,
    # 3 reaches out for the handle
    """
    ....##..
    ....##..
    ....#...
    ....###.
    ....#...
    ....#...
    ...#.#..
    ...#.#..
    """,
    # 4 grips the handle at the door's edge
    """
    ....##..
    ....##..
    ....#...
    ....####
    ....#...
    ....#...
    ...#.#..
    ...#.#..
    """,
    # 5 turns the handle
    """
    ....##..
    ....##..
    ....#...
    ....###.
    ....#..#
    ....#...
    ...#.#..
    ...#.#..
    """,
    # 6 leans in and pushes the door
    """
    .....##.
    .....##.
    ....#...
    ....####
    ....#...
    ....#...
    ...#.#..
    ...#.#..
    """,
    # 7 door swings away, hand follows it up
    """
    .....##.
    .....##.
    ....#..#
    ....###.
    ....#...
    ....#...
    ...#.#..
    ...#.#..
    """,
    # 8 lets go, standing again, as in the idle
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
]
export(FRAMES, os.path.dirname(os.path.abspath(__file__)), 'door-open-8x8', 'door_open', 'door-open')
