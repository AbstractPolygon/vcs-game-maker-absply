#!/usr/bin/env python3
"""Generates the 8x8, 8-frame jump from a run in this folder (see ../export_sprite.py for
the formats). Same character as ../run-cycle-8x8."""
import os
import sys

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from export_sprite import export  # noqa: E402

# Facing right. A leap taken mid-run: takes off from the run cycle's toe-off
# pose (its frame 8) and lands in its frame 1, so switch back to the run at its
# frame 2. Only the pose is drawn: the game raises the sprite by the amount
# noted on each frame (LIFT below), up to 6 pixels at the top.
FRAMES = [
    # 1 toe-off, as in the run (on the ground)
    """
    ....##..
    ....##..
    ....#.#.
    ...###..
    ...##...
    ...#.#..
    ..#...##
    .#......
    """,
    # 2 drive: back leg straight, front knee high (raise 2 px)
    """
    ....##..
    ....##..
    ....#.#.
    ...###..
    ..#.#...
    ...#.##.
    ..#...#.
    .#......
    """,
    # 3 rising: back knee folds (raise 4 px)
    """
    ....##..
    ....##..
    ....#.#.
    ..####..
    ....#...
    .#.#.##.
    ..#...#.
    ........
    """,
    # 4 top: arms up, legs gathering (raise 6 px)
    """
    ....##..
    .#..##.#
    ..#.#.#.
    ...###..
    ....#...
    ..#.###.
    ...#..#.
    ........
    """,
    # 5 top: both legs swing forward (raise 6 px)
    """
    ....##..
    ....##.#
    ..#.#.#.
    ...###..
    ....#...
    ....###.
    ....#..#
    .....#..
    """,
    # 6 legs out in front, arms coming down (raise 4 px)
    """
    ....##..
    ....##..
    ....#...
    ..#####.
    ....#...
    ....##..
    ....#.##
    ........
    """,
    # 7 front leg reaches for the ground (raise 2 px)
    """
    ....##..
    ....##..
    ....#.#.
    ..####..
    ....#...
    ..#.##..
    ...#..#.
    ......#.
    """,
    # 8 landing, as in the run (on the ground)
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
# Pixels to raise the sprite by on each frame, from where it stands (the GIF
# preview shows it raised by these).
LIFT = [0, 2, 4, 6, 6, 4, 2, 0]
export(FRAMES, os.path.dirname(os.path.abspath(__file__)), 'running-jump-8x8', 'running_jump', 'running-jump', lift=LIFT)
