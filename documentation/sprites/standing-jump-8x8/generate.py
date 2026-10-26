#!/usr/bin/env python3
"""Generates the 8x8, 10-frame jump from standing in this folder (see ../export_sprite.py for
the formats). Same character as ../run-cycle-8x8."""
import os
import sys

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from export_sprite import export  # noqa: E402

# A jump straight up from standing. Starts on the idle's first frame and dips
# through the idle's own knee-bend and low poses, springs up with both arms
# swinging up, tucks the knees at the top, opens the legs out and lands back
# through the idle's low and knee-bend poses, so it joins the idle at both
# ends. In the air the arms are mirrored either side of the body, like the
# fall, while one leg stays straight and the other bends at the hip and knee.
# Only the pose is drawn; the jump's height comes from moving the sprite in
# the game.
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
    # 2 knees bend, as in the idle
    """
    ....##..
    ....##..
    ....#...
    ...###..
    ..#.#.#.
    ....#...
    ...#.#..
    ..#...#.
    """,
    # 3 crouches low, as in the idle
    """
    ........
    ....##..
    ....##..
    ....#...
    ...###..
    ..#.#.#.
    ...#.#..
    ..#...#.
    """,
    # 4 springs up: legs straighten, arms swing up
    """
    ....##..
    ....##..
    ..#.#.#.
    ...###..
    ....#...
    ...#.#..
    ...#.#..
    ...#.#..
    """,
    # 5 leaves the ground: arms high, left leg straight, right leg bent with the foot lifted
    """
    ....##..
    ..#.###.
    ...###..
    ....#...
    ....#...
    ....##..
    ...#.#..
    ...#....
    """,
    # 6 right knee comes up high, left leg straight
    """
    ....##..
    ....##..
    ..#.#.#.
    ...###..
    ....#...
    ....##..
    ...#..#.
    ...#....
    """,
    # 7 top of the jump: arms out, right knee high, left leg straight
    """
    ....##..
    ....##..
    ....#...
    ..#####.
    ....#...
    ....##..
    ...#..#.
    ...#....
    """,
    # 8 right leg lowers for the landing
    """
    ....##..
    ....##..
    ....#...
    ..#####.
    ....#...
    ....##..
    ...#.#..
    ...#....
    """,
    # 9 lands low, as in the idle
    """
    ........
    ....##..
    ....##..
    ....#...
    ...###..
    ..#.#.#.
    ...#.#..
    ..#...#.
    """,
    # 10 rising with the knees still bent, back into the idle
    """
    ....##..
    ....##..
    ....#...
    ...###..
    ..#.#.#.
    ....#...
    ...#.#..
    ..#...#.
    """,
]
export(FRAMES, os.path.dirname(os.path.abspath(__file__)), 'standing-jump-8x8', 'standing_jump', 'standing-jump')
