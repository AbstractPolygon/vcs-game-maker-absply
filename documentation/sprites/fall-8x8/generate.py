#!/usr/bin/env python3
"""Generates the 8x8, 8-frame falling loop in this folder (see ../export_sprite.py for
the formats). Same character as ../run-cycle-8x8."""
import os
import sys

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from export_sprite import export  # noqa: E402

# Facing right, dropping: the arms flail up and down opposite each other,
# pausing at each end, while the legs pedal. Loops. Like the other animations,
# the fall itself comes from moving the sprite down in the game. Use
# ../fall-start-8x8 first when the player walks or runs off a platform.
FRAMES = [
    # 1 back arm up, front arm low, legs apart
    """
    ........
    ..#.##..
    ..#.##..
    ...##...
    ....####
    ....#...
    ...#.#..
    ..#...#.
    """,
    # 2 arms swinging, front knee up
    """
    ........
    ....##..
    .##.##..
    ...##..#
    ....###.
    ....#...
    ...#.##.
    ...#....
    """,
    # 3 arms out level, legs crossing
    """
    ........
    ....##..
    .#..##..
    ..###.##
    ....##..
    ....#...
    ...##...
    ..#..#..
    """,
    # 4 back arm low, front arm up, back leg under
    """
    ........
    ....##..
    ....##.#
    .####.#.
    ....##..
    ....#...
    ....##..
    ...#..#.
    """,
    # 5 holding: back arm low, front arm up, legs apart
    """
    ........
    ....##..
    ....##.#
    .####.#.
    ....##..
    ....#...
    ...#.#..
    ..#...#.
    """,
    # 6 arms swinging back, front knee up
    """
    ........
    ....##..
    .#..##..
    ..###.##
    ....##..
    ....#...
    ...#.##.
    ...#....
    """,
    # 7 arms out level, legs crossing
    """
    ........
    ....##..
    .##.##..
    ...##..#
    ....###.
    ....#...
    ...##...
    ..#..#..
    """,
    # 8 back arm up, front arm low, back leg under
    """
    ........
    ..#.##..
    ..#.##..
    ...##...
    ....####
    ....#...
    ....##..
    ...#..#.
    """,
]
export(FRAMES, os.path.dirname(os.path.abspath(__file__)), 'fall-8x8', 'fall', 'fall')
