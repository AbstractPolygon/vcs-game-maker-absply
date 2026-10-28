#!/usr/bin/env python3
"""Generates the 8x8, 4-frame crouch in this folder (see
../../export_sprite.py for the formats). Same character as ../run-cycle-8x8."""
import os
import sys

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
from export_sprite import export  # noqa: E402

# Facing right. The player crouching down to duck: from the idle's first frame
# through the idle's lowest pose (its frame 7), sinking with the arms out for
# balance, to a duck two rows shorter than standing. Ducked, the head and neck
# still sit clear of the hunched shoulders and the two bent legs stay apart,
# so it still reads as the player. Play it once and hold the last frame while
# ducking; play it backwards to stand up.
FRAMES = [
    # 1 standing, as in the idle
    """
    ....##..
    ....##..
    ....#...
    ...###..
    ..#.#.#.
    ...#.#..
    ..#..#..
    ..#...#.
    """,
    # 2 knees bend, as in the idle's low point
    """
    ........
    ....##..
    ....##..
    ....#...
    ...###..
    ..#.#.#.
    ...#.#..
    ..#...#.
    """,
    # 3 sinking lower, arms out for balance, knees out
    """
    ........
    ........
    ....##..
    ....##..
    ....#...
    ..#####.
    ..##.##.
    ..#...#.
    """,
    # 4 ducked: hunched over, arms in, knees bent right up
    """
    ........
    ........
    ....##..
    ....##..
    ....#...
    ..####..
    .#.#.##.
    .#....#.
    """,
]

export(FRAMES, os.path.dirname(os.path.abspath(__file__)), 'crouch-8x8', 'crouch', 'crouch', frame_ms=50)
