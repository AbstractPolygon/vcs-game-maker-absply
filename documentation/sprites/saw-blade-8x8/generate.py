#!/usr/bin/env python3
"""Generates the 8x8, 4-frame spinning saw blade in this folder (see
../export_sprite.py for the formats). A prop, not the player."""
import os
import sys

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from export_sprite import export  # noqa: E402

# A circular saw blade spinning clockwise: a round blade with a hole at the hub
# and 5 single-pixel teeth sticking out of the rim. The rim has 20 pixel
# positions around it and the teeth sit every 4th one, so each frame moves every
# tooth one position clockwise and after 4 frames the blade looks the same
# again.
FRAMES = [
    # 1 5 teeth around the rim
    """
    ..#.....
    ..#####.
    .######.
    .##..##.
    ###..##.
    .#######
    ..####..
    ...#....
    """,
    # 2 teeth one step clockwise
    """
    ...#....
    ..####..
    .#######
    ###..##.
    .##..##.
    .######.
    ..#####.
    ..#.....
    """,
    # 3 two steps
    """
    ....#...
    ..####..
    #######.
    .##..###
    .##..##.
    .######.
    .#####..
    .....#..
    """,
    # 4 three steps; the next step is frame 1 again
    """
    .....#..
    .#####..
    .######.
    .##..##.
    .##..###
    #######.
    ..####..
    ....#...
    """,
]

export(FRAMES, os.path.dirname(os.path.abspath(__file__)), 'saw-blade-8x8', 'saw_blade', 'saw-blade', frame_ms=50)
