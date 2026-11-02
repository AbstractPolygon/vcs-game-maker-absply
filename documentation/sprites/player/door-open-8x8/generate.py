#!/usr/bin/env python3
"""Generates the 8x8, 8-frame door opening in this folder (see
../../export_sprite.py for the formats). Same character as ../run-cycle-8x8."""
import os
import sys

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
from export_sprite import export  # noqa: E402

# Facing right, dramatically throwing open a door just past the right edge.
# Reaches out quickly and grabs the handle, leans right back to wind up, then
# lunges forward and flings the door away, the arm following through up high,
# and holds a wide-legged ta-da pose before settling back into the idle. Only
# the player is drawn: the game draws the door and swaps it to open on frame 5.
# Starts and ends on the idle's first frame.
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
    # 2 turns side-on and reaches for the handle
    """
    ....##..
    ....##..
    ....#...
    ....###.
    ....#...
    ...#.#..
    ..#..#..
    ..#...#.
    """,
    # 3 grabs the handle at the door's edge
    """
    ....##..
    ....##..
    ....#...
    ....####
    ....#...
    ...#.#..
    ..#..#..
    ..#...#.
    """,
    # 4 winds up: leans right back on the back foot, arm stretched to the handle
    """
    ...##...
    ...##...
    ...#....
    ...#####
    ...#....
    ...#.#..
    ..#..#..
    ..#...#.
    """,
    # 5 throws it: lunges forward, the front arm shoves the door away (the door opens)
    """
    .....##.
    .....##.
    ....#...
    ..######
    ...#....
    ...###..
    ..#...#.
    .#....#.
    """,
    # 6 follows through: the front arm flung up high after the door, the back arm swung back
    """
    ....##.#
    ....##.#
    ....#.#.
    ..####..
    .#..#...
    ...#.#..
    ..#...#.
    .#.....#
    """,
    # 7 ta-da: arms flung out wide, wide-legged stance, held
    """
    ....##..
    ....##..
    .#..#..#
    ..#####.
    ....#...
    ...#.#..
    ..#...#.
    .#.....#
    """,
    # 8 settles: arms drop, feet come back in
    """
    ....##..
    ....##..
    ....#...
    ...###..
    ..#.#.#.
    ...#.#..
    ..#...#.
    ..#...#.
    """,
    # 9 standing again, as in the idle
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
]

# NTSC frames: 4, 3, 3, 9 (wind-up), 2 (the throw), 4, 24 (held), 6, 6
FRAME_MS = [67, 50, 50, 150, 33, 67, 400, 100, 100]

export(FRAMES, os.path.dirname(os.path.abspath(__file__)), 'door-open-8x8', 'door_open', 'door-open', frame_ms=FRAME_MS)
