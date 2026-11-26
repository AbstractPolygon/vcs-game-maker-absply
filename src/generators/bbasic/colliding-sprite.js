'use strict';

// "Colliding sprite" in the sprite dropdown of a block (the user, 2026-11-25): inside a When ... collide block it is the sprite whose collision
// started (that block's code is made once for each sprite it tells apart, see collision_when in collision.js, which sets Blockly.BBasic.collidingSprite).
// Outside one it is nothing. A block made for players only (or missiles only) does nothing (gives 0) when the colliding sprite is another kind.
//
// The generator of the block sees the sprite as if it had been picked in the dropdown: while it runs, the block's field gives the value of that sprite.
// The scans of the project before the code is made (which sprites use a feature) see the block once for each sprite it can stand for (see
// collidingVariants, used by the workspace's getAllBlocks and getBlocksByType while the code is made, workspaceToCode in bbasic.js).

import {collisionWhenNames} from './collision-when';
import {markRun} from './colliding-index';

export const COLLIDING = 'colliding';
const NL = String.fromCharCode(10);

// The blocks that have it: the field and the kind of value it holds (player: '0' to '16'; mask: '1' up, Player 0 has no mask; missile: '0' or '1';
// object: 'player0', 'missile1', 'ball').
export const COLLIDING_FIELDS = {
  sprite_player_get: ['PLAYER', 'player'],
  sprite_player_set: ['PLAYER', 'player'],
  sprite_player_change: ['PLAYER', 'player'],
  sprite_player_size: ['PLAYER', 'player'],
  sprite_player_mask: ['PLAYER', 'mask'],
  sprite_player_animation_playback: ['PLAYER', 'player'],
  sprite_player_rom_noise: ['PLAYER', 'player'],
  sprite_player_rom_noise_stop: ['PLAYER', 'player'],
  sprite_player_rainbow_colors: ['PLAYER', 'player'],
  sprite_player_rainbow_colors_stop: ['PLAYER', 'player'],
  sprite_missile_get: ['MISSILE', 'missile'],
  sprite_missile_set: ['MISSILE', 'missile'],
  sprite_missile_change: ['MISSILE', 'missile'],
  sprite_missile_size: ['MISSILE', 'missile'],
  object_seek_to: ['OBJECT', 'object'],
  object_gravity: ['OBJECT', 'object'],
  object_bounce: ['OBJECT', 'object'],
  object_fire_stop: ['OBJECT', 'object'],
  sprite_inertia_accelerate: ['OBJECT', 'object'],
  sprite_inertia_decelerate: ['OBJECT', 'object'],
  sprite_scroll_with_playfield_set: ['OBJECT', 'object'],
  sprite_scroll_with_playfield_get: ['OBJECT', 'object'],
  // (Before, the Start / Stop gravity block read Blockly.BBasic.collidingSprite itself: one sprite at a time.)
  object_gravity_control: ['OBJECT', 'object'],
};

// The value of the field for a sprite ('player0', 'missile1', 'ball'), or null when the block cannot take that sprite.
export const collidingValue = (kind, sprite) => {
  const player = /^player([0-9]|1[0-6])$/.exec(sprite || '');
  const missile = /^missile([01])$/.exec(sprite || '');
  if (kind === 'player') return player ? player[1] : null;
  if (kind === 'mask') return player && player[1] !== '0' ? player[1] : null;
  if (kind === 'missile') return missile ? missile[1] : null;
  if (kind === 'object') return player || missile || sprite === 'ball' ? sprite : null;
  return null;
};

// A block's field with the sprite in it: the sprite's value in the dropdown, and in the VAR dropdown of the player and missile blocks (a name built from the
// player or missile, such as player0x: with "colliding sprite" the dropdown sync of blocks/sprites.js builds it from Player 0 or Missile 0) the name of the sprite.
const fieldWith = (block, field, kind, value) => (name) => {
  if (name === field) return value;
  const raw = block.getFieldValue(name);
  if (name !== 'VAR' || typeof raw !== 'string') return raw;
  if (kind === 'missile') return raw.replace('missile0', `missile${value}`);
  if (kind === 'player' || kind === 'mask') return raw.replace('player0', `player${value}`);
  return raw;
};

// The sprite a part of a When ... collide block stands for: its first object, or the second when the first is the Playfield.
export const collidingSpriteOf = (whenBlock, name) => (name === 'playfield' ? whenBlock.getFieldValue('VAR1') : name);

// The innermost When ... collide block a block is in, or null.
const enclosingWhen = (block) => {
  for (let up = block.getSurroundParent(); up; up = up.getSurroundParent()) {
    if (up.type === 'collision_when') return up;
  }
  return null;
};

// Whether a block's dropdown says "Colliding sprite".
export const isColliding = (block) => {
  const entry = block && COLLIDING_FIELDS[block.type];
  return !!entry && block.getFieldValue(entry[0]) === COLLIDING;
};

// The block as the scans see it: itself, or with "Colliding sprite" one stand-in for each sprite of its When ... collide block that it can take (none
// outside one). A stand-in is the block with that sprite in the field; everything else is the block's.
export const collidingVariants = (block) => {
  if (!isColliding(block)) return [block];
  const [field, kind] = COLLIDING_FIELDS[block.type];
  const when = enclosingWhen(block);
  if (!when) return [];
  const values = [...new Set(collisionWhenNames(when).map((name) => collidingValue(kind, collidingSpriteOf(when, name))).filter((value) => value !== null))];
  return values.map((value) => {
    const variant = Object.create(block);
    variant.getFieldValue = fieldWith(block, field, kind, value);
    return variant;
  });
};

// The code of the block for one sprite: its generator run with the field giving that sprite (a block inside it with "Colliding sprite" knows the sprite
// too). Gives {pre, code}: the lines a value inside hoists in front of the statement (they belong to this sprite's code) and the block's code (a value block's
// value, the lines it hoists itself in pre).
const codeForSprite = (Blockly, generator, original, block, field, kind, sprite, value) => {
  const outer = {sprite: Blockly.BBasic.collidingSprite, shared: Blockly.BBasic.collidingShared};
  const pending = Blockly.BBasic.pendingPreambleLines || [];
  const mark = pending.length;
  const before = Object.prototype.hasOwnProperty.call(block, 'getFieldValue') ? block.getFieldValue : null;
  const read = block.getFieldValue;
  block.getFieldValue = fieldWith({getFieldValue: (name) => read.call(block, name)}, field, kind, value);
  Blockly.BBasic.collidingSprite = sprite;
  Blockly.BBasic.collidingShared = null;
  try {
    const result = original.call(generator, block);
    const pre = pending.length > mark ? pending.splice(mark) : [];
    if (Array.isArray(result)) {
      const lines = String(result[0]).split(NL);
      return {pre: [...pre, ...lines.slice(0, -1)], code: lines[lines.length - 1]};
    }
    return {pre, code: String(result || '').replace(/\s+$/, '')};
  } finally {
    if (before) block.getFieldValue = before;
    else delete block.getFieldValue;
    Blockly.BBasic.collidingSprite = outer.sprite;
    Blockly.BBasic.collidingShared = outer.shared;
  }
};

// In a When ... collide block whose blocks inside are made once (shared: [{sprite, pend}], see collisionWhenSharedCode), a "Colliding sprite" block gives its
// code for each sprite (codes[k], null when there is none for the k-th sprite) as a mark, which the finished program makes the choice of them by the
// pending bits or one code for all (see resolveCollidingMarks in colliding-index.js). A value block's mark is in front of its statement and leaves the value
// in temp1, as Random between does.
export const collidingDispatch = (Blockly, shared, codes, isValue) => {
  if (codes.every((code) => code === null)) return isValue ? '0' : '';
  const mark = markRun({pend: shared.map(({pend}) => pend), blocks: [codes], value: isValue});
  return isValue ? [mark, 'temp1'].join(NL) : mark;
};

// A statement with "Colliding sprite" leaves a line with its code for each sprite; the When ... collide block puts the ones that follow each other in one mark,
// so that they can share their look at the pending bits, or be one code together (see colliding-index.js).
const MARK = 'rem colliding-sprite ';
export const collidingRuns = (Blockly, shared, body) => {
  const out = [];
  let run = null;
  const flush = () => {
    if (!run) return;
    out.push(markRun({pend: shared.map(({pend}) => pend), blocks: run, value: false}));
    run = null;
  };
  body.split(NL).forEach((line) => {
    const at = line.indexOf(MARK);
    if (at < 0 || line.slice(0, at).trim() !== '') {
      flush();
      out.push(line);
      return;
    }
    run = run || [];
    run.push(JSON.parse(decodeURIComponent(line.slice(at + MARK.length).trim())));
  });
  flush();
  return out.join(NL);
};

// Wraps the generators of the blocks above. With "Colliding sprite":
// - in a When ... collide block of one sprite (Blockly.BBasic.collidingSprite) the generator runs with the field giving it, or the block gives nothing (a
//   value block 0) when it cannot take it;
// - in one of more sprites, whose blocks inside are made once (Blockly.BBasic.collidingShared, see collisionWhenSharedCode), a statement leaves its code
//   for each sprite (see collidingRuns) and a value block gives its choice (see collidingDispatch);
// - outside a When ... collide block it gives nothing (a value block 0).
export const installCollidingSprite = (Blockly) => {
  Object.entries(COLLIDING_FIELDS).forEach(([type, [field, kind]]) => {
    const original = Blockly.BBasic[type];
    if (typeof original !== 'function') return;
    Blockly.BBasic[type] = function(block) {
      if (!block || block.getFieldValue(field) !== COLLIDING) return original.call(this, block);
      const isValue = !!block.outputConnection;
      const none = isValue ? ['0', Blockly.BBasic.ORDER_ATOMIC] : '';
      const shared = Blockly.BBasic.collidingShared;
      if (!shared) {
        const sprite = Blockly.BBasic.collidingSprite;
        const value = collidingValue(kind, sprite);
        if (value === null) return none;
        const {pre, code} = codeForSprite(Blockly, this, original, block, field, kind, sprite, value);
        if (isValue) return [[...pre, code].join(NL), Blockly.BBasic.ORDER_ATOMIC];
        if (pre.length) (Blockly.BBasic.pendingPreambleLines || []).push(...pre);
        return code ? `${code}${NL}` : '';
      }
      // (A statement that makes nothing for a sprite is the same as one that cannot take it.)
      const codes = shared.map(({sprite}) => {
        const value = collidingValue(kind, sprite);
        if (value === null) return null;
        const made = codeForSprite(Blockly, this, original, block, field, kind, sprite, value);
        const code = [...made.pre, isValue ? `temp1 = ${made.code}` : made.code].filter((line) => line.trim() !== '').join(NL);
        return code === '' ? null : code;
      });
      if (codes.every((code) => code === null)) return none;
      if (isValue) return [collidingDispatch(Blockly, shared, codes, true), Blockly.BBasic.ORDER_ATOMIC];
      return `${MARK}${encodeURIComponent(JSON.stringify(codes))}${NL}`;
    };
  });
};
