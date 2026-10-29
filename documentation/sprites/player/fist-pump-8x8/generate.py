#!/usr/bin/env python3
"""Generates the 8x8, 9-frame fist pump in this folder (see
../../export_sprite.py for the formats). Same character as ../run-cycle-8x8."""
import os
import sys

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
from export_sprite import export  # noqa: E402

# Facing right. The player celebrating like Mario: a hop with one fist punched
# up in the air. Starts on the idle's first frame, crouches into the idle's low
# pose, springs up swinging the front fist up past the head, and hangs at the
# top with the fist high, the other fist pulled in at the chest and the back
# knee raised. Comes down with the fist still up, lands low and drops the arm,
# then rises with the knees bent as at the end of the standing jump, so it
# hands back to the idle's first frame. Play it once. The pose is drawn in
# place; the game can move the sprite up and down for the hop.
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
    # 2 knees bend, as in the standing jump
    """
    ....##..
    ....##..
    ....#...
    ...###..
    ..#.#.#.
    ....#...
    ...#.#..
    ..#...#.
    """,
    # 3 crouches low, as in the idle
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
    # 4 springs up: legs straighten, the front fist swings up past the head
    """
    ....##..
    ....##.#
    ....#.#.
    ...###..
    ..#.#...
    ...#.#..
    ...#.#..
    ...#.#..
    """,
    # 5 top of the hop: fist punched high, the other fist in at the chest, back knee up
    """
    .......#
    ....##.#
    ....##.#
    .#..###.
    ..##.#..
    ..####..
    ..#..#..
    .....#..
    """,
    # 6 coming down with the fist still up, the knee lowering
    """
    .......#
    ....##.#
    ....##.#
    .#..###.
    ..##.#..
    ....##..
    ...#.#..
    ...#.#..
    """,
    # 7 lands low, fist still up
    """
    ........
    .......#
    ....##.#
    ....##.#
    .#..###.
    ..##.#..
    ...#.#..
    ..#...#.
    """,
    # 8 the arm drops, low as in the idle
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
    # 9 rising with the knees still bent, as at the end of the standing jump; the idle's first frame follows
    """
    ....##..
    ....##..
    ....#...
    ...###..
    ..#.#.#.
    ....#...
    ...#.#..
    ..#...#.
    """,
]

# NTSC frames: 6, 4, 4, 4, 18, 4, 6, 4, 4
FRAME_MS = [100, 67, 67, 67, 300, 67, 100, 67, 67]

export(FRAMES, os.path.dirname(os.path.abspath(__file__)), 'fist-pump-8x8', 'fist-pump', 'fist-pump', frame_ms=FRAME_MS)
