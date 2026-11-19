import * as Blockly from 'blockly/core';

import {SPEECH_ICON} from './icon';
import {buildTextStringOptions, processTextStringsStorageDefaults} from './text-strings';
import {useTextStringsStorage} from '../hooks/project';
import {encodeSpeech, voiceBytes, voiceById} from '../utils/speakjet';
import {speechWordsFor} from '../utils/speakjet-text';
import {speakBytes, speechTimeHint} from '../utils/speech-preview';
import {speakJetEffectOptions} from '../utils/speakjet-codes';

const MODE_OPTIONS = [['now', 'now'], ['after the current phrase', 'after']];
const modeField = () => new Blockly.FieldDropdown(MODE_OPTIONS);

// The voices of the Voice tab, as the list of the blocks that say words ("Default", ...); read afresh each time (the storage is a computed over local
// storage, which is not reactive, see buildTextStringOptions).
const voicesOf = () => processTextStringsStorageDefaults(useTextStringsStorage()).voices;
const buildVoiceOptions = () => voicesOf().map((voice) => [voice.name || `Voice ${voice.id}`, `${voice.id}`]);
const voiceField = () => new Blockly.FieldDropdown(buildVoiceOptions);
// The say blocks: a voice of the Vox tab for the phrase, or the voice the chip is in already (0, the default).
const buildSayVoiceOptions = () => [['(current voice)', '0'], ...buildVoiceOptions()];
const sayVoiceField = () => new Blockly.FieldDropdown(buildSayVoiceOptions);
// The bytes of a phrase as a voice says it.
const voicedBytes = (voiceId, words) => [...voiceBytes(voiceById(voicesOf(), voiceId)), ...encodeSpeech(words).bytes];

// A small play button in a block: hears the phrase the block says.
const PLAY_ICON = 'data:image/svg+xml;utf8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="8" fill="white" ' +
    'fill-opacity="0.9"/><path d="M6 4.5v7l6-3.5z" fill="rgb(156,39,176)"/></svg>');
const playButton = (words, voiceId = () => null) => new Blockly.FieldImage(PLAY_ICON, 16, 16, 'Hear it', () => speakBytes(voicedBytes(voiceId(), words())));

// (The color of the Vox tab and of the Vox category of the toolbox: the AtariVox blocks sit in it.)
const SPEECH_COLOR = 'rgb(158, 157, 36)';

// The tooltip of a block that says a phrase: the text, and how long the phrase takes (once that is worked out: the first hover starts it).
const timedTooltip = (text, words) => () => {
  let hint = null;
  try {
    hint = speechTimeHint(encodeSpeech(words()).bytes);
  } catch (e) {
    hint = null;
  }
  return hint ? `${text} ${hint}` : text;
};

// The AtariVox's SpeakJet speech chip (see generators/bbasic/speech.js). "say text" reads a message of the Text tab (turned into speech when
// the project is built, see utils/speakjet-text.js); "say phonemes" takes a phrase typed as SpeakJet words (see utils/speakjet.js).
Blockly.Blocks['speech_say_text'] = {
  init: function() {
    this.appendDummyInput()
        .appendField(`${SPEECH_ICON} AtariVox say text`)
        .appendField(new Blockly.FieldDropdown(buildTextStringOptions), 'TEXT_ID')
        .appendField('voice')
        .appendField(sayVoiceField(), 'VOICE')
        .appendField(modeField(), 'MODE')
        .appendField(playButton(() => {
          const strings = processTextStringsStorageDefaults(useTextStringsStorage());
          const id = this.getFieldValue('TEXT_ID');
          return speechWordsFor(strings.textStrings.find((entry) => `${entry.id}` === `${id}`), strings);
        }, () => this.getFieldValue('VOICE')));
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour(SPEECH_COLOR);
    this.setTooltip('Speaks a Text tab message through an AtariVox (a speech chip in the Player 2 controller port). English rules turn the text into speech: most plain words work, not all (numbers are said as words); for an exact phrase use "AtariVox say phonemes". Sent a byte a frame while the game goes on. Max 254 phrases in a project (each message, phrase of sounds, voice change and number word is one). The Player 2 joystick cannot be used with the AtariVox.');
  },
};

Blockly.Blocks['speech_say'] = {
  init: function() {
    this.appendDummyInput()
        .appendField(`${SPEECH_ICON} AtariVox say phonemes`)
        .appendField(new Blockly.FieldTextInput('HE EH LE OWWW'), 'TEXT')
        .appendField('voice')
        .appendField(sayVoiceField(), 'VOICE')
        .appendField(modeField(), 'MODE')
        .appendField(playButton(() => this.getFieldValue('TEXT'), () => this.getFieldValue('VOICE')));
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour(SPEECH_COLOR);
    this.setTooltip('Speaks a phrase of sounds through an AtariVox. Separate words with spaces: allophones (HE EH LE OWWW is "hello"), sound effects (R0-R9 robot, A0-A9 alarm, B0-B9 beeps, C0-C9 biological, D0-D11 tones, M0-M2 miscellaneous), PAUSE30, PAUSE60, PAUSE90, PAUSE200, PAUSE700, PAUSE100, FAST, SLOW, STRESS, RELAX, VOLUME n, SPEED n, PITCH n, BEND n (n 0 to 254), or #n for any byte. Sent a byte a frame while the game goes on. Max 254 phrases in a project (each message, phrase of sounds, voice change and number word is one). The Player 2 joystick cannot be used with the AtariVox.');
  },
};

// One of the SpeakJet's sound effects (the words R0 to M2 of "AtariVox say phonemes"), picked from a list.
Blockly.Blocks['speech_effect'] = {
  init: function() {
    this.appendDummyInput()
        .appendField(`${SPEECH_ICON} AtariVox sound effect`)
        .appendField(new Blockly.FieldDropdown(speakJetEffectOptions), 'EFFECT')
        .appendField(modeField(), 'MODE')
        .appendField(playButton(() => this.getFieldValue('EFFECT')));
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour(SPEECH_COLOR);
    this.setTooltip('Plays one of the 43 SpeakJet sound effects of the AtariVox (made by the chip, so almost no ROM). It joins the speech queue: "now" stops what is being sent and plays it, "after the current phrase" waits for the phrase being sent and the one waiting. Voice volume and bend change the effects; speed and pitch only in the emulators. Max 254 phrases in a project (each message, phrase of sounds, voice change and number word is one). The Player 2 joystick cannot be used with the AtariVox.');
  },
};

// A voice of the Vox tab (see generators/bbasic/speech.js): the chip goes into its volume, speed, pitch and bend, from the next phrase, in the queue of the
// speech blocks like a change of one control. By the list of the voices, or by the ID of the voice (the 'ID:n' on its card; a number or a variable).
Blockly.Blocks['speech_use_voice'] = {
  init: function() {
    this.appendDummyInput()
        .appendField(`${SPEECH_ICON} AtariVox use voice`)
        .appendField(voiceField(), 'VOICE');
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour(SPEECH_COLOR);
    this.setTooltip('Sets the AtariVox voice from the Vox tab from the next phrase on, until another voice is set. Queued in order with the phrases.');
  },
};

Blockly.Blocks['speech_use_voice_id'] = {
  init: function() {
    this.appendValueInput('VALUE')
        .setCheck('Number')
        .appendField(`${SPEECH_ICON} AtariVox use voice ID`);
    this.setInputsInline(true);
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour(SPEECH_COLOR);
    this.setTooltip('Sets the AtariVox voice whose ID (the "ID:n" on its card) is the value (number or variable), from the next phrase on. An ID no voice has does nothing. Every voice goes in the ROM.');
  },
};

Blockly.Blocks['speech_say_card'] = {
  init: function() {
    this.appendValueInput('VALUE')
        .setCheck('Number')
        .appendField(`${SPEECH_ICON} AtariVox say text card ID`);
    this.appendDummyInput().appendField(modeField(), 'MODE')
        .appendField(playButton(() => {
          // only a number typed in the block can be heard here (a variable has no value until the game runs)
          const target = this.getInputTargetBlock('VALUE');
          if (!target || target.type !== 'math_number') return '';
          const strings = processTextStringsStorageDefaults(useTextStringsStorage());
          return speechWordsFor(strings.textStrings.find((entry) => Number(entry.id) === Number(target.getFieldValue('NUM'))), strings);
        }));
    this.setInputsInline(true);
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour(SPEECH_COLOR);
    this.setTooltip('Speaks the Text tab message whose ID is the value (number or variable). Every card goes in the ROM as speech, so it takes more room than "AtariVox say text". An ID no card has says nothing.');
  },
};

Blockly.Blocks['speech_say_number'] = {
  init: function() {
    this.appendValueInput('VALUE')
        .setCheck('Number')
        .appendField(`${SPEECH_ICON} AtariVox say number`);
    this.appendDummyInput().appendField(modeField(), 'MODE');
    this.setInputsInline(true);
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour(SPEECH_COLOR);
    this.setTooltip('Speaks a number from 0 to 255 (value or variable) as words. "now" stops what is being sent and says it, "after the current phrase" waits for the phrase being sent and the one waiting. The words take about 1 KB of ROM, once.');
  },
};

Blockly.Blocks['speech_voice'] = {
  init: function() {
    this.appendDummyInput()
        .appendField(`${SPEECH_ICON} AtariVox set`)
        .appendField(new Blockly.FieldDropdown([['volume (0-127)', 'volume'], ['speed (0-127)', 'speed'], ['pitch (0-255)', 'pitch'],
          ['bend (0-15)', 'bend']]), 'KIND')
        .appendField('to')
        .appendField(new Blockly.FieldNumber(90, 0, 255, 1), 'VALUE');
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour(SPEECH_COLOR);
    this.setTooltip('Changes the AtariVox voice from the next phrase on: volume (default 96), speed (114, higher is faster), pitch (88), bend (5, deep to high). Queued in order with the phrases; stays until changed.');
  },
};

// The AtariVox's memory (see generators/bbasic/avox-memory.js).
Blockly.Blocks['avox_memory_save'] = {
  init: function() {
    this.appendValueInput('VALUE')
        .setCheck('Number')
        .appendField(`${SPEECH_ICON} AtariVox memory: save`);
    this.appendValueInput('SLOT')
        .setCheck('Number')
        .appendField('in slot');
    this.appendValueInput('FILE')
        .setCheck('Number')
        .appendField('of save file');
    this.setInputsInline(true);
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour(SPEECH_COLOR);
    this.setTooltip('Saves a byte (0 to 255) in a slot (0 to 255) of the AtariVox memory, kept when the console is off. Saving waits a few milliseconds and the picture can jump: do it between games. Does nothing with no AtariVox. Slots count from the first save file set on the Vox tab (file 65 by default).');
  },
};

Blockly.Blocks['avox_memory_load'] = {
  init: function() {
    this.appendValueInput('SLOT')
        .setCheck('Number')
        .appendField(`${SPEECH_ICON} AtariVox memory: load slot`);
    this.appendValueInput('FILE')
        .setCheck('Number')
        .appendField('of save file');
    this.appendDummyInput()
        .appendField('into')
        .appendField(new Blockly.FieldVariable('item'), 'VAR');
    this.setInputsInline(true);
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour(SPEECH_COLOR);
    this.setTooltip('Loads the byte in a slot (0 to 255) of the AtariVox memory into a variable. A never saved slot holds 255. With no AtariVox the variable is unchanged. Takes a few lines of the picture: do it once, not every frame. Slots count from the first save file set on the Vox tab (file 65 by default).');
  },
};

Blockly.Blocks['avox_memory_check'] = {
  init: function() {
    this.appendDummyInput()
        .appendField(`${SPEECH_ICON} AtariVox memory: is there a memory? set`)
        .appendField(new Blockly.FieldVariable('item'), 'VAR');
    this.setInputsInline(true);
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour(SPEECH_COLOR);
    this.setTooltip('Sets the variable to 1 when a memory answers on the controller port (an AtariVox or SaveKey), else 0. Takes a few lines of the picture: do it once.');
  },
};

Blockly.Blocks['avox_highscore_add'] = {
  init: function() {
    this.appendDummyInput()
        .appendField(`${SPEECH_ICON} AtariVox high scores: add the score, set`)
        .appendField(new Blockly.FieldVariable('item'), 'VAR')
        .appendField('to its place');
    this.setInputsInline(true);
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour(SPEECH_COLOR);
    this.setTooltip('Adds the game score to the table of the 10 best scores in the AtariVox memory and sets the variable to its place (1 to 10), or 0 if it is not among them or there is no memory. A tie goes below the older score. Saving takes tens of milliseconds and the picture can jump: do it once, when the game is over.');
  },
};

Blockly.Blocks['avox_highscore_get'] = {
  init: function() {
    this.appendValueInput('PLACE')
        .setCheck('Number')
        .appendField(`${SPEECH_ICON} AtariVox high scores: put place`);
    this.appendDummyInput().appendField('of the table in the score');
    this.setInputsInline(true);
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour(SPEECH_COLOR);
    this.setTooltip('Puts the score at a place of the best scores table (1 is best) into the score, replacing the game score, so show it when the game is over. An empty place is 0. With no memory the score is unchanged.');
  },
};

Blockly.Blocks['avox_highscore_clear'] = {
  init: function() {
    this.appendDummyInput().appendField(`${SPEECH_ICON} AtariVox high scores: clear the table`);
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour(SPEECH_COLOR);
    this.setTooltip('Sets all 10 places of the best scores table in the AtariVox memory to 0.');
  },
};

Blockly.Blocks['speech_stop'] = {
  init: function() {
    this.appendDummyInput().appendField(`${SPEECH_ICON} AtariVox stop sending speech`);
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour(SPEECH_COLOR);
    this.setTooltip('Stops sending the phrase and empties the queue. What the chip already got (up to 64 bytes) is still spoken.');
  },
};

Blockly.Blocks['speech_busy'] = {
  init: function() {
    this.appendDummyInput().appendField(`${SPEECH_ICON} AtariVox is still being sent a phrase`);
    this.setOutput(true, 'Boolean');
    this.setColour(SPEECH_COLOR);
    this.setTooltip('True while a phrase is still being sent to the AtariVox or waits in the queue (the chip may speak a little longer). Use it to wait before the next thing.');
  },
};

// The blocks that say a phrase tell, in their tooltip, how long it takes to speak.
const withTime = (type, words) => {
  const original = Blockly.Blocks[type].init;
  Blockly.Blocks[type].init = function() {
    original.call(this);
    this.setTooltip(timedTooltip(this.tooltip, () => words(this)));
  };
};
withTime('speech_say_text', (block) => {
  const strings = processTextStringsStorageDefaults(useTextStringsStorage());
  const id = block.getFieldValue('TEXT_ID');
  return speechWordsFor(strings.textStrings.find((entry) => `${entry.id}` === `${id}`), strings);
});
withTime('speech_say', (block) => block.getFieldValue('TEXT'));
withTime('speech_effect', (block) => block.getFieldValue('EFFECT'));
withTime('speech_say_card', (block) => {
  const target = block.getInputTargetBlock('VALUE');
  if (!target || target.type !== 'math_number') return '';
  const strings = processTextStringsStorageDefaults(useTextStringsStorage());
  return speechWordsFor(strings.textStrings.find((entry) => Number(entry.id) === Number(target.getFieldValue('NUM'))), strings);
});
