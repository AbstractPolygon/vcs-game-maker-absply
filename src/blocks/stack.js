import * as Blockly from 'blockly/core';

// DPC+'s 256-byte variable stack: push a variable to put its value aside, pull it back later. That lets different
// screens or subroutines reuse the same variables without losing what they held. Other kernels have no such
// stack, so there these blocks do nothing.
Blockly.Blocks['variables_push'] = {
  init: function() {
    this.appendDummyInput()
        .appendField('push')
        .appendField(new Blockly.FieldVariable('item'), 'VAR')
        .appendField('onto the stack');
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setStyle('variable_blocks');
    this.setTooltip('DPC+ only: pushes the variable\'s value on the 256-byte stack so the variable can be reused. Pull in the opposite order.');
  },
};

Blockly.Blocks['variables_pull'] = {
  init: function() {
    this.appendDummyInput()
        .appendField('pull')
        .appendField(new Blockly.FieldVariable('item'), 'VAR')
        .appendField('from the stack');
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setStyle('variable_blocks');
    this.setTooltip('DPC+ only: pulls the last pushed value back into the variable.');
  },
};

Blockly.Blocks['variables_keep_safe'] = {
  init: function() {
    this.appendDummyInput()
        .appendField('keep')
        .appendField(new Blockly.FieldVariable('item'), 'VAR')
        .appendField('safe on the stack while');
    this.appendStatementInput('DO');
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setStyle('variable_blocks');
    this.setTooltip('DPC+ only: pushes the variable, runs the blocks inside, then pulls it back, so they can reuse the variable. Nest several to keep several variables. Leaving early (Return, a jump to a label) skips the pull and breaks the stack. Other kernels just run the blocks.');
  },
};

Blockly.Blocks['variables_stack_position'] = {
  init: function() {
    this.appendDummyInput()
        .appendField('set the stack position to')
        .appendField(new Blockly.FieldNumber(255, 0, 255, 1), 'POSITION');
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setStyle('variable_blocks');
    this.setTooltip('DPC+ only: moves the stack pointer to one of 256 places (0 is the top, 255 the bottom) so values can be saved and restored in any order. Must be a number, not a variable. Each push moves one place toward the top, each pull one toward the bottom.');
  },
};
