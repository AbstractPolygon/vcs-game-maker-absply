#!/usr/bin/env python3
"""Generates the 8x8, 5-frame pike trap in this folder (see
../export_sprite.py for the formats). A prop, not the player."""
import os
import sys

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from export_sprite import export  # noqa: E402

# Pikes shooting out of the ground. Frame 1 is the warning: just the tips
# showing above the ground. Then four pikes burst out, fast: a tall one in the middle straight up
# to the top row, one either side leaning outward (stepping a pixel sideways
# halfway up) and a short one at the right edge. Every pike is one pixel thick
# with a clear column between them. They come out a beat apart, middle first,
# and the animation ends with all of them out. Play it once when the trap
# fires; to pull them back in, play it backwards.
FRAMES = [
    # 1 the tips just showing above the ground
    """
    ........
    ........
    ........
    ........
    ........
    ........
    ........
    .#.#.#.#
    """,
    # 2 the middle pike bursts out
    """
    ........
    ........
    ........
    ........
    ........
    ...#....
    ...#....
    .#.#.#.#
    """,
    # 3 shooting up
    """
    ........
    ........
    ...#....
    ...#....
    ...#....
    .#.#.#..
    .#.#.#..
    .#.#.#.#
    """,
    # 4 nearly out
    """
    ...#....
    ...#....
    ...#....
    #..#..#.
    #..#..#.
    .#.#.#..
    .#.#.#.#
    .#.#.#.#
    """,
    # 5 all the way out: the middle one to the top row
    """
    ...#....
    ...#....
    #..#..#.
    #..#..#.
    #..#..#.
    .#.#.#.#
    .#.#.#.#
    .#.#.#.#
    """,
]

# frame 1, the tips, is held for half a second (30 NTSC frames) before the
# pikes fire, then they shoot out at 2 NTSC frames a step
FRAME_MS = [500, 33, 33, 33, 33]

export(FRAMES, os.path.dirname(os.path.abspath(__file__)), 'pikes-8x8', 'pikes', 'pikes', frame_ms=FRAME_MS)
