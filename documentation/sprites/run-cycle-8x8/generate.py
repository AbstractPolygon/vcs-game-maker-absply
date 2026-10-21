#!/usr/bin/env python3
"""Generates the 8x8, 8-frame run cycle in this folder (see ../export_sprite.py
for the formats)."""
import os
import sys

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from export_sprite import export  # noqa: E402

# Facing right. A 1-bit silhouette can't tell the left limbs from the right,
# so the two halves of a stride look identical: these 8 frames cover a single
# step (one foot landing to the other foot landing) and loop as a full run.
# The arms swing opposite each other, from fully back to fully forward.
# The arms are short - a shoulder and a hand - and the swing shows at the
# shoulders: at full swing each arm sits off its shoulder, and as it passes the
# body its shoulder turns in behind the body line, so around the passing frame
# (5) the arms tuck in out of sight before swinging out again. The shoulders
# only ever move forward or back, never up or down.
# 50 ms (3 NTSC frames) per frame.
FRAMES = [
    # 1 landing: front foot reaches the ground, arms at full swing
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
    # 2 front knee bends to take the weight, back heel lifts
    """
    ....##..
    ....##..
    ....#...
    ...####.
    ...##...
    .#.##...
    ..#..#..
    .....#..
    """,
    # 3 back heel kicks up behind, bent at the knee
    """
    ....##..
    ....##..
    ....#...
    ...###..
    ....#.#.
    ..#.##..
    ...#.#..
    .....#..
    """,
    # 4 standing leg under the body, back foot tucked up
    """
    ....##..
    ....##..
    ....#...
    ....##..
    ....#...
    ....#...
    ...##...
    ....##..
    """,
    # 5 passing: swinging knee comes through, arms at the sides
    """
    ....##..
    ....##..
    ....#...
    ....#...
    ....#...
    ....##..
    ....##..
    ...##...
    """,
    # 6 standing leg behind the body, swinging knee forward
    """
    ....##..
    ....##..
    ....#...
    ....##..
    ....#...
    ....###.
    ...#..#.
    ...#....
    """,
    # 7 push off: back leg extends, front knee high
    """
    ....##..
    ....##..
    ....#...
    ...###..
    ....#.#.
    ...#.##.
    ...#...#
    ..#.....
    """,
    # 8 toe-off: front leg reaches out for the next landing
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
]
export(FRAMES, os.path.dirname(os.path.abspath(__file__)), 'run-cycle-8x8', 'run', 'run', frame_ms=50)
