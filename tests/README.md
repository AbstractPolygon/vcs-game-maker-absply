# Tests

Scripts used to check changes in the emulator and in the editor, with the test projects and the ROMs last built from them. PXE ROMs run with the app's PXE cartridge for 6502.ts (`tools/stellerator/pxe`, through `tests/lib/cart.cjs`). They use Node
(22 or later: `fetch` and `WebSocket` are built in) and the packages in `node_modules`. What they write goes to `tests/out` (ignored by git;
`TEST_OUT` sets another folder). Paths come from `tests/lib/paths.cjs`.

These files stay on the absply repo: leave the `tests` folder out of pushes to other repos.

## Emulator (6502.ts, `tests/emulator`)

- `frameball.cjs rom.bin frame r,g,b [dump.json]`: runs a ROM to a frame (no input), prints the lines with pixels of a color, and can write
  the frame's pixels (a color list per line) for the other scripts.
- `framescan.cjs rom.bin frames r,g,b`: the frames (every 25th) that have pixels of a color.
- `exactball.cjs dump.json project.vcsgm screen cardId topLine r,g,b [offset] [frame]`: every pixel of a title graphic's lines against the
  ball rules of `src/blocks/titlescreen.js` (titleFrameBallLines); prints the wrong pixels.
- `fcmp.cjs a.json b.json`: the lines that differ between two frame dumps.
- `framelines.cjs rom.bin`: the scanlines between VSYNCs for frames 95 to 109 (in thirds: 786 = 262 lines).
- `ramwatch.cjs rom.bin addr,addr from to`: RAM bytes (hex addresses) after each frame.
- `scrollreset.cjs rom.bin [plan]`: Reset playfield scroll (a project of `tests/projects/mkscroll.cjs`): the joystick scrolls, Fire resets, each
  frame after Fire compared with the one before any scroll (Player 1, which follows the scroll, left out). `sh tests/emulator/scrollreset_all.sh`
  builds and runs all 19 (the dev server running).
- `scrollpos.cjs rom.bin project.vcsgm [plan]`: the Playfield scroll position block (the projects put it into missile0x) against the background
  row at the top of the playfield read from the frame, and Player 1 against the picture; `sh tests/emulator/scrollpos_all.sh` builds and runs
  the 18 it can read.
- `scrolldir.cjs rom.bin [frames]`: which way the playfield moves on the screen for Down and for Up.
- `pxepeek.cjs rom.bin name,name [plan]`: variables of a PXE program after each joystick step (read from its memory in the ARM, pRAM).
- `scoredigits.cjs rom.bin [frame]`: the score of a frame as text (`roms/score_dpc.bin`, from `projects/mkscore.cjs`: 123456 on DPC+). Check it after
  rebuilding the DPC+ coprocessor programs (custom2*.bin) or changing the kernel ahead of the score loop: the loop draws the digits wrong when it
  crosses a page.
- `rollcheck.cjs rom.bin [frames] [seed]`: the scanlines of every frame with joystick input (framecmp's pattern); a frame of another length rolls the
  picture. With `projects/mkdpcstress.cjs` (DPC+ at 48, 96 and 192 rows: platformer, playfield collision, Fire, Bounce, Gravity).
- `framecmp.cjs`, `linewrites.cjs`, `labelline.cjs`, `setupcycles.cjs`, `pcwatch.cjs`, `pooltrace2.cjs`: see the usage line at the top of
  each (DPC+ ROMs and their symbols mostly).
- `firecmp.cjs old.bin new.bin` and `bouncecmp.cjs prog.bin`: the coprocessor programs (public/bb19/includes/custom/prog) run in 6502.ts's ARM
  emulator, without a ROM. firecmp: the Fire movement of an older program (function 101, one object a call) against the batch of function 102 on
  random objects and playfields (old.bin from git, e.g. `git show <commit>:public/bb19/includes/custom/prog/pf.bin`). bouncecmp: the later frames of
  a bounce (function 100) against the 6502 lines that do them now.
- `boxcmp.cjs [trials] [seed]`: the box comparison of two sprites as generateBoxChecks makes it, assembled with dasm.wasm and run on 6502.ts's CPU
  (no ROM, no browser), against a model of the boxes: every kind of box (fixed width, width from the size byte, width and copies from the size
  byte, the right half of a wide player), every size code, hidden sprites; then as many cases of two pairs with the same first sprite (its hidden
  test made once for both), each pair with its bit.
- `edgecmp.cjs`: the flag lines of an edge (a switch just switched on, Fire just pressed: edgeFlagLines in src/generators/bbasic/input.js), assembled
  and run on 6502.ts's CPU for every pair of bits and every value of the byte, up and down, against what the batari Basic statements did.
- `drawcmp.cjs draw_std.bin [frames]`: the standard kernel ROM of tests/projects/draw_std.vcsgm run that many frames (600); its playfield RAM
  against the same drawing done in JavaScript (the fill a true 4-connected flood fill). Earlier frames show the drawing spread over frames.
- `stepcost.cjs rom.bin rom.sym.txt [frames]`: the cycles each step of the Draw blocks' engine takes (a call of _pfd_unit), by the kind of work
  being drawn, with picsame's input: the most and the mean, and the most in timer counts (for STEP_TIMER_COUNTS in src/generators/bbasic/pf-draw.js).
- `runoncereset.cjs`: the per-frame reset of the DPC+ "Run once" flag bytes (runOnceResetLines in src/utils/dpc-ram-flags.js), run on 6502.ts's
  CPU with a model of the two data fetchers, 1 to 3 bytes, every value: the fired bits kept only with their touched bit, the touched bits
  cleared, no other byte of the display RAM changed.
- `scorecmp.cjs`: the assembly of a Set score block for a value worked out while the game runs (score_set in src/generators/bbasic/score.js),
  assembled and run on 6502.ts's CPU for every byte 0 to 255, against the score it must give (000 and the hundreds, tens and ones).
- `dfcount.cjs rom.bin [frames] [seed]`: a DPC+ ROM with rollcheck's joystick input: the reads and writes a frame of each variable the build put in
  the display memory (the bytes of the DPC+ stack area, through data fetcher 6), and of all of them.
- `picsame.cjs a.bin b.bin [frames]`: two ROMs of any kind (standard, DPC+, PXE) run with no input but the reset switch, their pictures compared
  frame by frame (PNG=prefix SHOW=frame writes that frame of each; FIRE=from-to,from-to presses Fire in those frames, to start a game).
- `bgcolor.cjs rom.bin frame[,frame...]`: the color most of rows 30 to 160 show in those frames (the background), with picsame's input
  (FIRE as there); EXPECT=rrggbb fails when the last frame shows another. ball2 to ball5, rc1, rc2 of tests/projects after "End title screen":
  `FIRE=200-210,400-410 EXPECT=328432 node emulator/bgcolor.cjs ball2.bin 300` (the starting background back, not black).

Example (the ball of the Title Screen demo logo, exact on its rows):

```
node tests/emulator/frameball.cjs tests/roms/ball2.bin 100 1,1,1 tests/out/ball2.json
node tests/emulator/exactball.cjs tests/out/ball2.json tests/projects/ball2.vcsgm 0 6 69 66,72,200 0
```

## Generator and compiler (`tests/generator`)

- `returnkind.cjs`: the cases of narrowSubroutineReturns (src/generators/bbasic/return-kind.js): a subroutine called only in its bank gets return thisbank,
  one called only from other banks return otherbank, anything else (mixed calls, a goto into it, a call that falls into it) the plain return; a
  Function's return value lines get thisbank.
- `returnasm.cjs`: compiles a short program with the app's batari Basic compiler (preprocess.wasm and 2600basic.wasm with WASI) and checks the
  code of those returns: RTS, JMP BS_return, a load and an RTS.
- `spillweights.cjs`: the weights the display memory spill (src/generators/bbasic/spill.js, describeSpill) gives a name's uses are the same wherever
  the bank layout puts the code that uses them: a unit reached by a goto or gosub, a subroutine a Function calls and a label an asm jmp reaches take
  the weight of the lines that reach them (100 a use from code of every frame, a quarter from inside an if), not the one of the section before them.

## TIA test ROMs (`tests/tia`)

- `mkhm.cjs T`, `hmmeasure.cjs rom`: HMOVE at cycle T of a line, the moves of the ball and Player 0.
- `mkresbl.cjs`, `balllines.cjs rom`: RESBL on the line it is written on and the line after, two RESBLs a line.
- `dasm.cjs dir file.asm out.bin`: assembles with the project's `public/bb19/dasm.wasm`.

```
node tests/tia/mkresbl.cjs
node tests/tia/dasm.cjs tests/out resbl.asm resbl.bin
node tests/tia/balllines.cjs tests/out/resbl.bin
```

## Editor (headless Chrome, `tests/browser`)

`cdp2c.cjs` starts a headless Chrome (`CHROME` or the first one found) on the dev server (`APP`, default `http://localhost:8086/`: run the
app's dev server first) and runs a steps file (`STEPS`), which gets `send` (DevTools protocol), `evaluate` and `sleep`. Steps files:

- `loadsym.cjs`: loads `VCSGM_PATH` (an absolute path: Chrome takes the file from it), builds the ROM and writes it to `ROMOUT` (with the symbols when the hooks below are on).
- `titlepreview.cjs`: loads `VCSGM_PATH`, clicks the Play button of Title tab page `TITLE_PAGE` (1 = the first shown) and prints whether the
  preview built and its error lines; with `ROMOUT` saves the preview ROM (and the assembly with `hook_asm.cjs` on, also when it fails).
- `buildlog.cjs`: loads `VCSGM_PATH`, builds it and prints the result and the error lines of the build log.
- `balldraw.cjs`, `exactprev.cjs`: the Title tab's Ball mode (painting speed, valid widths, undo, the picture over the ball).
- `dragtest.cjs`, `stripmenu2.cjs`, `striptest4.cjs`, `profrow.cjs`, `profdraw.cjs`: the row color strip and drawing speed.

```
cd tests/browser
VCSGM_PATH="$(cd ../projects && pwd -W 2>/dev/null || pwd)/ball2.vcsgm" ROMOUT=../out/ball2.bin STEPS=./loadsym.cjs node cdp2c.cjs
```

`tests/hooks/hook_bb.cjs` and `hook_symtext.cjs` add TEMP-DEBUG lines to `src/hooks/bb-compiler.js` so a build leaves its bB text and
symbols in the page (for `loadsym.cjs`), `hook_asm.cjs` one to `src/hooks/rom.js` that leaves the assembly before it is assembled (game
builds and previews); `tests/hooks/unhook.cjs` takes them all out again. Never commit with them in. `tests/hooks/hook_narrow.cjs on|off` makes the standard build
use 4-pixel tiles for a project with `tileSet.forceNarrow` (`projects/mknarrow.cjs`); turn it off with `off` (unhook.cjs does not).

## Projects and ROMs

- `projects/ball2.vcsgm`: the Title Screen demo with a ball on the logo (row colors, card 6) and on the small single color graphic (card 3);
  `ball3` the logo as single color; `ball4` and `ball5` two frames with different balls (the frames alternate); `rc1` and `rc2` the logo with
  visible row colors, one and two frames. `mkball2.cjs` made `ball2` from the demo.
- `projects/p6_ball2.vcsgm`, `p6_ball3.vcsgm`: Bricks of Olympus (DPC+) with a ball on the logo (screen 1, card 3, top line 45), row colors
  and single color.
- `projects/scroll_*.vcsgm` (made by `mkscroll.cjs`): Reset playfield scroll on the standard kernel, DPC+ and PXE (see the list at the top of
  `mkscroll.cjs`).
- `projects/draw_std.vcsgm`, `draw_dpc.vcsgm`, `draw_pxe.vcsgm` (made by `mkdraw.cjs`): every Draw block of Playfield > Utility in a Run once
  block (straight lines, a line, a fill, a circle, a flipped area, a pixel, a centered area, an erase) and the score set to 777 once
  "Playfield fill done"; for the drawing engine (src/generators/bbasic/pf-draw.js).
- `roms/`: the ROMs and symbols last built from them (`resbl.bin` from `tests/tia/mkresbl.cjs`).
