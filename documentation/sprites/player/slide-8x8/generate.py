#!/usr/bin/env python3
"""Generates the 8x8, 4-frame slide in this folder (see ../../export_sprite.py
for the formats). Same character as ../run-cycle-8x8."""
import os
import sys

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
from export_sprite import export  # noqa: E402

# Facing right. The player dropping into a slide along the ground, like Mega
# Man's slide. Starts on the run's first frame, drops with the legs kicking
# apart, then slides two rows shorter than standing: low, the arms out for
# balance, both legs splayed and visible, the back one stretched out behind and
# the front one out in front. In the slide the back foot drags flat along the
# ground, every pixel of it joined to the leg, so
# loop frames 3 and 4 for as long as the player slides; move the sprite in the
# game.
FRAMES = [
    # 1 running in, as in the run's frame 1
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
    # 2 dropping into the slide: legs kicking apart
    """
    ........
    ....##..
    ....##..
    ...##.#.
    ..#.#...
    ...##...
    ..#..##.
    .#.....#
    """,
    # 3 sliding: low, arms out for balance, the back leg stretched out behind and the front leg out in front
    """
    ........
    ........
    ...##...
    ...##...
    ..#.#.#.
    ...###..
    ..#...#.
    .#.....#
    """,
    # 4 the back leg stretches further out behind, the foot dragging on the ground; loop frames 3 and 4 while sliding
    """
    ........
    ........
    ...##...
    ...##...
    ..#.#.#.
    ...###..
    .##...#.
    #......#
    """,
]

# NTSC frames: 3, 3, 6, 6
FRAME_MS = [50, 50, 100, 100]

export(FRAMES, os.path.dirname(os.path.abspath(__file__)), 'slide-8x8', 'slide', 'slide', frame_ms=FRAME_MS)
