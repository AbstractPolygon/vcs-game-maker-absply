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
- `framecmp.cjs`, `linewrites.cjs`, `labelline.cjs`, `setupcycles.cjs`, `pcwatch.cjs`, `pooltrace2.cjs`: see the usage line at the top of
  each (DPC+ ROMs and their symbols mostly).

Example (the ball of the Title Screen demo logo, exact on its rows):

```
node tests/emulator/frameball.cjs tests/roms/ball2.bin 100 1,1,1 tests/out/ball2.json
node tests/emulator/exactball.cjs tests/out/ball2.json tests/projects/ball2.vcsgm 0 6 69 66,72,200 0
```

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
- `balldraw.cjs`, `exactprev.cjs`: the Title tab's Ball mode (painting speed, valid widths, undo, the picture over the ball).
- `dragtest.cjs`, `stripmenu2.cjs`, `striptest4.cjs`, `profrow.cjs`, `profdraw.cjs`: the row color strip and drawing speed.

```
cd tests/browser
VCSGM_PATH="$(cd ../projects && pwd -W 2>/dev/null || pwd)/ball2.vcsgm" ROMOUT=../out/ball2.bin STEPS=./loadsym.cjs node cdp2c.cjs
```

`tests/hooks/hook_bb.cjs` and `hook_symtext.cjs` add TEMP-DEBUG lines to `src/hooks/bb-compiler.js` so a build leaves its bB text and
symbols in the page (for `loadsym.cjs`); `tests/hooks/unhook.cjs` takes them out again. Never commit with them in.

## Projects and ROMs

- `projects/ball2.vcsgm`: the Title Screen demo with a ball on the logo (row colors, card 6) and on the small single color graphic (card 3);
  `ball3` the logo as single color; `ball4` and `ball5` two frames with different balls (the frames alternate); `rc1` and `rc2` the logo with
  visible row colors, one and two frames. `mkball2.cjs` made `ball2` from the demo.
- `projects/p6_ball2.vcsgm`, `p6_ball3.vcsgm`: Bricks of Olympus (DPC+) with a ball on the logo (screen 1, card 3, top line 45), row colors
  and single color.
- `projects/scroll_*.vcsgm` (made by `mkscroll.cjs`): Reset playfield scroll on the standard kernel, DPC+ and PXE (see the list at the top of
  `mkscroll.cjs`).
- `roms/`: the ROMs and symbols last built from them (`resbl.bin` from `tests/tia/mkresbl.cjs`).
