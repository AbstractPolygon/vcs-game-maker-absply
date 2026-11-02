#!/usr/bin/env python3
"""Generates the 8x8, 11-frame melt in this folder (see
../../export_sprite.py for the formats). Same character as ../run-cycle-8x8."""
import os
import sys

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
from export_sprite import export  # noqa: E402

# The player melting into a puddle with one arm raised. Starts on the idle's
# first frame and melts steadily from there, the body sinking a row every
# frame and spreading out sideways, while one arm droops and the other swings
# out, comes up and reaches straight up, then sinks with the body, going under
# last, until only a puddle is left across the bottom row. The head and the
# hand move at most one row per frame so nothing jumps. Play it once and hold
# the last frame.
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
    # 2 head drops, the knees give, one arm droops and the other swings out sideways
    """
    ........
    ....##..
    ....##..
    ...#####
    ..#.#...
    ..#.#...
    ..##.##.
    ..#...#.
    """,
    # 3 the shoulders sag into the body, the arm comes up past the head
    """
    ........
    .......#
    ....##.#
    ...####.
    ..#####.
    ..#.#.#.
    ..##.##.
    .##...##
    """,
    # 4 the head sinks into the shoulders, the arm reaches straight up
    """
    .......#
    .......#
    .......#
    ....##.#
    ...####.
    ..#####.
    .###.##.
    .###.###
    """,
    # 5 a lumpy blob, spreading at the base, the arm sinking with it
    """
    ........
    .......#
    .......#
    .......#
    ...###.#
    ..#####.
    .######.
    .#######
    """,
    # 6 sinking lower and wider, the arm still up
    """
    ........
    ........
    .......#
    .......#
    .......#
    ...###.#
    .######.
    ########
    """,
    # 7 a low mound, the arm sticking up out of it
    """
    ........
    ........
    ........
    .......#
    .......#
    .......#
    ..####.#
    ########
    """,
    # 8 the last of the head, the forearm going down
    """
    ........
    ........
    ........
    ........
    .......#
    .......#
    ...##..#
    ########
    """,
    # 9 one bubble left, the hand still up
    """
    ........
    ........
    ........
    ........
    ........
    .......#
    ....#..#
    ########
    """,
    # 10 the hand going under
    """
    ........
    ........
    ........
    ........
    ........
    ........
    ....#..#
    ########
    """,
    # 11 a flat puddle; hold this frame
    """
    ........
    ........
    ........
    ........
    ........
    ........
    ........
    ########
    """,
]

# NTSC frames: 6 each, the hand held a moment before it goes under
FRAME_MS = [100] * 9 + [150, 100]

export(FRAMES, os.path.dirname(os.path.abspath(__file__)), 'melt-8x8', 'melt', 'melt', frame_ms=FRAME_MS)
