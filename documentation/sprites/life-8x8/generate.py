#!/usr/bin/env python3
"""Generates the 8x8, 6-frame spinning extra life pickup in this folder (see
../export_sprite.py for the formats). A prop, not the player."""
import os
import sys

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from export_sprite import export  # noqa: E402

# A solid square spinning in place inside the 8x8 area, turning clockwise.
# Each frame is the square drawn at a given angle: one edge from corner to
# corner, turned about the centre to make the other three, then filled in, so
# every frame is exactly symmetrical and the corners never leave the 8x8. A square looks the
# same every quarter turn, so these frames are 90 degrees of the spin and the
# loop keeps turning. At this size only 6 different pictures come out of the
# quarter turn; each is held for as long as the spin takes to pass through it,
# so the speed stays even.
FRAMES = [
    # 1 square, upright
    """
    ........
    .######.
    .######.
    .######.
    .######.
    .######.
    .######.
    ........
    """,
    # 2 turned 15 degrees
    """
    ..#.....
    .######.
    .#######
    .######.
    .######.
    #######.
    .######.
    .....#..
    """,
    # 3 turned about 25 degrees
    """
    ..##....
    ..####..
    .#######
    .#######
    #######.
    #######.
    ..####..
    ....##..
    """,
    # 4 on its point, 45 degrees
    """
    ...##...
    ..####..
    .######.
    ########
    ########
    .######.
    ..####..
    ...##...
    """,
    # 5 turned about 65 degrees
    """
    ....##..
    ..####..
    #######.
    #######.
    .#######
    .#######
    ..####..
    ..##....
    """,
    # 6 turned 75 degrees; the next turn is frame 1 again
    """
    .....#..
    .######.
    #######.
    .######.
    .######.
    .#######
    .######.
    ..#.....
    """,
]

# NTSC frames: 6, 2, 4, 6, 4, 2 (a quarter turn in 24)
FRAME_MS = [100, 33, 67, 100, 67, 33]

export(FRAMES, os.path.dirname(os.path.abspath(__file__)), 'life-8x8', 'life', 'life', frame_ms=FRAME_MS)
