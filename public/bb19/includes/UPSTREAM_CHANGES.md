# Changes from stock batari Basic 1.9

This directory is vendored from the real bB 1.9 distribution (see the top
comment in `src/hooks/bb-compiler.js`). Everything here should match stock
bB byte-for-byte *except* the changes tracked below - keeping this list
accurate is what lets any of them be proposed back upstream later without
having to re-diff the whole tree by hand.

## Binary includes (`custom2.bin`, `DPCplus.arm`) were silently corrupted

DPC+ needs two binary (non-ASCII) includes: `DPCplusheader.asm` has an
unconditional `incbin "DPCplus.arm"` followed by an unconditional `incbin
"custom/bin/custom2.bin"` - neither is gated by `ifconst`/`ifnconst`
(confirmed by grepping the whole file), so every `set kernel DPC+` project
pulls both in. `custom2.bin` is a stock placeholder ARM binary that has
shipped with bB since its first commit (see
[batari-Basic/includes/custom/bin](https://github.com/batari-Basic/batari-Basic/tree/master/includes/custom/bin))
and reserves a fixed slot in the DPC+ ROM layout regardless of whether a
project uses custom ARM driver code - it isn't something a project can opt
out of. Getting a real DPC+ build working surfaced two separate,
independent bugs in how this app's whole toolchain handles binary content -
neither had ever been exercised before, since every other kernel this app
supports only includes plain ASCII `.asm`/`.h` files.

**Bug 1 - `includes-manifest.json` excluded `custom/` entirely.**
`public/bb19/includes-manifest.json` (see `src/hooks/bb-compiler.js`) is a
flat `{"includes/<file>": content}` snapshot every WASI compile stage
actually reads from instead of the live files in this directory - it does
not regenerate itself. It previously had zero keys under `custom/`, even
though the real files were on disk at `includes/custom/bin/custom2.bin`
etc., so `custom2.bin`'s `incbin` failed outright with `Unable to open
file`. Fixed by adding all 11 files under `includes/custom/`
(`ARMCOMPILE.txt`, `Makefile`, `bin/custom2.bin`, `bin/main.lst`, `main.c`,
`main.c.last`, `main.i`, `main.s`, `src/custom.S`, `src/custom.boot.lds`,
`src/custom.h`) to the manifest. `UPSTREAM_CHANGES.md` itself is still
excluded from the manifest, as before.

**Bug 2 - binary content was silently mangled by two separate UTF-8
round-trips, both assuming text.** Once `custom2.bin` could be found at
all, the build still failed with DASM reporting `Origin Reverse-indexed` on
the very next `incbin` line - reproducing on every single bank-relocation
attempt (confirmed via a real build reaching "Attempt 64" and giving up),
which was the first clue this had nothing to do with bank assignment. The
manifest's existing `includes/DPCplus.arm` entry turned out to be 5559
characters, when the real file (both this fork's disk copy and the real
upstream
[batari-Basic/includes/DPCplus.arm](https://github.com/batari-Basic/batari-Basic/blob/master/includes/DPCplus.arm))
is 3072 bytes - `DPCplusheader.asm` reserves exactly `$400`-`$1000` (3072
bytes) for this `incbin` before forcing `ORG $1000` right after for
`custom2.bin`, so the oversized entry pushed `ORG` backward, which is
exactly what DASM's `Origin Reverse-indexed` means.

The real cause was two independent, stacked UTF-8 round-trips, each lossy
for the arbitrary (non-UTF-8-valid) bytes a compiled ARM binary contains:
1. This project's compiler hook (`src/hooks/bb-compiler.js`) fetches
   `includes-manifest.json` via `fetch(...).then(r => r.json())` - the
   browser always decodes an HTTP JSON response body as UTF-8, regardless
   of how the file was actually written to disk.
2. `buildTree()` (same file) mounted every include into the in-browser WASI
   filesystem via `new TextEncoder().encode(content)` - re-encoding as
   UTF-8 a second time before DASM/2600basic.wasm ever see the bytes.

Both steps are lossless for plain ASCII (the only kind of include content
that existed before DPC+), which is exactly why this was never caught.
Fixed on both ends: `includes-manifest.json` is now written to disk with
`fs.writeFileSync(path, JSON.stringify(manifest), 'utf8')`, where each
value is a "byte string" (`fs.readFileSync(file, 'latin1')` - one JS char
code 0-255 per original file byte) - so the browser's UTF-8 `fetch().json()`
decode recovers the exact original byte codes. And `buildTree()` now uses a
new `toBytes()` helper (`charCodeAt(i) & 0xFF` per character) instead of
`TextEncoder`, so mounting a file into the WASI filesystem reproduces the
original bytes exactly instead of re-encoding them as UTF-8. Also fixed the
`DPCplus.arm` manifest entry itself to the correct 3072-byte content.

**Not yet addressed:** `isOverflowError` in `src/hooks/rom.js` treats
`origin reverse-indexed` as a retriable bank-overflow shape (true for the
*standard*-kernel bank-1-RORG-overflow case it was written for) - it can't
tell that shape apart from a genuine DPC+-header failure like this one, so
either would burn through every retry attempt identically before surfacing
the real error. Worth revisiting if a DPC+ build ever exhausts retries
again.

## `score_graphics.asm`: DPC+ (`bankswitch == 28`) case added

With the two binary-corruption bugs above fixed, a real DPC+ build got much
further but still failed with `Origin Reverse-indexed`, now inside the
normal bank-1 bankswitch-trampoline code (`start_bank1`), not the header.
Root cause: `score_graphics.asm` forces the score-font table to a hardcoded
address, selected by `if bankswitch == 8/16/32/64` (each a different literal
`ORG`/`RORG` pair) - with no case for DPC+'s `bankswitch = 28` (set by
`statements.c`'s `set kernel DPC+` handler - confirmed in the real upstream
[batari-Basic/statements.c](https://github.com/batari-Basic/batari-Basic/blob/master/statements.c)),
it always fell through to the `else` branch's `ORG $FF9C` - a fixed address
with no relationship to a DPC+ ROM's actual layout, corrupting DASM's
position tracking for everything placed after it (which is why the error
surfaced later, at `start_bank1`, not at this line itself). This matches
real upstream bB 1.9 byte-for-byte, so stock bB likely has this same gap for
any DPC+ project that doesn't override `score_graphics.asm` itself.

Confirmed via `DPCplus_kernel.asm` (`.byte <scoretable` / `.byte
((>scoretable) & $0f) | (((>scoretable) / 2) & $70)`, around line 710) that
DPC+'s score routine reads `scoretable`'s address as a normal assembler
*symbol*, unlike the fixed-address trick 8/16/32/64k bankswitching rely on -
so DPC+ doesn't need a forced address here at all. Fixed by wrapping the
whole `if bankswitch == 8/16/32/64 ... else ORG $FF9C endif` chain in `if
bankswitch != 28 ... endif`, so DPC+ just skips it and lets `scoretable`
land wherever it naturally falls.

Verified end-to-end against a real (minimal) DPC+ project through all four
WASI compile stages: bank 1 now reports a plain, small overflow (concrete
bytes over capacity, not a corrupted/nonsensical address) - the same kind of
"your project doesn't fit yet" signal a Standard-kernel project would give,
not a toolchain bug. Whatever's left at that point is real content-budget
tuning, not an infrastructure fix.

## `std_kernel.asm`: `ball_blank_lines` kernel option

Added in 1195d1f and taken out again in edf910a: see the list by file below.

## Note: `includes-manifest.json` must be regenerated after any edit here

`public/bb19/includes-manifest.json` (one level up from this directory) is
a flat `{"includes/<file>": content}` snapshot that every WASI compile
stage (`preprocess`/`2600basic`/`postprocess`/`dasm.wasm`, see
`src/hooks/bb-compiler.js`) actually reads instead of the live files in
this directory. It does not regenerate itself - it was generated once, in
commit f64a033, and any edit made directly to a file under
`public/bb19/includes/` since then has had no effect on a real build until
the manifest is regenerated to match. To regenerate it, write out every
file directly under this directory (excluding the `custom/` subdirectory
and this file) as `{"includes/<filename>": "<utf8 content>"}`, sorted by
filename, minified (no indentation, matching the existing format).

## `pf_scrolling.asm`: a direction can be left out

The standard kernel's `pfscroll` routine holds the code of all four directions (left, right, up, down; about 400 bytes). Each direction is now wrapped in
`ifnconst pfscroll_noleft` / `pfscroll_noright` / `pfscroll_noup` / `pfscroll_nodown`, so a program that defines the constant leaves that direction out. The
shift of the direction code in A (`lsr` at each step) is kept, so the directions still in the routine decode as before. Without the constants the routine
assembles to the same bytes as stock. The app sets them from the `pfscroll` statements of the generated program (`standardPfscrollFlags` in
`src/generators/bbasic.js`); the manifest was updated to match (only the `includes/pf_scrolling.asm` entry changed).

## Every change to these files, by file (from the git history)

The list below is every change the app made to the include files since they were added (commit f64a033), by file and date, with the commit. Keep it
current: each new change to a file here gets an entry in this list, and its section above when it needs more explanation. Not counted: `includes-manifest.json`, which follows the files.

### `DPCplus_kernel.asm`

- **0de2369** (2026-10-09): Adds the "Show remaining CPU cycles as the score" option (`debugscore`) in `drawscreen`, just before `fufu`. It reads `INTIM`: a value above 128 is time left and sets `scorecolor` to 14, a value below 128 means the code ran over and sets it to 64 (red), as the other kernels do. The count, with bit 7 cleared, is turned into cycles (64 per timer step, added in decimal) and put in `score+1` and `score+2`.

- **65b1e19** (2026-10-11): Adds the Score tab's "5 score digits" switch (`score5digits`) to the score setup after `noscoreloop`. `HMP0` gets `$e0` in place of `$f0`, and `HMP1` gets `$f0` after the `RESP0`/`RESP1` strobes, to move the digits 1 color clock to the right so they look centered. The fetcher pointers `DF0`-`DF5` now use the symbols `SCOREPLACE0`-`SCOREPLACE5`; with the switch on, each place reads the digit to its right and one place reads `SCOREBLANK` (`scoredata+80`, 8 bytes of zeros set at startup), so the leftmost digit is dropped. The comment notes that `LDA #0` can not be used for the blank, because with fast fetch on it reads a data fetcher.

- **8d6adbf** (2026-10-11): Reworks the 5-digit score offsets from 65b1e19. `HMP0` is now `$d0` with the switch on, and `HMP1` is set to `$e0` right after `HMP0`; the later `HMP1` write after the `RESP` strobes is removed. The comment says that the later write would delay the `HMOVE`.

- **f7a557d** (2026-10-18): Changes the start of `scorekernel`. The picture is left partway into its last line, and clearing `PF1`/`PF2` during the score setup cut that line short and drew the rest of it in the score colors. Now, when a score is drawn (no `dpchidescore`, no `noscore`), the code waits for the next line with `WSYNC`, then writes the score row background color from Y to `COLUBK` (only with a minikernel) and clears `PF1` and `PF2` there. With `dpchidescore` or `noscore` set, `PF1`/`PF2` are cleared at the old place, without the extra `WSYNC`.

- **da448db** (2026-10-28): Adds the Score tab's "Add score padding" (`scorepaddinglines`, 0 to 2). At the end of the score loop, before the `rts`, one or two `WSYNC` lines are added, which show the score row background color. To keep the frame length, the overscan timer set at `exit` is lowered by `scorepaddinglines*76/64`.

- **fc0b53f** (2026-11-06): Makes the score bars (`pfscore`) take the color of each score line in `scoreloop`, unless `scorebarflat` is set (then the bars keep `pfscorecolor`). The line color from `DF6DATA`, also written to `COLUP0`/`COLUP1`, is kept in `temp2` and written to `COLUPF` near the end of the line, in place of a `sleep 6`. A `sleep 5` becomes `sleep 2` to pay for the `sta temp2`, so the loop keeps its timing.

- **115a766** (2026-11-06): Adds padding before `scorekernel` so the score loop does not cross a page. A branch that crosses a page takes one cycle more, which draws every score line one cycle late and scrambles the digits. The symbols `SCOREKERNELSTART`, `SCOREKERNELLOOP` and `SCOREKERNELEND` (from `scoreloop` to the new label `scoreloopbpl`) are checked, and when the loop would cross a page, `ds` fills up to the next page before the routine.

- **115a766** (2026-11-06): Reworks the per-line bar color from fc0b53f. The line color is now written straight to `COLUPF` with the digit colors, after the last bar pixels of the line that is ending, so the bars of the next line get that line's color. The `temp2` copy and the end-of-line `lda temp2`/`sta COLUPF` are removed.

- **115a766** (2026-11-06): With score bars, the left bar value (`pfscore1`) is now also written to `PF1` at the end of each line in `scoreloop`, after the right bar's last pixel, in place of the `sleep 6`. This fixes the bar dots (bits 7 and 6, the 4 lives) that lit the first pixels of the left bar on the next line. The `dec temp1` is moved before the `sta PF1`, since the `bpl scoreloop` needs its flags and a store changes none.

- **bd6a92c** (2026-11-09): Adds padding before `kernel_setup` so the sprite positioning loop (`HorPosLoop`, `DivideLoop`) does not cross a page. Its branches take one cycle more across a page, and every sprite was then placed 3 color clocks to the right for each time round. The symbols `KSETUPSTART`, `KSETUPLOOP` and `KSETUPLOOPEND` (the new label `HorPosLoopEnd`, after `bpl HorPosLoop`) are checked, and `ds` fills up to the next page after the `Hmval74` tables when needed.

- **bd6a92c** (2026-11-09): With score bars, `pfscore1` is now written to `PF1` at the end of the line before the first score line. Before, the first line of the left bar lost its first two pixels when the bars use the score line colors, because that moves the loop's write 3 cycles later. To make time, the `DF5` fetcher setup and `temp1 = 7` are done before the `WSYNC` when `pfscore` is set, and a `sleep 9`, `lda pfscore1`, `sta PF1` take their old place before the `HMOVE`; the `RESP` strobes and the `HMOVE` stay at the same cycle.

- **0634f8c** (2026-11-12): Adds PAL timing. When `vblank_time` is above 50 ("set tv pal" sets 58, NTSC 43), `DPC_TV_VBLANK` is 30 and `DPC_TV_OVERSCAN` is 29 (30 with the Text Minikernel, `TextIndex`), and both are 0 otherwise. They are added to the vertical blank timer after `VERTICAL_SYNC` and to the overscan timer at `exit` (also when `scorepaddinglines` is set). The comment says a PAL frame is 50 lines longer, and this keeps the picture in the middle of the screen.

- **688d394** (2026-11-12): Adds `dpccolorprime` to `setloopfrac`, after the priming reads. With color rows of 2 scanlines, the color lists are read every 2 scanlines, and the fraction step held in a byte (255 for 256) made every color come a row late. An extra read before the picture starts the fraction at 255: bit 0 of `dpccolorprime` reads `DF4FRACDATA` (playfield colors) and bit 1 reads `DF6FRACDATA` (background colors).

### `DPCstartup.asm`

- **98efda7** (2026-10-19): In `clearmem`, the `inityloop` that sets `player1y` and up to 224 (hidden) now starts from `dpcspritemax-1` when `dpcspritemax` is set, in place of 8. Only the sprites the kernel draws start hidden. The memory of the other sprites is left free for variables, which start at 0.

### `PXEbB.h`

- **02f1a2a** (2026-11-04): Changes the zero page layout of the sprite positions. `player0x` moves from the start of the variables (`$30`) to just before `player1x`, after `player0xcoll`. The aliases `NewSpriteX` and `NewSpriteY` are removed; `player1x` and `player1y` are now plain `ds 1` bytes. So `player0x` to `player16x` sit in one run of bytes, as do `player0y` to `player16y`.

- **02f1a2a** (2026-11-04): Adds variables for a "Sprites mode". The labels `CEL_BOT_OFFSET_0` and `CEL_BOT_OFFSET_1` now mark `player0height` and `player1height`. The 10-byte `stack_reserved` at the end of zero page is replaced by `SIMPLE_48_START` and `SIMPLE_48_END`, and a new segment `stack_vars` at `$0100` holds `SPRITE_0`/`SPRITE_1`, `CEL_0`/`CEL_1`, `INK_0`/`INK_1` and `CEL_TOP_OFFSET_0`/`CEL_TOP_OFFSET_1` (1 + 16 bytes each). Two `echo` lines print the free zero page and stack RAM. The diff does not show how these are used, apart from the addresses passed in `PXEheader.asm`.

### `PXEfooter.asm`

- **02f1a2a** (2026-11-04): The paddle block moves from `$000a` to `$0008`, and `Paddle2` and `Paddle3` are added after `Paddle0` and `Paddle1`.

- **02f1a2a** (2026-11-04): Adds `write_savedata_0` and `write_savedata_1` after `pfscroll_up`, and ends the file with a newline.

### `PXEheader.asm`

- **02f1a2a** (2026-11-04): Adds entries to the header table after `miniKernelCount`: `save_data0_size`, `save_data1_size`, the addresses of `save_data0_var` and `save_data1_var`, the address of `SPRITE_0`, the address of `___SPRITE_DATA` (or 0, 0 when it is not defined), and the address of `SIMPLE_48_START`.

- **02f1a2a** (2026-11-04): Comment change only in the `PF_MODE` notes: width mode 2 is now described as 8 columns, 256 pixels (64 PF pixels) wide, where it said 10 columns, 320 pixels.

- **02f1a2a** (2026-11-04): The `simple48` byte gets a new label `GFX_MODE`, and its heading reads "Graphics modes". Its comment adds mode 2: no score at the bottom, and the top kernel fills all 188 lines. The note "Only 0 and 1 currently supported" above `PaddleRange0` is removed.

### `pf_scrolling.asm`

- **2ada4d2** (2026-11-08): each direction of `pfscroll` can be left out with `pfscroll_noleft` / `pfscroll_noright` / `pfscroll_noup` / `pfscroll_nodown`. See its section above.

### `startup.asm`

- **2395705** (2026-10-08): After `initscore`, when `scorefonts` is set, `scorefontlow` is set to `<scoretable`. The comment says the primary score font is the one at `scoretable` and the secondary sits right below it.

### `std_kernel.asm`

- **1195d1f** (2026-09-21): Adds the `ball_blank_lines` option in the `no_blank_lines` path after `noreadpaddle`, ahead of the `ifnconst playercolors` branch. In that slot, which stock `no_blank_lines` takes from missile 0, it draws the ball each line (`lda ballheight`, `dcp bally`, `sbc temp4`, `sta ENABL`, the same code as the `lastkernelline` tail) and jumps to `continuekernel2` to skip the `sleep 2`, which pays for the 14 cycles against 12. It is meant to be used with `no_blank_lines` and pfcolors off; missile 0 is still drawn, once per row.

- **1195d1f** (2026-09-21): Whitespace only: a trailing space after `ifnconst playercolors` and a line of spaces after `lastkernelline` are removed.

- **edf910a** (2026-09-24): Removes the `ball_blank_lines` block added in 1195d1f, with its comment and the extra `endif`. This undoes that change; the code is back to the stock `no_blank_lines` slot. The whitespace cleanup from 1195d1f stays.

- **65b1e19** (2026-10-11): Adds the "5 score digits" switch (`score5digits`) to the score setup after `noshakescreen2` and in `beginscore`. `HMP0` gets `$D0` in place of `$E0` and `HMP1` gets `$E0` in place of `$F0`, to move the digits 1 color clock to the right so they look centered. In `beginscore`, the sixth place read `lda (scorepointers+$A),y` is replaced by `lda #0` and `sleep 3` (the same 5 cycles), so that place is blank.

- **bd6a92c** (2026-11-09): With score bars (`pfscore`), the score setup after `noshakescreen2` gets a separate version that writes `pfscore1` to `PF1` at the end of the line before the first score line. Before, the first line of the left bar was not drawn at all, since the setup jumps into that line and the loop writes `PF1` only for the line that follows. To make time, the pointer setup (`temp5` and the high bytes of `scorepointers`) is done before the `WSYNC`, and the `NUSIZ0`/`NUSIZ1`, `VDELP1` and `HMP1` setup is done before the `RESP` strobes; the `RESP` strobes and the `HMOVE` stay at the same cycle. The old setup is kept for games without score bars.

### `std_kernel_vertical_reflect.asm`

- **65b1e19** (2026-10-11): The same "5 score digits" change as in `std_kernel.asm`: `HMP0` `$D0` in place of `$E0` and `HMP1` `$E0` in place of `$F0` after `noshakescreen2`, and in `beginscore` the sixth place read is replaced by `lda #0` and `sleep 3`.

- **bd6a92c** (2026-11-09): The same score bar change as in `std_kernel.asm`: with `pfscore`, a separate score setup after `noshakescreen2` writes `pfscore1` to `PF1` at the end of the line before the first score line, so the first line of the left bar is drawn. The `RESP` strobes and the `HMOVE` stay at the same cycle.

### `std_overscan.asm`

- **2395705** (2026-10-08): In `scorepointerset`, when `scorefonts` is set, both digit pointers add `scorefontlow` in place of `#<scoretable`. This lets the score use the font that `scorefontlow` points to (set in `startup.asm`).

- **65b1e19** (2026-10-11): Adds the "5 score digits" switch (`score5digits`) where the score pointers are set, before `vblk`. Each digit moves one place to the left: `score+2` fills `scorepointers+2` and `+4`, `score+1` fills `+1` and `+3`, and only the low digit of `score` is used, for `scorepointers`. The leftmost digit is dropped and the kernel leaves the sixth place blank, so the five digits sit centered.


## Changes the build makes to the kernel text

Besides the files above, the build changes some kernel and include text in memory before it compiles (the files on disk stay as they are). Each
change is made by the module named, only for the projects that need it:

- `DPCplus_kernel.asm`: the DPC+ sound engine reads the mixed voices into `AUDV0` in the kernel loop's spare 5 cycles (the `sleep 5` after
  `ifnconst DPC_kernel_options`) and quiets it at `exitkernel` (`withDpcPlusAudioHook`, `src/generators/bbasic/dpcplus-audio.js`); the Squish
  score font's shorter score loop (`src/utils/dpc-squish.js`); the score's colors and shading (`src/utils/dpc-score-colors.js`).
- `DPCplusbB.h`: `KERNEL_LINES` (the picture's timer) for no score (`src/utils/dpc-noscore.js`), the Squish score font (`src/utils/dpc-squish.js`) and
  the Text Minikernel's rows (`src/generators/bbasic/text-minikernel-files.js`).
- `score_graphics.asm`: the score fonts (`src/generators/score-fonts.js`, `src/utils/score-font.js`).
- The Text Minikernel's files (`text12a.asm`, `text12b.asm` and the DPC+ text kernel): fonts, line colors, the scroll cursor, the title text color
  (`src/utils/text-font.js`, `src/hooks/rom.js` around `siblingFiles`).

## Score minikernels (added files, no kernel file changed)

`public/bb19/score-minikernel/score33.asm`, `score42.asm` and `score51.asm` are batari's score minikernels (two scores: 3 + 3, 4 + 2 and 5 + 1 digits), from his post
"A few new score kernels" (2008-04-20, https://forums.atariage.com/topic/124520-a-few-new-score-kernels/, `scoreformats.zip`). The files are kept byte for byte as
posted. The standard kernel calls a routine named `minikernel` at the start of the score row when `noscore` is set (`ifconst minikernel` in `std_kernel.asm`, no
change to it); the files define that routine, and are inlined in the kernel's bank for a project that picks a two score layout on the Score tab (`score-layout.js`,
`generateTextMinikernel` in `text-minikernel.js`, `siblingFiles` in `src/hooks/rom.js`). Two things are done to the text in memory, as for the text kernel: the lines that
set the background color of the score row (`sta WSYNC`, `lda backgroundrealcolor` or the chosen color, `sta COLUBK`) are put after the `minikernel` label, because the files
do not set it, and the project's `minikernel` routine for the score row color is not written (the label would be defined twice). The files keep working with the
standard kernel only (DPC+ and PXE draw the score another way, so the setting is off there). `includes-manifest.json` is not affected: no file of `includes/` changed.

## Several score layouts and the one score layout in the minikernels (no file of `includes/` changed)

With more than one score layout in a project (a Set score layout block) the build gives each fetched minikernel file its labels with the layout's name added and puts a
dispatcher named `minikernel` in front of them (`withScoreLayoutLabels`, `scoreLayoutDispatcherAsm` in `src/generators/bbasic/score-layout.js`; `addScoreLayoutFiles` in
`src/hooks/rom.js`). The one score layout is made from `std_kernel.asm` in memory: the lines between `ifnconst noscore` and its `endif`, as a routine named
`minikernel` that ends with `rts` (`scoreNormalMinikernelFrom`). No kernel file is edited.

## `custom/armprog.c`: the Generate terrain function (113) and the set k

`public/bb19/includes/custom/armprog.c` has a new function for the DPC+ coprocessor, number 113, the Generate terrain block drawn in one call (`terrain`, `tplot` and
`tslope`, under `#ifndef NOTERRAIN`). It is the 6502 engine's terrain (`generators/bbasic/pf-draw.js`) written in C step for step, with the engine's names, and makes
the same pixels (checked on the twelve DPC+ terrain projects of `tests/projects/mkterrain.cjs`: the pictures are the same from the frame the 6502 engine is done).
`tools/armprog/build.sh` has a new letter, k, for the set (`-DNOTERRAIN` when it is left out) and a `FROM` setting; the programs with k (`public/bb19/includes/custom/prog`,
512 new files: k, kg, ok, ... ) were built with it (`FROM=512 sh tools/armprog/build.sh`), and the 510 programs without k are the same bytes as before (a build of
them with `-DNOTERRAIN` is identical to the files that were there). `src/generators/bbasic/offset-arm.js` knows the letter (`armProgramKey`, `ensureArmProgram`) and builds the
call (`buildTerrainArmCall`). `includes-manifest.json` is not affected: `armprog.c` and the programs are not in it.

The set k also has function 114, the Playfield gravity block (`pfgravity`: the pixels of an area fall, column by column from the lowest row up; the first and last column and row are in `C_function[1..4]`), called by `buildGravityArmCall` in `generators/bbasic/offset-arm.js`. The set k also has function 115 (`pfgravstep`: one step of the pixels falling over time, a pass of the rows from the bottom up that moves each pixel with a free place under it down one row; it gives back 1 in `C_function[1]` when a pixel moved), called by `buildGravityStepCall`. The 512 programs of the sets with k were built again with them; the others are as they were.

Overhangs of the terrain (function 113, and the same in pf-draw.js for the 6502): where an overhang starts the ground drops under the ledge by the ledge's thickness plus a quarter of the height (held inside the least height), so a void shows under it; where the range has no room it is left out. The set k programs were rebuilt (FROM=512).
