'use strict';

// The "When ... collide" block: the blocks inside run once, in the frame in which a collision starts (it was not there when the block was last run, and is now).
// It is told by the same test as the "Collided" block (collision_get in collision.js, so the hardware flags, the box test and the wide players work as they
// do there). Like the terrain's "When playfield terrain is done" it is a block with a body that stands in code that runs every frame (an event, or loose in the
// workspace, where gameplay code runs every frame).
//
// With "Any sprite" or "Player sprites" as the first object the block is worked out for each sprite (see ANY_SPRITE_NAMES), a bit for each, and the blocks inside are made once
// for each sprite, so that "Colliding sprite" in a block inside (the Start / Stop gravity block) is the sprite whose collision started.
//
// Each block keeps a bit for each sprite it tells apart: whether the sprites collided when it was last run. The bits of blocks fill bytes (see flag-pool.js).
// The block updates its bits when it runs, so it has to run each frame to see a collision end and start again.

import {flagPoolVar, flagPoolBit} from './flag-pool';
import {invertCondition} from './logic';
import {firstObjectNames} from './collision-names';

const BITS_PER_BYTE = 8;
export const collisionWhenFamily = (index) => `collisionWhenFlags${index}`;

// The sprites a block tells apart: the sprite it names, or with "Any sprite" or "Player sprites" each of those but the second object.
export const collisionWhenNames = (block) => firstObjectNames(block.getFieldValue('VAR0'), block.getFieldValue('VAR1'));

// Where each block's bits are: [{family, bits, pend}] in the order of the blocks (the bits of a group stay in one byte). A block of more than one sprite
// also has a bit for each sprite whose collision started this frame, the blocks inside not yet run for it (pend: {family, bits}, else null; see
// collisionWhenSharedCode).
export const collisionWhenSlots = (blocks) => {
  let family = 0;
  let used = 0;
  const take = (need) => {
    if (used + need > BITS_PER_BYTE) {
      family++;
      used = 0;
    }
    const group = {family: collisionWhenFamily(family), bits: Array.from({length: need}, (_, i) => used + i)};
    used += need;
    return group;
  };
  return blocks.map((block) => {
    const need = collisionWhenNames(block).length;
    const slot = take(need);
    return {...slot, pend: need > 1 ? take(need) : null};
  });
};

// The families the plan needs for these blocks: [{family, bits}].
export const collisionWhenFamilies = (blocks) => collisionWhenSlots(blocks).flatMap((slot) => [slot, ...(slot.pend ? [slot.pend] : [])])
    .reduce((families, group) => {
      let entry = families.find((candidate) => candidate.family === group.family);
      if (!entry) families.push(entry = {family: group.family, bits: []});
      entry.bits.push(...group.bits);
      return families;
    }, []);

// A bit of a group, as batari Basic names it.
const bitRef = (Blockly, group, part) =>
  `${Blockly.BBasic.nameDB_.getName(flagPoolVar(group.family), Blockly.Names.DEVELOPER_VARIABLE_TYPE)}{${flagPoolBit(group.family, group.bits[part])}}`;
const slotOf = (Blockly, block) => {
  const index = (Blockly.BBasic.collisionWhenBlocks || []).findIndex((candidate) => candidate.id === block.id);
  return index < 0 ? null : collisionWhenSlots(Blockly.BBasic.collisionWhenBlocks)[index];
};
// The pending bits of a block of more than one sprite, in the order of its sprites (see collisionWhenSharedCode), or null.
export const collisionWhenPendRefs = (Blockly, block) => {
  const slot = slotOf(Blockly, block);
  return slot && slot.pend ? slot.pend.bits.map((_, part) => bitRef(Blockly, slot.pend, part)) : null;
};

export const reserveCollisionWhenDevVars = (reserveDevVar, blocks) => {
  collisionWhenFamilies(blocks).forEach(({family}) => {
    reserveDevVar(flagPoolVar(family), undefined, 'a bit for each sprite of each "When ... collide" block: the sprites collided when it was last run');
  });
};

// The code of a block for one of its sprites (part): the test of the collision, the bit and the blocks inside, run once when the collision starts. The test
// is jumped on the way the If block does it (see controls_if in logic.js): the opposite of the condition when there is one (a chain of tests joined by ||
// has none that batari Basic takes in the other form past three tests), else "then goto ... else goto ...".
export const collisionWhenCode = (Blockly, block, part, collided, body) => {
  const slot = slotOf(Blockly, block);
  if (!slot) return '';
  const was = bitRef(Blockly, slot, part);
  const step = Blockly.BBasic.blockNumbers.next('collwhen');
  const off = `_collwhen_${step}_off`;
  const end = `_collwhen_${step}_end`;
  const inverse = invertCondition(collided);
  return [
    '',
    ...(inverse !== null ? [`if ${inverse} then goto ${off}`] : [`if ${collided} then goto _collwhen_${step}_on else goto ${off}`, `@ _collwhen_${step}_on`]),
    `if ${was} then goto ${end}`,
    `${was} = 1`,
    body,
    `goto ${end}`,
    `@ ${off}`,
    `${was} = 0`,
    `@ ${end}`,
    '',
  ].join(String.fromCharCode(10));
};

// A block of more than one sprite ("Any sprite", "Player sprites"): the blocks inside are made once, not once for each sprite. The test of each sprite only
// sets its pending bit when its collision starts (the part is that of collisionWhenCode, with the pending bit for the blocks inside); then the blocks inside
// run once for each pending sprite, lowest first, and its bit is cleared after them. Inside, "Colliding sprite" is the lowest pending sprite (see
// colliding-sprite.js); the bits stay set through a Wait block inside.
export const collisionWhenSharedCode = (Blockly, block, tests, body) => {
  const pend = collisionWhenPendRefs(Blockly, block);
  if (!pend) return '';
  const step = Blockly.BBasic.blockNumbers.next('collwhenrun');
  const loop = `_collwhenrun_${step}_loop`;
  const run = `_collwhenrun_${step}_run`;
  const done = `_collwhenrun_${step}_done`;
  return [
    ...tests.map(({part, collided}) => collisionWhenCode(Blockly, block, part, collided, `${pend[part]} = 1`)),
    `@ ${loop}`,
    ...pend.map((bit) => `if ${bit} then goto ${run}`),
    `goto ${done}`,
    `@ ${run}`,
    body,
    ...pend.map((bit) => `if ${bit} then ${bit} = 0 : goto ${loop}`),
    `@ ${done}`,
    '',
  ].join(String.fromCharCode(10));
};
