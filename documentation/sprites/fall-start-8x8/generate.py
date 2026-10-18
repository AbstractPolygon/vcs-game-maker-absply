#!/usr/bin/env python3
"""Generates the 8x8, 3-frame start of a fall in this folder (see ../export_sprite.py for
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
    # 1 stepping off: front foot reaches out over nothing, as in the run
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
    # 2 surprise: jerks upright, arms fly up, legs straight
    """
    ....##..
    ....##..
    ..#.#.#.
    ...###..
    ....#...
    ....#...
    ....#...
    ....#...
    """,
    # 3 dropping: legs dangle, arms start to flail
    """
    ........
    ..#.##..
    ..#.##..
    ...##.##
    ....##..
    ....#...
    ...#.#..
    ...#.#..
    """,
]
export(FRAMES, os.path.dirname(os.path.abspath(__file__)), 'fall-start-8x8', 'fall_start', 'fall-start')
