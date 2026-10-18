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
# jump's crouch and landing frames. Only the pose is drawn: the game raises
# the sprite by the amount noted on each frame (LIFT below), up to 8 pixels.
FRAMES = [
    # 1 crouch, arms swung back, as in the standing jump (on the ground)
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
    # 2 spring up: stretched out on the toes, arm reaching up (on the ground)
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
    # 3 knees pulled up, hands reaching for them (raise 4 px)
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
    # 4 cannonball: curled up, hugging the knees (raise 7 px)
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
    # 5 rolling forward in the ball (raise 8 px)
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
    # 6 holding the ball tight (raise 6 px)
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
    # 7 uncurling: legs reaching down, arms out (raise 3 px)
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
    # 8 landing: knees bend to absorb it, arms out for balance, as in the standing jump (on the ground)
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
# Pixels to raise the sprite by on each frame, from where it stands (the GIF
# preview shows it raised by these).
LIFT = [0, 0, 4, 7, 8, 6, 3, 0]
export(FRAMES, os.path.dirname(os.path.abspath(__file__)), 'cannonball-jump-8x8', 'cannonball_jump', 'cannonball-jump', lift=LIFT)
