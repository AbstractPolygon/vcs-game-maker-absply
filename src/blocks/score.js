import * as Blockly from 'blockly/core';

import {COLOR_ICON, SCORE_ICON} from './icon';

const SCORE_COLOR = '#f2691e';

// The score is six digits, numbered left to right.
const SCORE_DIGIT_OPTIONS = [...Array(6).keys()].map((n) => [`${n + 1}`, `${n + 1}`]);

// The byte "Score Bar units" counts the bits of when it is inside a custom function (temp1 to temp6 hold the arguments there).
export const scoreBarUnitsVarName = () => 'scoreBarUnits';
// The same for the Score left and Score right value blocks (the two values and the digit being added, when they are read inside a Function).
export const scoreSideValueVarName = (name) => `scoreSideValue${name}`;
// The same for "Score line colors: set hue", which holds the hue it works out there.
export const scoreLineHueVarName = () => 'scoreLineHue';

const SCORE_BAR_OPTIONS = [
  ['1', 'pfscore1'],
  ['2', 'pfscore2'],
];

Blockly.defineBlocksWithJsonArray([
  // Block for the score getter.
  {
    'type': `score_get`,
    'message0': `${SCORE_ICON} Score`,
    'output': 'Number',
    'colour': SCORE_COLOR,
    'tooltip': `Reads the score`,
  },
  // Block for the score setter.
  {
    'type': `score_set`,
    'message0': `${SCORE_ICON} Score set to %1`,
    'args0': [
      {
        'type': 'input_value',
        'name': 'VALUE',
      },
    ],
    'previousStatement': null,
    'nextStatement': null,
    'colour': SCORE_COLOR,
    'tooltip': `Updates the score`,
  },
  // Two score layouts at once: shows another of the layouts the project names.
  {
    'type': 'score_layout_set',
    'message0': `${SCORE_ICON} Set score layout to %1`,
    'args0': [{'type': 'field_dropdown', 'name': 'LAYOUT', 'options': [['3 + 3 digits', '3+3'], ['4 + 2 digits', '4+2'], ['5 + 1 digits', '5+1']]}],
    'previousStatement': null,
    'nextStatement': null,
    'colour': SCORE_COLOR,
    'tooltip': 'Shows the score as two scores of 3 + 3, 4 + 2 or 5 + 1 digits (it is still one number, so a score of 123456 shows as 123 456, 1234 56 or 12345 6). Only the layouts the Score tab and these blocks name are put in the ROM. Needs a two score layout on the Score tab (standard kernel); the Score left and Score right blocks then follow the layout showing.',
  },
  // Two score layout (Score tab): the left and right scores as numbers.
  {
    'type': 'score_left_get',
    'message0': `${SCORE_ICON} Score left`,
    'output': 'Number',
    'colour': SCORE_COLOR,
    'tooltip': 'The left score of a two score layout as a number, 0 to 255 (a score above 255 reads 255). It follows the layout showing, so with 3+3 a score of 123456 reads 123, with 4+2 it reads 255 (1234). Needs a two score layout (Score tab, standard kernel); 0 without one.',
  },
  {
    'type': 'score_right_get',
    'message0': `${SCORE_ICON} Score right`,
    'output': 'Number',
    'colour': SCORE_COLOR,
    'tooltip': 'The right score of a two score layout as a number, 0 to 255 (a score above 255 reads 255). It follows the layout showing, so with 3+3 a score of 123456 reads 255 (456), with 4+2 it reads 56. Needs a two score layout (Score tab, standard kernel); 0 without one.',
  },
  // Two score layout (Score tab): left score.
  {
    'type': 'score_left_set',
    'message0': `${SCORE_ICON} Score left set to %1`,
    'args0': [{'type': 'input_value', 'name': 'VALUE', 'check': 'Number'}],
    'previousStatement': null,
    'nextStatement': null,
    'colour': SCORE_COLOR,
    'tooltip': 'Sets the left score of a two score layout (Score tab). 0 to 255, and no more than its digits hold.',
  },
  {
    'type': 'score_left_change',
    'message0': `${SCORE_ICON} Score left change by %1`,
    'args0': [{'type': 'input_value', 'name': 'DELTA', 'check': 'Number'}],
    'previousStatement': null,
    'nextStatement': null,
    'colour': SCORE_COLOR,
    'tooltip': 'Adds to the left score of a two score layout (a negative number subtracts). It stops at its largest score (or 0) and never carries into the other score. Up to 255 at a time.',
  },
  // Two score layout (Score tab): right score.
  {
    'type': 'score_right_set',
    'message0': `${SCORE_ICON} Score right set to %1`,
    'args0': [{'type': 'input_value', 'name': 'VALUE', 'check': 'Number'}],
    'previousStatement': null,
    'nextStatement': null,
    'colour': SCORE_COLOR,
    'tooltip': 'Sets the right score of a two score layout (Score tab). 0 to 255, and no more than its digits hold.',
  },
  {
    'type': 'score_right_change',
    'message0': `${SCORE_ICON} Score right change by %1`,
    'args0': [{'type': 'input_value', 'name': 'DELTA', 'check': 'Number'}],
    'previousStatement': null,
    'nextStatement': null,
    'colour': SCORE_COLOR,
    'tooltip': 'Adds to the right score of a two score layout (a negative number subtracts). It stops at its largest score (or 0) and never carries into the other score. Up to 255 at a time.',
  },
  // Block for adding to the score in place.
  {
    'type': `score_change`,
    'message0': `${SCORE_ICON} Score change by %1`,
    'args0': [
      {
        'type': 'input_value',
        'name': 'DELTA',
        'check': 'Number',
      },
    ],
    'previousStatement': null,
    'nextStatement': null,
    'colour': SCORE_COLOR,
    'extensions': ['math_change_tooltip'],
  },
  // Block for choosing which of the two score fonts is drawn.
  {
    'type': `score_font_set`,
    'message0': `${SCORE_ICON} Score set font to %1`,
    'args0': [
      {
        'type': 'field_dropdown',
        'name': 'FONT',
        'options': [['primary', 'primary'], ['secondary', 'secondary']],
      },
    ],
    'previousStatement': null,
    'nextStatement': null,
    'colour': SCORE_COLOR,
    'tooltip': `Switches the score digits to the primary or secondary font of the Score tab. Does nothing without a secondary font.`,
  },
  // Block that changes the hue of the DPC+ score lines.
  {
    'type': `score_line_hue_set`,
    'message0': `${SCORE_ICON} Score line colors: set hue ${COLOR_ICON} to %1`,
    'args0': [
      {
        'type': 'input_value',
        'name': 'VALUE',
      },
    ],
    'previousStatement': null,
    'nextStatement': null,
    'colour': SCORE_COLOR,
    'tooltip': `DPC+ only: sets the hue (top 4 bits of the color) of the score lines, keeping the brightness each line has on the Score tab. Needed when the Score tab gives the lines different colors, since Score set color no longer changes them.`,
  },
  // Block that gives the score bars one flat color.
  {
    'type': `score_bar_color_set`,
    'message0': `${SCORE_ICON} Score bars: set ${COLOR_ICON} color to %1`,
    'args0': [
      {
        'type': 'input_value',
        'name': 'VALUE',
      },
    ],
    'previousStatement': null,
    'nextStatement': null,
    'colour': SCORE_COLOR,
    'tooltip': `Gives the score bars one flat color, instead of the score color (on DPC+, the color of each score line). Not for the PXE kernel.`,
  },
  // Block for the color getter.
  {
    'type': `score_color_get`,
    'message0': `${SCORE_ICON} Score ${COLOR_ICON} color`,
    'output': 'Number',
    'colour': SCORE_COLOR,
    'tooltip': `Reads the score's color`,
  },
  // Block for the color setter.
  {
    'type': `score_color_set`,
    'message0': `${SCORE_ICON} Score set ${COLOR_ICON} color to %1`,
    'args0': [
      {
        'type': 'input_value',
        'name': 'VALUE',
      },
    ],
    'previousStatement': null,
    'nextStatement': null,
    'colour': SCORE_COLOR,
    'tooltip': `Updates the score's color`,
  },
  // Block for fading the score's color - same mechanism as Background's
  // "Fade color to" (see blocks/background.js's  fade var-name helpers
  // and generateBackgroundFadeChecks in generators/bbasic/background.js,
  // both now generalized past just COLUBK/COLUPF), just always targeting
  // scorecolor rather than offering a register choice - there's only one
  // possible score color register. Fire-and-forget, same as Background's
  // version: triggering this once keeps the color stepping toward the
  // target every frame afterward by itself.
  {
    'type': `score_fade_to`,
    'message0': `${SCORE_ICON} Fade Score ${COLOR_ICON} color to %1 over %2 frames`,
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
    'colour': SCORE_COLOR,
    'tooltip': `Fades the score color toward the given color over about this many frames, keeping the hue. Runs once; it keeps going by itself until it reaches the target.`,
  },
  // Block for flashing the score's color: the color alternates with the one the score had, every so many frames, a number of times.
  {
    'type': `score_flash`,
    'message0': `${SCORE_ICON} Flash Score %1 ${COLOR_ICON} color to %2 every %3 frames, %4 times`,
    'args0': [
      {
        'type': 'field_dropdown',
        'name': 'TARGET',
        'options': [['digits', 'digits'], ['bars', 'bars'], ['digits and bars', 'both']],
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
      {
        'type': 'input_value',
        'name': 'TIMES',
        'check': 'Number',
      },
    ],
    'inputsInline': true,
    'previousStatement': null,
    'nextStatement': null,
    'colour': SCORE_COLOR,
    'tooltip': `Flashes the score digits, the bars or both: the given color shows for this many frames, then the score color for as many, repeated this many times; the score ends in its normal color. Started again while running, it restarts. The bars follow the digits unless a "Score bars set color" block colors them. On DPC+ with "Score bars use the line colors" on (Score tab) the bars flash with the digits. Not for the PXE kernel.`,
  },
  // Block for the background color setter - only takes effect when the
  // project also uses the Text Minikernel (see generators/bbasic/score.js's
  // generator): the standard score bar has no runtime-settable
  // background color at all, only the Text Minikernel's "minikernel"
  // subroutine reads scorebkcolor.
  {
    'type': `score_bk_color_set`,
    'message0': `${SCORE_ICON} Score set background ${COLOR_ICON} color to %1`,
    'args0': [
      {
        'type': 'input_value',
        'name': 'VALUE',
      },
    ],
    'previousStatement': null,
    'nextStatement': null,
    'colour': SCORE_COLOR,
    'tooltip': `Sets the score row background color. Only works when the Text Minikernel is used elsewhere in the project; otherwise it is fixed on the Score tab.`,
  },
  // Block for adding to the score's color in place.
  {
    'type': `score_color_change`,
    'message0': `${SCORE_ICON} Score change ${COLOR_ICON} color by %1`,
    'args0': [
      {
        'type': 'input_value',
        'name': 'DELTA',
        'check': 'Number',
      },
    ],
    'previousStatement': null,
    'nextStatement': null,
    'colour': SCORE_COLOR,
    'extensions': ['math_change_tooltip'],
  },
  // Block for a single score digit getter.
  {
    'type': `score_digit_get`,
    'message0': `${SCORE_ICON} Score digit %1`,
    'args0': [
      {
        'type': 'field_dropdown',
        'name': 'DIGIT',
        'options': SCORE_DIGIT_OPTIONS,
      },
    ],
    'output': 'Number',
    'colour': SCORE_COLOR,
    'tooltip': `Reads a score digit (0 to 9), counting from the left. Store it in a variable before comparing.`,
  },
  // Block for a single score digit setter.
  {
    'type': `score_digit_set`,
    'message0': `${SCORE_ICON} Score digit %1 set to %2`,
    'args0': [
      {
        'type': 'field_dropdown',
        'name': 'DIGIT',
        'options': SCORE_DIGIT_OPTIONS,
      },
      {
        'type': 'input_value',
        'name': 'VALUE',
        'check': 'Number',
      },
    ],
    'previousStatement': null,
    'nextStatement': null,
    'colour': SCORE_COLOR,
    'tooltip': `Sets one score digit, counting from the left. Use 0 to 9.`,
  },
  // Block for changing a single score digit in place.
  {
    'type': `score_digit_change`,
    'message0': `${SCORE_ICON} Score digit %1 change by %2`,
    'args0': [
      {
        'type': 'field_dropdown',
        'name': 'DIGIT',
        'options': SCORE_DIGIT_OPTIONS,
      },
      {
        'type': 'input_value',
        'name': 'DELTA',
        'check': 'Number',
      },
    ],
    'previousStatement': null,
    'nextStatement': null,
    'colour': SCORE_COLOR,
    'tooltip': `Adds to one score digit, counting from the left; a negative value subtracts. Does not wrap or carry: keep the result 0 to 9.`,
  },
  // Block for the score bar getter.
  {
    'type': `score_bar_get`,
    'message0': `${SCORE_ICON} Score Bar %1`,
    'args0': [
      {
        'type': 'field_dropdown',
        'name': 'VAR',
        'options': SCORE_BAR_OPTIONS,
      },
    ],
    'output': 'Number',
    'colour': SCORE_COLOR,
    'tooltip': `Reads the binary pattern (style) of a playfield score bar`,
  },
  // Block for the number of units a score bar shows.
  {
    'type': `score_bar_units`,
    'message0': `${SCORE_ICON} Score Bar %1 units`,
    'args0': [
      {
        'type': 'field_dropdown',
        'name': 'VAR',
        'options': SCORE_BAR_OPTIONS,
      },
    ],
    'output': 'Number',
    'colour': SCORE_COLOR,
    'tooltip': `Reads how many units a playfield score bar shows: the bits set in its pattern (0 to 8), such as the width of a health bar or the dots of a lives bar.`,
  },
  // Block for the score bar setter.
  {
    'type': `score_bar_set`,
    'message0': `${SCORE_ICON} Score Bar %1 set to %2`,
    'args0': [
      {
        'type': 'field_dropdown',
        'name': 'VAR',
        'options': SCORE_BAR_OPTIONS,
      },
      {
        'type': 'input_value',
        'name': 'VALUE',
      },
    ],
    'previousStatement': null,
    'nextStatement': null,
    'colour': SCORE_COLOR,
    'tooltip': `Enables the playfield score bars and sets a bar binary pattern, %00000000 to %11111111 (each 1 bit lights a pixel).`,
  },
  // Block for adding to a score bar in place.
  {
    'type': `score_bar_change`,
    'message0': `${SCORE_ICON} Score Bar %1 change by %2`,
    'args0': [
      {
        'type': 'field_dropdown',
        'name': 'VAR',
        'options': SCORE_BAR_OPTIONS,
      },
      {
        'type': 'input_value',
        'name': 'DELTA',
        'check': 'Number',
      },
    ],
    'previousStatement': null,
    'nextStatement': null,
    'colour': SCORE_COLOR,
    'extensions': ['math_change_tooltip'],
  },
  // Block for setting a score bar as a plain "N units filled" health bar,
  // instead of a raw binary pattern.
  {
    'type': `score_bar_set_health`,
    'message0': `${SCORE_ICON} Score Bar %1 set health to %2 (0-8)`,
    'args0': [
      {
        'type': 'field_dropdown',
        'name': 'VAR',
        'options': SCORE_BAR_OPTIONS,
      },
      {
        'type': 'input_value',
        'name': 'VALUE',
        'check': 'Number',
      },
    ],
    'previousStatement': null,
    'nextStatement': null,
    'colour': SCORE_COLOR,
    'tooltip': `Enables the playfield score bars and fills a bar with a solid block this wide, from the score (0 is empty, 8 is full).`,
  },
  // Block for setting a score bar as a plain "N lives" dot indicator,
  // instead of a raw binary pattern.
  {
    'type': `score_bar_set_lives`,
    'message0': `${SCORE_ICON} Score Bar %1 set lives to %2 (0-4)`,
    'args0': [
      {
        'type': 'field_dropdown',
        'name': 'VAR',
        'options': SCORE_BAR_OPTIONS,
      },
      {
        'type': 'input_value',
        'name': 'VALUE',
        'check': 'Number',
      },
    ],
    'previousStatement': null,
    'nextStatement': null,
    'colour': SCORE_COLOR,
    'tooltip': `Enables the playfield score bars and fills a bar with this many evenly spaced dots (0 to 4), from the score.`,
  },
  // Block for changing a health-style score bar by a number of units.
  {
    'type': `score_bar_change_health`,
    'message0': `${SCORE_ICON} Score Bar %1 change health by %2`,
    'args0': [
      {
        'type': 'field_dropdown',
        'name': 'VAR',
        'options': SCORE_BAR_OPTIONS,
      },
      {
        'type': 'input_value',
        'name': 'DELTA',
        'check': 'Number',
      },
    ],
    'previousStatement': null,
    'nextStatement': null,
    'colour': SCORE_COLOR,
    'tooltip': `Grows or shrinks a health bar by this many units. Only a literal negative number shrinks it; a variable can only grow it.`,
  },
  // Block for changing a lives-style score bar by a number of dots.
  {
    'type': `score_bar_change_lives`,
    'message0': `${SCORE_ICON} Score Bar %1 change lives by %2`,
    'args0': [
      {
        'type': 'field_dropdown',
        'name': 'VAR',
        'options': SCORE_BAR_OPTIONS,
      },
      {
        'type': 'input_value',
        'name': 'DELTA',
        'check': 'Number',
      },
    ],
    'previousStatement': null,
    'nextStatement': null,
    'colour': SCORE_COLOR,
    'tooltip': `Adds or removes dots on a lives bar. Only a literal negative number removes dots; a variable can only add them.`,
  },
]);

// Works exactly like background_fade_finished (see blocks/background.js's
// comment - same shared bit/flag machinery, same "fires once, regardless
// of fade direction, never late" behavior), just always targeting
// scorecolor rather than offering a register choice - same reasoning as
// score_fade_to above: there's only one possible score color register.
Blockly.Blocks['score_fade_finished'] = {
  init: function() {
    this.appendDummyInput()
        .appendField(`${SCORE_ICON} When Score ${COLOR_ICON} color has finished fading`);
    this.appendStatementInput('DO');
    this.setPreviousStatement(true);
    this.setNextStatement(true);
    this.setColour(SCORE_COLOR);
    this.setTooltip('Runs once when a matching "Fade Score color" block reaches its target. Does nothing if no matching fade runs in the project.');
  },
};
