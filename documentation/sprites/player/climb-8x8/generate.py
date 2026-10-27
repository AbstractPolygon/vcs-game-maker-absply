#!/usr/bin/env python3
"""Generates the 8x8, 12-frame ladder climb in this folder (see
../../export_sprite.py for the formats). Same character as ../run-cycle-8x8."""
import os
import sys

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
from export_sprite import export  # noqa: E402

# Climbing a ladder, seen from the front with the arms and legs either side
# of the body, like the fall. Made for a steady climb with no pauses: the hands
# and the feet take turns on every frame - one hand reaching up as the other
# pulls down, then a step of the feet - so something is always moving, and as
# a hand reaches the rung above the opposite knee is up at the next one. A full
# cycle (both hands, both feet) is 12 frames at 50 ms (3 NTSC frames), 0.6 s.
# Only the pose is drawn: the game moves the sprite up the ladder.
FRAMES = [
    # 1 right knee up
    """
    ....##..
    ..#.##..
    ...##...
    ....##..
    ....#.#.
    ....##..
    ...#..#.
    ...#....
    """,
    # 2 right hand up, left hand down
    """
    ....##..
    ....##..
    ..#.#...
    ...####.
    ....#...
    ....##..
    ...#..#.
    ...#....
    """,
    # 3 left knee up, right foot down
    """
    ....##..
    ....##..
    ..#.#...
    ...####.
    ....#...
    ....#...
    ..##.##.
    ........
    """,
    # 4 right hand up, left hand down
    """
    ....##..
    ....##..
    ....#.#.
    ..####..
    ....#...
    ....#...
    ..##.##.
    ........
    """,
    # 5 left knee up, right foot down
    """
    ....##..
    ....##..
    ....#.#.
    ..####..
    ....#...
    ...##...
    ..#..#..
    .....#..
    """,
    # 6 right hand up, left hand down
    """
    ....##..
    ....###.
    ....##..
    ...##...
    ..#.#...
    ...##...
    ..#..#..
    .....#..
    """,
    # 7 left foot down
    """
    ....##..
    ....###.
    ....##..
    ...##...
    ..#.#...
    ....#...
    ..##.#..
    .....#..
    """,
    # 8 left hand up, right hand down
    """
    ....##..
    ....##..
    ....#.#.
    ..####..
    ....#...
    ....#...
    ..##.#..
    .....#..
    """,
    # 9 left foot down
    """
    ....##..
    ....##..
    ....#.#.
    ..####..
    ....#...
    ....#...
    ...#.#..
    ...#.#..
    """,
    # 10 left hand up, right hand down
    """
    ....##..
    ....##..
    ..#.#...
    ...####.
    ....#...
    ....#...
    ...#.#..
    ...#.#..
    """,
    # 11 right knee up
    """
    ....##..
    ....##..
    ..#.#...
    ...####.
    ....#...
    ....#...
    ...#.##.
    ...#....
    """,
    # 12 left hand up, right hand down
    """
    ....##..
    ..#.##..
    ...##...
    ....##..
    ....#.#.
    ....#...
    ...#.##.
    ...#....
    """,
]
export(FRAMES, os.path.dirname(os.path.abspath(__file__)), 'climb-8x8', 'climb', 'climb', frame_ms=50)
