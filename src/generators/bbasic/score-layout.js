// The score layouts with two scores (the Score tab's "Score layout"), batari's score minikernels from his 2008 AtariAge post "A few new score
// kernels" (https://forums.atariage.com/topic/124520-a-few-new-score-kernels/): the score stays one six digit value, with its digits drawn as two
// scores, 3+3 (score33.asm), 4+2 (score42.asm) or 5+1 (score51.asm). Standard kernel only (the DPC+ and PXE kernels draw the score another way).
// The standard kernel calls a routine named minikernel when the constant noscore is set; the files define it (see public/bb19/score-minikernel).
import {isPxe} from '../../utils/pxe';

export const SCORE_LAYOUTS = {
  'normal': {label: 'One score (6 digits)', file: null, left: 6, right: 0},
  '3+3': {label: 'Two scores (3 + 3 digits)', file: 'score33.asm', left: 3, right: 3},
  '4+2': {label: 'Two scores (4 + 2 digits)', file: 'score42.asm', left: 4, right: 2},
  '5+1': {label: 'Two scores (5 + 1 digits)', file: 'score51.asm', left: 5, right: 1},
};

// The layout of a project: the setting, or normal where it cannot be used (another kernel than the standard one, the score hidden).
export const scoreLayoutOf = (config) => {
  const layout = SCORE_LAYOUTS[config.scoreLayout] ? config.scoreLayout : 'normal';
  if (layout === 'normal') return 'normal';
  if (!scoreLayoutUsable(config)) return 'normal';
  return layout;
};

// The amount that one point of the left score adds to the score (1000 for 3+3, 100 for 4+2 and 10 for 5+1), and the largest right score (999, 99, 9).
export const scoreLayoutLeftUnit = (layout) => 10 ** SCORE_LAYOUTS[layout].right;
export const scoreLayoutRightMax = (layout) => 10 ** SCORE_LAYOUTS[layout].right - 1;

// batari's files start with the label minikernel and do not set the color of the score row's background: the lines that do (see
// scoreLayoutBkColorLines in score.js) go right after that label, as the project's score routine for the standard kernel does.
export const withScoreLayoutBkColor = (text, generator) => {
  const lines = text.split(/\r?\n/);
  const at = lines.findIndex((line) => /^minikernel[a-z0-9]*$/.test(line.trim()));
  if (at < 0) throw new Error('the score minikernel has no minikernel label');
  lines.splice(at + 1, 0, ...generator.scoreLayoutBkColorLines().split('\n'));
  return lines.join('\n');
};

// Several layouts in one project: the Score tab's layout (index 0, shown from the start) and every other two score layout a "Set score layout" block
// names, in the order of SCORE_LAYOUTS. Only these layouts' minikernels are put in the ROM. [] where no two score layout can be used; one entry is
// the plain case with one minikernel and nothing to switch.
// The one score layout (normal) can be one of them: it is then drawn by a routine made from the score code of the standard kernel (scoreNormalMinikernelFrom),
// so that the kernel can leave it out (noscore) and call the dispatcher. A project that names no other layout has no list at all.
export const scoreLayoutKeysOf = (config, used = []) => {
  if (!scoreLayoutUsable(config)) return [];
  const first = scoreLayoutOf(config);
  const others = Object.keys(SCORE_LAYOUTS).filter((key) => key !== first && used.includes(key));
  if (first === 'normal' && !others.length) return [];
  return [first, ...others];
};

// Where a layout's layouts can be used at all: the standard kernel with the score showing.
export const scoreLayoutUsable = (config) => !(config.kernel === 'dpcplus' || isPxe(config) || (config.showScore ?? true) === false);

// The name of a layout's asm file in the ROM (the one score layout has no file of batari's: it is made from the kernel, see below).
export const scoreLayoutFileOf = (layout) => (layout === 'normal' ? 'scorenormal.asm' : SCORE_LAYOUTS[layout].file);

// The standard kernel's score code (between ifnconst noscore and its endif) as a routine named minikernel, for the one score layout in a ROM that
// leaves that code out (noscore) because it switches layouts. The kernel's text is used as it is, so the score has what that code has (score bars, fade,
// the 5 digit switch). The routine ends with rts where the kernel's code falls through.
export const scoreNormalMinikernelFrom = (kernelText) => {
  const lines = kernelText.split(/\r?\n/);
  const start = lines.findIndex((line) => /^\s*ifnconst noscore\s*$/.test(line));
  const end = lines.findIndex((line, i) => i > start && /^\s*endif ;noscore/.test(line));
  if (start < 0 || end < 0) throw new Error('the standard kernel has no score code between ifnconst noscore and endif');
  return ['minikernel', ...lines.slice(start + 1, end), ' rts'].join('\n');
};

// The label of a layout's routine when more than one is in the ROM (the dispatcher keeps the name minikernel).
export const scoreLayoutLabel = (layout) => `minikernel${layout.replace('+', '')}`;

// One flag bit for each layout but the first: the bit of the layout that is showing (none set: the first). Family planned in init().
export const SCORE_LAYOUT_FLAGS_FAMILY = 'scoreLayoutFlags';

// A file's text with every label (a name in column 0) given the layout's name, so that the files of several layouts can be in one ROM.
export const withScoreLayoutLabels = (text, layout) => {
  const suffix = layout.replace('+', '');
  const labels = [...new Set(text.split(/\r?\n/).map((line) => (/^([A-Za-z_]\w*)\s*(;.*)?$/.exec(line) || [])[1]).filter(Boolean))];
  let result = text;
  labels.forEach((label) => {
    const edge = String.fromCharCode(92) + 'b';
    result = result.replace(new RegExp(edge + label + edge, 'g'), `${label}${suffix}`);
  });
  return result;
};

// The dispatcher the kernel calls (the label minikernel) when more than one layout is in the ROM: it jumps to the routine of the layout showing.
// flagsName: the flag byte; bits: the real bit number of each layout after the first.
export const scoreLayoutDispatcherAsm = (keys, flagsName, bits) => [
  'minikernel',
  ...keys.slice(1).flatMap((key, i) => [
    ` lda ${flagsName}`,
    ` and #${1 << bits[i]}`,
    ` beq _scorelayout_not_${scoreLayoutLabel(key)}`,
    ` jmp ${scoreLayoutLabel(key)}`,
    `_scorelayout_not_${scoreLayoutLabel(key)}`,
  ]),
  ` jmp ${scoreLayoutLabel(keys[0])}`,
].join('\n');
