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
# frame 2. The arms are the run's short arms on fixed shoulders. Only the
# pose is drawn; the jump's height comes from moving the
# sprite in the game.
FRAMES = [
    # 1 toe-off, as in the run
    """
    ....##..
    ....##..
    ....#...
    ...####.
    ...##...
    ...#.#..
    ..#...##
    .#......
    """,
    # 2 drive: back leg straight, front knee high, front hand up
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
    # 3 rising: back knee folds, back hand swings up
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
    # 4 top: front leg reaching forward, both hands high
    """
    ....##..
    ....##..
    ..#.#.#.
    ...###..
    ....#...
    .#.#.#..
    ..#...#.
    ......#.
    """,
    # 5 top: both legs swing forward
    """
    ....##..
    ....##..
    ..#.#.#.
    ...###..
    ....#...
    ...#.#..
    ...#..##
    ........
    """,
    # 6 legs out in front, hands coming down
    """
    ....##..
    ....##..
    ....#...
    ..#####.
    ....#...
    ....##..
    ....#.#.
    .......#
    """,
    # 7 front leg reaches for the ground
    """
    ....##..
    ....##..
    ....#...
    ...####.
    ..#.#...
    ...#.#..
    ..#...#.
    ......#.
    """,
    # 8 landing, as in the run
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
export(FRAMES, os.path.dirname(os.path.abspath(__file__)), 'running-jump-8x8', 'running_jump', 'running-jump')
