#!/usr/bin/env python3
"""Generates the 8x8, 8-frame door opening in this folder (see
../export_sprite.py for the formats). Same character as ../run-cycle-8x8."""
import os
import sys

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from export_sprite import export  # noqa: E402

# Facing right, opening a door just past the right edge and walking through.
# Only the player is drawn: the game draws the door and swaps it to open
# around frames 6-7, and moves the sprite forward over frames 7-8. Starts on
# the idle's first frame and ends on the run cycle's frame 1.
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
    # 5 turns the handle, bracing: back foot slides back
    """
    ........
    ....##..
    ....##..
    ....#...
    ....####
    ...#.#..
    ...#.#..
    ..#..#..
    """,
    # 6 pushes: leans hard into the door, back leg driving
    """
    ........
    .....##.
    .....##.
    ....#...
    ....####
    ...#....
    ..#.#...
    .#..##..
    """,
    # 7 door swings open: front foot steps through, arm still holding it
    """
    ....##..
    ....##..
    ....#...
    ....####
    ....#...
    ...#.#..
    ..#..#..
    .#....#.
    """,
    # 8 walking on, as in the run
    """
    ....##..
    ....##..
    ....#.#.
    ...###..
    ..#.#...
    ...#.#..
    .##..#..
    ......#.
    """,
]
export(FRAMES, os.path.dirname(os.path.abspath(__file__)), 'door-open-8x8', 'door_open', 'door-open')
