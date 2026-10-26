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

## All animations in one file

`player-animations.aseprite` holds every animation below in one Aseprite file:
104 frames on one layer, with a coloured tag per animation, named as in the
"Aseprite name" column. `player-animations.png` + `player-animations.json` is
the same thing as an Aseprite sprite sheet: pick both with **Import from
Aseprite** to bring in every animation at once, one per tag. After changing
any animation, re-run its `generate.py` and then `build_aseprite.py` to
rebuild all three.

## Overview

| Animation | Folder | Size | Frames | Per frame | Loops | Aseprite name |
| --- | --- | --- | --- | --- | --- | --- |
| Idle | `idle-8x8` | 8×8 | 6 | 100 ms (6) | Yes | `idle` |
| Run cycle | `run-cycle-8x8` | 8×8 | 8 | 50 ms (3) | Yes | `run` |
| Standing jump | `standing-jump-8x8` | 8×8 | 8 | 100 ms (6) | No | `standing-jump` |
| Running jump | `running-jump-8x8` | 8×8 | 8 | 100 ms (6) | No | `running-jump` |
| Cannonball jump | `cannonball-jump-8x8` | 8×8 | 8 | 100 ms (6) | No | `cannonball-jump` |
| Cannonball loop | `cannonball-loop-8x8` | 8×8 | 8 | 100 ms (6) | Yes | `cannonball-loop` |
| Fall start | `fall-start-8x8` | 8×8 | 8 | 100 ms (6) | No | `fall-start` |
| Fall | `fall-8x8` | 8×8 | 12 | 50 ms (3) | Yes | `fall` |
| Hard landing | `hard-landing-8x8` | 8×8 | 10 | 100 ms (6) | No | `hard-landing` |
| Wall bounce | `wall-bounce-8x8` | 8×8 | 8 | 100 ms (6) | No | `wall-bounce` |
| Door opening | `door-open-8x8` | 8×8 | 8 | 100 ms (6) | No | `door-open` |
| Ladder climb | `climb-8x8` | 8×8 | 12 | 50 ms (3) | Yes | `climb` |

## Lining the animations up

- **Feet on the bottom row.** Every frame is drawn as if the character were
  standing on the ground, with the feet on the bottom row, so switching
  animations needs no offset.
- **Movement comes from the game.** The animations change only the pose.
  Running forward, the height of a jump, falling and the wall knock-back all
  need the sprite to be moved in game code.
- **Shared frames.** Where one animation hands over to another, they share the
  exact same frame, so the switch doesn't jump:

| From | To | Shared frame |
| --- | --- | --- |
| Run cycle frame 8 | Running jump frame 1 | Toe-off |
| Running jump frame 8 | Run cycle frame 1 (carry on from frame 2) | Landing |
| Run cycle frame 1 | Wall bounce frame 1 | Running in |
| Wall bounce frame 8 | Idle frame 1 | Standing |
| Standing jump frames 1 and 8 | Cannonball jump frames 1 and 8 | Crouch and landing |
| Run cycle frame 8 | Fall start frame 1 | Toe-off |
| Fall start frame 8 | Fall frame 1 (carry on from frame 2) | Both arms up, legs apart |
| Hard landing frame 10 | Idle frame 1 | Standing |
| Idle frame 1 | Door opening frame 1 | Standing |
| Door opening frame 8 | Idle frame 1 | Standing |

## Animations

### Idle — `idle-8x8`

![Idle](idle-8x8/idle-8x8.gif)

Facing right, with the front foot planted ahead of the back one and both arms
down at the sides, bouncing gently up and down with overlapping action: going
down the hips drop first, then the arms, then the head; coming up the arms
lead, then the hips, with the head last. Each frame moves one part by one
pixel and no pose repeats.

1. Standing, arms down at the sides
2. Knees bend, hips drop
3. Arms follow
4. Head follows: fully low
5. Arms lead back up
6. Legs straighten; the head comes up last as it loops

### Run cycle — `run-cycle-8x8`

![Run cycle](run-cycle-8x8/run-cycle-8x8.gif)

The 8 frames cover a single step, from one foot landing to the other. In a
1-colour silhouette both halves of a stride look the same, so this loops as a
full run. The arms swing opposite each other, and the trailing leg folds at
the knee after push-off. The arms are short, and the swing shows at the
shoulders: at full swing each arm sits off its shoulder, and as it passes the
body the shoulder turns in behind the body line, so the arms tuck out of sight
around the passing frame. The shoulders only move forward or back, never up or
down.

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

A jump straight up from standing. Starts from the idle pose and lands back in
it.

1. Crouch, arms swung back
2. Launch: stretched out on the toes, arm reaching up
3. Rising
4. Knees start to tuck, arms out
5. Top of the jump, knees tucked
6. Falling, legs opening
7. Legs reaching for the ground
8. Landing: knees bend to absorb it, arms out for balance

### Running jump — `running-jump-8x8`

![Running jump](running-jump-8x8/running-jump-8x8.gif)

A leap taken mid-run. It takes off from the run cycle's frame 8 and lands on
its frame 1, so switch back to the run at frame 2.

1. Toe-off, as in the run
2. Drive: back leg straight, front knee high
3. Rising: back knee folds
4. Top: arms up, legs gathering
5. Top: both legs swing forward
6. Legs out in front, arms coming down
7. Front leg reaches for the ground
8. Landing, as in the run

### Cannonball jump — `cannonball-jump-8x8`

![Cannonball jump](cannonball-jump-8x8/cannonball-jump-8x8.gif)

A jump from standing that curls into a ball at the top, hugging the knees,
then uncurls to land. Shares its first and last frames with the standing
jump.

1. Crouch, arms swung back, as in the standing jump
2. Spring up: stretched out on the toes, arm reaching up
3. Knees pulled up, hands reaching for them
4. Cannonball: curled up, hugging the knees
5. Rolling forward in the ball
6. Holding the ball tight
7. Uncurling: legs reaching down, arms out
8. Landing: knees bend to absorb it, arms out for balance, as in the standing jump

### Cannonball loop — `cannonball-loop-8x8`

![Cannonball loop](cannonball-loop-8x8/cannonball-loop-8x8.gif)

The cannonball jump's curled-up ball rolling forward through a full turn, 45°
a frame, centred so it spins in place. Loop it while the player is in the air,
for example in place of the cannonball jump's frames 4–6.

1. Ball upright, head on top
2. Rolled 45 degrees forward
3. Head facing forward
4. Rolled 135 degrees
5. Upside down
6. Rolled 225 degrees
7. Head facing back
8. Rolled 315 degrees, back to upright next

### Fall start — `fall-start-8x8`

![Fall start](fall-start-8x8/fall-start-8x8.gif)

The lead-in to a fall when the player walks or runs off the edge of a
platform. Starts on the run cycle's frame 8 and ends on the fall loop's frame 1.

1. Stepping off: toe-off, as in the run
2. Front foot reaches out over the edge
3. The foot drops into nothing
4. Jolt: arms jerk up, legs come together
5. Arms fully up, legs hang straight
6. Arms settle into the falling flap, legs hang straight
7. Legs start to dangle apart
8. Legs apart, both arms up: the fall loop's first frame

### Fall — `fall-8x8`

![Fall](fall-8x8/fall-8x8.gif)

A smooth loop for dropping, with the body mirrored: both arms move together
and both legs move together, and the arms are the same two-pixel length as the
legs. The arms flap from up to high above the shoulders, back to up, out level
and down to the hips; the feet kick up, come down, tuck in and go back out. The
arms flap twice as fast as the legs kick: they step every frame, the feet every
third frame. 12 frames at 50 ms make a 0.6 s loop. The game moves the sprite
down. Its first frame is the fall start's last, so after the fall start carry
on from frame 2.

### Hard landing — `hard-landing-8x8`

![Hard landing](hard-landing-8x8/hard-landing-8x8.gif)

Landing after a long fall: braces, hits the ground and splats flat out face
down, then pushes up on one arm, gets a knee under and stands. Switch to it
from the fall loop when the player lands after falling a long way; it ends on
the idle's frame 1.

1. Bracing for the ground: legs straight, arms up
2. Impact: knees buckle into a wide squat, arms fling out
3. Splat: flattened out face down on the ground
4. Lying flat
5. Pushes up on one arm
6. Pulls a knee under
7. Up on one knee, hand on the ground
8. Pushes up off the knee
9. Straightening up
10. Standing, as in the idle

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

### Door opening — `door-open-8x8`

![Door opening](door-open-8x8/door-open-8x8.gif)

Opening a door just past the right edge. The feet stay planted in the idle's
stance the whole time; only the upper body moves. Only the player is
drawn: the game draws the door and swaps it to open around frames 6–7. Starts
and ends on the idle's frame 1.

1. Standing, as in the idle
2. Turns side-on to the door, arms down
3. Reaches out for the handle
4. Grips the handle at the door's edge
5. Turns the handle
6. Leans in and pushes the door
7. Door swings away, hand follows it up
8. Lets go, standing again, as in the idle

### Ladder climb — `climb-8x8`

![Ladder climb](climb-8x8/climb-8x8.gif)

Climbing a ladder, seen from the front with the arms and legs either side of
the body, like the fall. Made for a steady climb with no pauses: the hands and
the feet take turns on every frame, one hand reaching up as the other pulls
down, then a step of the feet, so something is always moving. As a hand
reaches the rung above, the opposite knee is up at the next one. A full cycle
(both hands, both feet) is 12 frames at 50 ms, 0.6 s. The game moves the
sprite up the ladder.

1. Right knee up
2. Right hand up, left hand down
3. Left knee up, right foot down
4. Right hand up, left hand down
5. Left knee up, right foot down
6. Right hand up, left hand down
7. Left foot down
8. Left hand up, right hand down
9. Left foot down
10. Left hand up, right hand down
11. Right knee up
12. Left hand up, right hand down
