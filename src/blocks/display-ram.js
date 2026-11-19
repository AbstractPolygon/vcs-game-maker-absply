import * as Blockly from 'blockly/core';

// DPC+ keeps the playfield and color tables in 4K of display memory with room for 256 rows each, and a project
// only uses as many rows as its playfield resolution says. The upper half of six of those tables (128 bytes each)
// is spare and can hold plain variables, reached through one of the coprocessor's data fetchers (see
// generators/bbasic/display-ram.js), so these blocks give a project another 768 bytes to keep numbers in.
export const DISPLAY_RAM_AREA_OPTIONS = [
  ['1', '0'], ['2', '1'], ['3', '2'], ['4', '3'], ['5', '4'], ['6', '5'],
];

const DISPLAY_RAM_TOOLTIP = 'DPC+ only: six areas of 128 spare bytes (0 to 127) that work like variables. Not available when the playfield has more than 127 rows or a background scrolls. A get takes a few dozen cycles more than a variable.';

Blockly.Blocks['display_ram_set'] = {
  init: function() {
    this.appendValueInput('VALUE')
        .setCheck('Number')
        .appendField('Display RAM area')
        .appendField(new Blockly.FieldDropdown(DISPLAY_RAM_AREA_OPTIONS), 'AREA')
        .appendField('byte')
        .appendField(new Blockly.FieldNumber(0, 0, 127, 1), 'INDEX')
        .appendField('set to');
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setStyle('variable_blocks');
    this.setTooltip(DISPLAY_RAM_TOOLTIP);
  },
};

Blockly.Blocks['display_ram_change'] = {
  init: function() {
    this.appendValueInput('VALUE')
        .setCheck('Number')
        .appendField('Display RAM area')
        .appendField(new Blockly.FieldDropdown(DISPLAY_RAM_AREA_OPTIONS), 'AREA')
        .appendField('byte')
        .appendField(new Blockly.FieldNumber(0, 0, 127, 1), 'INDEX')
        .appendField('change by');
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setStyle('variable_blocks');
    this.setTooltip(DISPLAY_RAM_TOOLTIP);
  },
};

Blockly.Blocks['display_ram_get'] = {
  init: function() {
    this.appendDummyInput()
        .appendField('Display RAM area')
        .appendField(new Blockly.FieldDropdown(DISPLAY_RAM_AREA_OPTIONS), 'AREA')
        .appendField('byte')
        .appendField(new Blockly.FieldNumber(0, 0, 127, 1), 'INDEX');
    this.setOutput(true, 'Number');
    this.setStyle('variable_blocks');
    this.setTooltip(DISPLAY_RAM_TOOLTIP);
  },
};

// Data streams: a pointer into the display memory that moves on by one byte with every read or write, so a run of bytes
// can be stepped through without working out each address. DPC+ only. They use the coprocessor's data fetchers 2 to 4,
// which the kernel points back at its data every frame, so a stream's pointer does not last past drawscreen.
const DATA_STREAM_OPTIONS = [['1', '1'], ['2', '2'], ['3', '3']];

const DATA_STREAM_TOOLTIP = 'DPC+ only: a position in the Display RAM that moves on one byte after each read or write. Point it first, then read or write in turn. It is lost at the end of the frame, so point it again each frame. Past byte 127 of an area it carries on into the next area.';

Blockly.Blocks['data_stream_point'] = {
  init: function() {
    this.appendValueInput('INDEX')
        .setCheck('Number')
        .appendField('Data stream')
        .appendField(new Blockly.FieldDropdown(DATA_STREAM_OPTIONS), 'STREAM')
        .appendField('point to Display RAM area')
        .appendField(new Blockly.FieldDropdown(DISPLAY_RAM_AREA_OPTIONS), 'AREA')
        .appendField('byte');
    this.setInputsInline(true);
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setStyle('variable_blocks');
    this.setTooltip(DATA_STREAM_TOOLTIP);
  },
};

Blockly.Blocks['data_stream_read'] = {
  init: function() {
    this.appendDummyInput()
        .appendField('Data stream')
        .appendField(new Blockly.FieldDropdown(DATA_STREAM_OPTIONS), 'STREAM')
        .appendField('read next byte');
    this.setOutput(true, 'Number');
    this.setStyle('variable_blocks');
    this.setTooltip(DATA_STREAM_TOOLTIP);
  },
};

Blockly.Blocks['data_stream_write'] = {
  init: function() {
    this.appendValueInput('VALUE')
        .setCheck('Number')
        .appendField('Data stream')
        .appendField(new Blockly.FieldDropdown(DATA_STREAM_OPTIONS), 'STREAM')
        .appendField('write next byte');
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setStyle('variable_blocks');
    this.setTooltip(DATA_STREAM_TOOLTIP);
  },
};

// Fill and copy a run of Display RAM bytes in one block. DPC+ only. They use data fetchers 5 and 6 and a few of the
// temporary variables, and stop when they have done COUNT bytes; a run that goes past byte 127 of an area carries on
// into the next one.
const BULK_TOOLTIP = 'DPC+ only: works through a run of Display RAM bytes (up to 255), about 22 cycles a byte. Past byte 127 of an area it carries on into the next area.';

Blockly.Blocks['display_ram_fill'] = {
  init: function() {
    this.appendValueInput('VALUE')
        .setCheck('Number')
        .appendField('Display RAM area')
        .appendField(new Blockly.FieldDropdown(DISPLAY_RAM_AREA_OPTIONS), 'AREA')
        .appendField('fill with');
    this.appendValueInput('START')
        .setCheck('Number')
        .appendField('starting at byte');
    this.appendValueInput('COUNT')
        .setCheck('Number')
        .appendField('for');
    this.appendDummyInput().appendField('bytes');
    this.setInputsInline(true);
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setStyle('variable_blocks');
    this.setTooltip(BULK_TOOLTIP);
  },
};

Blockly.Blocks['display_ram_copy'] = {
  init: function() {
    this.appendValueInput('COUNT')
        .setCheck('Number')
        .appendField('Display RAM copy');
    this.appendDummyInput()
        .appendField('bytes from area')
        .appendField(new Blockly.FieldDropdown(DISPLAY_RAM_AREA_OPTIONS), 'FROM_AREA');
    this.appendValueInput('FROM')
        .setCheck('Number')
        .appendField('byte');
    this.appendDummyInput()
        .appendField('to area')
        .appendField(new Blockly.FieldDropdown(DISPLAY_RAM_AREA_OPTIONS), 'TO_AREA');
    this.appendValueInput('TO')
        .setCheck('Number')
        .appendField('byte');
    this.setInputsInline(true);
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setStyle('variable_blocks');
    this.setTooltip(BULK_TOOLTIP + ' Copying goes from the lowest byte up, so an overlapping copy repeats bytes.');
  },
};
