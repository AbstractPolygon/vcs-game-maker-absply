'use strict';

// The "When ... collide" block: the blocks inside run once, in the frame in which a collision starts (it was not there when the block was last run, and is now).
// It is told by the same test as the "Collided" block (collision_get in collision.js, so the hardware flags, the box test and the wide players work as they
// do there). Like the terrain's "When playfield terrain is done" it is a block with a body that stands in code that runs every frame (an event, or loose in the
// workspace, where gameplay code runs every frame).
//
// With "Any sprite" as the first object the block is worked out for each sprite (see ANY_SPRITE_NAMES), a bit for each, and the blocks inside are made once
// for each sprite, so that "Colliding sprite" in a block inside (the Start / Stop gravity block) is the sprite whose collision started.
//
// Each block keeps a bit for each sprite it tells apart: whether the sprites collided when it was last run. The bits of blocks fill bytes (see flag-pool.js).
// The block updates its bits when it runs, so it has to run each frame to see a collision end and start again.

import {flagPoolVar, flagPoolBit} from './flag-pool';
import {invertCondition} from './logic';
import {ANY_SPRITE_NAMES} from './collision-names';

const BITS_PER_BYTE = 8;
export const collisionWhenFamily = (index) => `collisionWhenFlags${index}`;

// The sprites a block tells apart: the sprite it names, or with "Any sprite" every sprite but the second object.
export const collisionWhenNames = (block) => (block.getFieldValue('VAR0') === 'any' ?
  ANY_SPRITE_NAMES.filter((name) => name !== block.getFieldValue('VAR1')) : [block.getFieldValue('VAR0')]);

// Where each block's bits are: [{family, bits}] in the order of the blocks (the bits of a block stay in one byte).
export const collisionWhenSlots = (blocks) => {
  let family = 0;
  let used = 0;
  return blocks.map((block) => {
    const need = collisionWhenNames(block).length;
    if (used + need > BITS_PER_BYTE) {
      family++;
      used = 0;
    }
    const slot = {family: collisionWhenFamily(family), bits: Array.from({length: need}, (_, i) => used + i)};
    used += need;
    return slot;
  });
};

// The families the plan needs for these blocks: [{family, bits}].
export const collisionWhenFamilies = (blocks) => collisionWhenSlots(blocks).reduce((families, slot) => {
  let entry = families.find((candidate) => candidate.family === slot.family);
  if (!entry) families.push(entry = {family: slot.family, bits: []});
  entry.bits.push(...slot.bits);
  return families;
}, []);

export const reserveCollisionWhenDevVars = (reserveDevVar, blocks) => {
  collisionWhenFamilies(blocks).forEach(({family}) => {
    reserveDevVar(flagPoolVar(family), undefined, 'a bit for each sprite of each "When ... collide" block: the sprites collided when it was last run');
  });
};

// The code of a block for one of its sprites (part): the test of the collision, the bit and the blocks inside, run once when the collision starts. The test
// is jumped on the way the If block does it (see controls_if in logic.js): the opposite of the condition when there is one (a chain of tests joined by ||
// has none that batari Basic takes in the other form past three tests), else "then goto ... else goto ...".
export const collisionWhenCode = (Blockly, block, part, collided, body) => {
  const index = (Blockly.BBasic.collisionWhenBlocks || []).findIndex((candidate) => candidate.id === block.id);
  if (index < 0) return '';
  const slot = collisionWhenSlots(Blockly.BBasic.collisionWhenBlocks)[index];
  const name = Blockly.BBasic.nameDB_.getName(flagPoolVar(slot.family), Blockly.Names.DEVELOPER_VARIABLE_TYPE);
  const was = `${name}{${flagPoolBit(slot.family, slot.bits[part])}}`;
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
