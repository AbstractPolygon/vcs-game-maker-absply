#!/usr/bin/env python3
"""Generates the 8x8, 8-frame jump from standing in this folder (see ../export_sprite.py for
the formats). Same character as ../run-cycle-8x8."""
import os
import sys

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from export_sprite import export  # noqa: E402

# Facing right. A jump straight up from standing, starting from the idle pose
# and landing back in it. Only the pose is drawn; the jump's height comes from
# moving the sprite in the game.
FRAMES = [
    # 1 crouch, arms swung back
    """
    ........
    ........
    .....##.
    .....##.
    .#..#...
    ..###...
    ....##..
    ...#.#..
    """,
    # 2 launch: stretched out on the toes, arm reaching up
    """
    ......#.
    ....###.
    ....##..
    ....#...
    ....#...
    ....#...
    ....#...
    ....#...
    """,
    # 3 rising
    """
    ......#.
    ....###.
    ....##..
    ....#...
    ....#...
    ....#...
    ....#...
    ...#....
    """,
    # 4 knees start to tuck, arms out
    """
    ....##..
    ....##..
    ..#.#.#.
    ...###..
    ....#...
    ....##..
    .....#..
    ....#...
    """,
    # 5 top of the jump, knees tucked
    """
    ....##..
    ....##..
    ..#.#.#.
    ...###..
    ....#...
    ....###.
    ......#.
    ........
    """,
    # 6 falling, legs opening
    """
    ....##..
    ....##..
    ..#.#.#.
    ...###..
    ....#...
    ....#...
    ...#.#..
    ...#.#..
    """,
    # 7 legs reaching for the ground
    """
    ....##..
    ....##..
    ..#.#.#.
    ...###..
    ....#...
    ....#...
    ....#...
    ....##..
    """,
    # 8 landing: knees bend to absorb it, arms out for balance
    """
    ........
    ........
    ....##..
    ....##..
    ..#.#.#.
    ...##...
    ....##..
    ...#.#..
    """,
]
export(FRAMES, os.path.dirname(os.path.abspath(__file__)), 'standing-jump-8x8', 'standing_jump', 'standing-jump')
