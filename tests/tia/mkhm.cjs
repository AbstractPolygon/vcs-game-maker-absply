// usage: node mkhm.cjs T -> hm_T.asm: on each of 17 lines, the ball (8 wide) and Player 0 (8 wide, HMP0 $80) are moved by an HMOVE whose
// store ends at cycle T of the line (T 3: right after the WSYNC; T 23 to 75: late in the line), with HMBL = n*16 for the n-th move
const P = require('../lib/paths.cjs');
const fs = require('fs');
const T = Number(process.argv[2]);
const early = T <= 3;
const sleep = (n) => {
  const out = [];
  let c = n;
  if (c & 1) { out.push('\tnop 0'); c -= 3; }
  for (let i = 0; i < c / 2; i++) out.push('\tnop');
  return out.join('\n');
};
// per line after the WSYNC (cycle 0): [sta HMOVE (3) if early] tya asl asl asl asl sta HMBL lda #$80 sta HMP0 = 18 [sleep] [sta HMOVE if late]
const lineBody = early ? ['\tsta HMOVE', '\ttya', '\tasl', '\tasl', '\tasl', '\tasl', '\tsta HMBL', '\tlda #$80', '\tsta HMP0'].join('\n') :
  ['\ttya', '\tasl', '\tasl', '\tasl', '\tasl', '\tsta HMBL', '\tlda #$80', '\tsta HMP0', sleep(T - 21), '\tsta HMOVE'].join('\n');
const src = `	processor 6502
VSYNC = $00
VBLANK = $01
WSYNC = $02
COLUP0 = $06
COLUPF = $08
CTRLPF = $0A
RESP0 = $10
RESBL = $14
GRP0 = $1B
ENABL = $1F
HMP0 = $20
HMBL = $24
HMOVE = $2A
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
	lda #$46
	sta COLUP0
	lda #$30
	sta CTRLPF
	sta WSYNC
	sta HMCLR
${sleep(40)}
	sta RESBL
	nop
	nop
	nop
	nop
	nop
	nop
	nop
	nop
	nop
	nop
	sta RESP0
	sta WSYNC
	lda #2
	sta ENABL
	lda #$01
	sta GRP0
	ldy #$FF
line
	sta WSYNC
	iny
${lineBody}
	cpy #16
	bne line
	sta WSYNC
	sta WSYNC
	lda #0
	sta ENABL
	sta GRP0
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
// (The iny at the start of the line takes 2 cycles: the counts above are from after it, so the stores end 2 cycles later than T; T is
// corrected for it.)
fs.writeFileSync(`${P.OUT}/hm_${T}.asm`, src.replace(sleep(T - 21), sleep(T - 23)).replace('\tsta HMOVE\n\ttya', '\tsta HMOVE\n\ttya'));
console.log('ok');
