#!/usr/bin/env python3
"""Generates the 8x8, 8-frame standing idle in this folder (see
../export_sprite.py for the formats). Same character as ../run-cycle-8x8."""
import os
import sys

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from export_sprite import export  # noqa: E402

# Facing right, standing in place with the feet planted: a breath in and out,
# a lean forward, then a glance back over the shoulder. 250 ms (15 NTSC
# frames) per frame.
FRAMES = [
    # 1 standing, arms at the sides
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
    # 2 breathing in: chest up, hands drift out
    """
    ....##..
    ....##..
    ...###..
    ..#.#.#.
    ....#...
    ....#...
    ...#.#..
    ...#.#..
    """,
    # 3 breathing out: head and shoulders drop a pixel
    """
    ........
    ....##..
    ....##..
    ...###..
    ...#.#..
    ....#...
    ...#.#..
    ...#.#..
    """,
    # 4 weight shifts forward over the front foot
    """
    ........
    .....##.
    .....##.
    ....###.
    ....#.#.
    .....#..
    ....##..
    ...#.#..
    """,
    # 5 back upright
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
    # 6 head turns to glance back
    """
    ...##...
    ...##...
    ....#...
    ...###..
    ...#.#..
    ....#...
    ...#.#..
    ...#.#..
    """,
    # 7 still looking back, breathing out
    """
    ........
    ...##...
    ...##...
    ...###..
    ...#.#..
    ....#...
    ...#.#..
    ...#.#..
    """,
    # 8 facing forward again, hands swinging slightly forward
    """
    ....##..
    ....##..
    ....#...
    ....##..
    ....#.#.
    ....#...
    ...#.#..
    ...#.#..
    """,
]
export(FRAMES, os.path.dirname(os.path.abspath(__file__)), 'idle-8x8', 'idle', 'idle', frame_ms=250)
