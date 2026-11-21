import * as Blockly from 'blockly/core';

import {BIT_ICON} from './icon';
import {blockVariableOptions} from '../utils/block-variables';

export const BIT_OPTIONS = [...Array(8).keys()].map((n) => [`${n}`, `${n}`]);

// Built-in batari Basic variables worth reading/writing directly - plain
// names, unlike the user's  variables, which are listed by id. Shared
// between the per-bit blocks below (BUILT_IN_VARIABLES) and
// system_variable_get further down (SYSTEM_VARIABLE_OPTIONS, same list,
// already in dropdown-option [label, value] shape) - reading the WHOLE
// byte only makes sense for the built-in names, not the user's
// variables (those already have a plain Blockly "variables_get" block for
// that), so this doesn't reuse variableOptions()'s combined list below.
export const SYSTEM_VARIABLE_OPTIONS = [
  'player0size',
  'player1size',
  'player0frame',
  'player1frame',
  'framecounter',
  // "repeatcounter" (the "Repeat X times" block's  for-loop variable -
  // see REPEAT_COUNTER_VAR_NAME in generators/bbasic/loops.js) deliberately
  // isn't listed here - unlike every name above (all unconditionally
  // dimmed/real hardware registers), it's only ever declared for a project
  // that actually has a "Repeat" block somewhere, so exposing it in this
  // generic "read a built-in variable" picker would let a project with none
  // reference an undeclared symbol and fail to compile.
  'CTRLPF',
  'NUSIZ0',
  'NUSIZ1',
  'SWCHA',
  'SWCHB',
].map((name) => [name, name]);
const BUILT_IN_VARIABLES = SYSTEM_VARIABLE_OPTIONS;

// A block in the toolbox flyout belongs to the flyout's  workspace, which
// has no variables.
const workspaceOf = (field) => {
  const block = field.getSourceBlock();
  if (!block || !block.workspace) return null;
  const workspace = block.workspace;
  return workspace.isFlyout ? workspace.targetWorkspace : workspace;
};

/**
 * Lists the variables offered by the bit blocks' dropdown. Blockly calls this
 * with `this` bound to the field, and re-evaluates it every time the dropdown
 * opens, so variables the user creates later show up without the block needing
 * to be rebuilt.
 * @return {!Array<!Array<string>>} Pairs of label and value.
 */
function variableOptions() {
  // eslint-disable-next-line no-invalid-this
  const workspace = workspaceOf(this);
  const userVariables = workspace ?
    workspace.getAllVariables().map((variable) => [variable.name, variable.getId()]) :
    [];
  return [...userVariables, ...BUILT_IN_VARIABLES];
}

const buildVariableField = () => new Blockly.FieldDropdown(variableOptions);

// Resolves the selection to one of the user's variables, or null when a
// built-in batari Basic name is selected.
const selectedVariable = (block) => {
  const value = block.getFieldValue('VAR');
  return block.workspace && block.workspace.getVariableById ?
    block.workspace.getVariableById(value) : null;
};

// The VAR field stores the variable's ID (see variableOptions), so a rename
// elsewhere doesn't break the reference - but FieldDropdown only re-runs its
// options generator (and so only re-reads the variable's current name) when
// its cache is invalidated, which a plain rename never does by itself: the
// field keeps showing whatever label was cached from the last time its
// dropdown opened, stale until the user happens to click it again.
// getOptions() (no cache arg) has to run BEFORE setValue(), same gotcha
// documented in subroutine.js's  setSubroutineDropdownValue - setValue's
// validation reads the cache, so a rename without a preceding fresh
// getOptions() call would just re-validate against the same stale label.
/**
 * @param {!Blockly.Field} field
 * @param {string} value
 */
function refreshVariableDropdownValue(field, value) {
  field.getOptions();
  field.setValue(value);
}

/**
 * @param {?Blockly.Workspace} workspace
 */
function ensureBitVariableRenameListener(workspace) {
  if (!workspace || workspace.isFlyout || workspace.bitVariableRenameListener_) return;
  workspace.bitVariableRenameListener_ = true;
  workspace.addChangeListener((event) => {
    if (event.type !== Blockly.Events.VAR_RENAME) return;
    ['bit_get', 'bit_set', 'nibble_get', 'nibble_set'].flatMap((type) => workspace.getBlocksByType(type, false))
        .forEach((block) => {
          const field = block.getField('VAR');
          if (field && field.getValue() === event.varId) {
            refreshVariableDropdownValue(field, event.varId);
          }
        });
  });
}

Blockly.Blocks['bit_get'] = {
  init: function() {
    this.appendDummyInput()
        .appendField(`${BIT_ICON} bit`)
        .appendField(new Blockly.FieldDropdown(BIT_OPTIONS), 'BIT')
        .appendField('of')
        .appendField(buildVariableField(), 'VAR');
    this.setOutput(true, 'Boolean');
    // A theme style, not a raw colour - matches the stock variables_get/set/change
    // blocks'  colour resolution exactly (see variables.js in Blockly core),
    // instead of going through setColour's separate, compounding desaturation path.
    this.setStyle('variable_blocks');
    this.setTooltip('Checks if a bit of a variable is set (1) or clear (0).');
    if (this.workspace) ensureBitVariableRenameListener(this.workspace);
  },
  // The dropdown is not a variable field, so without this Blockly treats the
  // variable as unused: it would be dropped when the workspace is serialised,
  // never get declared, and not be tracked on rename or delete.
  getVarModels: function() {
    const variable = selectedVariable(this);
    return variable ? [variable] : [];
  },
};

Blockly.Blocks['bit_set'] = {
  init: function() {
    this.appendValueInput('VALUE')
        .setCheck(['Boolean', 'Number'])
        .appendField(`${BIT_ICON} set bit`)
        .appendField(new Blockly.FieldDropdown(BIT_OPTIONS), 'BIT')
        .appendField('of')
        .appendField(buildVariableField(), 'VAR')
        .appendField('to');
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setStyle('variable_blocks');
    this.setTooltip('Sets a bit of a variable. Accepts true/false or 1/0.');
    if (this.workspace) ensureBitVariableRenameListener(this.workspace);
  },
  // See bit_get.
  getVarModels: function() {
    const variable = selectedVariable(this);
    return variable ? [variable] : [];
  },
};

const NIBBLE_OPTIONS = [['first 4 bits', 'FIRST'], ['last 4 bits', 'LAST']];

// The first 4 bits (bits 0 to 3) or the last 4 bits (bits 4 to 7) of a variable as a number from 0 to 15.
Blockly.Blocks['nibble_get'] = {
  init: function() {
    this.appendDummyInput()
        .appendField(`${BIT_ICON}`)
        .appendField(new Blockly.FieldDropdown(NIBBLE_OPTIONS), 'HALF')
        .appendField('of')
        .appendField(buildVariableField(), 'VAR');
    this.setOutput(true, 'Number');
    this.setStyle('variable_blocks');
    this.setTooltip('Reads half of a variable as 0 to 15: bits 0 to 3 or bits 4 to 7.');
    if (this.workspace) ensureBitVariableRenameListener(this.workspace);
  },
  // See bit_get.
  getVarModels: function() {
    const variable = selectedVariable(this);
    return variable ? [variable] : [];
  },
};

// The number a half of a variable is set to, from what is typed: four 0s and 1s are the bits (0101 is 5), any other number is held to 0 to 15.
// null for what is not a number.
export const nibbleNumber = (text) => {
  const trimmed = String(text).trim();
  if (/^[01]{4}$/.test(trimmed)) return parseInt(trimmed, 2);
  // (The ways a number block takes too: %1010 or 0b1010, $1F or 0x1F.)
  if (/^(%|0[bB])[01]+$/.test(trimmed)) return Math.min(15, parseInt(trimmed.replace(/^(%|0[bB])/, ''), 2));
  if (/^(\$|0[xX])[0-9a-fA-F]+$/.test(trimmed)) return Math.min(15, parseInt(trimmed.replace(/^(\$|0[xX])/, ''), 16));
  const value = Number(trimmed);
  if (trimmed === '' || Number.isNaN(value)) return null;
  return Math.max(0, Math.min(15, Math.floor(value)));
};

Blockly.Blocks['nibble_set'] = {
  init: function() {
    this.appendValueInput('VALUE')
        .setCheck('Number')
        .appendField(`${BIT_ICON} set`)
        .appendField(new Blockly.FieldDropdown(NIBBLE_OPTIONS), 'HALF')
        .appendField('of')
        .appendField(buildVariableField(), 'VAR')
        .appendField('to');
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setStyle('variable_blocks');
    this.setTooltip('Sets half of a variable to a number from 0 to 15 (bits 0 to 3 or 4 to 7) and leaves the other half. Four 0s and 1s (like 0101) are read as the bits. A number above 15 is set to 15.');
    if (this.workspace) ensureBitVariableRenameListener(this.workspace);
  },
  // The number typed in the block, as it is kept: four 0s and 1s (0101) are the bits, turned into their number (5); above 15 is put back to
  // 15, below 0 to 0.
  onchange: function() {
    const target = this.getInputTargetBlock('VALUE');
    if (!target || target.type !== 'math_number' || this.isInFlyout) return;
    const text = String(target.getFieldValue('NUM'));
    const held = nibbleNumber(text);
    if (held !== null && text !== String(held)) target.setFieldValue(String(held), 'NUM');
  },
  // See bit_get.
  getVarModels: function() {
    const variable = selectedVariable(this);
    return variable ? [variable] : [];
  },
};

// Reads any of the built-in batari Basic variables (see
// SYSTEM_VARIABLE_OPTIONS above) as a whole byte, not one bit at a time
// like bit_get.
// The names of the variables that the blocks of the project make (see utils/block-variables.js) come after the built-in ones. A project that is
// being loaded makes the blocks one after the other, so the block that makes a variable may not be there yet when the block that reads it
// is: any name is taken, and shown as it is.
/** The dropdown of the block that reads a built-in variable. */
class FieldBuiltInVariable extends Blockly.FieldDropdown {
  /** Lists the built-in names and the variables the blocks of the project make. */
  constructor() {
    super(function() {
      // eslint-disable-next-line no-invalid-this
      const workspace = workspaceOf(this);
      return [...SYSTEM_VARIABLE_OPTIONS, ...(workspace ? blockVariableOptions(workspace) : [])];
    });
  }
  /**
   * @param {*} newValue
   * @return {?string} The name, or null when it is not one.
   */
  doClassValidator_(newValue) {
    return typeof newValue === 'string' && /^[A-Za-z_][A-Za-z0-9_]*$/.test(newValue) ? newValue : null;
  }
  /**
   * @param {boolean=} useCache
   * @return {!Array<!Array<string>>} Pairs of label and value, with the current value in them.
   */
  getOptions(useCache) {
    const options = super.getOptions(useCache);
    const value = this.getValue();
    return value && !options.some((option) => option[1] === value) ? [...options, [value, value]] : options;
  }
}

Blockly.Blocks['system_variable_get'] = {
  init: function() {
    this.appendDummyInput()
        .appendField(`${BIT_ICON} `)
        .appendField(new FieldBuiltInVariable(), 'VAR');
    this.setOutput(true, 'Number');
    this.setStyle('variable_blocks');
    this.setTooltip('Reads a built-in batari Basic variable, e.g. "framecounter" (frames since power-on). Variables kept by other blocks of the project (Platform state and speed, a Seek target, ...) are listed while that block is in the project.');
  },
};
