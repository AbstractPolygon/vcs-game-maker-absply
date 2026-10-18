#!/usr/bin/env python3
"""Generates the 8x8, 4-frame falling loop in this folder (see
../export_sprite.py for the formats). Same character as ../run-cycle-8x8."""
import os
import sys

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from export_sprite import export  # noqa: E402

# Facing right, dropping: arms flail up and out and the legs kick, on a loop.
# Like the other animations, the fall itself comes from moving the sprite down
# in the game.
FRAMES = [
    # 1 back arm up, legs apart
    """
    ........
    ..#.##..
    ..#.##..
    ...##..#
    ....###.
    ....#...
    ...#.#..
    ..#...#.
    """,
    # 2 front arm up, legs kicking
    """
    ........
    ....##..
    .#..##.#
    ..###.#.
    ....##..
    ....#...
    ...#.##.
    ...#....
    """,
    # 3 back arm up, legs crossing
    """
    ........
    ..#.##..
    ..#.##..
    ...##..#
    ....###.
    ....#...
    ...##...
    ..#..#..
    """,
    # 4 front arm up, legs apart
    """
    ........
    ....##..
    .#..##.#
    ..###.#.
    ....##..
    ....#...
    ....##..
    ...#..#.
    """,
]
export(FRAMES, os.path.dirname(os.path.abspath(__file__)), 'fall-8x8', 'fall', 'fall')
