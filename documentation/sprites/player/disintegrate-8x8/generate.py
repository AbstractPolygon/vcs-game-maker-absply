#!/usr/bin/env python3
"""Generates the 8x8, 15-frame disintegration in this folder (see
../../export_sprite.py for the formats). Same character as ../run-cycle-8x8."""
import os
import sys

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
from export_sprite import export  # noqa: E402

# The player turning to ash and crumbling into a pile, for a death. Starts on
# the idle's first frame. Like a cartoon, the body stays exactly where it is
# while it crumbles from the bottom up, two grains a frame: everything above
# keeps hanging in place until the ash beneath it has gone, and the head drops
# last. Ash falls a row a frame and slides outward down the pile; where there's
# no room it packs into the ash below, so the pile stays a small mound 6 pixels
# wide on the bottom row. No grain moves more than one pixel a frame.
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
    # 2 the feet crumble to ash
    """
    ....##..
    ....##..
    ....#...
    ...###..
    ..#.#.#.
    ...#.#..
    ........
    .##..##.
    """,
    # 3 the shins crumble; the rest stays standing
    """
    ....##..
    ....##..
    ....#...
    ...###..
    ..#.#.#.
    ........
    ...#.#..
    .##..##.
    """,
    # 4 the knees go
    """
    ....##..
    ....##..
    ....#...
    ...###..
    ....#...
    ..#...#.
    ........
    .######.
    """,
    # 5 the hips go, the body still hanging in place
    """
    ....##..
    ....##..
    ....#...
    ...###..
    ........
    ....#...
    ..#...#.
    .######.
    """,
    # 6 the arms crumble away
    """
    ....##..
    ....##..
    ....#...
    ...#....
    ....##..
    ........
    ..#.#...
    .######.
    """,
    # 7 the chest goes
    """
    ....##..
    ....##..
    ....#...
    ........
    ...#....
    ....##..
    ..#.#...
    .######.
    """,
    # 8 the neck goes
    """
    ....##..
    ....##..
    ........
    ....#...
    ........
    ...#....
    ..####..
    .######.
    """,
    # 9 the head is left hanging, then drops
    """
    ....##..
    ........
    ....##..
    ........
    ....#...
    ...#....
    ..####..
    .######.
    """,
    # 10 falling
    """
    ........
    ....##..
    ........
    ....##..
    ........
    ...##...
    ..####..
    .######.
    """,
    # 11 falling
    """
    ........
    ........
    ....##..
    ........
    ....##..
    ...##...
    ..####..
    .######.
    """,
    # 12 the head lands
    """
    ........
    ........
    ........
    ....##..
    ........
    ...###..
    ..####..
    .######.
    """,
    # 13 the last ash slides down
    """
    ........
    ........
    ........
    ........
    ....##..
    ...##...
    ..####..
    .######.
    """,
    # 14 packing down
    """
    ........
    ........
    ........
    ........
    ........
    ...###..
    ..####..
    .######.
    """,
    # 15 settled into a pile of ash
    """
    ........
    ........
    ........
    ........
    ........
    ...##...
    ..####..
    .######.
    """,
]

export(FRAMES, os.path.dirname(os.path.abspath(__file__)), 'disintegrate-8x8', 'disintegrate', 'disintegrate', frame_ms=33)
