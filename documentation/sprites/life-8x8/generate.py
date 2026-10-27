#!/usr/bin/env python3
"""Generates the 8x8, 14-frame spinning, pulsing extra life pickup in this
folder (see ../export_sprite.py for the formats). A prop, not the player."""
import os
import sys

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from export_sprite import export  # noqa: E402

# A solid square spinning clockwise in place inside the 8x8 area, at full size
# for most of the turn, with a quick pulse each time it comes upright: it
# shrinks to a 4x4 square and springs back to full size, still turning. Each
# frame is the square drawn at its angle and size from one edge turned about
# the centre and filled in, so it stays exactly symmetrical. A square looks the
# same every quarter turn, so the loop is 90 degrees of the spin and one pulse;
# each frame is held for as long as the spin takes to pass through it.
FRAMES = [
    # 1 full size, turning
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
    # 2 turning
    """
    ..#.....
    ..####..
    .#######
    .######.
    .######.
    #######.
    ..####..
    .....#..
    """,
    # 3 turning
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
    # 4 turning
    """
    ..###...
    ..####..
    .#######
    ########
    ########
    #######.
    ..####..
    ...###..
    """,
    # 5 turning
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
    # 6 turning
    """
    ...###..
    ..####..
    #######.
    ########
    ########
    .#######
    ..####..
    ..###...
    """,
    # 7 turning
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
    # 8 turning
    """
    .....#..
    ..####..
    #######.
    .######.
    .######.
    .#######
    ..####..
    ..#.....
    """,
    # 9 the pulse starts: shrinking as it comes upright
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
    # 10 shrinking
    """
    ........
    ..####..
    .######.
    .######.
    .######.
    .######.
    ..####..
    ........
    """,
    # 11 shrinking
    """
    ........
    ....##..
    .#####..
    .#####..
    ..#####.
    ..#####.
    ..##....
    ........
    """,
    # 12 smallest, upright
    """
    ........
    ........
    ..####..
    ..####..
    ..####..
    ..####..
    ........
    ........
    """,
    # 13 growing back
    """
    ........
    ..##....
    ..#####.
    ..#####.
    .#####..
    .#####..
    ....##..
    ........
    """,
    # 14 back to full size
    """
    ........
    ..####..
    .######.
    .######.
    .######.
    .######.
    ..####..
    ........
    """,
]

# NTSC frames: 1, 1, 3, 1, 5, 1, 3, 1, 1, 1, 1, 3, 1, 1 (a quarter turn in 24)
FRAME_MS = [17, 17, 50, 17, 83, 17, 50, 17, 17, 17, 17, 50, 17, 17]

export(FRAMES, os.path.dirname(os.path.abspath(__file__)), 'life-8x8', 'life', 'life', frame_ms=FRAME_MS)
