#!/usr/bin/env python3
"""Generates the 8x8, 14-frame ladder climb in this folder (see
../export_sprite.py for the formats). Same character as ../run-cycle-8x8."""
import os
import sys

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from export_sprite import export  # noqa: E402

# Climbing a ladder, seen from the front with the arms and legs either side
# of the body, like the fall. The hands move together, one reaching up as the
# other pulls down, then the feet step: as a hand reaches the rung above, the
# opposite knee comes up to the next rung. Every frame moves just one part by
# one step, so the climb is smooth; a full cycle (both hands, both feet) is
# 14 frames at 50 ms (3 NTSC frames), 0.7 s. Only the pose is drawn: the game
# moves the sprite up the ladder.
FRAMES = [
    # 1 left hand on the rung above, right knee up
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
    # 2 right hand reaches up, left hand pulls down
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
    # 3 right hand reaches up, left hand pulls down
    """
    ....##..
    ....##..
    ....#.#.
    ..####..
    ....#...
    ....##..
    ...#..#.
    ...#....
    """,
    # 4 right foot steps down
    """
    ....##..
    ....##..
    ....#.#.
    ..####..
    ....#...
    ....#...
    ...#.##.
    ...#....
    """,
    # 5 right foot steps down
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
    # 6 left knee comes up
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
    # 7 right hand reaches up, left hand pulls down
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
    # 8 left knee comes up
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
    # 9 left hand reaches up, right hand pulls down
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
    # 10 left hand reaches up, right hand pulls down
    """
    ....##..
    ....##..
    ..#.#...
    ...####.
    ....#...
    ...##...
    ..#..#..
    .....#..
    """,
    # 11 left foot steps down
    """
    ....##..
    ....##..
    ..#.#...
    ...####.
    ....#...
    ....#...
    ..##.#..
    .....#..
    """,
    # 12 left foot steps down
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
    # 13 right knee comes up
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
    # 14 left hand reaches up, right hand pulls down
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
