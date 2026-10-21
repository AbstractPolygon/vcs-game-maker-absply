#!/usr/bin/env python3
"""Generates the 8x8, 24-frame falling loop in this folder (see ../export_sprite.py for
the formats). Same character as ../run-cycle-8x8."""
import os
import sys

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from export_sprite import export  # noqa: E402

# Facing right, dropping, as a very smooth loop. Both arms move together as
# mirror images, sweeping from straight up, out, down low and back up with no
# pauses, while the legs pedal gently - one foot moving one pixel at a time.
# The arms and the feet take turns, so each frame changes just one thing.
# 24 frames, 50 ms (3 NTSC frames) each: 1.2 s per loop. Like the other
# animations, the fall itself comes from moving the sprite down in the game.
# Its first frame is ../fall-start-8x8's last.
FRAMES = [
    # 1 arms up, front foot down, back foot out
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
    # 2 arms up, front foot up, back foot out
    """
    ........
    ....##..
    .#..##.#
    ..#.#.#.
    ...###..
    ....#...
    ...#.##.
    ..#.....
    """,
    # 3 arms upout, front foot up, back foot out
    """
    ........
    ....##..
    ....##..
    .##.#.##
    ...###..
    ....#...
    ...#.##.
    ..#.....
    """,
    # 4 arms upout, front foot up, back foot in
    """
    ........
    ....##..
    ....##..
    .##.#.##
    ...###..
    ....#...
    ...#.##.
    ...#....
    """,
    # 5 arms out, front foot up, back foot in
    """
    ........
    ....##..
    ....##..
    .#..#..#
    ..#####.
    ....#...
    ...#.##.
    ...#....
    """,
    # 6 arms out, front foot down, back foot in
    """
    ........
    ....##..
    ....##..
    .#..#..#
    ..#####.
    ....#...
    ...#.#..
    ...#..#.
    """,
    # 7 arms low, front foot down, back foot in
    """
    ........
    ....##..
    ....##..
    ....#...
    .#######
    ....#...
    ...#.#..
    ...#..#.
    """,
    # 8 arms low, front foot down, back foot out
    """
    ........
    ....##..
    ....##..
    ....#...
    .#######
    ....#...
    ...#.#..
    ..#...#.
    """,
    # 9 arms out, front foot down, back foot out
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
    # 10 arms out, front foot up, back foot out
    """
    ........
    ....##..
    ....##..
    .#..#..#
    ..#####.
    ....#...
    ...#.##.
    ..#.....
    """,
    # 11 arms upout, front foot up, back foot out
    """
    ........
    ....##..
    ....##..
    .##.#.##
    ...###..
    ....#...
    ...#.##.
    ..#.....
    """,
    # 12 arms upout, front foot up, back foot in
    """
    ........
    ....##..
    ....##..
    .##.#.##
    ...###..
    ....#...
    ...#.##.
    ...#....
    """,
    # 13 arms up, front foot up, back foot in
    """
    ........
    ....##..
    .#..##.#
    ..#.#.#.
    ...###..
    ....#...
    ...#.##.
    ...#....
    """,
    # 14 arms up, front foot down, back foot in
    """
    ........
    ....##..
    .#..##.#
    ..#.#.#.
    ...###..
    ....#...
    ...#.#..
    ...#..#.
    """,
    # 15 arms upout, front foot down, back foot in
    """
    ........
    ....##..
    ....##..
    .##.#.##
    ...###..
    ....#...
    ...#.#..
    ...#..#.
    """,
    # 16 arms upout, front foot down, back foot out
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
    # 17 arms out, front foot down, back foot out
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
    # 18 arms out, front foot up, back foot out
    """
    ........
    ....##..
    ....##..
    .#..#..#
    ..#####.
    ....#...
    ...#.##.
    ..#.....
    """,
    # 19 arms low, front foot up, back foot out
    """
    ........
    ....##..
    ....##..
    ....#...
    .#######
    ....#...
    ...#.##.
    ..#.....
    """,
    # 20 arms low, front foot up, back foot in
    """
    ........
    ....##..
    ....##..
    ....#...
    .#######
    ....#...
    ...#.##.
    ...#....
    """,
    # 21 arms out, front foot up, back foot in
    """
    ........
    ....##..
    ....##..
    .#..#..#
    ..#####.
    ....#...
    ...#.##.
    ...#....
    """,
    # 22 arms out, front foot down, back foot in
    """
    ........
    ....##..
    ....##..
    .#..#..#
    ..#####.
    ....#...
    ...#.#..
    ...#..#.
    """,
    # 23 arms upout, front foot down, back foot in
    """
    ........
    ....##..
    ....##..
    .##.#.##
    ...###..
    ....#...
    ...#.#..
    ...#..#.
    """,
    # 24 arms upout, front foot down, back foot out
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
]
export(FRAMES, os.path.dirname(os.path.abspath(__file__)), 'fall-8x8', 'fall', 'fall', frame_ms=50)
