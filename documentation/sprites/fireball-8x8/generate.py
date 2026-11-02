#!/usr/bin/env python3
"""Generates the 8x8, 8-frame looping fireball in this folder (see
../export_sprite.py for the formats). A hazard, not the player, drawn to be
shown at double width (NUSIZ), so it appears 16x8 on screen."""
import os
import sys

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from export_sprite import export  # noqa: E402

# A fireball flying to the right with a flame trail streaming out behind it.
# The ball at the front pulses, swelling from 4 pixels wide and 6 tall (round
# on screen, with the pixels twice as wide as they are tall) to 5 wide and the
# full 8 tall, back, and shrinking to 4 tall before swelling again; while it's
# at its biggest a hot spot flickers in its middle. The trail behind it is
# thinner than the ball and tapers to the back; its middle line waves and it
# breaks up into licks towards its end, the pattern streaming back half a pixel
# a frame, so it looks like the ball is rushing forward. Two embers drop off
# behind, one above and one below the trail, a pixel back each frame. Only the
# picture moves: the game moves the sprite across the screen. Flip it to fly
# left. 8 frames at 3 NTSC frames each, looping.
FRAMES = [
    # 1 the ball medium
    """
    ........
    .....##.
    ....####
    ...#####
    ##.#####
    ....####
    ...#.##.
    ........
    """,
    # 2 the ball large
    """
    .....##.
    ....####
    ...#####
    ..###.##
    #..#####
    ...#####
    ..#.####
    .....##.
    """,
    # 3 the ball large
    """
    .....##.
    ....####
    ...#####
    ..######
    ..####.#
    ...#####
    .#..####
    .....##.
    """,
    # 4 the ball medium
    """
    ........
    .....##.
    ....####
    ..######
    ..######
    ....####
    #....##.
    ........
    """,
    # 5 the ball medium
    """
    ........
    ...#.##.
    ....####
    .#######
    ..######
    ....####
    .....##.
    ........
    """,
    # 6 the ball small
    """
    ........
    ..#.....
    .....##.
    .##.####
    .#######
    .....##.
    ........
    ........
    """,
    # 7 the ball small
    """
    ........
    .#......
    .....##.
    ....####
    .##.####
    .....##.
    ........
    ........
    """,
    # 8 the ball medium
    """
    ........
    #....##.
    ....####
    #..#####
    ##.#####
    ....####
    .....##.
    ........
    """,
]

export(FRAMES, os.path.dirname(os.path.abspath(__file__)), 'fireball-8x8', 'fireball', 'fireball',
       frame_ms=50, pixel_width=2)
