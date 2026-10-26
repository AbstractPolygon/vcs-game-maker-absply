#!/usr/bin/env python3
"""Generates the 8x8, 12-frame trampoline bounce in this folder (see
../export_sprite.py for the formats). A prop, not the player."""
import os
import sys

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from export_sprite import export  # noqa: E402

# Side view of a trampoline: the bed spans the top between two legs with feet.
# Frame 1 is the trampoline at rest, to show while nothing is on it. When the
# player lands, the bed slams to its deepest stretch in one frame and flings up
# 2 pixels past flat on the next, so the player is launched almost at once.
# It then eases back down to flat and settles with a smaller dip and a last
# flick. The frame and legs never move; only the bed does. Launch the player on frame 3,
# the top of the fling.
FRAMES = [
    # 1 bed flat at rest (landing)
    """
    ........
    ........
    ........
    ########
    #......#
    #......#
    #......#
    ##....##
    """,
    # 2 impact: bed slams to its deepest stretch
    """
    ........
    ........
    ........
    #......#
    ##....##
    #.#..#.#
    #..##..#
    ##....##
    """,
    # 3 launch: bed flings up 2 pixels past flat
    """
    ........
    ..####..
    .#....#.
    #......#
    #......#
    #......#
    #......#
    ##....##
    """,
    # 4 coming back down
    """
    ........
    ........
    ..####..
    ##....##
    #......#
    #......#
    #......#
    ##....##
    """,
    # 5 almost flat
    """
    ........
    ........
    ...##...
    ###..###
    #......#
    #......#
    #......#
    ##....##
    """,
    # 6 flat
    """
    ........
    ........
    ........
    ########
    #......#
    #......#
    #......#
    ##....##
    """,
    # 7 smaller second dip
    """
    ........
    ........
    ........
    ###..###
    #..##..#
    #......#
    #......#
    ##....##
    """,
    # 8 second dip bottom
    """
    ........
    ........
    ........
    ##....##
    #.####.#
    #......#
    #......#
    ##....##
    """,
    # 9 coming back up
    """
    ........
    ........
    ........
    ###..###
    #..##..#
    #......#
    #......#
    ##....##
    """,
    # 10 flat
    """
    ........
    ........
    ........
    ########
    #......#
    #......#
    #......#
    ##....##
    """,
    # 11 last small flick up
    """
    ........
    ........
    ...##...
    ###..###
    #......#
    #......#
    #......#
    ##....##
    """,
    # 12 settled at rest
    """
    ........
    ........
    ........
    ########
    #......#
    #......#
    #......#
    ##....##
    """,
]

export(FRAMES, os.path.dirname(os.path.abspath(__file__)), 'trampoline-8x8', 'trampoline', 'trampoline', frame_ms=50)
