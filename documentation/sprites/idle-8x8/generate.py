#!/usr/bin/env python3
"""Generates the 8x8, 8-frame ready-stance idle in this folder (see
../export_sprite.py for the formats). Same character as ../run-cycle-8x8."""
import os
import sys

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from export_sprite import export  # noqa: E402

# Facing right in a ready stance: leaning forward, front fist up and front
# foot planted ahead of the back one. Bounces on the balls of the feet, then
# throws a quick jab and bounces again. 150 ms (9 NTSC frames) per frame.
FRAMES = [
    # 1 ready stance: leaning forward, front fist up, front foot ahead
    """
    ....##..
    ....##..
    ....#.#.
    ...###..
    ...##...
    ...#.#..
    ..#..#..
    ..#...#.
    """,
    # 2 bounce: knees dip, fists drop
    """
    ........
    ....##..
    ....##..
    ....#...
    ...####.
    ...##...
    ...#.#..
    ..#...#.
    """,
    # 3 up again
    """
    ....##..
    ....##..
    ....#.#.
    ...###..
    ...##...
    ...#.#..
    ..#..#..
    ..#...#.
    """,
    # 4 bounce
    """
    ........
    ....##..
    ....##..
    ....#...
    ...####.
    ...##...
    ...#.#..
    ..#...#.
    """,
    # 5 pulls the front fist back
    """
    ....##..
    ....##..
    ....#...
    ...###..
    ...##...
    ...#.#..
    ..#..#..
    ..#...#.
    """,
    # 6 jab: leans in, arm straight out
    """
    .....##.
    .....##.
    ....#...
    ...#####
    ...##...
    ...#.#..
    ..#..#..
    ..#...#.
    """,
    # 7 back to guard
    """
    ....##..
    ....##..
    ....#.#.
    ...###..
    ...##...
    ...#.#..
    ..#..#..
    ..#...#.
    """,
    # 8 bounce, then round again
    """
    ........
    ....##..
    ....##..
    ....#...
    ...####.
    ...##...
    ...#.#..
    ..#...#.
    """,
]
export(FRAMES, os.path.dirname(os.path.abspath(__file__)), 'idle-8x8', 'idle', 'idle', frame_ms=150)
