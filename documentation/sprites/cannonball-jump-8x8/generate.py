#!/usr/bin/env python3
"""Generates the 8x8, 8-frame cannonball jump in this folder (see
../export_sprite.py for the formats). Same character as ../run-cycle-8x8."""
import os
import sys

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from export_sprite import export  # noqa: E402

# Facing right. A jump from standing that curls up into a ball at the top,
# hugging the knees, then uncurls to land. Starts and ends with the standing
# jump's crouch and landing frames. Only the pose is drawn; the jump's height
# comes from moving the sprite in the game.
FRAMES = [
    # 1 crouch, arms swung back, as in the standing jump
    """
    ........
    ........
    .....##.
    .....##.
    .#..#...
    ..###...
    ....##..
    ...#.#..
    """,
    # 2 spring up: stretched out on the toes, arm reaching up
    """
    ......#.
    ....###.
    ....##..
    ....#...
    ....#...
    ....#...
    ....#...
    ....#...
    """,
    # 3 knees pulled up, hands reaching for them
    """
    ....##..
    ....##..
    ....#.#.
    ....###.
    ....##..
    .....#..
    ........
    ........
    """,
    # 4 cannonball: curled up, hugging the knees
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
    # 5 rolling forward in the ball
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
    # 6 holding the ball tight
    """
    ........
    ....##..
    ..#.##..
    .#...#..
    .#..###.
    ..#.##..
    ...###..
    ........
    """,
    # 7 uncurling: legs reaching down, arms out
    """
    ....##..
    ....##..
    ..#.#.#.
    ...###..
    ....#...
    ....#...
    ....#...
    ....##..
    """,
    # 8 landing: knees bend to absorb it, arms out for balance, as in the standing jump
    """
    ........
    ........
    ....##..
    ....##..
    ..#.#.#.
    ...##...
    ....##..
    ...#.#..
    """,
]
export(FRAMES, os.path.dirname(os.path.abspath(__file__)), 'cannonball-jump-8x8', 'cannonball_jump', 'cannonball-jump')
