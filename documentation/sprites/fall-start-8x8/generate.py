#!/usr/bin/env python3
"""Generates the 8x8, 8-frame start of a fall in this folder (see ../export_sprite.py for
the formats). Same character as ../run-cycle-8x8."""
import os
import sys

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from export_sprite import export  # noqa: E402

# Facing right. The lead-in to the fall when the player walks or runs off the
# edge of a platform: starts on the run cycle's toe-off pose (its frame 8) and
# hands over to ../fall-8x8 at its frame 1. Plays once.
FRAMES = [
    # 1 stepping off: toe-off, as in the run
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
    # 2 front foot reaches out over the edge
    """
    ....##..
    ....##..
    ....#...
    ...####.
    ...##...
    ...#.#..
    ..#...#.
    .#....#.
    """,
    # 3 the foot drops into nothing
    """
    ....##..
    ....##..
    ....#...
    ...####.
    ..#.#...
    ...#.#..
    ..#..#..
    .....#..
    """,
    # 4 jolt: arms jerk up, legs come together
    """
    ....##..
    ....##..
    ..#.#.#.
    ...###..
    ....#...
    ....#...
    ....#...
    ...#.#..
    """,
    # 5 arms fully up, legs hang straight
    """
    ....##..
    ..#.###.
    ..#.#.#.
    ...###..
    ....#...
    ....#...
    ....#...
    ....#...
    """,
    # 6 body settles into the fall posture, arms still up
    """
    ........
    ..#.##..
    ..#.##.#
    ...##.#.
    ....##..
    ....#...
    ....#...
    ....#...
    """,
    # 7 legs start to dangle apart
    """
    ........
    ..#.##..
    ..#.##.#
    ...##.#.
    ....##..
    ....#...
    ...#.#..
    ...#.#..
    """,
    # 8 legs apart, both arms up, into the fall loop
    """
    ........
    ..#.##..
    ..#.##.#
    ...##.#.
    ....##..
    ....#...
    ...#.#..
    ..#...#.
    """,
]
export(FRAMES, os.path.dirname(os.path.abspath(__file__)), 'fall-start-8x8', 'fall_start', 'fall-start')
