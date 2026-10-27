#!/usr/bin/env python3
"""Generates the 8x8, 8-frame looping fireball in this folder (see
../export_sprite.py for the formats). A hazard, not the player."""
import os
import sys

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from export_sprite import export  # noqa: E402

# A fireball flying to the right: a round ball of fire whose edge wobbles,
# with a ragged trail of flame streaming back from it to a point. The trail
# waves up and down and its ragged edge is carried backwards a pixel a frame,
# and embers break off its tip and drift away behind, so it looks like it's
# rushing forward even when the sprite stays still. Loops every 8 frames;
# flip it to fly left.
FRAMES = [
    # 1
    """
    ........
    ........
    ...####.
    .#######
    ..######
    ..#####.
    .....#..
    ........
    """,
    # 2
    """
    ........
    .....##.
    ...####.
    .#######
    ..######
    .#.####.
    .....#..
    ........
    """,
    # 3
    """
    ........
    .....##.
    ...####.
    .#######
    ########
    ...####.
    ........
    ........
    """,
    # 4
    """
    ........
    ....##..
    ...####.
    ..######
    .#######
    ...####.
    ........
    ........
    """,
    # 5
    """
    ........
    ....##..
    ...#####
    ..######
    .#######
    ...####.
    ........
    ........
    """,
    # 6
    """
    ........
    ....##..
    ...#####
    ..######
    .#.#####
    #.#.####
    ........
    ........
    """,
    # 7
    """
    ........
    ....##..
    ...#####
    .#######
    ...#####
    .#..####
    ........
    ........
    """,
    # 8 (loops back to 1)
    """
    ........
    ....#...
    ...#####
    .#######
    ...#####
    #..####.
    .....#..
    ........
    """,
]

export(FRAMES, os.path.dirname(os.path.abspath(__file__)), 'fireball-8x8', 'fireball', 'fireball', frame_ms=50)
