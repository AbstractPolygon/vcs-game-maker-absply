#!/usr/bin/env python3
"""Generates the 8x8, 12-frame falling loop in this folder (see ../export_sprite.py for
the formats). Same character as ../run-cycle-8x8."""
import os
import sys

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from export_sprite import export  # noqa: E402

# Facing right, dropping, as a smooth loop. The body is mirrored: both arms
# move together, sweeping from straight up, out, down low and back up, and both
# legs move together, kicking the feet up, down, tucking them in and back out.
# The arms flap twice as fast as the legs kick - they step every frame, the
# feet every third frame. 12 frames, 50 ms (3 NTSC frames) each: 0.6 s per
# loop. Like the other animations, the fall itself comes from moving the sprite
# down in the game. Its first frame is ../fall-start-8x8's last.
FRAMES = [
    # 1 arms up, feet out
    """
    ........
    ....##..
    .#..##.#
    ..#.#.#.
    ...###..
    ....#...
    ...#.#..
    ..#...#.
    """,
    # 2 arms upout, feet out
    """
    ........
    ....##..
    ....##..
    .##.#.##
    ...###..
    ....#...
    ...#.#..
    ..#...#.
    """,
    # 3 arms out, feet out
    """
    ........
    ....##..
    ....##..
    .#..#..#
    ..#####.
    ....#...
    ...#.#..
    ..#...#.
    """,
    # 4 arms low, feet kick up
    """
    ........
    ....##..
    ....##..
    ....#...
    .#######
    ....#...
    ..##.##.
    ........
    """,
    # 5 arms out, feet kick up
    """
    ........
    ....##..
    ....##..
    .#..#..#
    ..#####.
    ....#...
    ..##.##.
    ........
    """,
    # 6 arms upout, feet kick up
    """
    ........
    ....##..
    ....##..
    .##.#.##
    ...###..
    ....#...
    ..##.##.
    ........
    """,
    # 7 arms up, feet out
    """
    ........
    ....##..
    .#..##.#
    ..#.#.#.
    ...###..
    ....#...
    ...#.#..
    ..#...#.
    """,
    # 8 arms upout, feet out
    """
    ........
    ....##..
    ....##..
    .##.#.##
    ...###..
    ....#...
    ...#.#..
    ..#...#.
    """,
    # 9 arms out, feet out
    """
    ........
    ....##..
    ....##..
    .#..#..#
    ..#####.
    ....#...
    ...#.#..
    ..#...#.
    """,
    # 10 arms low, feet tuck in
    """
    ........
    ....##..
    ....##..
    ....#...
    .#######
    ....#...
    ...#.#..
    ...#.#..
    """,
    # 11 arms out, feet tuck in
    """
    ........
    ....##..
    ....##..
    .#..#..#
    ..#####.
    ....#...
    ...#.#..
    ...#.#..
    """,
    # 12 arms upout, feet tuck in
    """
    ........
    ....##..
    ....##..
    .##.#.##
    ...###..
    ....#...
    ...#.#..
    ...#.#..
    """,
]
export(FRAMES, os.path.dirname(os.path.abspath(__file__)), 'fall-8x8', 'fall', 'fall', frame_ms=50)
