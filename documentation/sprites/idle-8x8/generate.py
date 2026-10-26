#!/usr/bin/env python3
"""Generates the 8x8, 10-frame idle in this folder (see
../export_sprite.py for the formats). Same character as ../run-cycle-8x8."""
import os
import sys

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from export_sprite import export  # noqa: E402

# Facing right, with the front foot planted ahead of the back one, bouncing
# gently up and down with overlapping action. Going down the arms swing out
# first, then the back knee softens, the hips drop, the shoulders follow and
# the head comes last; at the bottom the arms drop to the sides, then the
# shoulders lead back up, the hips rise with the knee still bent, the knee
# straightens and the head comes up last. The arms are out the whole way down
# and at the sides the whole way up, and both shoulders always move together.
# Each frame moves one part by one pixel and no pose repeats. 67 ms (4 NTSC
# frames) per frame.
FRAMES = [
    # 1 tall, arms down at the sides
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
    # 2 arms swing out as the drop starts
    """
    ....##..
    ....##..
    ....#...
    ..#####.
    ....#...
    ...#.#..
    ..#..#..
    ..#...#.
    """,
    # 3 knees soften
    """
    ....##..
    ....##..
    ....#...
    ..#####.
    ....#...
    ...#.#..
    ...#.#..
    ..#...#.
    """,
    # 4 knees bend, hips drop, arms out
    """
    ....##..
    ....##..
    ....#...
    ..#####.
    ....#...
    ....#...
    ...#.#..
    ..#...#.
    """,
    # 5 shoulders follow, arms out
    """
    ....##..
    ....##..
    ....#...
    ....#...
    ..#####.
    ....#...
    ...#.#..
    ..#...#.
    """,
    # 6 head follows: fully low, arms out
    """
    ........
    ....##..
    ....##..
    ....#...
    ..#####.
    ....#...
    ...#.#..
    ..#...#.
    """,
    # 7 arms drop to the sides as the rise starts
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
    # 8 shoulders lead back up
    """
    ........
    ....##..
    ....##..
    ...###..
    ..#.#.#.
    ....#...
    ...#.#..
    ..#...#.
    """,
    # 9 hips rise, knee still bent
    """
    ........
    ....##..
    ....##..
    ...###..
    ..#.#.#.
    ...#.#..
    ...#.#..
    ..#...#.
    """,
    # 10 knee straightens; the head comes up last as it loops
    """
    ........
    ....##..
    ....##..
    ...###..
    ..#.#.#.
    ...#.#..
    ..#..#..
    ..#...#.
    """,
]
export(FRAMES, os.path.dirname(os.path.abspath(__file__)), 'idle-8x8', 'idle', 'idle', frame_ms=67)
