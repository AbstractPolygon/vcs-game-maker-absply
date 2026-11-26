import * as Blockly from 'blockly/core';
import {registerExtension, numberDefaultsExtension} from './extension';

// The gravity block's direction starts at 128: down.
registerExtension('object_gravity_defaults', numberDefaultsExtension({PULL: 3, MAXFALL: 4, ANGLE: 128}));

import {processPlayerAnimationsStorageDefaults} from '../generators/bbasic/sprites';
import {usePlayerAnimationsStorage, useConfigurationStorage} from '../hooks/project';
import {playerCount, EXTRA_PLAYER_NUMBER, EXTRA_PLAYER_NAME} from '../utils/pxe';
import {SPRITE_POOL_COLOUR} from './sprite-pool';
import {rainbowRangeArgs} from './rainbow-colors';
import {PLAYER_ICON, MISSILE_ICON, BALL_ICON, COLOR_ICON, HEIGHT_ICON, ANIMATION_ICON, VISIBILITY_ICON, HORIZONTAL_ICON, VERTICAL_ICON, MIRROR_ICON, FRAME_ICON, PLAY_ICON, PAUSE_ICON, PRIORITY_ICON, DATA_ICON, SEEK_ICON, LOCK_ICON, INERTIA_ICON, STOP_ICON} from './icon';

const PRIORITY_COLOUR = '#009688';

// The generated code dispatches on the animation's position in the list
// ("if player0animation = 2 ..."), not on its id, so the option value is the
// index. Storage is read afresh on each call rather than through a cached
// computed, so renamed and added animations show up without a reload.
const buildAnimationOptions = (storageFactory) => () => {
  try {
    const player = processPlayerAnimationsStorageDefaults(storageFactory());
    return player.animations.map((animation, index) =>
      [animation.name || `Unnamed ${index + 1}`, `${index}`]);
  } catch (e) {
    console.error('Failed to list animation options', e);
    return [['Error', '0']];
  }
};

// Defined programmatically because a JSON definition can only hold a fixed list
// of options, and this one has to be rebuilt each time the dropdown opens.
// Player 0 and Player 1 share this one combined block type (see PLAYER_OPTIONS'
// comment below for why) - no VAR-sync extension needed here unlike
// buildCombinedPlayerVarBlocks'  get/set/change blocks, since the animation
// list itself (buildAnimationOptions) is the SAME shared pool regardless of
// which player is picked, not a player0-prefixed/player1-prefixed pair of
// options like a real bB variable name would be.
const buildAnimationSelectBlock = ({icon, colour, storageFactory}) => {
  // Value block: picks an animation by name and reports its number, so it can
  // be plugged into the sprite setter or anywhere else a number is wanted.
  Blockly.Blocks['sprite_player_animation_select'] = {
    init: function() {
      this.appendDummyInput()
          .appendField(`${icon} ${ANIMATION_ICON} animation`)
          .appendField(
              new Blockly.FieldDropdown(buildAnimationOptions(storageFactory)), 'VAR');
      this.setOutput(true, 'Number');
      this.setColour(colour);
      // No player to pick: every sprite shares the one pool of animations. Plugged into a block that has a player, it takes that
      // player's colour (red for Player 0, blue for Player 1, and so on); unplugged it keeps the plain one.
      const block = this;
      // (Never while a block is being dragged, or on the insertion marker the drag shows: recoloring then rebuilds blocks Blockly is
      // in the middle of connecting and disconnecting.)
      this.setOnChange(() => {
        if (!block.workspace || block.workspace.isFlyout || block.isInsertionMarker() ||
          (block.workspace.isDragging && block.workspace.isDragging())) return;
        const parentPlayer = block.getParent() && block.getParent().getFieldValue('PLAYER');
        const wanted = parentPlayer == null ? 'red' :
          parentPlayer === '1' ? 'blue' : EXTRA_PLAYER_NUMBER.test(parentPlayer) ? extraPlayerColour(parentPlayer) : 'red';
        if (block.getColour() === Blockly.utils.colour.parse(wanted)) return;
        setTimeout(() => {
          if (block.disposed || !block.workspace || block.isInsertionMarker() || block.workspace.isDragging()) return;
          block.setColour(wanted);
        }, 0);
      });
      this.setTooltip('Reports the animation\'s number.');
    },
  };
};

// Statement block: combines picking the player AND picking the animation by
// name into a single block - a real reported gap, since the generic
// sprite_player_set block (see buildCombinedPlayerVarBlocks) plugged with
// sprite_player_animation_select above makes the user pick the SAME player
// twice (once on each block) to do the single, extremely common "set this
// player's animation" action. Kept as a separate block rather than undoing
// the Player 0/1 combination everywhere else - every other property still
// benefits from the generic get/set/change pattern; only "pick an animation
// by name" is common/awkward enough to deserve this shortcut.
const buildAnimationSetBlock = ({icon, colour, storageFactory}) => {
  Blockly.Blocks['sprite_player_set_animation'] = {
    init: function() {
      this.appendDummyInput()
          .appendField(`${icon} Player`)
          .appendField(new Blockly.FieldDropdown(PLAYER_DROPDOWN_OPTIONS), 'PLAYER')
          .appendField(`${ANIMATION_ICON} set animation to`)
          .appendField(
              new Blockly.FieldDropdown(buildAnimationOptions(storageFactory)), 'VAR')
          .appendField(' ')
          .appendField(new Blockly.FieldCheckbox('TRUE'), 'RESTART')
          .appendField('restart at frame')
          .appendField(new Blockly.FieldNumber(1, 1, 255, 1), 'START')
          .appendField(' ')
          .appendField(new Blockly.FieldCheckbox('TRUE'), 'LOOP')
          .appendField('loop');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(colour);
      // Same "VAR translation naturally no-ops" reasoning as
      // sprite_player_animation_select's comment just above - VAR here is
      // an animation-list index too, never a "player0..."-prefixed name.
      Blockly.Extensions.apply('sprite_player_field_sync', this, false);
      this.setTooltip('"restart": play from the first frame (or the frame number given; 1 is the first, past the last starts on the last), else carry on from the current position. "loop" off plays it once and stays on the last frame.');
    },
  };
};

// Same one-step shortcut as buildAnimationSetBlock above, but for an
// animation's raw numeric list position (its 0-based index, matching
// sprite_player_animation_select's VAR value) instead of its name - a
// plugged expression/variable/Data table lookup can't be resolved to a
// fixed name the way the dropdown block above needs, so this takes a VALUE
// input instead of a VAR dropdown. The generic sprite_player_set block
// (VAR = Animation) already supports this too, for a value plugged into
// ITS VALUE input, but needs picking "Animation" from VAR first - this
// skips that extra step for the same reason buildAnimationSetBlock skips
// VAR's dropdown.
const buildAnimationSetByIdBlock = ({icon, colour}) => {
  Blockly.Blocks['sprite_player_set_animation_id'] = {
    init: function() {
      this.appendValueInput('VALUE')
          .setCheck('Number')
          .appendField(`${icon} Player`)
          .appendField(new Blockly.FieldDropdown(PLAYER_DROPDOWN_OPTIONS), 'PLAYER')
          .appendField(`${ANIMATION_ICON} set animation to ID`);
      this.appendDummyInput()
          .appendField(' ')
          .appendField(new Blockly.FieldCheckbox('TRUE'), 'RESTART')
          .appendField('restart')
          .appendField(' ')
          .appendField(new Blockly.FieldCheckbox('TRUE'), 'LOOP')
          .appendField('loop');
      this.setInputsInline(true);
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(colour);
      Blockly.Extensions.apply('sprite_player_field_sync', this, false);
      this.setTooltip('Sets the animation by its list position (0-based, top to bottom). "restart": play from the first frame, else carry on from the current position. "loop" off plays it once and stays on the last frame.');
    },
  };
};

// One-step getter: reads the chosen player's CURRENTLY PLAYING animation as
// its raw numeric list position - pairs with buildAnimationSetByIdBlock
// above the same way sprite_player_animation_select (pick a name, get its
// ID) pairs with buildAnimationSetBlock. The generic sprite_player_get
// block (VAR = Animation) already reads this too, just needing "Animation"
// picked from VAR first - this skips that extra step for the same reason
// buildAnimationSetByIdBlock skips sprite_player_set's VAR dropdown.
const buildAnimationIdGetBlock = ({icon, colour}) => {
  Blockly.Blocks['sprite_player_animation_id_get'] = {
    init: function() {
      this.appendDummyInput()
          .appendField(`${icon} Player`)
          .appendField(new Blockly.FieldDropdown(PLAYER_DROPDOWN_OPTIONS), 'PLAYER')
          .appendField(`${ANIMATION_ICON} current animation ID`);
      this.setOutput(true, 'Number');
      this.setColour(colour);
      Blockly.Extensions.apply('sprite_player_field_sync', this, false);
      this.setTooltip('The number of the playing animation: its list position (0-based, top to bottom).');
    },
  };
};

// Works exactly like sprite_player_fade_finished (see its comment below) -
// same shared "check a flag bit, clear it, run DO" shape,
// just watching a non-looping animation's "finished" bit (see
// animationLoopBitsCode in generators/bbasic/sprites.js) instead of a color
// fade's. Never fires for a LOOPING animation (the default - see the "loop"
// checkbox on "Player set animation to"/"Player set animation to ID"/the
// generic "Player set Animation to"), since a looping animation never
// actually reaches a stopped "finished" state to begin with.
const buildAnimationFinishedBlock = ({icon, colour}) => {
  Blockly.Blocks['sprite_player_animation_finished'] = {
    init: function() {
      this.appendDummyInput()
          .appendField(`${icon} When Player`)
          .appendField(new Blockly.FieldDropdown(PLAYER_DROPDOWN_OPTIONS), 'PLAYER')
          .appendField(`${ANIMATION_ICON} animation has finished`);
      this.appendStatementInput('DO');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(colour);
      Blockly.Extensions.apply('sprite_player_field_sync', this, false);
      this.setTooltip('Runs once when a non-looping animation reaches its last frame. Never runs for a looping animation.');
    },
  };
};

const buildPlayerOptions = (name) => [
  [HORIZONTAL_ICON + ' X', `${name}x`],
  [VERTICAL_ICON + ' Y', `${name}y`],
  [COLOR_ICON + ' Color', `${name}realcolor`],
  [ANIMATION_ICON + ' Animation', `${name}animation`],
  [MIRROR_ICON + ' Horizontal flip', `__${name}size_3_`],
];

const buildMissileOptions = (name) => [
  [HORIZONTAL_ICON + ' X', `${name}x`],
  [VERTICAL_ICON + ' Y', `${name}y`],
  [HEIGHT_ICON + ' Height', `${name}height`],
];

const PLAYER_SIZE_OPTIONS = [
  ['1 copy of player and missile.', '$0'],
  ['2 close-spaced copies of player and missile.', '$1'],
  ['2 medium-spaced copies of player and missile.', '$2'],
  ['3 close-spaced copies of player and missile.', '$3'],
  ['2 wide-spaced copies of player and missile.', '$4'],
  ['Double-sized player.', '$5'],
  ['3 medium-spaced copies of player and missile.', '$6'],
  ['Quad-sized', '$7'],
];

const MISSILE_SIZE_OPTIONS = [
  ['1', '$00'],
  ['2', '$10'],
  ['4', '$20'],
  ['8', '$30'],
];

// Same 0-7 clockwise-from-Up encoding as input_joyN_direction8 (see
// blocks/input.js's  buildJoystickDirection8Block) - used for the Fire
// block's "Default direction" dropdown (see generateMissileFireChecks'
// trigger comment): whatever the user picks here is what actually fires
// when the Angle input evaluates to 255 ("no clear direction" - e.g. the
// joystick is centered), rather than a single hardcoded fallback, so any of
// the 8 directions can be the default, not just Up.
const MISSILE_FIRE_DEFAULT_ANGLE_OPTIONS_8 = [
  ['⬆ Up', '0'],
  ['↗ Up-Right', '1'],
  ['➡ Right', '2'],
  ['↘ Down-Right', '3'],
  ['⬇ Down', '4'],
  ['↙ Down-Left', '5'],
  ['⬅ Left', '6'],
  ['↖ Up-Left', '7'],
];
// Same 0-15 scale DIRECTION16_STEPS (generators/bbasic/sprites.js) uses at
// runtime - even indices are the original 8 compass points above (doubled),
// odd indices are the new halfway points "16 directions" inserts between
// each pair.
const MISSILE_FIRE_DEFAULT_ANGLE_OPTIONS_16 = [
  ['⬆ Up', '0'],
  ['⬆ Up (leaning right)', '1'],
  ['↗ Up-Right', '2'],
  ['➡ Right (leaning up)', '3'],
  ['➡ Right', '4'],
  ['➡ Right (leaning down)', '5'],
  ['↘ Down-Right', '6'],
  ['⬇ Down (leaning right)', '7'],
  ['⬇ Down', '8'],
  ['⬇ Down (leaning left)', '9'],
  ['↙ Down-Left', '10'],
  ['⬅ Left (leaning down)', '11'],
  ['⬅ Left', '12'],
  ['⬅ Left (leaning up)', '13'],
  ['↖ Up-Left', '14'],
  ['⬆ Up (leaning left)', '15'],
];
// Dynamic dropdown generator (Blockly's  FieldDropdown constructor
// accepts a function as well as a plain array) - "this" is the FIELD
// instance when Blockly calls this, per the standard dynamic-options
// convention already used elsewhere in this codebase (e.g. blocks/
// text-strings.js's  buildTextStringOptions). Reads the SIBLING
// DIRECTIONS16 checkbox off the same block to decide which of the two
// static lists above to show - falls back to the 8-way list if the block
// isn't attached yet (the very first call, made by the FieldDropdown
// constructor itself before this field has even been appended to a block).
const buildMissileFireDefaultAngleOptions = function() {
  // eslint-disable-next-line no-invalid-this
  const block = this.getSourceBlock && this.getSourceBlock();
  const mode = block && block.getFieldValue('DIRECTIONS16');
  // (Any direction does not use the default, but keeps the finer list so that a value picked before stays valid.)
  return mode === 'TRUE' || mode === 'ANY' ? MISSILE_FIRE_DEFAULT_ANGLE_OPTIONS_16 : MISSILE_FIRE_DEFAULT_ANGLE_OPTIONS_8;
};
// Wires the DIRECTIONS16 checkbox so toggling it both refreshes
// DEFAULT_ANGLE's  dynamic option list (FieldDropdown caches its
// generated menu - see registerDropdownFieldSyncExtension's  identical
// "getOptions() before setValue()" gotcha above) AND translates whatever
// value was already selected onto the new scale, the same doubling this
// block's  generator already does at compile time for a 255 ("no clear
// direction") fallback - so a project that already had e.g. "Right" (2)
// picked before checking "16 directions" lands on the equivalent "Right"
// (4) on the finer scale instead of silently becoming "Right (leaning up)".
// Halving on the way back down floors to the nearest original compass
// point, since a halfway direction has no exact 8-way equivalent. Also
// busts DEFAULT_ANGLE's  option cache once unconditionally right after
// setup, so a block loaded from a saved project with "16 directions"
// already checked shows the right list immediately - a field's validator
// never fires for a value that arrives via XML load with events suppressed
// (see registerDropdownFieldSyncExtension's  comment on that exact
// mechanism), so waiting for a live toggle to do this wouldn't cover that
// case.
const setupFireDefaultAngleSync = (block) => {
  const directions16Field = block.getField('DIRECTIONS16');
  const defaultAngleField = block.getField('DEFAULT_ANGLE');
  if (!directions16Field || !defaultAngleField) return;
  directions16Field.setValidator(function(newValue) {
    // eslint-disable-next-line no-invalid-this
    const wasFine = this.getValue() !== 'FALSE';
    const isFine = newValue !== 'FALSE';
    if (wasFine !== isFine) {
      const current = parseInt(defaultAngleField.getValue(), 10) || 0;
      const translated = isFine ? current * 2 : Math.floor(current / 2);
      defaultAngleField.getOptions();
      defaultAngleField.setValue(String(translated));
    }
    return newValue;
  });
  // Any direction has no default angle and no "same speed" box (every angle moves at the same speed): their rows are hidden. Whenever the value is set, also
  // when a saved project loads it with the events off.
  const syncRows = (value) => {
    ['DEFAULT_INPUT', 'EVENSPEED_INPUT'].forEach((name) => {
      const input = block.getInput(name);
      if (input) input.setVisible(value !== 'ANY');
    });
  };
  const setValueOriginal = directions16Field.doValueUpdate_;
  directions16Field.doValueUpdate_ = function(newValue) {
    // eslint-disable-next-line no-invalid-this
    setValueOriginal.call(this, newValue);
    syncRows(newValue);
  };
  syncRows(directions16Field.getValue());
  defaultAngleField.getOptions();
};

// Player 0 and Player 1 are otherwise-identical hardware players (same
// register SHAPE, just player0* vs player1* real bB variable names - see
// generators/bbasic/sprites.js's  ROM_NOISE_COLOR_REGISTERS comment for
// the one place they're genuinely different real registers, which is
// data-driven by name already, not block-shape-driven), so every Player
// block is a single combined type with this PLAYER dropdown instead of a
// separate sprite_player0_*/sprite_player1_* pair - confirmed with the user
// (this used to be two full sets of blocks; Ball is NOT part of this - it
// never had a twin to combine with, so buildSpriteBlocks below stays per-name
// for it (its Fire block is the combined Missile/Ball one). Missile 0/1 get the exact
// same "one combined type, MISSILE dropdown instead of PLAYER" treatment
// - see MISSILE_OPTIONS just below).
// Labels are bare "0"/"1", not "Player 0"/"Player 1" - every combined
// Player block's  message0 already has a static "Player" word right
// before this dropdown (see buildCombinedPlayerVarBlocks etc. below), so
// full labels here would read as a doubled "Player Player 0" once placed.

// The DPC+ kernel has eight more sprites (Player 2 to 9), offered by the blocks that can drive them.
// (And the PXE kernel eight more, Player 10 to 16.)
// "pool sprite" stands for the sprite a Sprite pool block is working on (see blocks/sprite-pool.js); it is only offered where a virtual sprite exists.
const PLAYER_DROPDOWN_OPTIONS = function() {
  const count = playerCount(((useConfigurationStorage() || {}).value || {}));
  return [...Array.from({length: count}, (_, i) => [String(i), String(i)]), ...(count > 2 ? [['pool sprite', 'pool'], ['all pool sprites', 'poolall']] : [])];
};

const playerNameFromField = (block) => {
  const value = block && block.getFieldValue('PLAYER');
  return /^pool(all)?$/.test(value) ? `player${value}` : `player${/^([0-9]|1[0-6])$/.test(value) ? value : '0'}`;
};

// Same reasoning as PLAYER_OPTIONS above, for Missile 0/1 - genuinely
// identical hardware objects (missileFireActiveBit/missileFireDirVarName/
// etc. in generators/bbasic/sprites.js already treat 'missile0'/'missile1'
// as pure data, never branching on which one), just missile0*/missile1*
// real bB variable names.
// Same "bare 0/1, not Missile 0/Missile 1" reasoning as PLAYER_OPTIONS
// above - every combined Missile block's  message0 already has a
// static "Missile" word right before this dropdown.
const MISSILE_OPTIONS = [['0', '0'], ['1', '1']];
// "Colliding sprite" at the end of a block's sprite dropdown (the first choice stays the one a new block has): inside a When ... collide block, the
// sprite whose collision started (see generators/bbasic/colliding-sprite.js; outside one the block does nothing). The players' and missiles' dropdowns
// name them by number, the objects' by name.
const withColliding = (options) => () => [...(typeof options === 'function' ? options() : options), ['colliding sprite', 'colliding']];
const withCollidingObjects = (options) => () => [...(typeof options === 'function' ? options() : options), [PLAYER_ICON + ' Colliding sprite', 'colliding']];
// The Fire block covers both missiles and the ball in one dropdown (the field is still called
// MISSILE, as it was when the block only did missiles, so saved projects keep loading).
const FIRE_OBJECT_OPTIONS = [['Missile 0', '0'], ['Missile 1', '1'], ['Ball', 'ball']];
// Fire also launches the players (all ten on DPC+, two otherwise), as a Fire object like the missiles.
const FIRE_OBJECT_DROPDOWN_OPTIONS = function() {
  const players = Array.from({length: playerCount(((useConfigurationStorage() || {}).value || {}))}, (_, i) => ['Player ' + i, 'player' + i]);
  return [...FIRE_OBJECT_OPTIONS, ...players, ...(players.length > 2 ? [['pool sprite', 'playerpool'], ['all pool sprites', 'playerpoolall']] : [])];
};
// Players 2 to 9 (DPC+ virtual sprites) each get a different color on the blocks that pick one, Player 0 is red and Player 1 blue.
const EXTRA_PLAYER_COLOURS = {
  2: '#2e9e4f', 3: '#8a5ac2', 4: '#d4a017', 5: '#17a2b8', 6: '#d6338a', 7: '#7a8c2c', 8: '#8d5a3b', 9: '#607d8b',
  // (PXE: Players 10 to 16, the shades of the first seven again but darker or lighter.)
  10: '#1b7a3a', 11: '#6d3fa8', 12: '#b88a00', 13: '#0f7f92', 14: '#b02070', 15: '#5c6b1f', 16: '#6e4630',
};
const extraPlayerColour = (number) => EXTRA_PLAYER_COLOURS[number] || '#8a5ac2';
const fireObjectColour = (value) => (value === 'ball' ? '#ff8800' : (value === '1' || value === 'player1') ? 'blue' :
  EXTRA_PLAYER_NAME.test(value) ? extraPlayerColour(value.slice(6)) : 'red');

// The color of the blocks for a sprite of a scene (utils/scene.js: 0 to 9 the players, 10 and 11 the missiles, 12 the ball, 13 to 19 the
// players 10 to 16 of PXE).
export const sceneObjectColour = (object) => {
  const colour = object <= 9 ? (object === 0 ? 'red' : object === 1 ? 'blue' : extraPlayerColour(object)) :
    object >= 13 ? extraPlayerColour(object - 3) : fireObjectColour(object === 12 ? 'ball' : String(object - 10));
  // The blocks draw the names red and blue as pure #ff0000 and #0000ff (a chip would take them for the Material colors).
  return colour === 'red' ? '#ff0000' : colour === 'blue' ? '#0000ff' : colour;
};

const missileNameFromField = (block) => `missile${block && block.getFieldValue('MISSILE') === '1' ? '1' : '0'}`;

// Builds the VAR dropdown's option list fresh every time it opens (the same
// "dynamic options" FieldDropdown support blocks/bit.js's
// buildVariableField already relies on) - the real variable names
// underneath (player0x vs player1x, etc.) depend on whichever player THIS
// block's  PLAYER field currently holds, so a plain static option array
// can't work once Player 0/1 share one block type. extraOptionsFor, when
// given, appends whatever extra get-only/set-only options that block needs
// (Frame for the getter, Visibility for the setter) - "change" passes
// nothing, matching buildSpriteBlocks'  three-way options/writeOnly/
// readOnly split below.
const buildPlayerVarOptionsFn = (extraOptionsFor) => function() {
  // eslint-disable-next-line no-invalid-this
  const name = playerNameFromField(this.getSourceBlock());
  return [...buildPlayerOptions(name), ...(extraOptionsFor ? extraOptionsFor(name) : [])];
};

// Under DPC+ each missile has a separate color register (COLUM0/COLUM1), where the standard kernel draws a missile in
// its player's color. The Missile blocks' Color option stands for it; the generator turns it into that register.
const dpcPlusMissileColorOptions = (name) =>
  (((useConfigurationStorage() || {}).value || {}).kernel === 'dpcplus' ? [[COLOR_ICON + ' Color', `${name}color`]] : []);

// Same reasoning as buildPlayerVarOptionsFn above, for the combined Missile
// 0/1 get/set/change blocks - extraOptionsFor appends Width (set-only), the
// missile equivalent of buildPlayerVarOptionsFn's  Frame/Visibility.
const buildMissileVarOptionsFn = (extraOptionsFor) => function() {
  // eslint-disable-next-line no-invalid-this
  const name = missileNameFromField(this.getSourceBlock());
  return [...buildMissileOptions(name), ...(extraOptionsFor ? extraOptionsFor(name) : [])];
};

// Registers a "dropdown drives colour + VAR field" extension shared by both
// the combined Player and combined Missile blocks (see PLAYER_OPTIONS'/
// MISSILE_OPTIONS' comments) - identical logic either way, just reading
// a differently-named dropdown field and a differently-prefixed real
// variable name, so this is written once and called twice rather than
// hand-duplicated.
//
// Single extension covering BOTH concerns every combined block needs from
// its  dropdown field - Blockly.Block.prototype.setOnChange (see its
// JSDoc) REPLACES any prior onchange handler rather than composing with it,
// so this can't be split into two separate registered extensions (one per
// concern) the way it reads more naturally; every block gets exactly one
// 'extensions' entry pointing here instead.
//
// 1. Colour - index0 (Player 0/Missile 0) = red, index1 (Player 1/
//    Missile 1) = blue, the exact colours the old separate per-name blocks
//    used to be, before they were combined into one type each (confirmed
//    with the user: still wanted that same visual distinction, just driven
//    by the dropdown now instead of by which block type was dragged out).
//    Applied once immediately (a block's  initial colour, from its JSON
//    'colour' key, is only ever right for the dropdown's default value) and
//    again on every change.
// 2. VAR sync (only for blocks that actually have a VAR field - get/set/
//    change) - keeps VAR showing a valid, correctly-translated option after
//    the dropdown changes. Without this, switching e.g. Player 0 -> Player 1
//    on an existing block would leave VAR holding a stale "player0..."
//    value that isn't even one of the (now player1-prefixed) options being
//    shown. Translates the SAME property across (player0x -> player1x, not
//    silently resetting back to X every time) when the old value still has
//    the expected prefix; otherwise leaves it alone.
//
// Registered as a VALIDATOR directly on the dropdown field, not via
// Blockly.Block.prototype.setOnChange - confirmed as a real reported bug:
// setOnChange only ever fires from a real Blockly.Events.BlockChange event,
// and Blockly suppresses event firing entirely while a block is being
// built from XML with events disabled (see Field.prototype.setValue's
// "if (source && Blockly.Events.isEnabled())" guard in node_modules/
// blockly/core/field.js) - which is exactly how every TOOLBOX FLYOUT block
// is constructed (Blockly.Xml.domToBlock, called with events off for
// performance), so a block placed in the toolbox XML with e.g.
// `<field name="PLAYER">1</field>` never fired the change this relied on
// and stayed whatever colour PLAYER's  JSON default resolved to. A
// field's LOCAL VALIDATOR (this.getValidator()/setValidator()), by
// contrast, is called unconditionally from inside setValue() itself,
// BEFORE that same events-enabled check - runs every single time, XML load
// or live user edit alike. Field.prototype.setValue's  oldValue read
// happens AFTER the validator runs but BEFORE the new value is committed,
// so the validator's `this.getValue()` (this = the field) is still the
// OLD value at the point it runs, and the validator's  newValue
// parameter is the incoming one - exactly the {old, new} pair this used to
// read off the (unreliable) BlockChange event instead.
//
// VAR's  getOptions() (no cache arg) has to run BEFORE its setValue() -
// same gotcha blocks/bit.js's  refreshVariableDropdownValue documents:
// the dropdown's dynamic options are cached until something invalidates
// them, and setValue()'s  validation reads whatever's cached, so
// skipping the fresh getOptions() call would just validate the translated
// value against the OLD option list instead of the new one.
// Exported - blocks/input.js's combined Joystick 0/1 blocks reuse this
// directly (same "dropdown drives colour + optional VAR-prefix translate"
// shape) rather than duplicating it.
export const registerDropdownFieldSyncExtension = (extensionName, dropdownFieldName, namePrefixFor) => {
  const colourFor = (value) => (/^pool(all)?$/.test(value) ? SPRITE_POOL_COLOUR : value === '1' ? 'blue' : EXTRA_PLAYER_NUMBER.test(value) ? extraPlayerColour(value) : 'red');
  registerExtension(extensionName, function() {
    // eslint-disable-next-line no-invalid-this
    const block = this;
    const dropdownField = block.getField(dropdownFieldName);
    if (!dropdownField) return;
    block.setColour(colourFor(dropdownField.getValue()));
    dropdownField.setValidator(function(newValue) {
      block.setColour(colourFor(newValue));
      const varField = block.getField('VAR');
      // eslint-disable-next-line no-invalid-this
      const oldValue = this.getValue();
      // Only when the dropdown is ACTUALLY changing - XML deserialization
      // (loading a saved project) calls setValue for every field tag
      // regardless of whether it differs from the field's just-constructed
      // default, so a block whose PLAYER/MISSILE tag happens to match its
      // default (e.g. "0", same as a fresh block's starting value)
      // would otherwise still schedule a "correction" below - see this
      // whole block's comment for why that's applied AFTER the fact,
      // and why applying it unconditionally clobbered the VALUE this same
      // block's explicit VAR tag had already (correctly) set moments
      // later in the same deserialization pass (confirmed as a real
      // reported bug - see git history for this block).
      if (varField && oldValue !== newValue) {
        // Deferred via setTimeout (same "run after the current Blockly
        // field-update cascade finishes" pattern as blocks/function.js's
        // fixFunctionCallNames/updateFunctionCallArgVisibility), AND
        // re-reading VAR's value fresh only once deferred, not captured
        // synchronously here - confirmed as a real reported bug otherwise
        // ("Player 1 set" blocks silently moving Player 0"): this
        // validator runs BEFORE the dropdown field's value actually
        // commits (Field.prototype.setValue calls the local validator,
        // then only afterwards updates this.value_ - see node_modules/
        // blockly/core/field.js), so reading/translating VAR's value
        // synchronously here uses a STILL-STALE menuGenerator result (it
        // reads this block's PLAYER/MISSILE field LIVE, still the OLD
        // value at this exact moment) - and, if this block has ITS
        // separate VAR field tag still to come later in the same XML
        // deserialization pass, a translated value captured NOW would go
        // stale the instant that later, legitimate tag applies, and then
        // silently overwrite it right back out from under it once this
        // deferred callback finally runs. Reading everything fresh here
        // instead - by now PLAYER/MISSILE's value has genuinely
        // committed AND any of this block's later field tags have
        // already applied - avoids both problems at once.
        setTimeout(() => {
          if (!block.workspace || (typeof block.isDeadOrDying === 'function' && block.isDeadOrDying())) return;
          const oldName = namePrefixFor(oldValue);
          const newName = namePrefixFor(newValue);
          const current = varField.getValue();
          // A plain .replace() (first occurrence anywhere), not an
          // indexOf(...)===0/slice pair - confirmed as a real reported bug
          // otherwise ("Horizontal flip" left untranslated switching
          // Player 0/1): buildPlayerOptions' Horizontal flip option
          // value is `__${name}size_3_` (the player name embedded after a
          // leading "__", not at the very start of the string, unlike every
          // other property's `${name}...` shape), so an indexOf(...)===0
          // check never matched it at all. Every raw value this can ever
          // see is one of this app's generated option strings (never
          // user input), so a first-occurrence replace is safe - there's
          // no risk of coincidentally matching unrelated text.
          const translated = (typeof current === 'string' && current.includes(oldName)) ?
            current.replace(oldName, newName) : current;
          if (translated === current) return;
          varField.generatedOptions = null;
          varField.setValue(translated);
        }, 0);
      }
      return newValue;
    });
  });
};

registerDropdownFieldSyncExtension('sprite_player_field_sync', 'PLAYER',
    (value) => (/^pool(all)?$/.test(value) ? `player${value}` : `player${/^([0-9]|1[0-6])$/.test(value) ? value : '0'}`));
registerDropdownFieldSyncExtension('sprite_missile_field_sync', 'MISSILE',
    (value) => `missile${value === '1' ? '1' : '0'}`);

// The combined Player getter/setter/"change by" - see PLAYER_OPTIONS'
// comment above. Unlike buildSpriteBlocks below (still per-name, still used
// for Missile 0/1/Ball), this is only ever called once, for both players at
// once - there's no separate "options"/description per player anymore, just
// the one shared VAR dropdown reading whichever player PLAYER currently
// names (buildPlayerVarOptionsFn above).
const buildCombinedPlayerVarBlocks = ({icon, colour}) => {
  Blockly.defineBlocksWithJsonArray([
    // Block for the getter.
    {
      'type': 'sprite_player_get',
      'message0': `${icon} Player %1 %2`,
      'args0': [
        {
          'type': 'field_dropdown',
          'name': 'PLAYER',
          'options': withColliding(PLAYER_DROPDOWN_OPTIONS),
        },
        {
          'type': 'field_dropdown',
          'name': 'VAR',
          // Custom-ordered (not buildPlayerVarOptionsFn's usual "base
          // options, then extras appended at the end") so Height can sit
          // between Y and Color, as requested, rather than trailing after
          // Frame like every other get-only extra does.
          'options': function() {
            // eslint-disable-next-line no-invalid-this
            const name = playerNameFromField(this.getSourceBlock());
            return [
              [HORIZONTAL_ICON + ' X', `${name}x`],
              [VERTICAL_ICON + ' Y', `${name}y`],
              // player0height/player1height are real batari Basic kernel
              // variables (see sprite_player_rom_noise's comment in
              // generators/bbasic/sprites.js) - auto-set by the compiler to
              // match whichever graphic frame is currently showing, exactly
              // like player0frame already is, so this needs no new dev var
              // or generator special-case, just another plain get-only
              // option resolving straight to the real kernel symbol.
              [HEIGHT_ICON + ' Height', `${name}height`],
              // The width/quantity code (0-7) "Player set width/quantity" writes into
              // the low 3 bits of the size variable: 0 is one copy, 5 double size,
              // 7 quad size, the rest are 2 or 3 copies. It is not a variable,
              // so the generator masks it out of the size variable.
              [HEIGHT_ICON + ' Width/quantity', `__${name}size_w_`],
              [COLOR_ICON + ' Color', `${name}realcolor`],
              [ANIMATION_ICON + ' Animation', `${name}animation`],
              [MIRROR_ICON + ' Horizontal flip', `__${name}size_3_`],
              [FRAME_ICON + ' Frame', `${name}frame`],
              // 1 while the player is shown, 0 while Visibility has hidden it (a hidden player
              // is on frame 255). Not a variable, so the generator works it out from the frame.
              [VISIBILITY_ICON + ' Visibility', `__${name}visible_`],
            ];
          },
        },
      ],
      // Also fits the true/false sockets of the Logic blocks: Visibility reads as true or false there.
      'output': ['Number', 'Boolean'],
      colour,
      'extensions': ['sprite_player_field_sync'],
      'tooltip': 'Visibility is 1 while the player is shown, 0 while hidden.',
    },
    // Block for the setter.
    {
      'type': 'sprite_player_set',
      'message0': `${icon} Player %1 set %2 to %3`,
      'args0': [
        {
          'type': 'field_dropdown',
          'name': 'PLAYER',
          'options': withColliding(PLAYER_DROPDOWN_OPTIONS),
        },
        {
          'type': 'field_dropdown',
          'name': 'VAR',
          'options': buildPlayerVarOptionsFn((name) => [
            [VISIBILITY_ICON + ' Visibility', `${name}visibility`],
            // Cuts a DPC+ player's picture down to this many scanlines (a drawn row is 2) whatever its animation frame
            // says, e.g. to make a bar that grows and shrinks. 255 takes the limit off.
            ...(((useConfigurationStorage() || {}).value || {}).kernel === 'dpcplus' ?
              [[HEIGHT_ICON + ' Height limit in lines (DPC+)', `${name}height`]] : []),
          ]),
        },
        {
          'type': 'input_value',
          'name': 'VALUE',
        },
      ],
      // A second row for the "loop" checkbox - same "field(s) FIRST, then
      // a trailing named input_dummy to close/wrap them" shape as
      // sprite_inertia_accelerate's DIRECTIONS16_INPUT/FINE_INPUT rows
      // (see that block's comment for why the dummy has to come AFTER the
      // field it's wrapping, not before - a real reported crash
      // ("FieldDropdown.getTextContent: text content is null") when this
      // was first built with the dummy declared first). Only actually
      // shown once VAR is "Animation" - see
      // sprite_player_set_loop_visibility_sync's comment below.
      'message1': '%1 %2 loop %3',
      'args1': [
        {'type': 'field_label', 'text': ' '},
        {
          'type': 'field_checkbox',
          'name': 'LOOP',
          'checked': true,
        },
        {
          'type': 'input_dummy',
          'name': 'LOOP_INPUT',
        },
      ],
      // A third row, for the "move away when hidden" checkbox (y 200 on DPC+, 0 on the standard kernel and PXE, see hiddenSpriteY in
      // generators/bbasic/sprites.js): only shown once VAR is "Visibility" (see the extension below).
      'message2': '%1 %2 move away when hidden %3',
      'args2': [
        {'type': 'field_label', 'text': ' '},
        {
          'type': 'field_checkbox',
          'name': 'ORIGIN',
          'checked': false,
        },
        {
          'type': 'input_dummy',
          'name': 'ORIGIN_INPUT',
        },
      ],
      // The "loop" and "move away when hidden" checkboxes come after the value on the same line, not on a separate line.
      'inputsInline': true,
      'previousStatement': null,
      'nextStatement': null,
      colour,
      'extensions': ['sprite_player_field_sync', 'sprite_player_set_loop_visibility_sync'],
      'tooltip': 'Setting Visibility to hidden can also move the player to x 0, y 0 (the checkbox): a hidden sprite left on the rows of a shown one can make the shown one drop out every other frame. Animation has a "loop" checkbox: off plays it once and stays on the last frame.',
    },
    // Block for adding to a variable in place.
    {
      'type': 'sprite_player_change',
      'message0': `${icon} Player %1 change %2 by %3`,
      'args0': [
        {
          'type': 'field_dropdown',
          'name': 'PLAYER',
          'options': withColliding(PLAYER_DROPDOWN_OPTIONS),
        },
        {
          'type': 'field_dropdown',
          'name': 'VAR',
          'options': buildPlayerVarOptionsFn(),
        },
        {
          'type': 'input_value',
          'name': 'DELTA',
          'check': 'Number',
        },
      ],
      // Same shape as sprite_player_set's message1/args1 just above.
      'message1': '%1 %2 loop %3',
      'args1': [
        {'type': 'field_label', 'text': ' '},
        {
          'type': 'field_checkbox',
          'name': 'LOOP',
          'checked': true,
        },
        {
          'type': 'input_dummy',
          'name': 'LOOP_INPUT',
        },
      ],
      'inputsInline': true,
      'previousStatement': null,
      'nextStatement': null,
      colour,
      'extensions': ['sprite_player_field_sync', 'sprite_player_set_loop_visibility_sync', 'math_change_tooltip'],
    },
  ]);
};

// Shows/hides sprite_player_set's/sprite_player_change's LOOP_INPUT (the
// "loop" checkbox) based on whether VAR is currently set to "Animation" -
// every other property (X/Y/Color/Visibility/Horizontal flip/...) has no
// such concept, so the checkbox would just read as a dead control for
// them. Same visibility-toggle shape/guards (insertion-marker/headless-
// workspace bail-outs) as sprite_inertia_accelerate_action_sync's
// comment above - VAR's value is a real variable name
// (player0animation/player1animation), not a fixed literal shared across
// every PLAYER choice, so this checks endsWith('animation') rather than a
// fixed option list, matching buildPlayerOptions' `${name}animation`
// value shape. A dedicated extension, not folded into
// registerDropdownFieldSyncExtension above - that one's shared with the
// combined Missile blocks too, which have no Animation option or
// LOOP_INPUT to toggle at all.
registerExtension('sprite_player_set_loop_visibility_sync', function() {
  // eslint-disable-next-line no-invalid-this
  const block = this;
  const varField = block.getField('VAR');
  if (!varField) return;
  const applyVisibility = (value) => {
    if (typeof block.isInsertionMarker === 'function' && block.isInsertionMarker()) return;
    if (!block.workspace || !block.workspace.rendered) return;
    const shouldBeVisible = typeof value === 'string' && value.endsWith('animation');
    const input = block.getInput('LOOP_INPUT');
    // (The "move away when hidden" row of Player set: only for Visibility. The Player change block has no such row.)
    const originInput = block.getInput('ORIGIN_INPUT');
    const originVisible = typeof value === 'string' && value.endsWith('visibility');
    const originChanged = !!originInput && originInput.isVisible() !== originVisible;
    if (originChanged) originInput.setVisible(originVisible);
    if ((!input || input.isVisible() === shouldBeVisible) && !originChanged) return;
    if (input && input.isVisible() !== shouldBeVisible) input.setVisible(shouldBeVisible);
    // Deferred, not called synchronously here - same "run after the
    // current Blockly field-update cascade finishes" reasoning
    // registerDropdownFieldSyncExtension's comment documents in detail.
    // This runs from TWO places that can both fire before the block has
    // ever gone through a first real render: once synchronously at
    // extension-apply time (construction - VAR's default option here is
    // X, not Animation, so this genuinely does need to hide LOOP_INPUT on
    // every fresh instance, unlike sprite_inertia_accelerate_action_sync's
    // initial call, which happens to be a no-op since that block's default
    // ACTION already matches its fields' starting visibility), and again
    // via the VALIDATOR the instant a saved project's XML
    // <field name="VAR"> tag gets applied during load - BEFORE this
    // block's first real render either time. Calling block.render()
    // synchronously in both cases corrupts this block's row/field
    // measurements for Blockly's subsequent real render pass right after -
    // confirmed as a real reported crash
    // ("FieldDropdown.getTextContent: text content is null") on every
    // fresh sprite_player_set/change instance AND on loading any saved
    // project with one. Deferring guarantees Blockly's first render
    // (which already reads isVisible() fresh regardless) has happened by
    // the time this actually runs.
    setTimeout(() => {
      // The block may be gone by now (the tab was left or a project was
      // imported in the meantime): rendering a disposed block throws and
      // breaks Blockly's shared render queue for every later render.
      if (!block.workspace || (typeof block.isDeadOrDying === 'function' && block.isDeadOrDying())) return;
      if (typeof block.queueRender === 'function') block.queueRender();
      else if (typeof block.render === 'function') block.render();
      if (block.workspace && block.workspace.resizeContents) block.workspace.resizeContents();
    }, 0);
  };
  applyVisibility(varField.getValue());
  varField.setValidator((newValue) => {
    applyVisibility(newValue);
    return newValue;
  });
});

// Bounce's spread input starts with a number block (a shadow, so it can be replaced), also on a block made without one (an older project).
registerExtension('object_bounce_spread_prefill', function() {
  // eslint-disable-next-line no-invalid-this
  const block = this;
  setTimeout(() => {
    if (!block.workspace || !block.workspace.rendered || (typeof block.isDeadOrDying === 'function' && block.isDeadOrDying())) return;
    if (typeof block.isInsertionMarker === 'function' && block.isInsertionMarker()) return;
    const input = block.getInput('SPREAD_STEPS');
    if (!input || !input.connection || input.connection.targetBlock()) return;
    const shadow = block.workspace.newBlock('math_number');
    shadow.setShadow(true);
    shadow.setFieldValue(1, 'NUM');
    shadow.initSvg();
    input.connection.connect(shadow.outputConnection);
    if (typeof shadow.render === 'function') shadow.render();
    if (typeof block.queueRender === 'function') block.queueRender();
  }, 0);
});

// Bounce's angle number is only shown while "set angle manually" is ticked.
// Same deferred-render reasoning as the extension above.
registerExtension('object_bounce_manual_angle_sync', function() {
  // eslint-disable-next-line no-invalid-this
  const block = this;
  const manualField = block.getField('MANUAL');
  if (!manualField) return;
  const applyVisibility = (value) => {
    if (typeof block.isInsertionMarker === 'function' && block.isInsertionMarker()) return;
    if (!block.workspace || !block.workspace.rendered) return;
    const shouldBeVisible = value === true || value === 'TRUE';
    const input = block.getInput('ANGLE');
    if (!input || input.isVisible() === shouldBeVisible) return;
    input.setVisible(shouldBeVisible);
    setTimeout(() => {
      if (!block.workspace || (typeof block.isDeadOrDying === 'function' && block.isDeadOrDying())) return;
      // Prefill the shown field with a number block (a shadow, so it can be
      // replaced) when nothing is plugged in.
      if (shouldBeVisible && !input.connection.targetBlock()) {
        const shadow = block.workspace.newBlock('math_number');
        shadow.setShadow(true);
        shadow.setFieldValue(0, 'NUM');
        shadow.initSvg();
        input.connection.connect(shadow.outputConnection);
        if (typeof shadow.render === 'function') shadow.render();
      }
      if (typeof block.queueRender === 'function') block.queueRender();
      else if (typeof block.render === 'function') block.render();
      if (block.workspace && block.workspace.resizeContents) block.workspace.resizeContents();
    }, 0);
  };
  applyVisibility(manualField.getValue());
  manualField.setValidator((newValue) => {
    applyVisibility(newValue);
    return newValue;
  });
});

// Same reasoning as buildCombinedPlayerVarBlocks above, for Missile 0/1 -
// Ball is NOT part of this (never had a twin), so buildSpriteBlocks below
// stays per-name for it, same as it always has.
const buildCombinedMissileVarBlocks = ({icon, colour}) => {
  Blockly.defineBlocksWithJsonArray([
    // Block for the getter.
    {
      'type': 'sprite_missile_get',
      'message0': `${icon} Missile %1 %2`,
      'args0': [
        {
          'type': 'field_dropdown',
          'name': 'MISSILE',
          'options': withColliding(MISSILE_OPTIONS),
        },
        {
          'type': 'field_dropdown',
          'name': 'VAR',
          'options': buildMissileVarOptionsFn(dpcPlusMissileColorOptions),
        },
      ],
      'output': 'Number',
      colour,
      'extensions': ['sprite_missile_field_sync'],
      'tooltip': 'Reads information about whichever missile is selected.',
    },
    // Block for the setter.
    {
      'type': 'sprite_missile_set',
      'message0': `${icon} Missile %1 set %2 to %3`,
      'args0': [
        {
          'type': 'field_dropdown',
          'name': 'MISSILE',
          'options': withColliding(MISSILE_OPTIONS),
        },
        {
          'type': 'field_dropdown',
          'name': 'VAR',
          'options': buildMissileVarOptionsFn((name) => [[HEIGHT_ICON + ' Width', `${name}width`], ...dpcPlusMissileColorOptions(name)]),
        },
        {
          'type': 'input_value',
          'name': 'VALUE',
        },
      ],
      'previousStatement': null,
      'nextStatement': null,
      colour,
      'extensions': ['sprite_missile_field_sync'],
      'tooltip': 'With the DPC+ kernel the missile also has a Color, and a Height of 0 hides it while 1 draws it on every other line.',
    },
    // Block for adding to a variable in place.
    {
      'type': 'sprite_missile_change',
      'message0': `${icon} Missile %1 change %2 by %3`,
      'args0': [
        {
          'type': 'field_dropdown',
          'name': 'MISSILE',
          'options': withColliding(MISSILE_OPTIONS),
        },
        {
          'type': 'field_dropdown',
          'name': 'VAR',
          'options': buildMissileVarOptionsFn(),
        },
        {
          'type': 'input_value',
          'name': 'DELTA',
          'check': 'Number',
        },
      ],
      'previousStatement': null,
      'nextStatement': null,
      colour,
      'extensions': ['sprite_missile_field_sync', 'math_change_tooltip'],
    },
  ]);
};

const buildSpriteBlocks = ({name, description, icon, options=[], writeOnlyOptions=[], readOnlyOptions=[], colour}) => {
  Blockly.defineBlocksWithJsonArray([
    // Block for the getter.
    {
      'type': `sprite_${name}_get`,
      'message0': `${icon} ${description} %1`,
      'args0': [
        {
          'type': 'field_dropdown',
          'name': 'VAR',
          'options': [...options, ...readOnlyOptions],
        },
      ],
      'output': 'Number',
      colour,
      'tooltip': `Reads information about ${description}`,
    },
    // Block for the setter.
    {
      'type': `sprite_${name}_set`,
      'message0': `${icon} ${description} %{BKY_VARIABLES_SET}`,
      'args0': [
        {
          'type': 'field_dropdown',
          'name': 'VAR',
          'options': [...options, ...writeOnlyOptions],
        },
        {
          'type': 'input_value',
          'name': 'VALUE',
        },
      ],
      'previousStatement': null,
      'nextStatement': null,
      colour,
      'tooltip': `Updates information about ${description}`,
    },
    // Block for adding to a variable in place.
    {
      'type': `sprite_${name}_change`,
      'message0': `${icon} ${description} %{BKY_MATH_CHANGE_TITLE}`,
      'args0': [
        {
          'type': 'field_dropdown',
          'name': 'VAR',
          options,
        },
        {
          'type': 'input_value',
          'name': 'DELTA',
          'check': 'Number',
        },
      ],
      'previousStatement': null,
      'nextStatement': null,
      colour,
      'extensions': ['math_change_tooltip'],
    },
  ]);
};

// The players the PXE kernel can mask at the screen edges: every one but Player 0.
const MASK_PLAYER_OPTIONS = function() {
  const count = Math.max(2, playerCount(((useConfigurationStorage() || {}).value || {})));
  return [...Array.from({length: count - 1}, (_, i) => [String(i + 1), String(i + 1)]), ...(count > 2 ? [['pool sprite', 'pool'], ['all pool sprites', 'poolall']] : [])];
};

// The players the rainbow colors blocks can color: Player 0 and 1, and under DPC+ the virtual sprites too (and the pool sprite).
const RAINBOW_PLAYER_OPTIONS = function() {
  const config = ((useConfigurationStorage() || {}).value || {});
  const count = config.kernel === 'dpcplus' ? playerCount(config) : 2;
  return [...Array.from({length: count}, (_, i) => [String(i), String(i)]), ...(count > 2 ? [['pool sprite', 'pool'], ['all pool sprites', 'poolall']] : [])];
};

const buildPlayerBlocks = ({icon, colour}) => {
  Blockly.defineBlocksWithJsonArray([
    // Block for changing a player's size and quantity.
    {
      'type': 'sprite_player_size',
      'message0': `${icon} Player %1 set width/quantity to %2`,
      'args0': [
        {
          'type': 'field_dropdown',
          'name': 'PLAYER',
          'options': withColliding(PLAYER_DROPDOWN_OPTIONS),
        },
        {
          'type': 'field_dropdown',
          'name': 'SIZE',
          'options': PLAYER_SIZE_OPTIONS,
        },
      ],
      'previousStatement': null,
      'nextStatement': null,
      colour,
      'extensions': ['sprite_player_field_sync', 'math_change_tooltip'],
    },
    // Block for the left and right edge masking of the PXE kernel.
    {
      'type': 'sprite_player_mask',
      'message0': `${icon} Player %1 edge masking %2`,
      'args0': [
        {
          'type': 'field_dropdown',
          'name': 'PLAYER',
          'options': withColliding(MASK_PLAYER_OPTIONS),
        },
        {
          'type': 'field_dropdown',
          'name': 'STATE',
          'options': [['on', 'on'], ['off', 'off']],
        },
      ],
      'previousStatement': null,
      'nextStatement': null,
      colour,
      'tooltip': 'PXE kernel only: with masking on, a sprite past the left or right screen edge is cut off there instead of showing on the other side. Player 0 has no masking.',
    },
    // Block for pausing/resuming a player's animation.
    {
      'type': 'sprite_player_animation_playback',
      'message0': `${icon} Player %1 ${ANIMATION_ICON} animation %2`,
      'args0': [
        {
          'type': 'field_dropdown',
          'name': 'PLAYER',
          'options': withColliding(PLAYER_DROPDOWN_OPTIONS),
        },
        {
          'type': 'field_dropdown',
          'name': 'STATE',
          'options': [
            [`${PLAY_ICON} Play`, 'play'],
            [`${PAUSE_ICON} Pause`, 'pause'],
          ],
        },
      ],
      'previousStatement': null,
      'nextStatement': null,
      colour,
      'extensions': ['sprite_player_field_sync'],
      'tooltip': 'Plays or pauses the animation.',
    },
    // Points this player directly at a slice of the ROM's bank 1 code
    // (plus a runtime offset) instead of one of its defined animation
    // frames - the classic Yars' Revenge "neutral zone" trick: real batari
    // Basic sprites are just a pointer + a row count read from wherever
    // that pointer happens to be (see generators/bbasic/sprites.js's
    // comment on player0pointer/player0height for the confirmed real
    // kernel mechanics), so pointing it at ordinary CODE instead of a
    // drawn graphic makes the sprite display those bytes as a pixel
    // pattern - genuinely arbitrary-looking, not tied to anything the
    // user has to set up first. No data table to create or pick - an
    // earlier version of this required one, specifically to guarantee a
    // real, always-present bank 1 address; generators/bbasic/sprites.js's
    // generator now points at a fixed kernel label that's already
    // guaranteed present in every compiled ROM instead, so this block
    // works immediately with no other setup. OFFSET defaults to the frame
    // counter when left unplugged (see that generator's comment) so the
    // pattern already shimmers by itself - it's still a real, typed input
    // if a specific offset expression is ever wanted instead.
    {
      'type': 'sprite_player_rom_noise',
      'message0': `${icon} Player %1 display ${DATA_ICON} ROM noise, offset %2 height %3 rows`,
      'args0': [
        {
          'type': 'field_dropdown',
          'name': 'PLAYER',
          'options': withColliding(PLAYER_DROPDOWN_OPTIONS),
        },
        {
          'type': 'input_value',
          'name': 'OFFSET',
          'check': 'Number',
        },
        {
          'type': 'input_value',
          'name': 'HEIGHT',
          'check': 'Number',
        },
      ],
      'inputsInline': true,
      'previousStatement': null,
      'nextStatement': null,
      colour,
      'extensions': ['sprite_player_field_sync'],
      'tooltip': 'Shows raw ROM bytes (always from bank 1) as the player\'s graphic instead of its animation frames, until "stop ROM noise" is used, even over animation frames set later. Leave "offset" unplugged for a shimmering pattern (the frame counter), or plug in an expression. It does not affect width/quantity (NUSIZ).',
    },
    // ROM noise (above) sets a runtime "active" flag that keeps overriding
    // this player's graphic pointer every single frame, forever, once
    // triggered - a normal "Set animation" block alone can't undo that,
    // since generateRomNoiseChecks'  per-frame override runs AFTER the
    // animation logic every frame and only ever gets set, never cleared
    // (confirmed as a real reported gap: "I want to be able to switch back
    // to using sprite graphics after using the noise block"). This just
    // clears that flag, letting the animation pointer generateAnimations
    // already reasserts every frame regardless take back over immediately -
    // no pixel/graphic changes.
    {
      'type': 'sprite_player_rom_noise_stop',
      'message0': `${icon} Player %1 stop ${DATA_ICON} ROM noise`,
      'args0': [
        {
          'type': 'field_dropdown',
          'name': 'PLAYER',
          'options': withColliding(PLAYER_DROPDOWN_OPTIONS),
        },
      ],
      'previousStatement': null,
      'nextStatement': null,
      colour,
      'extensions': ['sprite_player_field_sync'],
      'tooltip': 'Undoes "display ROM noise": the player shows its animation frames again.',
    },
    // A different color on every scanline of this player - a REAL, existing
    // batari Basic kernel feature ("playercolors"/"player1colors" kernel
    // options - see std_kernel.asm's "ifnconst playercolors" checks),
    // not built from scratch here. Deliberately its  separate block, not
    // a checkbox on sprite_*_rom_noise: this reads ROM bytes into
    // player0color/player1color the exact same "no data table, no ROM cost"
    // way the noise block reads them into player0pointer/player1pointer
    // (see generators/bbasic/sprites.js's ROM_NOISE_COLOR_REGISTERS
    // comment for the confirmed real register aliasing this relies on), but
    // that mechanism is entirely independent of what the player's GRAPHIC
    // pointer is doing - it works identically whether this player is
    // showing a normal drawn animation frame OR ROM noise, so keeping it
    // separate lets either be used without the other.
    {
      'type': 'sprite_player_rainbow_colors',
      'message0': `${icon} Player %1 rainbow colors, offset %2 colors from %3 to %4 %5 %6 %7`,
      'args0': [
        {
          'type': 'field_dropdown',
          'name': 'PLAYER',
          'options': withColliding(RAINBOW_PLAYER_OPTIONS),
        },
        {
          'type': 'input_value',
          'name': 'OFFSET',
          'check': 'Number',
        },
        ...rainbowRangeArgs(),
      ],
      'inputsInline': true,
      'previousStatement': null,
      'nextStatement': null,
      colour,
      'extensions': ['sprite_player_field_sync', 'rainbow_legacy_hues'],
      'tooltip': 'Gives the player a different color on each row, read from ROM like "display ROM noise"; works with any graphic. Leave "offset" unplugged for a shimmering pattern (the frame counter). "Colors from ... to" limits the colors to a range of values (0 to 255, may go round: 240 to 16), shown as a ramp; 16 values make a hue (0 to 15 gray, 16 to 31 gold, 32 to 47 orange...), ranges over 64 values are sampled, 0 to 255 leaves colors as they are. A saved span of hues is kept (shown after the numbers, and the numbers do not apply) until a hue is set to "any hue". Uses the matching missile (Missile 0 for Player 0, Missile 1 for Player 1), which then cannot be a sprite anywhere in the project, and for Player 0 paddle input becomes unavailable.',
    },
    // Same "active flag only ever gets set, never cleared" gap as
    // sprite_player_rom_noise_stop above, for the rainbow-colors trigger
    // instead - see that block's  comment. One real difference: once
    // "playercolors"/"player1colors" is in kernel_options at all, the
    // KERNEL itself always reads (player0color),y every scanline - there's
    // no way to turn that back into a plain flat COLUP0/COLUP1 color at
    // runtime, so this can't fully "undo" rainbow colors the way the ROM
    // noise stop block can fully undo noise. What it DOES do: with the
    // Options tab's "Enable per-row sprite colors" toggle on, each
    // animation frame already declares its  real per-row color table
    // (see generateAnimations in generators/bbasic.js) every time that
    // frame is (re)shown - clearing this flag lets THAT take back over,
    // the same "something else already reasserts every frame" mechanism
    // the ROM noise stop block relies on. Without that toggle, this just
    // freezes the color pointer wherever it currently is.
    {
      'type': 'sprite_player_rainbow_colors_stop',
      'message0': `${icon} Player %1 stop rainbow colors`,
      'args0': [
        {
          'type': 'field_dropdown',
          'name': 'PLAYER',
          'options': withColliding(RAINBOW_PLAYER_OPTIONS),
        },
      ],
      'previousStatement': null,
      'nextStatement': null,
      colour,
      'extensions': ['sprite_player_field_sync'],
      'tooltip': 'Stops "rainbow colors" for the player. With the Options tab\'s "Enable per-row sprite colors" on, it goes back to each frame\'s declared colors (or the default color); without it, the color pointer stays where rainbow colors left it.',
    },
  ]);
};

// Same "trigger block, actual movement happens in a per-frame check" shape
// as buildMissileBlocks' "fire" block just below - separate from it
// (not folded in) since the user wants a distinct, dedicated follow/seek
// action rather than an extension of the angle-based Fire block. One single
// block (not one per sprite name, unlike buildSpriteBlocks/buildMissileBlocks
// above) - an OBJECT dropdown covers all 5 names (both players, both
// missiles, the ball) instead, per an explicit request to combine what was
// originally 5 separate blocks into one.
const SEEK_OBJECT_OPTIONS = [
  [PLAYER_ICON + ' Player 0', 'player0'],
  [PLAYER_ICON + ' Player 1', 'player1'],
  [MISSILE_ICON + ' Missile 0', 'missile0'],
  [MISSILE_ICON + ' Missile 1', 'missile1'],
  [BALL_ICON + ' Ball', 'ball'],
];

// Seek and Inertia also move the DPC+ kernel's extra sprites (Player 2 to 9).
const SEEK_OBJECT_DROPDOWN_OPTIONS = function() {
  const count = playerCount(((useConfigurationStorage() || {}).value || {}));
  if (count <= 2) return SEEK_OBJECT_OPTIONS;
  const extra = Array.from({length: count - 2}, (_, i) => [PLAYER_ICON + ' Player ' + (i + 2), 'player' + (i + 2)]);
  return [...SEEK_OBJECT_OPTIONS.slice(0, 2), ...extra, [PLAYER_ICON + ' Pool sprite', 'playerpool'], [PLAYER_ICON + ' All pool sprites', 'playerpoolall'], ...SEEK_OBJECT_OPTIONS.slice(2)];
};

// Same colour-per-choice treatment as sprite_player_fade_colour_sync above,
// generalized to OBJECT's 5-way pick instead of a 2-way one - reusing each
// object's  individual block colour (red for either Player 0 or
// Missile 0, blue for either Player 1 or Missile 1, orange for Ball,
// matching PLAYER_ICON/MISSILE_ICON/BALL_ICON's  call sites further down
// this file) rather than inventing a new palette just for this dropdown.
const SEEK_OBJECT_COLOURS = {
  player0: 'red', player1: 'blue', missile0: 'red', missile1: 'blue', ball: '#ff8800', playerpool: SPRITE_POOL_COLOUR, playerpoolall: SPRITE_POOL_COLOUR,
  ...Object.fromEntries([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16].map((n) => [`player${n}`, extraPlayerColour(n)])),
};
// Validator-based, not setOnChange - see registerDropdownFieldSyncExtension's
// comment above for why: setOnChange only ever fires from a real
// Blockly.Events.BlockChange event, which never fires while a block is
// being built from XML with events disabled (exactly how every toolbox
// flyout block is constructed) - a validator on the field itself runs
// unconditionally on every setValue call instead, XML load or live edit
// alike (confirmed as a real reported bug: toolbox flyout copies all
// stayed the same colour regardless of their  preset OBJECT field).
registerExtension('object_seek_colour_sync', function() {
  // eslint-disable-next-line no-invalid-this
  const block = this;
  const objectField = block.getField('OBJECT');
  if (!objectField) return;
  block.setColour(SEEK_OBJECT_COLOURS[objectField.getValue()] || 'purple');
  objectField.setValidator((newValue) => {
    block.setColour(SEEK_OBJECT_COLOURS[newValue] || 'purple');
    return newValue;
  });
});

// Hides DIRECTION/RATE/MAXSPEED/DIRECTIONS16_INPUT/FINE_INPUT entirely
// while ACTION is "stop" on the combined sprite_inertia_accelerate block -
// none of direction/rate/max speed/16-directions/Fine are read by the Stop
// branch (see its generator comment in generators/bbasic/sprites.js), so
// showing them just invites editing values that quietly do nothing, the
// same "nothing useful to show" reasoning input_fire_pattern_frames_sync
// uses for Fire's FRAMES field. DIRECTION/RATE/MAXSPEED are each already a
// separate named "input_value"; DIRECTIONS16_INPUT/FINE_INPUT are each a
// dedicated named "input_dummy" wrapping the 16-directions/Fine checkbox on
// a dedicated message row (see the block definition's comment) - so every
// one of the five can be looked up and hidden directly by name, no need
// for a JS init()-style block definition just to name a wrapping input.
// Validator-based, not setOnChange - same reasoning as
// registerDropdownFieldSyncExtension's comment above.
registerExtension('sprite_inertia_accelerate_action_sync', function() {
  // eslint-disable-next-line no-invalid-this
  const block = this;
  const actionField = block.getField('ACTION');
  if (!actionField) return;
  const applyVisibility = (action) => {
    // Bails entirely on an insertion marker (the ghost preview block
    // Blockly clones while dragging a new copy out of the flyout, before
    // it's a real connected block) - confirmed as a real reported crash
    // otherwise: an insertion marker's fields exist but aren't backed by
    // real SVG DOM nodes yet, so block.render() throws ("Cannot read
    // properties of null (reading 'setAttribute')") trying to lay one out.
    // Nothing needs to show/hide on a marker anyway - it's discarded the
    // instant the drag ends, and this validator re-runs for real on the
    // actual dropped block once the drag finishes.
    if (typeof block.isInsertionMarker === 'function' && block.isInsertionMarker()) return;
    // Same headless-workspace guard as input_fire_pattern_frames_sync,
    // checked BEFORE any input.setVisible() call below (not just the
    // render()/resizeContents() calls at the end) - setVisible() is the
    // call that actually crashes on a headless workspace ("...
    // stopTrackingAll is not a function" - see function.js's comment for
    // the full explanation), not just the rendering that follows it.
    if (!block.workspace || !block.workspace.rendered) return;
    const shouldBeVisible = action !== 'stop';
    let changed = false;
    ['DIRECTION', 'RATE', 'MAXSPEED', 'DIRECTIONS16_INPUT', 'FINE_INPUT'].forEach((name) => {
      const input = block.getInput(name);
      if (!input || input.isVisible() === shouldBeVisible) return;
      input.setVisible(shouldBeVisible);
      changed = true;
    });
    if (!changed) return;
    if (typeof block.queueRender === 'function') block.queueRender();
    else if (typeof block.render === 'function') block.render();
    if (block.workspace.resizeContents) block.workspace.resizeContents();
  };
  applyVisibility(actionField.getValue());
  actionField.setValidator((newValue) => {
    applyVisibility(newValue);
    return undefined;
  });
});

// Lock a sprite to another: it follows the other one, an offset away, until it is unlocked (see generators/bbasic/sprite-lock.js).
Blockly.defineBlocksWithJsonArray([
  {
    'type': 'sprite_lock',
    'message0': `${LOCK_ICON} Lock %1 to %2 at X offset %3 Y offset %4`,
    'args0': [
      {
        'type': 'field_dropdown',
        'name': 'CHILD',
        'options': SEEK_OBJECT_DROPDOWN_OPTIONS,
      },
      {
        'type': 'field_dropdown',
        'name': 'PARENT',
        'options': SEEK_OBJECT_DROPDOWN_OPTIONS,
      },
      {
        'type': 'input_value',
        'name': 'X',
        'check': 'Number',
      },
      {
        'type': 'input_value',
        'name': 'Y',
        'check': 'Number',
      },
    ],
    'inputsInline': true,
    'previousStatement': null,
    'nextStatement': null,
    'colour': 'purple',
    'tooltip': 'Makes the first sprite follow the second, the given pixels right (X) and down (Y) of it (negative goes left or up), every frame until unlocked. When the second sprite is a player facing left (flipped), the first goes on the other side and flips too.',
  },
  {
    'type': 'sprite_unlock',
    'message0': `${LOCK_ICON} Unlock %1`,
    'args0': [
      {
        'type': 'field_dropdown',
        'name': 'CHILD',
        'options': SEEK_OBJECT_DROPDOWN_OPTIONS,
      },
    ],
    'previousStatement': null,
    'nextStatement': null,
    'colour': 'purple',
    'tooltip': 'The sprite stays where it is.',
  },
]);

Blockly.defineBlocksWithJsonArray([
  {
    'type': 'object_seek_to',
    'message0': `${SEEK_ICON} Move %1 to X %2 Y %3 at speed %4`,
    'args0': [
      {
        'type': 'field_dropdown',
        'name': 'OBJECT',
        'options': withCollidingObjects(SEEK_OBJECT_DROPDOWN_OPTIONS),
      },
      {
        'type': 'input_value',
        'name': 'X',
        'check': 'Number',
      },
      {
        'type': 'input_value',
        'name': 'Y',
        'check': 'Number',
      },
      {
        'type': 'input_value',
        'name': 'SPEED',
        'check': 'Number',
      },
    ],
    'message1': 'throttle movement %1',
    'args1': [
      {
        'type': 'field_checkbox',
        'name': 'THROTTLE',
        'checked': false,
      },
    ],
    'message2': 'one axis at a time %1',
    'args2': [
      {
        'type': 'field_checkbox',
        'name': 'AXIS',
        'checked': false,
      },
    ],
    'inputsInline': true,
    'previousStatement': null,
    'nextStatement': null,
    'colour': 'purple',
    'extensions': ['object_seek_colour_sync'],
    'tooltip': 'Moves the object toward X/Y by up to "speed" pixels a frame, each axis separately, and stops exactly on arrival. It does not touch Height/visibility. Each run resets the target/speed, so put it behind a rate limiter (e.g. "every X frames") if that should not happen every frame. "throttle movement", directly inside an "every X frames" block, moves one step every X frames instead of every frame. "one axis at a time" moves along X to the target column, then along Y.',
  },
  // A plain boolean value (plugs into an "if", same as collision_get/
  // background_fade_active elsewhere in this codebase - a bare 'output':
  // 'Boolean' with no outputShape override, the same "classic" connector
  // every other boolean-pluggable block here already uses), true from the
  // moment a matching object_seek_to block (same OBJECT choice) actually
  // reaches its  target X/Y, until the next time that object's  Seek
  // target is set again (object_seek_to's  generator clears this bit
  // right when it (re)triggers - see generators/bbasic/sprites.js). A seek
  // that starts already at its target (nothing to actually step) never sets
  // this - there's no real arrival to report if it was already there before
  // the first check.
  {
    'type': 'object_seek_arrived',
    'message0': `${SEEK_ICON} %1 arrived at its move target`,
    'args0': [
      {
        'type': 'field_dropdown',
        'name': 'OBJECT',
        'options': SEEK_OBJECT_DROPDOWN_OPTIONS,
      },
    ],
    'output': 'Boolean',
    'colour': 'purple',
    'extensions': ['object_seek_colour_sync'],
    'tooltip': 'True once a matching "Move" block (same object) reaches its target, until it is given a new target. False if no matching Move block runs.',
  },
  // True once a Fire block's object has gone off the screen and stopped there.
  {
    'type': 'object_fire_offscreen',
    'message0': `${MISSILE_ICON} Fired %1 has gone off screen`,
    'args0': [
      {
        'type': 'field_dropdown',
        'name': 'OBJECT',
        'options': SEEK_OBJECT_DROPDOWN_OPTIONS,
      },
    ],
    'output': 'Boolean',
    'colour': 'purple',
    'extensions': ['object_seek_colour_sync'],
    'tooltip': 'True once an object a "Fire" block launched has gone off the screen edge and stopped (it is put at the top left corner), until a "Fire" block launches it again. Not true when "Stop fired" or a collision stopped it. False if no "Fire" block launches it, or while "Bounce off screen edges" keeps it in play.',
  },
  // Same "one block, OBJECT dropdown covers all 5 names" shape as object_
  // seek_to above, reusing the same SEEK_OBJECT_OPTIONS/object_seek_colour_
  // sync. A runtime on/off toggle (not a compile-time checkbox) - lets a
  // project turn scroll-following on for one sprite mid-game (e.g. only
  // once gameplay actually starts scrolling) and off for another (e.g. a
  // HUD-like sprite that should stay fixed on screen). VALUE accepts
  // Boolean or Number, same convention as bit_set's VALUE input in
  // blocks/bit.js.
  {
    'type': 'sprite_scroll_with_playfield_set',
    'message0': `${SEEK_ICON} %1 set scroll with playfield to %2`,
    'args0': [
      {
        'type': 'field_dropdown',
        'name': 'OBJECT',
        'options': withCollidingObjects(SEEK_OBJECT_DROPDOWN_OPTIONS),
      },
      {
        'type': 'input_value',
        'name': 'VALUE',
        'check': ['Boolean', 'Number'],
      },
    ],
    'inputsInline': true,
    'previousStatement': null,
    'nextStatement': null,
    'colour': 'purple',
    'extensions': ['object_seek_colour_sync'],
    'tooltip': 'While on, every "Playfield scroll" block using Up/Down/Up (2x)/Down (2x) also shifts this object\'s Y by the same amount, so it keeps its place on the scrolling background. No effect on Left/Right scrolling. Accepts true/false or 1/0.',
  },
  // Read-only companion to the setter above - same OBJECT dropdown/colour
  // extension, just reading the same runtime bit back instead of writing it.
  {
    'type': 'sprite_scroll_with_playfield_get',
    'message0': `${SEEK_ICON} Is %1 scrolling with playfield?`,
    'args0': [
      {
        'type': 'field_dropdown',
        'name': 'OBJECT',
        'options': withCollidingObjects(SEEK_OBJECT_DROPDOWN_OPTIONS),
      },
    ],
    'output': 'Boolean',
    'colour': 'purple',
    'extensions': ['object_seek_colour_sync'],
    'tooltip': 'True while playfield-scroll following is on for this object.',
  },
  // Same "one block, OBJECT dropdown covers all 5 names" shape as
  // object_seek_to above, and the same per-choice colour extension
  // (object_seek_colour_sync is already OBJECT-dropdown-generic, so it's
  // reused directly rather than duplicated). Continuous, not a one-shot
  // push - toggled on/off, same as sprite_player_animation_playback's
  // Play/Pause shape - "accelerate" here means "start applying this rate
  // every frame," not "add this amount once." DIRECTION is a plain 0-7
  // number input (not a fixed dropdown), matching sprite_*_fire's
  // ANGLE field - lets it be wired straight from a "Joystick direction
  // (8-way)" block for continuous joystick-driven thrust, not just typed
  // in as a literal.
  // Combined Start/Stop, same "one block, ACTION dropdown up front" shape
  // as sprite_inertia_decelerate below (was two separate block types,
  // sprite_inertia_accelerate and sprite_inertia_stop_accelerate, per an
  // explicit request to match Decelerate's shape) - DIRECTION/RATE/MAXSPEED
  // hide entirely while ACTION is Stop (see sprite_inertia_accelerate_
  // action_sync's comment above for why). Old projects using the two
  // separate block types are auto-migrated on load - see
  // hooks/migrate-inertia-accelerate-blocks.js.
  {
    'type': 'sprite_inertia_accelerate',
    'message0': `${INERTIA_ICON} %1 Accelerate %2 %3 toward direction %4 by %5, max speed %6`,
    'args0': [
      {
        'type': 'field_dropdown',
        'name': 'ACTION',
        'options': [['Start', 'start'], ['Stop', 'stop']],
      },
      {
        'type': 'field_dropdown',
        'name': 'OBJECT',
        'options': withCollidingObjects(SEEK_OBJECT_DROPDOWN_OPTIONS),
      },
      // Forces ACTION/OBJECT above onto a separate input instead of being
      // swept into DIRECTION's - Blockly's JSON interpolation attaches any
      // fields with no input between them and the NEXT value/statement/
      // dummy input onto THAT next input (confirmed directly against
      // Blockly.Block.prototype.interpolateArguments_/jsonInit_'s
      // fieldStack logic), so without this, DIRECTION's hidden/shown
      // input.setVisible() call in sprite_inertia_accelerate_action_sync
      // below was ALSO hiding ACTION and OBJECT - a real reported bug
      // ("every field gets hidden ... except 16 directions and fine",
      // i.e. everything sharing DIRECTION's input). inputsInline (below)
      // still renders this on the same line as everything else, same as
      // input_joystick_fire_pattern's separately-named FRAMES_INPUT
      // dummy achieves for the same reason.
      {'type': 'input_dummy'},
      {
        'type': 'input_value',
        'name': 'DIRECTION',
        'check': 'Number',
      },
      {
        'type': 'input_value',
        'name': 'RATE',
        'check': 'Number',
      },
      {
        'type': 'input_value',
        'name': 'MAXSPEED',
        'check': 'Number',
      },
    ],
    // Trailing named "input_dummy" on each row (rather than just a bare
    // checkbox) - same "give the field an addressable wrapping input"
    // reasoning as the DIRECTION-row's dummy above: with no input to
    // its name, a message1/message2 row's checkbox would otherwise get
    // wrapped in an ANONYMOUS auto-created dummy input Blockly.Block.
    // prototype.interpolate_ generates for any fields left unclaimed at
    // the end of a message row - impossible to look up and hide later.
    'message1': '%1 %2 %3',
    'args1': [
      {'type': 'field_label', 'text': ' '},
      {
        'type': 'field_dropdown',
        'name': 'DIRECTIONS16',
        'options': [['8 directions', 'FALSE'], ['16 directions', 'TRUE'], ['any direction', 'ANY']],
      },
      {'type': 'input_dummy', 'name': 'DIRECTIONS16_INPUT'},
    ],
    'message2': '%1 %2 Fine %3',
    'args2': [
      {'type': 'field_label', 'text': ' '},
      {
        'type': 'field_checkbox',
        'name': 'FINE',
        'checked': false,
      },
      {'type': 'input_dummy', 'name': 'FINE_INPUT'},
    ],
    'inputsInline': true,
    'previousStatement': null,
    'nextStatement': null,
    'colour': 'purple',
    'extensions': ['object_seek_colour_sync', 'sprite_inertia_accelerate_action_sync'],
    'tooltip': 'Start: every frame the velocity moves "rate" closer to the direction, up to "max speed" per axis, until Stop. Direction is 0-7 (0=Up, 1=Up-Right, 2=Right, 3=Down-Right, 4=Down, 5=Down-Left, 6=Left, 7=Up-Left, same as "Fire"), or 0-15 with "16 directions" (the extra directions push the dominant axis at full rate and the other at half). Running Start again updates direction/rate/max speed without resetting velocity. Stop leaves the velocity as it is (the object keeps moving) unless "Decelerate" is on. "Fine": rate is a fraction of a pixel a frame (0-255, in 256ths); costs 2 extra bytes per axis, and cannot be used with 16 directions. Must match "Decelerate" on the same object. Any direction: 0-255 is a full turn (0 up, 64 right, 128 down, 192 left), the rate and the speed limit are split between x and y by the sine and cosine (uses Fine); 8 and 16 direction blocks of the same object are turned into a heading.',
  },
  {
    'type': 'sprite_inertia_decelerate',
    'message0': `${INERTIA_ICON} %1 Decelerate %2 by %3`,
    'args0': [
      {
        'type': 'field_dropdown',
        'name': 'ACTION',
        'options': [['Start', 'start'], ['Stop', 'stop']],
      },
      {
        'type': 'field_dropdown',
        'name': 'OBJECT',
        'options': withCollidingObjects(SEEK_OBJECT_DROPDOWN_OPTIONS),
      },
      {
        'type': 'input_value',
        'name': 'RATE',
        'check': 'Number',
      },
    ],
    'message1': '%1 %2 Fine',
    'args1': [
      {'type': 'field_label', 'text': ' '},
      {
        'type': 'field_checkbox',
        'name': 'FINE',
        'checked': false,
      },
    ],
    'inputsInline': true,
    'previousStatement': null,
    'nextStatement': null,
    'colour': 'purple',
    'extensions': ['object_seek_colour_sync'],
    'tooltip': 'Start: every frame the velocity moves "rate" closer to 0 per axis, never past it; turns itself off once both axes reach 0 (running Start again turns it on). Works with Accelerate at the same time, or alone to coast to a stop. "Fine": rate is a fraction of a pixel a frame (0-255, in 256ths) and movement slows through sub-pixel speeds; costs 2 extra bytes per axis. Must match "Accelerate" on the same object.',
  },
  // Gravity for a fired object: it keeps its Fire movement and falls (or, after a Bounce, rises) on top of it, in a curve. The speed is the vertical
  // speed of the object's Fine inertia (see sprite_inertia_accelerate), so Bounce reflects it too.
  {
    'type': 'object_gravity',
    'message0': `${INERTIA_ICON} %1 %2 %3 gravity %4 max fall speed %5`,
    'args0': [
      {
        'type': 'field_dropdown',
        'name': 'ACTION',
        'options': [['Start', 'start'], ['Stop', 'stop']],
      },
      {
        'type': 'field_dropdown',
        'name': 'OBJECT',
        'options': withCollidingObjects(SEEK_OBJECT_DROPDOWN_OPTIONS),
      },
      {'type': 'input_dummy'},
      {
        'type': 'input_value',
        'name': 'PULL',
        'check': 'Number',
      },
      {
        'type': 'input_value',
        'name': 'MAXFALL',
        'check': 'Number',
      },
    ],
    'message1': '%1 bounce keeps %2',
    'args1': [
      {'type': 'field_label', 'text': ' '},
      {
        'type': 'field_dropdown',
        'name': 'BOUNCE',
        'options': [['100%', '4'], ['75%', '3'], ['50%', '2'], ['25%', '1'], ['0%', '0']],
      },
    ],
    'message2': '%1 pull toward direction %2',
    'args2': [
      {'type': 'field_label', 'text': ' '},
      {'type': 'input_value', 'name': 'ANGLE', 'check': 'Number'},
    ],
    'message3': '%1 %2 stop at playfield %3 %4 use pixel width',
    'args3': [
      {'type': 'field_label', 'text': ' '},
      {'type': 'field_checkbox', 'name': 'LAND', 'checked': false},
      {'type': 'field_label', 'text': ' '},
      {'type': 'field_checkbox', 'name': 'SPRITEWIDTH', 'checked': false},
    ],
    'inputsInline': true,
    'previousStatement': null,
    'nextStatement': null,
    'colour': 'purple',
    'extensions': ['object_seek_colour_sync', 'object_gravity_defaults'],
    'tooltip': 'Makes an object fall, or be pulled in a direction, faster and faster. Start/Stop: turns the gravity on, or off with the fall speed 0. Gravity: eighths of a pixel the fall speed grows each frame (1 to 16). Max fall speed: pixels a frame. Bounce keeps: how much of its speed a Bounce block leaves. Pull toward direction: a full turn of 256 (128 is down). Stop at playfield (down only): lands on the first lit pixel and stops falling. Use pixel width: the landing box is as wide as the lit pixels of the player, not 8 pixels.',
  },
  // Starts or stops the gravity of an object, with the numbers a Gravity block gave it (the Start and Stop of the Gravity block, without its numbers).
  {
    'type': 'object_gravity_control',
    'message0': `${INERTIA_ICON} %1 gravity %2`,
    'args0': [
      {
        'type': 'field_dropdown',
        'name': 'ACTION',
        'options': [['Start', 'start'], ['Stop', 'stop']],
      },
      {
        'type': 'field_dropdown',
        'name': 'OBJECT',
        // eslint-disable-next-line new-cap
        'options': () => [[PLAYER_ICON + ' Colliding sprite', 'colliding'], ...SEEK_OBJECT_DROPDOWN_OPTIONS()],
      },
    ],
    'previousStatement': null,
    'nextStatement': null,
    'colour': 'purple',
    'extensions': ['object_seek_colour_sync'],
    'tooltip': 'Colliding sprite: inside a "When ... collide" block, the sprite whose collision started (with Any sprite, whichever one it was); nothing anywhere else. Start: turns the gravity of the object on again, with the speed up, max fall speed, bounce and direction a "Gravity" block with its numbers gave it (it starts falling from 0; in code that runs every frame it starts the gravity in the first frame only). Stop: the object stops falling at once (its fall speed is set to 0); Fire movement and other Inertia are not touched. No effect on an object no "Gravity" block uses.',
  },
  // One block, OBJECT dropdown covers all 5 names (same shape as
  // object_seek_to/the Inertia blocks above) - replaces the old, separate
  // sprite_missile_bounce/sprite_ball_bounce (Player never had a Bounce
  // block at all, since Players never had Fire) per an explicit request
  // not to have separate blocks for the same functionality. Old projects
  // using the previous block types are auto-migrated on load - see
  // hooks/migrate-bounce-blocks.js. Reflects whichever movement system(s)
  // the chosen object actually uses: Fire's  angle (missile/ball only,
  // unchanged Combat-style guessing), Inertia's  velocity (any of the
  // 5), or both at once if both are in play on the same object - see this
  // block's  generator for exactly how.
  {
    'type': 'object_bounce',
    'message0': `${INERTIA_ICON} Bounce %1 %2 %3 off screen edges %4 %5 set angle manually %6 %7 random angle spread ± %8 steps in %9 %10 %11`,
    'args0': [
      {
        'type': 'field_dropdown',
        'name': 'OBJECT',
        'options': withCollidingObjects(SEEK_OBJECT_DROPDOWN_OPTIONS),
      },
      {
        'type': 'field_label',
        'text': ' ',
      },
      {
        'type': 'field_checkbox',
        'name': 'EDGES',
        'checked': false,
      },
      // Extra gap between the two options.
      {
        'type': 'field_label',
        'text': ' ',
      },
      {
        'type': 'field_checkbox',
        'name': 'MANUAL',
        'checked': false,
      },
      // Extra gap between the two options.
      {
        'type': 'field_label',
        'text': ' ',
      },
      // Off: no spread is worked out at all (no code, no random number).
      {
        'type': 'field_checkbox',
        'name': 'SPREAD',
        'checked': false,
      },
      {
        'type': 'input_value',
        'name': 'SPREAD_STEPS',
        'check': 'Number',
      },
      // The half of the circle the angle the spread ends at is kept in (an angle in the other half is mirrored over the line between the halves).
      {
        'type': 'field_dropdown',
        'name': 'HEMISPHERE',
        'options': [
          ['any direction', 'ANY'],
          ['the top half', 'TOP'],
          ['the bottom half', 'BOTTOM'],
          ['the left half', 'LEFT'],
          ['the right half', 'RIGHT'],
        ],
      },
      // Holds the fields above, so hiding ANGLE does not hide them.
      {
        'type': 'input_dummy',
      },
      {
        'type': 'input_value',
        'name': 'ANGLE',
        'check': 'Number',
      },
    ],
    'inputsInline': true,
    'previousStatement': null,
    'nextStatement': null,
    'colour': 'purple',
    'extensions': ['object_seek_colour_sync', 'object_bounce_manual_angle_sync', 'object_bounce_spread_prefill'],
    'tooltip': 'Reflects the object off what it just collided with, guessing the surface: the first stuck frame mirrors as off a vertical wall; still stuck the next frame, a horizontal wall; still stuck after that, it reverses (a corner). Reflects Fire\'s direction (missile/ball only) and/or Inertia\'s velocity, whichever the object uses; no effect on an object using neither. Run it every frame the collision persists, behind whatever decides it should bounce (it detects nothing itself). With "off screen edges" ticked no collision is needed: place it where it runs every frame and it bounces the object at the left, right, top or bottom edge, puts it back on the edge, and keeps a fired missile or ball in play. "set angle manually" ticked: a fired missile or ball leaves at the angle given (0-7, 0-15 with 16 directions, 0-255 with any direction, clockwise from up); not for "off screen edges". "random angle spread" (missile/ball with Fire only): turns the leaving angle by a random 0 to the chosen steps (1-4, above 4 counts as 4; with any direction a step is 22.5 degrees) either way; applies to "off screen edges" too. The choice after "steps" keeps the angle in one half of the circle (top, bottom, left or right): an angle in the other half is mirrored over the line between them. A bounce off a wall facing away from the chosen half sends the object back into that wall, then the stuck-frame guesses apply.',
  },
  // Cancels what a Fire block started: the object stops moving where it is.
  // Same OBJECT dropdown and colour sync as object_bounce above.
  {
    'type': 'object_fire_stop',
    'message0': `${STOP_ICON} Stop fired %1`,
    'args0': [
      {
        'type': 'field_dropdown',
        'name': 'OBJECT',
        'options': withCollidingObjects(SEEK_OBJECT_DROPDOWN_OPTIONS),
      },
    ],
    'previousStatement': null,
    'nextStatement': null,
    'colour': 'purple',
    'extensions': ['object_seek_colour_sync'],
    'tooltip': 'Stops a missile or ball a "Fire" block launched, where it is. Height and visibility are not touched (use "Missile: set Height" to hide it). No effect on a player or on an object no "Fire" block launched.',
  },
]);

// Every object_seek_arrived block resolved to the OBJECT name(s) it actually
// watches - needed early (bbasic.js's  init(), before reserveDevVar hands
// out user variable letters) so seekArrivedFlagsVarName only gets reserved
// when at least one such watch really exists, same reasoning as
// resolveBackgroundFadeFinishedWatches in blocks/background.js. Unlike that
// one, no separate "watch key" function is needed - OBJECT's  value
// (player0/player1/missile0/missile1/ball) already is the key.
export const resolveSeekArrivedWatches = (workspace) => {
  const watched = new Set();
  workspace.getAllBlocks(false).forEach((block) => {
    if (block.type === 'object_seek_arrived' && block.isEnabled()) {
      watched.add(block.getFieldValue('OBJECT'));
    }
  });
  return watched;
};

// Missile-only (NUSIZ0/1 width/copies) - the ball has its  separate
// width mechanism (CTRLPF, see reserveCtrlpfShadowDevVar in
// generators/bbasic/sprites.js), so this is never called for it.
// Missile 0/1 only (never had a Ball equivalent at all - Ball's width is
// set through sprite_ball_set's "Width" option instead), so - unlike
// the per-name blocks for Ball - this is fully repurposed into the combined type,
// called once instead of once per name.
const buildMissileSizeBlock = ({icon, colour}) => {
  Blockly.defineBlocksWithJsonArray([
    // Block for changing a missile's width.
    {
      'type': 'sprite_missile_size',
      'message0': `${icon} Missile %1 set width to %2 pixels`,
      'args0': [
        {
          'type': 'field_dropdown',
          'name': 'MISSILE',
          'options': withColliding(MISSILE_OPTIONS),
        },
        {
          'type': 'field_dropdown',
          'name': 'SIZE',
          'options': MISSILE_SIZE_OPTIONS,
        },
      ],
      'previousStatement': null,
      'nextStatement': null,
      colour,
      'extensions': ['sprite_missile_field_sync', 'math_change_tooltip'],
    },
  ]);
};

// Shared by missile0/missile1/ball - reflects
// whichever direction this object was last fired at (see sprite_*_fire),
// using the same adaptive multi-frame guessing Combat (1977) uses for its
// tank shells: since this block has no idea which wall/edge of whatever
// shape it collided with was actually hit, it can't compute a single
// correct reflection on the first try - so, same as Combat, it treats the
// first stuck frame as a guess (mirror as if a vertical wall was hit),
// keeps guessing differently each consecutive stuck frame (next try: mirror
// as if it was a horizontal wall instead), and after a few frames still
// stuck, gives up and just reverses the original heading outright (assume a
// corner). See generateMissileFireChecks'  comment in
// generators/bbasic/sprites.js for the exact stage sequence and how
// "consecutive" is detected. No built-in screen-edge or collision detection
// (confirmed with the user: no "gravity"/physics beyond this) -
// place this behind whatever collision check (e.g. collision_get) or
// screen-edge check the user's  project already needs, same "trigger
// block, no detection built in" shape as sprite_*_fire itself leaving
// throttling/rate-limiting up to the user. Meant to be called EVERY frame
// the collision persists, not just once - unlike a plain one-shot flip, this
// only makes its intended guess/guess/give-up progression if it keeps being
// called each frame the object is still stuck.
// The Fire block for Missile 0, Missile 1 and the Ball: one block with a dropdown
// (it used to be a separate block for the ball; hooks/migrate-ball-fire-blocks.js
// converts those). Fires the object from the given starting X/Y, moving at the
// given angle/speed until it goes off-screen, where it just stops (see
// generateMissileFireChecks) - its Height/visibility is left entirely to the
// existing "set" blocks, never touched here. Defined in JS rather than the JSON
// array shape every other block in this file uses, so DEFAULT_ANGLE's dropdown
// can be backed by a function (see buildMissileFireDefaultAngleOptions'
// comment) - same reasoning text_minikernel_show_named's comment in
// blocks/text-minikernel.js gives for the identical choice there.
const buildCombinedMissileFireBlock = ({icon, colour}) => {
  Blockly.Blocks['sprite_missile_fire'] = {
    init: function() {
      this.appendDummyInput()
          .appendField(`${icon} Fire`)
          .appendField(new Blockly.FieldDropdown(FIRE_OBJECT_DROPDOWN_OPTIONS), 'MISSILE');
      this.appendValueInput('X')
          .setCheck('Number')
          .appendField('from X');
      this.appendValueInput('Y')
          .setCheck('Number')
          .appendField('Y');
      this.appendValueInput('ANGLE')
          .setCheck('Number')
          .appendField('at angle');
      this.appendDummyInput('DEFAULT_INPUT')
          .appendField('default')
          .appendField(new Blockly.FieldDropdown(buildMissileFireDefaultAngleOptions), 'DEFAULT_ANGLE');
      // Pixels per frame, 0 (stands still) to 7: a number block, variable or any
      // other number (anything above 7 is held at 7 in the generated code). Each
      // block in the toolbox comes with a number block already plugged in.
      this.appendValueInput('SPEED')
          .setCheck('Number')
          .appendField('speed');
      this.appendDummyInput()
          .appendField(' ')
          .appendField(new Blockly.FieldCheckbox('FALSE'), 'THROTTLE')
          .appendField('throttle movement');
      // The values of the old checkbox stay: FALSE is 8 directions and TRUE is 16 (saved projects load as before).
      const directionsField = new Blockly.FieldDropdown([['8 directions', 'FALSE'], ['16 directions', 'TRUE'], ['any direction', 'ANY']]);
      directionsField.setTooltip('8 or 16 directions, or any direction: the angle is 0-255, a full turn (0 up, 64 right, 128 down, 192 left), 255 is an angle like the rest and "default" is not used.');
      this.appendDummyInput()
          .appendField(' ')
          .appendField(directionsField, 'DIRECTIONS16');
      const evenSpeedField = new Blockly.FieldCheckbox('FALSE');
      evenSpeedField.setTooltip('Every direction moves at the same speed. Without it a diagonal (and a halfway angle) is about 1.4 times faster than straight. Ticked, a straight shot takes an extra pixel now and then to match. Costs one byte of memory for the object.');
      this.appendDummyInput('EVENSPEED_INPUT')
          .appendField(' ')
          .appendField(evenSpeedField, 'EVENSPEED')
          .appendField('same speed at every angle');
      const playfieldCheckField = new Blockly.FieldCheckbox('FALSE');
      playfieldCheckField.setTooltip('Moves one pixel at a time and checks the playfield after each, stopping on the first lit pixel. Without it a fast object can jump over a thin playfield pixel. Costs a little extra time every frame it moves.');
      this.appendDummyInput()
          .appendField(' ')
          .appendField(playfieldCheckField, 'PFCHECK')
          .appendField('check playfield while moving');
      this.setInputsInline(true);
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(colour);
      // Red for Missile 0, blue for Missile 1 (like the other missile blocks)
      // and orange for the Ball, following the dropdown.
      const fireColourFor = fireObjectColour;
      const objectField = this.getField('MISSILE');
      this.setColour(fireColourFor(objectField.getValue()));
      objectField.setValidator((newValue) => {
        this.setColour(fireColourFor(newValue));
        return newValue;
      });
      // Every number input starts with a number (a shadow block, which shows even when a saved project has no block there), as in the toolbox.
      [['X', 0], ['Y', 0], ['ANGLE', 0], ['SPEED', 1]].forEach(([inputName, value]) => {
        const input = this.getInput(inputName);
        if (input && input.connection) input.connection.setShadowState({type: 'math_number', fields: {NUM: value}});
      });
      setupFireDefaultAngleSync(this);
      this.setTooltip('Launches the missile from the given X/Y, moving it until it goes off-screen, where it stops. Height/visibility is never touched; use "Missile: set Height" to hide it. Angle is 0-7 (0=Up, 1=Up-Right, 2=Right, 3=Down-Right, 4=Down, 5=Down-Left, 6=Left, 7=Up-Left), 0-15 with "16 directions", or 0-255 with "any direction" (a full turn: 64 is right, 128 down; 255 is an angle, no default). 255 (or any value outside the range) means no direction (e.g. a centered joystick): "default" is used instead. Each run relaunches the missile from the given X/Y even if a shot is in flight, so put it behind a rate limiter (e.g. "every X frames"), not something true every frame. "throttle movement", directly inside an "every X frames" block, moves one step every X frames instead of every frame. "16 directions" doubles the angle resolution to 0-15; the extra directions move full speed on the dominant axis and half on the other. Picked values are translated onto the new scale when toggled.');
    },
  };
};

// Player 0 and Player 1 share these three combined block families now (see
// PLAYER_OPTIONS' comment in buildCombinedPlayerVarBlocks above). The
// 'colour' passed here is only ever the construction-time placeholder,
// immediately overridden by sprite_player_field_sync's  colour-sync half
// (red for Player 0, blue for Player 1 - the same colours the old separate
// sprite_player0_*/sprite_player1_* blocks used to be, restored per the
// user's  follow-up request after this refactor first shipped them all
// as a single flat purple) - 'red' here just matches PLAYER's  default.
buildCombinedPlayerVarBlocks({
  icon: PLAYER_ICON,
  colour: 'red',
});

buildPlayerBlocks({
  icon: PLAYER_ICON,
  colour: 'red',
});

buildAnimationSelectBlock({
  icon: PLAYER_ICON,
  colour: 'red',
  storageFactory: usePlayerAnimationsStorage,
});

buildAnimationSetBlock({
  icon: PLAYER_ICON,
  colour: 'red',
  storageFactory: usePlayerAnimationsStorage,
});

buildAnimationSetByIdBlock({
  icon: PLAYER_ICON,
  colour: 'red',
});

buildAnimationIdGetBlock({
  icon: PLAYER_ICON,
  colour: 'red',
});

buildAnimationFinishedBlock({
  icon: PLAYER_ICON,
  colour: 'red',
});

// Missile 0/1 share these four combined block families now (see
// MISSILE_OPTIONS' comment above) - 'colour' is only ever the
// construction-time placeholder, immediately overridden by
// sprite_missile_field_sync's  colour-sync half (red for Missile 0,
// blue for Missile 1, the same colours the old separate
// sprite_missile0_*/sprite_missile1_* blocks used to be).
buildCombinedMissileVarBlocks({
  icon: MISSILE_ICON,
  colour: 'red',
});

buildMissileSizeBlock({
  icon: MISSILE_ICON,
  colour: 'red',
});

buildCombinedMissileFireBlock({
  icon: MISSILE_ICON,
  colour: 'red',
});

// Reads the direction a fired object (set by the Fire block) is travelling in: 0-7
// clockwise from Up, or 0-15 when a Fire block for that object uses 16 directions
// (the same numbers as the Fire block's angle and the joystick direction block).
// Read it before a Bounce block runs, which changes it.
Blockly.Blocks['sprite_fire_angle_get'] = {
  init: function() {
    this.appendDummyInput()
        .appendField(`${MISSILE_ICON} Fire angle of`)
        .appendField(new Blockly.FieldDropdown(FIRE_OBJECT_DROPDOWN_OPTIONS), 'MISSILE');
    this.setOutput(true, 'Number');
    const colourFor = fireObjectColour;
    const objectField = this.getField('MISSILE');
    this.setColour(colourFor(objectField.getValue()));
    objectField.setValidator((newValue) => {
      this.setColour(colourFor(newValue));
      return newValue;
    });
    this.setTooltip('The direction the missile or ball was last fired in by a "Fire" block: 0 Up, 1 Up-Right, 2 Right, 3 Down-Right, 4 Down, 5 Down-Left, 6 Left, 7 Up-Left (0-15 with "16 directions", 0-255 with "any direction"). Read it on a collision, before a "Bounce" block turns it around. Only meaningful for an object a Fire block launched.');
  },
};

// Changes how fast an object a Fire block launched moves, while it is moving (the Fire block
// sets the speed it starts at).
Blockly.Blocks['sprite_fire_speed_set'] = {
  init: function() {
    this.appendValueInput('SPEED')
        .setCheck('Number')
        .appendField(`${MISSILE_ICON} Set fired`)
        .appendField(new Blockly.FieldDropdown(FIRE_OBJECT_DROPDOWN_OPTIONS), 'MISSILE')
        .appendField('speed to');
    this.setInputsInline(true);
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    const colourFor = fireObjectColour;
    const objectField = this.getField('MISSILE');
    this.setColour(colourFor(objectField.getValue()));
    objectField.setValidator((newValue) => {
      this.setColour(colourFor(newValue));
      return newValue;
    });
    this.setTooltip('Changes the speed (pixels a frame, 0 to 7) of a missile or ball a "Fire" block launched, from the next frame, keeping its direction. 0 holds it still without cancelling the Fire ("Stop fired" cancels it). No effect on an object no "Fire" block launches.');
  },
};

buildSpriteBlocks({
  name: 'ball',
  description: 'Ball',
  icon: BALL_ICON,
  colour: '#ff8800',
  options: buildMissileOptions('ball'),
  writeOnlyOptions: [
    [HEIGHT_ICON + ' Width', 'ballwidth'],
  ],
});

// The Atari 2600 only has one priority switch for the whole screen: it can't
// be set per-sprite, only for all players/missiles/ball against the
// playfield at once.
Blockly.defineBlocksWithJsonArray([
  {
    'type': 'sprite_priority_set',
    'message0': `${PRIORITY_ICON} Sprite priority %1`,
    'args0': [
      {
        'type': 'field_dropdown',
        'name': 'VALUE',
        'options': [
          ['Sprites above playfield (default)', '0'],
          ['Playfield above sprites', '1'],
        ],
      },
    ],
    'previousStatement': null,
    'nextStatement': null,
    'colour': PRIORITY_COLOUR,
    'tooltip': `Chooses whether the playfield and ball are drawn in front of or behind all players and missiles. One switch for the whole screen, changeable at any time.`,
  },
]);

// Fading Player 0/Player 1's color - same shared mechanism as Background's
// "Fade color to" (see emitColorFadeTrigger in generators/bbasic/
// background.js, generalized past just COLUBK/COLUPF/scorecolor/TextColor
// to cover player0realcolor/player1realcolor too - see blocks/background.js's
// FADE_TAG_BY_VAR/FADE_FLAGS_BYTE_BY_VAR). One combined VAR dropdown
// covering both players (same "one combined block instead of one per
// player/missile/ball" convention as object_seek_to/object_seek_arrived
// above), targeting the exact same player0realcolor/player1realcolor system
// variables the "Color" option on sprite_player_get/sprite_player_set
// already reads/writes (buildPlayerOptions above).
//
// Also fades the matching missile (missile0 for Player 0, missile1 for
// Player 1) with no extra code needed: real 2600 hardware has no separate
// missile color register at all - missile0 always draws using COLUP0 (the
// exact same register Player 0's  color lives in), missile1 uses COLUP1 -
// so fading player0realcolor/player1realcolor (which feed COLUP0/COLUP1
// every frame - see bbasic.bb.hbs's "COLUP0 = player0realcolor") already
// fades whichever missile is paired with that player too.
const PLAYER_FADE_VAR_OPTIONS = [
  [`${PLAYER_ICON} Player 0`, 'player0realcolor'],
  [`${PLAYER_ICON} Player 1`, 'player1realcolor'],
];
const PLAYER_FADE_COLOUR = 'red';

// Same red-for-Player-0/blue-for-Player-1 colour-sync treatment
// registerDropdownFieldSyncExtension above already gives the combined
// sprite_player_get/set/change/etc. blocks (confirmed with the user) -
// simpler here since VAR IS the player choice itself (no separate PLAYER
// field to translate anything against), so this is its  small extension
// rather than reusing that generic factory. Validator-based, not
// setOnChange - see registerDropdownFieldSyncExtension's  comment above
// for why (setOnChange never fires for a toolbox flyout block built from
// XML with events disabled).
registerExtension('sprite_player_fade_colour_sync', function() {
  // eslint-disable-next-line no-invalid-this
  const block = this;
  const varField = block.getField('VAR');
  if (!varField) return;
  const colourFor = (value) => {
    const extra = /^player([2-9]|1[0-6])realcolor$/.exec(value);
    return value === 'player1realcolor' ? 'blue' : extra ? extraPlayerColour(extra[1]) : 'red';
  };
  block.setColour(colourFor(varField.getValue()));
  varField.setValidator((newValue) => {
    block.setColour(colourFor(newValue));
    return newValue;
  });
});

Blockly.defineBlocksWithJsonArray([
  {
    'type': `sprite_player_fade_to`,
    'message0': `${PLAYER_ICON} Fade %1 ${COLOR_ICON} color to %2 over %3 frames`,
    'args0': [
      {
        'type': 'field_dropdown',
        'name': 'VAR',
        'options': PLAYER_FADE_VAR_OPTIONS,
      },
      {
        'type': 'input_value',
        'name': 'VALUE',
      },
      {
        'type': 'input_value',
        'name': 'FRAMES',
        'check': 'Number',
      },
    ],
    'inputsInline': true,
    'previousStatement': null,
    'nextStatement': null,
    'colour': PLAYER_FADE_COLOUR,
    'extensions': ['sprite_player_fade_colour_sync'],
    'tooltip': 'Fades the player\'s color toward the given color over about this many frames, in the same hue. Needs triggering only once; it keeps running every frame until it reaches the target. Also fades the player\'s missile (missile0 for Player 0, missile1 for Player 1); with the DPC+ kernel the missile has a separate color register (the Missile Color option) and the fade carries it along. A DPC+ player can only fade to a fixed color (a color block, not a calculated value).',
  },
]);

// Works exactly like background_fade_finished (see blocks/background.js's
// comment - same shared bit/flag machinery, same "fires once, regardless
// of fade direction, never late" behavior), just choosing between Player 0/
// Player 1 instead of Background/Playfield.
Blockly.Blocks['sprite_player_fade_finished'] = {
  init: function() {
    this.appendDummyInput()
        .appendField(`${PLAYER_ICON} When`)
        .appendField(new Blockly.FieldDropdown(PLAYER_FADE_VAR_OPTIONS), 'VAR')
        .appendField(`${COLOR_ICON} color has finished fading`);
    this.appendStatementInput('DO');
    this.setPreviousStatement(true);
    this.setNextStatement(true);
    this.setColour(PLAYER_FADE_COLOUR);
    Blockly.Extensions.apply('sprite_player_fade_colour_sync', this, false);
    this.setTooltip('Runs once when a matching "Fade" block (same player) reaches its target color. Does nothing if no matching fade runs.');
  },
};

// Plain, always-current boolean read of the active bit - same shape as
// background_fade_active's  generator (see blocks/background.js's
// comment), just choosing between Player 0/Player 1 instead of Background/
// Playfield.
Blockly.Blocks['sprite_player_fade_active'] = {
  init: function() {
    this.appendDummyInput()
        .appendField(`${PLAYER_ICON} Is`)
        .appendField(new Blockly.FieldDropdown(PLAYER_FADE_VAR_OPTIONS), 'VAR')
        .appendField(`${COLOR_ICON} color fade active?`);
    this.setOutput(true, 'Boolean');
    this.setColour(PLAYER_FADE_COLOUR);
    Blockly.Extensions.apply('sprite_player_fade_colour_sync', this, false);
    this.setTooltip('True from when a "Fade" block triggers until it reaches its target color.');
  },
};
