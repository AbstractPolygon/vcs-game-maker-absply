#!/usr/bin/env python3
"""Generates the 8x8, 8-frame jump in this folder (see ../export_sprite.py for
the formats). Same character as ../run-cycle-8x8."""
import os
import sys

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from export_sprite import export  # noqa: E402

# Facing right. The frames only change the pose: the height of the jump comes
# from moving the sprite up and down in the game, so frames 3-6 are the ones
# to show while the player is in the air.
FRAMES = [
    # 1 crouch: knees bent, arms swung back
    """
    ........
    ........
    ....##..
    ....##..
    ..###...
    ....#...
    .....#..
    ...###..
    """,
    # 2 push: legs straightening, arms swinging forward
    """
    ........
    ....##..
    ....##..
    ....#...
    ...###..
    ....#...
    .....#..
    ....##..
    """,
    # 3 launch: stretched out, toes leaving the ground, arms driving up
    """
    ....##..
    ....##..
    ....#.#.
    ....##..
    ....#...
    ....#...
    ....#...
    ...#....
    """,
    # 4 rise: knees coming up
    """
    ....##..
    ....##..
    ....#.#.
    ....##..
    ....#...
    ....##..
    ...##...
    ........
    """,
    # 5 apex: knees tucked high, arms out
    """
    ....##..
    ....##..
    ..#.#.#.
    ...###..
    ....#...
    .....##.
    .....#..
    ........
    """,
    # 6 fall: legs reaching down, arms up for balance
    """
    ....##..
    ....##..
    ..#.#.#.
    ...###..
    ....#...
    ....#...
    ...#.#..
    .....#..
    """,
    # 7 land: feet touch down, knees giving, arms forward
    """
    ........
    ....##..
    ....##..
    ....#.#.
    ....##..
    ....#...
    .....#..
    ...###..
    """,
    # 8 recover: absorbing the landing
    """
    ........
    ........
    ....##..
    ....##..
    ....#...
    ...##...
    ..#..#..
    ...###..
    """,
]
export(FRAMES, os.path.dirname(os.path.abspath(__file__)), 'jump-8x8', 'jump', 'jump')
