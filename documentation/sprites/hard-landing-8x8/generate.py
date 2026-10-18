#!/usr/bin/env python3
"""Generates the 8x8, 16-frame hard landing in this folder (see
../export_sprite.py for the formats). Same character as ../run-cycle-8x8."""
import os
import sys

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from export_sprite import export  # noqa: E402

# Facing right. Landing after a long fall: braces, hits the ground, squashes
# down and splats flat out face down, then pushes up on one arm, gets a knee
# under, shakes it off and stands. Play it from the fall loop when the player
# lands after falling a long way; it ends on the idle's first frame. Plays once.
FRAMES = [
    # 1 bracing for the ground: legs straight, arms up
    """
    ........
    .#..##..
    ..#.##.#
    ...####.
    ....#...
    ....#...
    ...#.#..
    ...#.#..
    """,
    # 2 impact: knees buckle into a wide squat, arms fling out
    """
    ........
    ........
    ....##..
    .#..##.#
    ..#####.
    ....#...
    ...#.#..
    ..#...#.
    """,
    # 3 squashing lower, legs splaying
    """
    ........
    ........
    ........
    ....##..
    .#..##.#
    ..#####.
    ..#...#.
    .#.....#
    """,
    # 4 splat: flattened out face down on the ground
    """
    ........
    ........
    ........
    ........
    ........
    ........
    #.....##
    .#######
    """,
    # 5 bounces: feet and back flop up
    """
    ........
    ........
    ........
    ........
    ........
    #.......
    .#...###
    ..######
    """,
    # 6 lying flat
    """
    ........
    ........
    ........
    ........
    ........
    ........
    ......##
    ########
    """,
    # 7 lifts the head
    """
    ........
    ........
    ........
    ........
    ........
    ......##
    ......##
    ######..
    """,
    # 8 pushes up on one arm
    """
    ........
    ........
    ........
    ......##
    ......##
    .....#..
    ....##..
    ####.#..
    """,
    # 9 pulls a knee under
    """
    ........
    ........
    ........
    ......##
    ......##
    ....##..
    ...#.#..
    .##..#..
    """,
    # 10 up on one knee, hand on the ground
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
    # 11 shakes the head
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
    # 12 pushes up off the knee
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
    # 13 hands on knees
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
    # 14 straightening up
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
    # 15 shakes it off: arms out
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
    # 16 standing, as in the idle
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
