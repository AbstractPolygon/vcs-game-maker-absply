#!/usr/bin/env python3
"""Generates the 8x8, 12-frame ready-stance idle in this folder (see
../export_sprite.py for the formats). Same character as ../run-cycle-8x8."""
import os
import sys

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from export_sprite import export  # noqa: E402

# Facing right in a ready stance: leaning forward, front fist up and front
# foot planted ahead of the back one, bouncing gently up and down. Every frame
# moves just one part by one pixel - knees, then fist, then head on the way
# down, legs, then fist, then head on the way up, with the back hand swinging
# a beat behind - so the bounce reads smoothly. 100 ms (6 NTSC frames) per
# frame.
FRAMES = [
    # 1 up, front fist high
    """
    ....##..
    ....##..
    ....#.#.
    ...###..
    ...##...
    ...#.#..
    ..#..#..
    ..#...#.
    """,
    # 2 knees start to bend
    """
    ....##..
    ....##..
    ....#.#.
    ...###..
    ...##...
    ....#...
    ...#.#..
    ..#...#.
    """,
    # 3 front fist drops
    """
    ....##..
    ....##..
    ....#...
    ...####.
    ...##...
    ....#...
    ...#.#..
    ..#...#.
    """,
    # 4 head and shoulders follow down
    """
    ........
    ....##..
    ....##..
    ....#...
    ...####.
    ...##...
    ...#.#..
    ..#...#.
    """,
    # 5 back hand swings back
    """
    ........
    ....##..
    ....##..
    ....#...
    ...####.
    ..#.#...
    ...#.#..
    ..#...#.
    """,
    # 6 holding low
    """
    ........
    ....##..
    ....##..
    ....#...
    ...####.
    ..#.#...
    ...#.#..
    ..#...#.
    """,
    # 7 legs push up
    """
    ........
    ....##..
    ....##..
    ....#...
    ...####.
    ..##.#..
    ..#..#..
    ..#...#.
    """,
    # 8 front fist rises
    """
    ........
    ....##..
    ....##..
    ....#.#.
    ...###..
    ..##.#..
    ..#..#..
    ..#...#.
    """,
    # 9 head and shoulders follow up
    """
    ....##..
    ....##..
    ....#.#.
    ...###..
    ..#.#...
    ...#.#..
    ..#..#..
    ..#...#.
    """,
    # 10 back hand settles
    """
    ....##..
    ....##..
    ....#.#.
    ...###..
    ...##...
    ...#.#..
    ..#..#..
    ..#...#.
    """,
    # 11 holding up
    """
    ....##..
    ....##..
    ....#.#.
    ...###..
    ...##...
    ...#.#..
    ..#..#..
    ..#...#.
    """,
    # 12 holding up, then round again
    """
    ....##..
    ....##..
    ....#.#.
    ...###..
    ...##...
    ...#.#..
    ..#..#..
    ..#...#.
    """,
]
export(FRAMES, os.path.dirname(os.path.abspath(__file__)), 'idle-8x8', 'idle', 'idle')
