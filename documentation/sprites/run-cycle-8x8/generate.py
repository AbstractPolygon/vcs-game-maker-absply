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
# Both shoulders stay put at chest height; only the hands swing. The back hand
# swings back, hangs down, tucks behind the body around the passing frames
# (4-6) and hangs down again, mirroring the front hand's sweep.
# The head, shoulders and arms bob down a pixel in frames 2-3, as the front
# knee takes the weight; the legs and frames 1 and 8 don't change.
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
    # 2 front knee bends to take the weight, back heel lifts; head and shoulders drop a pixel
    """
    ........
    ....##..
    ....##..
    ....#.#.
    ...###..
    .#.##...
    ..#..#..
    .....#..
    """,
    # 3 back heel kicks up behind, bent at the knee; still low, back hand tucked
    """
    ........
    ....##..
    ....##..
    ....#...
    ...####.
    ..#.##..
    ...#.#..
    .....#..
    """,
    # 4 standing leg under the body, back foot tucked up
    """
    ....##..
    ....##..
    ....#...
    ...###..
    ....#.#.
    ....#...
    ...##...
    ....##..
    """,
    # 5 passing: swinging knee comes through, arms at the sides
    """
    ....##..
    ....##..
    ....#...
    ...###..
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
    ...###..
    ....#.#.
    ....###.
    ...#..#.
    ...#....
    """,
    # 7 push off: back leg extends, front knee high
    """
    ....##..
    ....##..
    ....#...
    ...####.
    ...##...
    ...#.##.
    ...#...#
    ..#.....
    """,
    # 8 toe-off: front leg reaches out for the next landing
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
]
export(FRAMES, os.path.dirname(os.path.abspath(__file__)), 'run-cycle-8x8', 'run', 'run', frame_ms=50)
