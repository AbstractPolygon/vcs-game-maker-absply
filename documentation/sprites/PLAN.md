# Player character animations

Every animation for the player character: one 1-colour figure, facing right,
8 pixels wide. Each folder holds the same set of files, all importable from
the Player editor:

| File | Import with |
| --- | --- |
| `<name>.png` + `<name>.json` | **Import from Aseprite** (pick both files) |
| `<prefix>_1.spr` … `<prefix>_N.spr` | **Import animation frames → .spr files** |
| `<prefix>_1.png` … `<prefix>_N.png` | **Import animation frames → images** |
| `<name>.gif`, `preview.png` | Previews only |

Edit a folder's frames in its `generate.py` and re-run it to rebuild every
file there. The shared export code is in `export_sprite.py`.

## Overview

| Animation | Folder | Size | Frames | Per frame | Loops | Aseprite name |
| --- | --- | --- | --- | --- | --- | --- |
| Idle | `idle-8x8` | 8×8 | 8 | 250 ms (15 NTSC frames) | Yes | `idle` |
| Run cycle | `run-cycle-8x8` | 8×8 | 8 | 100 ms (6) | Yes | `run` |
| Standing jump | `standing-jump-8x8` | 8×8 | 8 | 100 ms (6) | No | `standing-jump` |
| Running jump | `running-jump-8x8` | 8×8 | 8 | 100 ms (6) | No | `running-jump` |
| Cannonball jump | `cannonball-jump-8x8` | 8×8 | 8 | 100 ms (6) | No | `cannonball-jump` |
| Fall | `fall-8x8` | 8×8 | 4 | 100 ms (6) | Yes | `fall` |
| Wall bounce | `wall-bounce-8x8` | 8×8 | 8 | 100 ms (6) | No | `wall-bounce` |

## Lining the animations up

- **Feet on the bottom row.** Every frame is drawn as if the character were
  standing on the ground, with the feet on the bottom row, so switching
  animations needs no offset.
- **Movement comes from the game.** The animations change only the pose.
  Running forward, the height of a jump, falling and the wall knock-back all
  need the sprite to be moved in game code. For the jumps, each frame below
  says how far to raise the sprite (also in `LIFT` in their `generate.py`),
  and their GIFs show it raised that way.
- **Shared frames.** Where one animation hands over to another, they share the
  exact same frame, so the switch doesn't jump:

| From | To | Shared frame |
| --- | --- | --- |
| Run cycle frame 8 | Running jump frame 1 | Toe-off |
| Running jump frame 8 | Run cycle frame 1 (carry on from frame 2) | Landing |
| Run cycle frame 1 | Wall bounce frame 1 | Running in |
| Wall bounce frame 8 | Idle frame 1 | Standing |
| Standing jump frames 1 and 8 | Cannonball jump frames 1 and 8 | Crouch and landing |

## Animations

### Idle — `idle-8x8`

![Idle](idle-8x8/idle-8x8.gif)

Standing in place and breathing, with the feet planted. Poses repeat to hold
each part of the breath, so every import method plays at the same pace.

1. Standing, arms at the sides
2. Breathing in: chest swells, shoulders rise a pixel
3. Holding the breath
4. Holding the breath
5. Breathing out
6. Head and shoulders drop a pixel
7. Resting
8. Resting, then breathing in again

### Run cycle — `run-cycle-8x8`

![Run cycle](run-cycle-8x8/run-cycle-8x8.gif)

The 8 frames cover a single step, from one foot landing to the other. In a
1-colour silhouette both halves of a stride look the same, so this loops as a
full run. The arms swing opposite each other, and the trailing leg folds at
the knee after push-off.

1. Landing: front foot reaches the ground, arms at full swing
2. Front knee bends to take the weight, back heel lifts
3. Back heel kicks up behind, bent at the knee
4. Standing leg under the body, back foot tucked up
5. Passing: swinging knee comes through, arms at the sides
6. Standing leg behind the body, swinging knee forward
7. Push off: back leg extends, front knee high
8. Toe-off: front leg reaches out for the next landing

### Standing jump — `standing-jump-8x8`

![Standing jump](standing-jump-8x8/standing-jump-8x8.gif)

A jump straight up from standing, rising up to 8 pixels. Starts from the idle
pose and lands back in it. Raise the sprite by the amount shown on each
frame.

1. Crouch, arms swung back (on the ground)
2. Launch: stretched out on the toes, arms thrust up (on the ground)
3. Rising (raise 3 px)
4. Knees start to tuck, arms out (raise 6 px)
5. Top of the jump, knees tucked (raise 8 px)
6. Falling, legs opening (raise 6 px)
7. Legs reaching for the ground (raise 2 px)
8. Landing: knees bend to absorb it (on the ground)

### Running jump — `running-jump-8x8`

![Running jump](running-jump-8x8/running-jump-8x8.gif)

A leap taken mid-run, rising up to 6 pixels. It takes off from the run cycle's
frame 8 and lands on its frame 1, so switch back to the run at frame 2. Raise
the sprite by the amount shown on each frame.

1. Toe-off, as in the run (on the ground)
2. Drive: back leg straight, front knee high (raise 2 px)
3. Rising: back knee folds (raise 4 px)
4. Top: arms up, legs gathering (raise 6 px)
5. Top: both legs swing forward (raise 6 px)
6. Legs out in front, arms coming down (raise 4 px)
7. Front leg reaches for the ground (raise 2 px)
8. Landing, as in the run (on the ground)

### Cannonball jump — `cannonball-jump-8x8`

![Cannonball jump](cannonball-jump-8x8/cannonball-jump-8x8.gif)

A jump from standing that curls into a ball at the top, hugging the knees,
then uncurls to land. Rises up to 8 pixels. Shares its first and last frames
with the standing jump. Raise the sprite by the amount shown on each frame.

1. Crouch, arms swung back, as in the standing jump (on the ground)
2. Spring up: stretched out on the toes, arms thrust up (on the ground)
3. Knees pulled up, hands reaching for them (raise 4 px)
4. Cannonball: curled up, hugging the knees (raise 7 px)
5. Rolling forward in the ball (raise 8 px)
6. Holding the ball tight (raise 6 px)
7. Uncurling: legs reaching down, arms out (raise 3 px)
8. Landing: knees bend to absorb it, as in the standing jump (on the ground)

### Fall — `fall-8x8`

![Fall](fall-8x8/fall-8x8.gif)

A loop for dropping, for example off a ledge: the arms flail up and out and
the legs kick. The game moves the sprite down.

1. Back arm up, legs apart
2. Front arm up, legs kicking
3. Back arm up, legs crossing
4. Front arm up, legs apart

### Wall bounce — `wall-bounce-8x8`

![Wall bounce](wall-bounce-8x8/wall-bounce-8x8.gif)

Running into a wall just past the right edge and bouncing off it. Starts on
the run cycle's frame 1 and ends on the idle's frame 1. The game should push
the sprite left, mostly over frames 3–5.

1. Running in, as in the run
2. Hit: face and hands flat against the wall
3. Jolt: head snaps back, front arm flung up
4. Knocked back off the feet, legs swinging up in front
5. Lands on the back foot, arms windmilling
6. Staggering, arms out for balance
7. Steadying: bent over, hands on knees
8. Standing again, as in the idle
