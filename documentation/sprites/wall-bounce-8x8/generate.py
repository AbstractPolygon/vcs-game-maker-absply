#!/usr/bin/env python3
"""Generates the 8x8, 8-frame wall bounce in this folder (see
../export_sprite.py for the formats). Same character as ../run-cycle-8x8."""
import os
import sys

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from export_sprite import export  # noqa: E402

# Facing right, running into a wall just past the right edge and bouncing off
# it. Starts on the run cycle's frame 1 and ends on the idle's first frame. As
# with the other 8x8 animations, the knock-back itself comes from moving the
# sprite left in the game, mostly over frames 3-5.
FRAMES = [
    # 1 running in, as in the run
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
    # 2 hit: face and hands flat against the wall
    """
    ......##
    ......##
    .....#.#
    ....##.#
    ....#...
    ...#.#..
    ..#..#..
    .#...#..
    """,
    # 3 jolt: head snaps back, front arm flung up
    """
    ........
    ..##..#.
    ..##.#..
    ...##...
    ....#...
    ....#...
    ...#.#..
    ...#.#..
    """,
    # 4 knocked back off the feet, legs swinging up in front
    """
    ........
    .##.....
    .##.#...
    ..###.#.
    ...#.#..
    ...##...
    ....#.#.
    .......#
    """,
    # 5 lands on the back foot, arms windmilling
    """
    .#......
    ..##..#.
    ..##.#..
    ...##...
    ...#....
    ...##...
    ..#..#..
    ..#...#.
    """,
    # 6 staggering, arms out for balance
    """
    ........
    ...##...
    .#.##..#
    ..#####.
    ....#...
    ....#...
    ...#.#..
    ..#..#..
    """,
    # 7 steadying: bent over, hands on knees
    """
    ........
    ........
    .....##.
    .....##.
    ...###..
    ...#.#..
    ...#.#..
    ...#.#..
    """,
    # 8 standing again, as in the idle
    """
    ....##..
    ....##..
    ....#.#.
    ...###..
    ...##...
    ...#.#..
    ..#..#..
    ..#...#.
    """,
]
export(FRAMES, os.path.dirname(os.path.abspath(__file__)), 'wall-bounce-8x8', 'wall_bounce', 'wall-bounce')
