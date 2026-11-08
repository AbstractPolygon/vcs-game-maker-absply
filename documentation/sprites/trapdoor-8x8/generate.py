#!/usr/bin/env python3
"""Generates the 8x8, 7-frame trap door in this folder (see
../export_sprite.py for the formats). A level object, not the player, drawn to
be shown at double width (NUSIZ), so it appears 16x8 on screen."""
import os
import sys

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from export_sprite import export  # noqa: E402

# A trap door in the floor that opens in the middle: two leaves, each half the
# width (8 pixels on screen), hinged at the outer edges and meeting in the
# middle along the top row. When it fires they swing down, faster as they go,
# until they hang straight down from their hinges either side of the hole,
# bounce back up a little and drop again. Each leaf is the same length closed
# and open (8 pixels on screen across, 8 rows down). Play it once and hold the
# last frame; play it backwards to close it.
FRAMES = [
    # 1 closed: the two leaves meet in the middle
    """
    ########
    ........
    ........
    ........
    ........
    ........
    ........
    ........
    """,
    # 2 the leaves drop open from the middle
    """
    ##....##
    .######.
    ...##...
    ........
    ........
    ........
    ........
    ........
    """,
    # 3 swinging down
    """
    #......#
    ##....##
    .#....#.
    .##..##.
    ..#..#..
    ..####..
    ........
    ........
    """,
    # 4 nearly down
    """
    #......#
    #......#
    #......#
    ##....##
    .#....#.
    .#....#.
    .#....#.
    .#....#.
    """,
    # 5 hanging straight down from their hinges
    """
    #......#
    #......#
    #......#
    #......#
    #......#
    #......#
    #......#
    #......#
    """,
    # 6 bouncing back up a little
    """
    #......#
    #......#
    #......#
    #......#
    #......#
    #......#
    #......#
    ##....##
    """,
    # 7 open
    """
    #......#
    #......#
    #......#
    #......#
    #......#
    #......#
    #......#
    #......#
    """,
]

# NTSC frames: 6, 2, 2, 2, 3, 3, 6
FRAME_MS = [100, 33, 33, 33, 50, 50, 100]

export(FRAMES, os.path.dirname(os.path.abspath(__file__)), 'trapdoor-8x8', 'trapdoor', 'trapdoor',
       frame_ms=FRAME_MS, pixel_width=2)
