#!/usr/bin/env python3
"""Generates the 8x16, 5-frame large spinning saw blade in this folder (see
../export_sprite.py for the formats). A prop, not the player, drawn to be shown
at double width (NUSIZ), so it appears 16x16 on screen."""
import os
import sys

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from export_sprite import export  # noqa: E402

# A bigger version of ../saw-blade-8x8, spinning clockwise. Each pixel is twice
# as wide as it is tall, so the blade is drawn as a circle 6 pixels wide and 12
# tall: round on screen, with a hole at the hub. 8 teeth stick out of the rim,
# which has 40 pixel positions around it; the teeth sit every 5th one, so each
# frame moves every tooth one position clockwise and after 5 frames the blade
# looks the same again.
FRAMES = [
    # 1 8 teeth around the rim
    """
    ........
    ....#...
    ..####..
    .#####.#
    .######.
    .######.
    .##..##.
    ###..##.
    .##..###
    .##..##.
    .######.
    .######.
    #.#####.
    ..####..
    ...#....
    ........
    """,
    # 2 teeth one step clockwise
    """
    ........
    .....#..
    .#####..
    ..####..
    .#######
    .######.
    ###..##.
    .##..##.
    .##..##.
    .##..###
    .######.
    #######.
    ..####..
    ..#####.
    ..#.....
    ........
    """,
    # 3 two steps
    """
    ........
    .#....#.
    ..####..
    ..####..
    .######.
    ########
    .##..##.
    .##..##.
    .##..##.
    .##..##.
    ########
    .######.
    ..####..
    ..####..
    .#....#.
    ........
    """,
    # 4 three steps
    """
    ........
    ..#.....
    ..#####.
    ..####..
    #######.
    .######.
    .##..###
    .##..##.
    .##..##.
    ###..##.
    .######.
    .#######
    ..####..
    .#####..
    .....#..
    ........
    """,
    # 5 four steps; the next step is frame 1 again
    """
    ........
    ...#....
    ..####..
    #.#####.
    .######.
    .######.
    .##..##.
    .##..###
    ###..##.
    .##..##.
    .######.
    .######.
    .#####.#
    ..####..
    ....#...
    ........
    """,
]

export(FRAMES, os.path.dirname(os.path.abspath(__file__)), 'saw-blade-large-8x16', 'saw_blade_large', 'saw-blade-large',
       frame_ms=50, pixel_width=2)
