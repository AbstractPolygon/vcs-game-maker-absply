'use strict';

// The objects "Any sprite" stands for, as the first object of a Collided or When ... collide block: the two players, the two missiles and the ball. On the
// DPC+ kernel Player 1's hardware flags stand for every virtual sprite (Player 1 to 9) at once, so the virtual sprites are in the test through Player 1.
export const ANY_SPRITE_NAMES = ['player0', 'player1', 'missile0', 'missile1', 'ball'];
// "Player sprites" (the When ... collide block): only the players, not the missiles or the ball.
export const PLAYER_SPRITE_NAMES = ['player0', 'player1'];

// The sprites a first object stands for: with "Any sprite" or "Player sprites" each of those but the second object, else the object itself.
export const firstObjectNames = (first, second) => {
  if (first === 'any') return ANY_SPRITE_NAMES.filter((name) => name !== second);
  if (first === 'anyplayer') return PLAYER_SPRITE_NAMES.filter((name) => name !== second);
  return [first];
};
