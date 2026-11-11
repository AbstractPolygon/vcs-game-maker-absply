// usage: node mkresbl.cjs -> resbl.asm: the ball (1 wide, white) with ENABL on. Lines in pairs: on the first line of pair j a RESBL whose store
// ends at cycle 20 + 3j (no RESBL on the second line), so the frame shows whether a RESBL draws the ball on the line it is written on and where the ball is
// on the line after it. Then 8 lines with two RESBLs on each line (cycles 30 and 60).
const P = require('../lib/paths.cjs');
const fs = require('fs');
const sleep = (n) => {
  const out = [];
  let c = n;
  if (c & 1) { out.push('\tnop 0'); c -= 3; }
  for (let i = 0; i < c / 2; i++) out.push('\tnop');
  return out.join('\n');
};
let body = '';
for (let j = 0; j < 16; j++) {
  // after the WSYNC: cycle 0; sta RESBL ends 3 cycles after it starts
  body += `\tsta WSYNC\n${sleep(20 + 3 * j - 3)}\n\tsta RESBL\n\tsta WSYNC\n`;
}
for (let j = 0; j < 8; j++) body += `\tsta WSYNC\n${sleep(27)}\n\tsta RESBL\n${sleep(27)}\n\tsta RESBL\n`;
body += '\tsta WSYNC\n';
const src = `	processor 6502
VSYNC = $00
VBLANK = $01
WSYNC = $02
COLUPF = $08
CTRLPF = $0A
RESBL = $14
ENABL = $1F
HMCLR = $2B
	org $F000
start
	sei
	cld
	ldx #$FF
	txs
	lda #0
clear	sta 0,x
	dex
	bne clear
frame
	lda #2
	sta VSYNC
	sta WSYNC
	sta WSYNC
	sta WSYNC
	lda #0
	sta VSYNC
	ldx #37
vb	sta WSYNC
	dex
	bne vb
	lda #0
	sta VBLANK
	lda #$0E
	sta COLUPF
	lda #$00
	sta CTRLPF
	sta HMCLR
	lda #2
	sta ENABL
	ldx #20
pre	sta WSYNC
	dex
	bne pre
${body}	lda #0
	sta ENABL
	ldx #150
rest	sta WSYNC
	dex
	bne rest
	lda #2
	sta VBLANK
	ldx #30
os	sta WSYNC
	dex
	bne os
	jmp frame
	org $FFFC
	.word start
	.word start
`;
fs.writeFileSync(P.OUT + '/resbl.asm', src);
console.log('ok');
