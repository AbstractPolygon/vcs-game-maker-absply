#!/usr/bin/env python3
"""Generates the 8x8, 8-frame spinning cannonball loop in this folder (see ../../export_sprite.py for
the formats). Same character as ../run-cycle-8x8."""
import os
import sys

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
from export_sprite import export  # noqa: E402

# Facing right. The cannonball jump's curled-up ball rolling forward through a
# full turn, 45 degrees a frame, centred so it spins in place. Loop it while
# the player is in the air, e.g. between the cannonball jump's frames 4 and 6.
FRAMES = [
    # 1 ball upright, head on top
    """
    ........
    ....##..
    ...###..
    ..#...#.
    ..#..##.
    ..#.##..
    ...###..
    ........
    """,
    # 2 rolled 45 degrees forward
    """
    ........
    ........
    ...####.
    ..#.###.
    .#...##.
    .#..##..
    ..###...
    ........
    """,
    # 3 head facing forward
    """
    ........
    ........
    ..###...
    .#...#..
    .##..##.
    .###.##.
    ...##...
    ........
    """,
    # 4 rolled 135 degrees
    """
    ........
    ..##....
    .#..#...
    .#...#..
    .##.##..
    ..####..
    ...###..
    ........
    """,
    # 5 upside down
    """
    ........
    ..###...
    ..##.#..
    .##..#..
    .#...#..
    ..###...
    ..##....
    ........
    """,
    # 6 rolled 225 degrees
    """
    ........
    ...###..
    ..##..#.
    .##...#.
    .###.#..
    .####...
    ........
    ........
    """,
    # 7 head facing back
    """
    ........
    ...##...
    .##.###.
    .##..##.
    ..#...#.
    ...###..
    ........
    ........
    """,
    # 8 rolled 315 degrees, back to upright next
    """
    ........
    ..###...
    ..####..
    ..##.##.
    ..#...#.
    ...#..#.
    ....##..
    ........
    """,
]
export(FRAMES, os.path.dirname(os.path.abspath(__file__)), 'cannonball-loop-8x8', 'cannonball_loop', 'cannonball-loop', frame_ms=67)
