import * as Blockly from 'blockly/core';

import {COLOR_ICON, TEXT_ICON} from './icon';
import {buildTextStringOptions} from './text-strings';

// Was '#795548' - identical (down to the exact RGB triplet) to Data's
// 'rgb(121, 85, 72)', making Text and Data blocks indistinguishable by
// colour alone. Indigo isn't used anywhere else in the app's palette (see
// blocks/*.js: purple, red, blue, background's orange, score's orange-red,
// data's brown, sound's magenta, sprites' teal, event's teal, comment's
// blue-grey).
const TEXT_COLOR = '#3F51B5';

// A message longer than the Text tab's "Max characters to display at
// once" setting (see resolveTextMaxDisplayWidth in blocks/text-strings.js)
// always auto-scrolls, regardless of which "Show text" block shows it (see
// generators/bbasic/text-minikernel.js's  encodeMessageRow) - the three
// "..._scroll" block variants below just add speed/pause fields to tune
// that, using DEFAULT_SCROLL_SPEED/DEFAULT_SCROLL_PAUSE otherwise (see
// their  use in generators/bbasic/text-minikernel.js).
const appendScrollInputs = (block) => {
  block.appendValueInput('SCROLL_SPEED')
      .setCheck('Number')
      .appendField('every');
  block.appendDummyInput().appendField('frames,');
  block.appendValueInput('SCROLL_PAUSE')
      .setCheck('Number')
      .appendField('wait');
  block.appendDummyInput().appendField('at limits');
  block.appendDummyInput()
      .appendField(new Blockly.FieldCheckbox('FALSE'), 'START_AT_END')
      .appendField('start at end');
  block.setInputsInline(true);
};

// Shows a message using the Text Minikernel (a five-line message drawn in
// place of the score digits - see generators/bbasic/text-minikernel.js), the
// message picked from the entries defined on the Text tab. Defined in JS
// rather than the JSON array below so the dropdown can be backed by a
// function: that lets Blockly rebuild the option list every time the
// dropdown opens, so messages added, renamed or deleted on the Text tab show
// up without reloading the page (same reasoning as data_get_element's TABLE
// dropdown in blocks/data.js).
Blockly.Blocks['text_minikernel_show_named'] = {
  init: function() {
    this.appendDummyInput()
        .appendField(`${TEXT_ICON} Show text`)
        .appendField(new Blockly.FieldDropdown(buildTextStringOptions), 'TEXT_ID');
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour(TEXT_COLOR);
    this.setTooltip('Shows a message from the Text tab in place of the score. If longer than the Text tab\'s max display width, it wraps to a second line when that entry\'s "Wrap to line 2" is on, otherwise it scrolls back and forth. "Scroll text" adds scroll speed/pause and always scrolls on one line.');
  },
};

// Same dropdown as text_minikernel_show_named above, but puts just that
// entry's  FIRST line on the chosen row (1 or 2) - the OTHER row always
// comes out blank, same "no way to update just one row" limitation as
// text_minikernel_show_row (see its  comment). Only the first line is
// ever used here (no word-wrap/"Wrap to line 2"/scrolling) - for an entry
// that needs more than a single row's worth of text, use plain "Show text"
// instead.
Blockly.Blocks['text_minikernel_show_named_row'] = {
  init: function() {
    this.appendDummyInput()
        .appendField(`${TEXT_ICON} Show text row`)
        .appendField(new Blockly.FieldDropdown([['1', '1'], ['2', '2']]), 'ROW')
        .appendField(new Blockly.FieldDropdown(buildTextStringOptions), 'TEXT_ID');
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour(TEXT_COLOR);
    this.setTooltip('Shows only the first line of a Text tab message on row 1 or 2; the other row is blank. Use "Show text" for a message needing both rows.');
  },
};

// Same message-picking rules as text_minikernel_show_named above, with
// SCROLL_SPEED/SCROLL_PAUSE fields added (see appendScrollInputs) to tune
// the scroll that entry gets automatically if it's too long to fit
// statically - a separate block, rather than the two extra fields just
// being added onto text_minikernel_show_named directly, so a project that
// never needs to tune scrolling never has to look at (or account for) those
// fields at all.
Blockly.Blocks['text_minikernel_show_named_scroll'] = {
  init: function() {
    this.appendDummyInput()
        .appendField(`${TEXT_ICON} Scroll text`)
        .appendField(new Blockly.FieldDropdown(buildTextStringOptions), 'TEXT_ID');
    appendScrollInputs(this);
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour(TEXT_COLOR);
    this.setTooltip('Shows a Text tab message in place of the score, with a set scroll speed/pause. Only has an effect when the message is longer than the max display width. Always scrolls on one line, ignoring "Wrap to line 2"; use "Show text" to wrap.');
  },
};

Blockly.defineBlocksWithJsonArray([
  // Shows a message using the Text Minikernel. Free-typed here rather than
  // picked from a list: the generator registers whatever's typed into a
  // shared, deduplicated message table at compile time, so any text works
  // without a separate "define your messages first" step - see
  // "Show text" (text_minikernel_show_named above) for the named-entry
  // version backed by the Text tab.
  {
    'type': 'text_minikernel_show',
    'message0': `${TEXT_ICON} Show text %1`,
    'args0': [
      {
        'type': 'field_input',
        'name': 'TEXT',
        'text': 'HELLO WORLD!',
      },
    ],
    'previousStatement': null,
    'nextStatement': null,
    'colour': TEXT_COLOR,
    'tooltip': 'Shows a message in place of the score (A-Z, 0-9, basic punctuation). Scrolls back and forth if longer than the Text tab\'s max display width; "Scroll text" adds scroll speed/pause.',
  },
  // Sets ONE row directly (row 1 or row 2, picked from the dropdown) rather
  // than a whole message - the OTHER row always comes out blank (see
  // generators/bbasic/text-minikernel.js's  registerFreeTypedRowMessage):
  // this always compiles in a real 2-row entry with the chosen row set to
  // TEXT and the other row set to spaces, since the Text Minikernel's
  // row 2 is always read from a fixed offset right after row 1 (text12b.asm's
  // "textkernel2ndrow") - there's no way to update just one row while
  // leaving whatever the OTHER row currently shows untouched.
  {
    'type': 'text_minikernel_show_row',
    'message0': `${TEXT_ICON} Show text row %1 %2`,
    'args0': [
      {
        'type': 'field_dropdown',
        'name': 'ROW',
        'options': [['1', '1'], ['2', '2']],
      },
      {
        'type': 'field_input',
        'name': 'TEXT',
        'text': 'HELLO WORLD!',
      },
    ],
    'previousStatement': null,
    'nextStatement': null,
    'colour': TEXT_COLOR,
    'tooltip': 'Shows text on row 1 or 2 in place of the score; the other row is blank. Use "Show text" or "Show text ID" to fill both rows.',
  },
  // Sets the displayed message from a number expression (a variable,
  // computed value, or literal) rather than a fixed choice - the number is
  // the message's position on the Text tab (1 = the first message listed
  // there, 2 = the second, and so on), so the message shown can be picked at
  // runtime instead of always being the same fixed one.
  {
    'type': 'text_minikernel_show_by_id',
    'message0': `${TEXT_ICON} Show text ID %1`,
    'args0': [
      {
        'type': 'input_value',
        'name': 'VALUE',
        'check': 'Number',
      },
    ],
    'previousStatement': null,
    'nextStatement': null,
    'colour': TEXT_COLOR,
    'tooltip': 'Shows the Text tab message at this position (1 = first listed); the number can be a variable or calculation. If longer than the max display width, it wraps to a second line when that entry\'s "Wrap to line 2" is on, otherwise it scrolls.',
  },
  // Same runtime id lookup as text_minikernel_show_by_id above, but shows
  // only that entry's  first line, on just one row (1 or 2) - the OTHER
  // row always comes out blank, same limitation every other "show row"
  // block has (see text_minikernel_show_row's  comment). ROW=2 costs
  // extra ROM (a second, parallel copy of every Text tab entry's  first
  // line - see generateTextRow2OffsetsTable's  comment in generators/
  // bbasic/text-minikernel.js) - ROW=1 doesn't, since an entry's row 1 IS
  // its  first line already.
  {
    'type': 'text_minikernel_show_by_id_row',
    'message0': `${TEXT_ICON} Show text row %1 ID %2`,
    'args0': [
      {
        'type': 'field_dropdown',
        'name': 'ROW',
        'options': [['1', '1'], ['2', '2']],
      },
      {
        'type': 'input_value',
        'name': 'VALUE',
        'check': 'Number',
      },
    ],
    'previousStatement': null,
    'nextStatement': null,
    'colour': TEXT_COLOR,
    'tooltip': 'Shows only the first line of the Text tab message at this position (1 = first listed) on row 1 or 2; the other row is blank. The number can be a variable or calculation.',
  },
  // Clears whatever message is currently shown, without displaying a new
  // one - equivalent to "Show text" with an empty message, but reads clearer
  // at the call site.
  {
    'type': 'text_minikernel_clear',
    'message0': `${TEXT_ICON} Clear text`,
    'previousStatement': null,
    'nextStatement': null,
    'colour': TEXT_COLOR,
    'tooltip': 'Clears the displayed text.',
  },
  // Used after any of the blocks that show text (by name, by ID, scrolling, with several rows, one row...): the text is cleared
  // again once the frames have passed.
  {
    'type': 'text_minikernel_clear_after',
    'message0': `${TEXT_ICON} Clear text after %1 frames`,
    'args0': [{'type': 'input_value', 'name': 'FRAMES', 'check': 'Number'}],
    'inputsInline': true,
    'previousStatement': null,
    'nextStatement': null,
    'colour': TEXT_COLOR,
    'tooltip': 'Put it after a block that shows text: clears the text after this many frames (1 to 255; 60 is about a second). Run it again after showing another message to give that one the full time.',
  },
  // Used after a block that shows text: the text blinks (off and on again) at the Text tab's Blink speed, forever or a number of times, and
  // then stays shown or is cleared.
  {
    'type': 'text_minikernel_blink',
    'message0': `${TEXT_ICON} Blink text %1 forever, or %2 times, then clear text %3`,
    'args0': [
      {'type': 'field_checkbox', 'name': 'FOREVER', 'checked': true},
      {'type': 'input_value', 'name': 'TIMES', 'check': 'Number'},
      {'type': 'field_checkbox', 'name': 'CLEAR', 'checked': false},
    ],
    'inputsInline': true,
    'previousStatement': null,
    'nextStatement': null,
    'colour': TEXT_COLOR,
    'tooltip': 'Put it after a block that shows text: the text blinks at the Text tab\'s Blink speed (16 frames when Never). "forever" blinks without stopping; otherwise it blinks 1 to 16 times, then stays shown or is cleared if "then clear text" is ticked. It hides the text with the text background color, so a row with its color set separately ("Text set row 2 color") stays visible.',
  },
  // Runs the blocks inside once, in the frame after a Blink text block with a number of blinks has finished them.
  {
    'type': 'text_minikernel_blink_done',
    'message0': `${TEXT_ICON} When text blinking is done`,
    'message1': '%1',
    'args1': [{'type': 'input_statement', 'name': 'DO'}],
    'previousStatement': null,
    'nextStatement': null,
    'colour': TEXT_COLOR,
    'tooltip': 'Runs the blocks inside once, in the frame after text blinking is done (a Blink text block with a number of times; "forever" never is). Put it in code that runs every frame.',
  },
  {
    'type': 'text_minikernel_set_color',
    'message0': `${COLOR_ICON} Text set %1 color to %2`,
    'args0': [
      {
        'type': 'field_dropdown',
        'name': 'ROW',
        'options': [['row 1', '1'], ['row 2', '2'], ['both', 'both']],
      },
      {
        'type': 'input_value',
        'name': 'VALUE',
      },
    ],
    'previousStatement': null,
    'nextStatement': null,
    'colour': TEXT_COLOR,
    'tooltip': 'Sets the color of text messages. "row 2" only affects the second line of a wrapped message. Defaults to "row 1".',
  },
  {
    'type': 'text_minikernel_change_color',
    'message0': `${COLOR_ICON} Text change %1 color by %2`,
    'args0': [
      {
        'type': 'field_dropdown',
        'name': 'ROW',
        'options': [['row 1', '1'], ['row 2', '2'], ['both', 'both']],
      },
      {
        'type': 'input_value',
        'name': 'VALUE',
        'check': 'Number',
      },
    ],
    'previousStatement': null,
    'nextStatement': null,
    'colour': TEXT_COLOR,
    'tooltip': 'Adds a number to the color of the text. 16 is the next hue at the same brightness: inside an "Every x frames" block it cycles the color. "row 2" only affects the second line of a wrapped message.',
  },
  {
    'type': 'text_minikernel_set_background',
    'message0': `${COLOR_ICON} Text set background color to %1`,
    'args0': [
      {
        'type': 'input_value',
        'name': 'VALUE',
      },
    ],
    'previousStatement': null,
    'nextStatement': null,
    'colour': TEXT_COLOR,
    'tooltip': 'Sets the background color of the text rows while the game runs (the Text tab\'s Background color is the starting color). Each text line is drawn 1 color clock later than without this block, and "Clear text" and "Blink text" hide the text with the last background color set.',
  },
  {
    'type': 'text_minikernel_set_cursor_color',
    'message0': `${COLOR_ICON} Text set scroll cursor color to %1`,
    'args0': [
      {
        'type': 'input_value',
        'name': 'VALUE',
      },
    ],
    'previousStatement': null,
    'nextStatement': null,
    'colour': TEXT_COLOR,
    'tooltip': 'Sets the color of the blinking scroll cursor (the Text tab\'s "Show a blinking scroll cursor" switch).',
  },
  {
    'type': 'text_minikernel_set_end_icon_color',
    'message0': `${COLOR_ICON} Text set end icon color to %1`,
    'args0': [
      {
        'type': 'input_value',
        'name': 'VALUE',
      },
    ],
    'previousStatement': null,
    'nextStatement': null,
    'colour': TEXT_COLOR,
    'tooltip': 'Sets the color of the "end of message" icon.',
  },
  // Runtime on/off switch for the scroll cursor (Text tab's "Show a
  // scroll cursor" switch) - a single block with a dropdown, matching
  // text_minikernel_scroll_control's "one flag write, several named
  // choices" shape below, rather than two separate "show"/"hide" blocks.
  // Hidden means neither the up/down arrows nor the "end of message" icon
  // ever draw, regardless of whether the currently shown message actually
  // has more to scroll to - visible restores the normal behavior of each
  // showing exactly when it otherwise would.
  {
    'type': 'text_minikernel_scroll_cursor_visible',
    'message0': `${TEXT_ICON} Text scroll cursor %1`,
    'args0': [
      {
        'type': 'field_dropdown',
        'name': 'ACTION',
        'options': [['show', 'show'], ['hide', 'hide']],
      },
    ],
    'previousStatement': null,
    'nextStatement': null,
    'colour': TEXT_COLOR,
    'tooltip': 'Shows or hides the scroll cursor (arrows and "end of message" icon) while the game runs. Only has an effect if the Text tab\'s "Show a scroll cursor" switch is on. Shown by default.',
  },
  // Fades TextColor toward a target - same shared mechanism as Background's
  // "Fade color to" (see blocks/background.js's  fade var-name
  // helpers and generateBackgroundFadeChecks in generators/bbasic/
  // background.js, both now generalized past just COLUBK/COLUPF), just
  // always targeting TextColor rather than offering a register choice.
  // Fire-and-forget, same as Background's  version: triggering this once
  // keeps the color stepping toward the target every frame afterward by itself,
  // only while the Text Minikernel is in use elsewhere in the project.
  {
    'type': 'text_minikernel_fade_to',
    'message0': `${TEXT_ICON} Fade Text ${COLOR_ICON} color to %1 over %2 frames`,
    'args0': [
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
    'colour': TEXT_COLOR,
    'tooltip': 'Fades the message color toward the given color over roughly this many frames, keeping the hue of the target. Trigger it once; the fade keeps running every frame, even from an "if" that is only briefly true.',
  },
  // A single comparison against the shared scroll offset/max (see
  // generateTextScrollAdvance in generators/bbasic/text-minikernel.js) -
  // true at the moment a scrolling message has reached (and is pausing at)
  // the chosen end, false the rest of the time, including for a message
  // that never needed to scroll in the first place (offset and max are both
  // 0 then, so "Left" reads true and "Right" reads false at every frame -
  // the "already all the way left" state a non-scrolling message is always
  // in).
  // Runtime control over the shared scroll state (see generateTextScrollAdvance
  // in generators/bbasic/text-scroll.js) - a single block with a dropdown
  // rather than five separate blocks, since they're all just one flag/reset
  // write apiece and share the exact same "which action" shape.
  //
  // Start/Unpause both just clear the paused flag - Start reads better at a
  // call site meant to kick scrolling off (e.g. right after a "Show text"
  // call that intentionally left it paused), Unpause reads better paired
  // with a "Pause" earlier in the same logic, but they do the same thing.
  //
  // Stop freezes the message at its  start (offset 0) and pauses it
  // there - Restart resets to offset 0 too, but leaves it running (and
  // waits the "pause at limits" duration before its first step, the same
  // as a genuinely new message - see buildTextScrollSetupLines'
  // comment in text-scroll.js).
  {
    'type': 'text_minikernel_scroll_control',
    'message0': `${TEXT_ICON} Text scroll %1`,
    'args0': [
      {
        'type': 'field_dropdown',
        'name': 'ACTION',
        'options': [
          ['Start', 'start'],
          ['Pause', 'pause'],
          ['Unpause', 'unpause'],
          ['Stop', 'stop'],
          ['Restart', 'restart'],
        ],
      },
    ],
    'previousStatement': null,
    'nextStatement': null,
    'colour': TEXT_COLOR,
    'tooltip': 'Controls the shown scrolling message. Start/Unpause resumes it, Pause freezes it, Stop returns it to the beginning and freezes it, Restart returns it to the beginning and keeps scrolling. No effect on a message that does not scroll.',
  },
  {
    'type': 'text_minikernel_scroll_at',
    'message0': `${TEXT_ICON} Is text scroll at %1 ?`,
    'args0': [
      {
        'type': 'field_dropdown',
        'name': 'SIDE',
        'options': [['Left', 'left'], ['Right', 'right']],
      },
    ],
    'output': 'Boolean',
    'colour': TEXT_COLOR,
    'tooltip': 'True while the shown message is paused at the chosen end of its scroll range (always true for "Left" on a message that does not scroll).',
  },
  {
    'type': 'text_minikernel_end_icon_visible',
    'message0': `${TEXT_ICON} End of text?`,
    'output': 'Boolean',
    'colour': TEXT_COLOR,
    'tooltip': 'True when the "end of message" icon would be showing, with nothing left below to scroll down to.',
  },
  // Moves the currently shown message up/down one or two lines at a time
  // whenever its  text (the Text tab's  multi-line field) is more than
  // 2 lines - works regardless of whether "Wrap to line 2" is on: that
  // toggle only decides whether line 2 draws automatically without
  // scrolling, not whether a message's  overflow text is split into real,
  // separate lines at all (a long message always word-wraps into more than
  // one line, on or off). Distinct from the "Text scroll" blocks above
  // (which move a single line horizontally, character by character) - these
  // move vertically, whole lines at a time. Harmless no-ops on a message
  // with 2 or fewer lines, or one shown via a "(scrolling)" block.
  {
    'type': 'text_minikernel_line_scroll_up',
    'message0': `${TEXT_ICON} Scroll text lines up %1`,
    'args0': [
      {
        'type': 'field_dropdown',
        'name': 'LINES',
        'options': [['1 line', '1'], ['2 lines', '2']],
      },
    ],
    'inputsInline': true,
    'previousStatement': null,
    'nextStatement': null,
    'colour': TEXT_COLOR,
    'tooltip': 'Moves the shown message up one or two lines, never past the first line. No effect on a message of 2 lines or fewer.',
  },
  {
    'type': 'text_minikernel_line_scroll_down',
    'message0': `${TEXT_ICON} Scroll text lines down %1`,
    'args0': [
      {
        'type': 'field_dropdown',
        'name': 'LINES',
        'options': [['1 line', '1'], ['2 lines', '2']],
      },
    ],
    'inputsInline': true,
    'previousStatement': null,
    'nextStatement': null,
    'colour': TEXT_COLOR,
    'tooltip': 'Moves the shown message down one or two lines, never past the last line. No effect on a message of 2 lines or fewer.',
  },
]);

// Free-typed version of text_minikernel_show_named_scroll above - see
// text_minikernel_show's  comment for why free-typed text gets its
// block instead of a Text tab entry.
Blockly.Blocks['text_minikernel_show_scroll'] = {
  init: function() {
    this.appendDummyInput()
        .appendField(`${TEXT_ICON} Scroll text`)
        .appendField(new Blockly.FieldTextInput('HELLO WORLD!'), 'TEXT');
    appendScrollInputs(this);
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour(TEXT_COLOR);
    this.setTooltip('Shows a message in place of the score, with a set scroll speed/pause. Only has an effect when the message is longer than the Text tab\'s max display width.');
  },
};

// Runtime-ID version of text_minikernel_show_named_scroll above - see
// text_minikernel_show_by_id's  comment for the ID-lookup mechanics.
// Since which message this ends up showing isn't known until runtime,
// whether it scrolls (and how far) is also resolved at runtime, from a
// small lookup table generated alongside text_strings itself (see
// generateTextOffsetTables in generators/bbasic/text-scroll.js) - the
// scroll speed/pause fields below still apply at compile time, since those
// aren't part of what the runtime lookup needs to resolve.
Blockly.Blocks['text_minikernel_show_by_id_scroll'] = {
  init: function() {
    this.appendValueInput('VALUE')
        .setCheck('Number')
        .appendField(`${TEXT_ICON} Scroll text ID`);
    appendScrollInputs(this);
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour(TEXT_COLOR);
    this.setTooltip('Shows the Text tab message at this position, with a set scroll speed/pause; the number can be a variable or calculation. Only has an effect when the message is longer than the max display width. Always scrolls on one line, ignoring "Wrap to line 2"; use "Show text ID" to wrap.');
  },
};

// Works exactly like background_fade_finished (see blocks/background.js's
// comment - same shared bit/flag machinery, same "fires once, regardless
// of fade direction, never late" behavior), just always targeting TextColor
// rather than offering a register choice - same reasoning as
// text_minikernel_fade_to above: there's only one possible text color
// register.
Blockly.Blocks['text_minikernel_fade_finished'] = {
  init: function() {
    this.appendDummyInput()
        .appendField(`${TEXT_ICON} When Text ${COLOR_ICON} color has finished fading`);
    this.appendStatementInput('DO');
    this.setPreviousStatement(true);
    this.setNextStatement(true);
    this.setColour(TEXT_COLOR);
    this.setTooltip('Runs the blocks inside once when a matching "Fade Text color" block reaches its target color. Does nothing if no matching fade runs in the project.');
  },
};
