#!/usr/bin/env python3
"""Generates the 8x8, 21-frame landing on pikes in this folder (see
../../export_sprite.py for the formats). Same character as ../run-cycle-8x8."""
import os
import sys

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
from export_sprite import export  # noqa: E402

# Facing right. The player falls onto the pikes and is stuck on them, for a
# death, lined up with the pikes sprite (../../pikes-8x8) all the way out: draw
# the player at the same place as the pikes. Starts on the fall loop's first
# frame. On impact the player is speared through the hips by the tall middle
# pike, folded over it with the head and feet flung up, bounces up the pike
# and drops back, then sags: the legs come to rest on the left pike's tip, the
# shoulders and head on the right one's, and the body hangs between them on the
# middle pike, which sticks up through it. An arm hangs down between the pikes
# and swings right back, then right forward, the hand out past the right pike,
# then a smaller swing back before it settles. Overlapping the arm as it slows,
# one leg slips off the left pike's tip and swings down between the pikes,
# hanging its full length (4 pixels), forward, back and forward a little,
# settling after the arm; then the other leg twitches, a foot flicks and it
# goes still. The pikes sprite shows through where they cross.
FRAMES = [
    # 1 falling, as in the fall loop
    """
    ....##..
    ....##..
    ..#.#.#.
    ...###..
    ....#...
    ....#...
    ...#.#..
    ..#...#.
    """,
    # 2 lands on the pikes: speared through the hips on the tall middle one, head and feet flung up
    """
    #.....##
    .#...###
    ..#.##..
    ...#....
    ........
    ........
    ........
    ........
    """,
    # 3 bounces up the pike
    """
    ##....##
    ..#..###
    ...###..
    ........
    ........
    ........
    ........
    ........
    """,
    # 4 drops back onto it
    """
    #.....##
    .#...###
    ..#.##..
    ...#....
    ........
    ........
    ........
    ........
    """,
    # 5 sags, head and legs dropping onto the pikes either side
    """
    ......##
    #....###
    .#..##..
    ..##....
    ........
    ........
    ........
    ........
    """,
    # 6 draped across the pikes, the arm already swinging back as it drops
    """
    ......##
    #.....##
    .#...#..
    ..####..
    ....#...
    ........
    ........
    ........
    """,
    # 7 right back
    """
    ......##
    #.....##
    .#...#..
    ..###...
    ....#...
    ........
    ........
    ........
    """,
    # 8 swinging forward
    """
    ......##
    #.....##
    .#...#..
    ..####..
    ....#...
    ........
    ........
    ........
    """,
    # 9 through the bottom of the swing
    """
    ......##
    #.....##
    .#...#..
    ..####..
    .....#..
    ........
    ........
    ........
    """,
    # 10 swinging forward, in front of the pike
    """
    ......##
    #.....##
    .#...#..
    ..####..
    ......#.
    ........
    ........
    ........
    """,
    # 11 right forward, the hand out past the pike
    """
    ......##
    #.....##
    .#...#..
    ..###.##
    ........
    ........
    ........
    ........
    """,
    # 12 swinging back; one leg starts to slip off the left pike's tip
    """
    ......##
    #.....##
    .#...#..
    .#####..
    ......#.
    ........
    ........
    ........
    """,
    # 13 the arm through the bottom; the leg drops down between the pikes
    """
    ......##
    #.....##
    .#...#..
    .#####..
    .#...#..
    ..#.....
    ........
    ........
    """,
    # 14 a smaller swing back; the leg swings on, forward, the foot lifting
    """
    ......##
    #.....##
    .#...#..
    .#####..
    ..#.#...
    ..#.....
    ........
    ........
    """,
    # 15 the arm settling; the leg swings back, hanging full length
    """
    ......##
    #.....##
    .#...#..
    .#####..
    .#...#..
    ..#.....
    ..#.....
    ........
    """,
    # 16 the arm still; the leg swings forward a little
    """
    ......##
    #.....##
    .#...#..
    .#####..
    ..#..#..
    ..#.....
    ........
    ........
    """,
    # 17 both hang limp
    """
    ......##
    #.....##
    .#...#..
    .#####..
    ..#..#..
    ..#.....
    ..#.....
    ........
    """,
    # 18 the other leg twitches up
    """
    #.....##
    .#....##
    .#...#..
    .#####..
    ..#..#..
    ..#.....
    ..#.....
    ........
    """,
    # 19 limp
    """
    ......##
    #.....##
    .#...#..
    .#####..
    ..#..#..
    ..#.....
    ..#.....
    ........
    """,
    # 20 a last flick of the foot
    """
    #.....##
    #.....##
    .#...#..
    .#####..
    ..#..#..
    ..#.....
    ..#.....
    ........
    """,
    # 21 still
    """
    ......##
    #.....##
    .#...#..
    .#####..
    ..#..#..
    ..#.....
    ..#.....
    ........
    """,
]

# NTSC frames: 4, 4, 3, 3, 3, 3, 3, 3, 3, 3, 5, 3, 3, 4, 4, 6, 8, 3, 8, 3, 18
FRAME_MS = [67, 67, 50, 50, 50, 50, 50, 50, 50, 50, 83, 50, 50, 67, 67, 100, 133, 50, 133, 50, 300]

export(FRAMES, os.path.dirname(os.path.abspath(__file__)), 'pikes-hit-8x8', 'pikes_hit', 'pikes-hit', frame_ms=FRAME_MS)
