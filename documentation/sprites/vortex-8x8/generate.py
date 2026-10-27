#!/usr/bin/env python3
"""Generates the 8x8, 12-frame swirling vortex in this folder (see
../export_sprite.py for the formats). A hazard, not the player."""
import os
import sys

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from export_sprite import export  # noqa: E402

# A swirling vortex hazard: two spiral arms winding in to a solid eye in the
# middle, inside a round 8x8 area. The arms turn a little each frame, so the
# swirl looks like it's drawing everything in towards the eye. Two arms look
# the same every half turn, so the 12 frames are half a turn and loop
# seamlessly. Every frame is different.
FRAMES = [
    # 1
    """
    ...###..
    .....##.
    ..##..#.
    .#.##.#.
    .#.##.#.
    .#..##..
    .##.....
    ..###...
    """,
    # 2
    """
    ....##..
    ......#.
    ..###.##
    .#.##.#.
    .#.##.#.
    ##.###..
    .#......
    ..##....
    """,
    # 3
    """
    .....#..
    ......#.
    .####.##
    .#.##.##
    ##.##.#.
    ##.####.
    .#......
    ..#.....
    """,
    # 4
    """
    ........
    ......#.
    .##.#..#
    ##.##..#
    #..##.##
    #..#.##.
    .#......
    ........
    """,
    # 5
    """
    ........
    ..##....
    ###.#..#
    #..##..#
    #..##..#
    #..#.###
    ....##..
    ........
    """,
    # 6
    """
    ........
    .####...
    ##..#..#
    #..###.#
    #.###..#
    #..#..##
    ...####.
    ........
    """,
    # 7
    """
    ........
    .####...
    ##...#..
    #..###.#
    #.###..#
    ..#...##
    ...####.
    ........
    """,
    # 8
    """
    ..#.....
    .####...
    #....#..
    #.####..
    ..####.#
    ..#....#
    ...####.
    .....#..
    """,
    # 9
    """
    ..##....
    .#####..
    #....#..
    ..####..
    ..####..
    ..#....#
    ..#####.
    ....##..
    """,
    # 10
    """
    ..###...
    .#..##..
    .....#..
    ..###...
    ...###..
    ..#.....
    ..##..#.
    ...###..
    """,
    # 11
    """
    ..####..
    .....#..
    .....##.
    ..###.#.
    .#.###..
    .##.....
    ..#.....
    ..####..
    """,
    # 12 (loops back to 1)
    """
    ..####..
    .....##.
    ...#..#.
    .####.#.
    .#.####.
    .#..#...
    .##.....
    ..####..
    """,
]

export(FRAMES, os.path.dirname(os.path.abspath(__file__)), 'vortex-8x8', 'vortex', 'vortex', frame_ms=50)
