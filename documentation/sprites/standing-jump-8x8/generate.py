#!/usr/bin/env python3
"""Generates the 8x8, 8-frame jump from standing in this folder (see ../export_sprite.py for
the formats). Same character as ../run-cycle-8x8."""
import os
import sys

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from export_sprite import export  # noqa: E402

# Facing right. A jump straight up from standing, starting from the idle pose
# and landing back in it. Only the pose is drawn: the game raises the sprite by
# the amount noted on each frame (LIFT below), up to 8 pixels at the top.
FRAMES = [
    # 1 crouch, arms swung back (on the ground)
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
    # 2 launch: stretched out on the toes, arms thrust up (on the ground)
    """
    ....##.#
    ..#.###.
    ...###..
    ....#...
    ....#...
    ....#...
    ....#...
    ....#...
    """,
    # 3 rising (raise 3 px)
    """
    ....##.#
    ..#.###.
    ...###..
    ....#...
    ....#...
    ....#...
    ....#...
    ...#....
    """,
    # 4 knees start to tuck, arms out (raise 6 px)
    """
    ....##..
    ....##..
    ..#.#.#.
    ...###..
    ....#...
    ....#...
    .....#..
    ....#...
    """,
    # 5 top of the jump, knees tucked (raise 8 px)
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
    # 6 falling, legs opening (raise 6 px)
    """
    ....##..
    ....##..
    ..#.#.#.
    ...###..
    ....#...
    ....#...
    .....#..
    ....#...
    """,
    # 7 legs reaching for the ground (raise 2 px)
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
    # 8 landing: knees bend to absorb it (on the ground)
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
# Pixels to raise the sprite by on each frame, from where it stands (the GIF
# preview shows it raised by these).
LIFT = [0, 0, 3, 6, 8, 6, 2, 0]
export(FRAMES, os.path.dirname(os.path.abspath(__file__)), 'standing-jump-8x8', 'standing_jump', 'standing-jump', lift=LIFT)
