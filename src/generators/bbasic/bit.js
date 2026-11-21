'use strict';
import {nibbleNumber} from '../../blocks/bit';

export default (Blockly) => {
  // The variable dropdown mixes the user's  variables, which are listed by
  // id, with built-in batari Basic names, which are listed literally.
  const resolveVariable = (block) => {
    const value = block.getFieldValue('VAR');
    if (!value) return 'temp1';
    const workspace = block.workspace;
    const variable = workspace && workspace.getVariableById ?
      workspace.getVariableById(value) : null;
    return Blockly.BBasic.nameDB_.getName(
        variable ? variable.getId() : value, Blockly.VARIABLE_CATEGORY_NAME);
  };

  Blockly.BBasic['bit_get'] = function(block) {
    const varName = resolveVariable(block);
    const bit = block.getFieldValue('BIT');
    const code = `${varName}{${bit}}`;
    return [code, Blockly.BBasic.ORDER_ATOMIC];
  };

  // A literal can be assigned straight to the bit; anything else has to be
  // branched on, since a batari Basic condition is not a value.
  const BIT_LITERALS = {'true': '1', '1': '1', 'false': '0', '0': '0'};

  Blockly.BBasic['nibble_get'] = function(block) {
    const varName = resolveVariable(block);
    if (block.getFieldValue('HALF') === 'LAST') {
      return [`${varName} / 16`, Blockly.BBasic.ORDER_DIVISION];
    }
    return [`${varName} & 15`, Blockly.BBasic.ORDER_BITWISE_AND];
  };

  Blockly.BBasic['nibble_set'] = function(block) {
    const varName = resolveVariable(block);
    const value = (Blockly.BBasic.valueToCode(block, 'VALUE', Blockly.BBasic.ORDER_BITWISE_AND) || '0').trim();
    // A plain number as the block keeps it (four 0s and 1s are the bits, above 15 is 15, see nibbleNumber); a worked out one is held to 15 in temp1.
    // (A number block is read from what is typed in it: its code drops the 0 in front of 0101.)
    const target = block.getInputTargetBlock('VALUE');
    const literal = target && target.type === 'math_number' ? nibbleNumber(target.getFieldValue('NUM')) : (/^\d+$/.test(value) ? nibbleNumber(value) : null);
    const held = literal !== null ? '' : `temp1 = ${value}\nif temp1 > 15 then temp1 = 15\n`;
    if (block.getFieldValue('HALF') === 'LAST') {
      return `${held}${varName} = (${varName} & 15) | ${literal !== null ? literal * 16 : '(temp1 * 16)'}\n`;
    }
    return `${held}${varName} = (${varName} & $F0) | ${literal !== null ? literal : 'temp1'}\n`;
  };

  // Just the plain built-in name - it's already a real, directly-readable
  // batari Basic variable, no lookup/resolution needed the way bit_get's
  // combined user-variable-or-built-in dropdown does.
  Blockly.BBasic['system_variable_get'] = function(block) {
    const code = block.getFieldValue('VAR');
    return [code, Blockly.BBasic.ORDER_ATOMIC];
  };

  Blockly.BBasic['bit_set'] = function(block) {
    const varName = resolveVariable(block);
    const bit = block.getFieldValue('BIT');
    const argument0 = Blockly.BBasic.valueToCode(block, 'VALUE',
        Blockly.BBasic.ORDER_ASSIGNMENT) || 'true';
    const target = `${varName}{${bit}}`;
    const literal = BIT_LITERALS[argument0.trim()];
    if (literal) {
      return `${target} = ${literal}\n`;
    }
    return `if ${argument0} then ${target} = 1 else ${target} = 0\n`;
  };
};
