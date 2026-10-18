#!/usr/bin/env python3
"""Generates the 8x8, 10-frame hard landing in this folder (see
../export_sprite.py for the formats). Same character as ../run-cycle-8x8."""
import os
import sys

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from export_sprite import export  # noqa: E402

# Facing right. Landing after a long fall: braces, hits the ground, slams
# down on one knee with a hand on the ground, shakes it off and stands up.
# Play it from the fall loop when the player lands after falling a long way;
# it ends on the idle's first frame. Plays once.
FRAMES = [
    # 1 bracing for the ground: legs straight down, arms up
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
    # 2 impact: knees buckle, arms fling out
    """
    ........
    .#...##.
    ..#.##..
    ...###.#
    ....#.#.
    ...#.#..
    ..#...#.
    .##...##
    """,
    # 3 slams down on one knee, hand on the ground
    """
    ........
    ........
    ........
    .....##.
    .....##.
    ...###..
    ..#..##.
    .##.#.#.
    """,
    # 4 dazed: head drops
    """
    ........
    ........
    ........
    ........
    .....##.
    ...####.
    ..#..##.
    .##.#.#.
    """,
    # 5 shakes the head
    """
    ........
    ........
    ........
    ....##..
    ....##..
    ...###..
    ..#..##.
    .##.#.#.
    """,
    # 6 pushes up off the knee
    """
    ........
    ........
    .....##.
    .....##.
    ...###..
    ..#..#..
    ..#.##..
    .##..#..
    """,
    # 7 hands on knees
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
    # 8 straightening up
    """
    ........
    ....##..
    ....##..
    ....#...
    ...###..
    ...#.#..
    ...#.#..
    ...#.#..
    """,
    # 9 shakes it off: arms out
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
    # 10 standing, as in the idle
    """
    ....##..
    ....##..
    ....#...
    ...###..
    ...#.#..
    ....#...
    ...#.#..
    ...#.#..
    """,
]
export(FRAMES, os.path.dirname(os.path.abspath(__file__)), 'hard-landing-8x8', 'hard_landing', 'hard-landing')
