#!/usr/bin/env python3
"""Generates the 8x8, 8-frame speed pickup in this folder (see
../export_sprite.py for the formats). A prop, not the player."""
import os
import sys

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from export_sprite import export  # noqa: E402

# A speed boost: a wing seen from the side, joined at the right edge, its
# feathers fanning out to the left with their tips drawn as a row of points.
# It flaps: from level it lifts to raised high, sweeps back down through level
# to all the way down and lifts again, a step a frame, so the loop beats
# steadily. The wing always stays inside the 8x8.
FRAMES = [
    # 1 spread level
    """
    ........
    ........
    #.#.#.#.
    ########
    .#######
    ...#####
    ......##
    ........
    """,
    # 2 lifting
    """
    ........
    #.#.#...
    .#######
    ..######
    ....####
    ......##
    ........
    ........
    """,
    # 3 raised high
    """
    #.#.....
    .#.#.#..
    ..######
    ...#####
    ....####
    ......##
    ........
    ........
    """,
    # 4 coming down
    """
    ........
    #.#.#...
    .#######
    ..######
    ....####
    ......##
    ........
    ........
    """,
    # 5 level
    """
    ........
    ........
    #.#.#.#.
    ########
    .#######
    ...#####
    ......##
    ........
    """,
    # 6 beating down
    """
    ........
    ........
    ........
    ..######
    ########
    #.#.#.##
    ......##
    ........
    """,
    # 7 all the way down
    """
    ........
    ........
    ........
    ....####
    ..######
    .#######
    #.#.#.##
    ........
    """,
    # 8 lifting again; loops back to frame 1
    """
    ........
    ........
    ........
    ..######
    ########
    #.#.#.##
    ......##
    ........
    """,
]

export(FRAMES, os.path.dirname(os.path.abspath(__file__)), 'speed-8x8', 'speed', 'speed', frame_ms=50)
