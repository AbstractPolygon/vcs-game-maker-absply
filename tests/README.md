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
- `terraincmp.cjs terrain_std_<side>.bin side [frames]`: the standard kernel ROM of a terrain project (mkterrain.cjs), its playfield checked as
  terrain on that side: one run from the edge at every position, 2 to 5 deep, the depth moving at most a pixel from one position to the next.
- `fireany.cjs rom.bin rom.sym.txt kernel frames missile0:angle:speed,... [pf]`: the any direction Fire block (a heading of 0-255 for a full turn, the quarter turn sine
  table; `projects/fire_<kernel>_any_*.vcsgm` of `mkfire.cjs`): each object's x and y every frame against the exact integer model of the movement (sine table
  in 32nds, leftover 32nds of each axis, the 1.625 times vertical stretch of DPC+ without the playfield check) and against the ideal circle (within 2 pixels).
- `firebounce.cjs rom.bin rom.sym.txt frames object[,object]`: the heading byte of a fired object with a Bounce (`fire_<kernel>_any_bounce` off the screen edges,
  `fire_<kernel>_any_wall` and `wall2` off a wall and a floor of the playfield) every frame; each change must be the mirror over a vertical wall (0 - heading) or a
  horizontal one (128 - heading), TOLERANCE=16 for the playfield, where the wall is told from the nearest of 16 directions.
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
- `tooltipsonly.cjs file.js ...`: whether a file of src differs from the last commit (TIP_BASE=folder: from the file of that name there) only in the text of
  tooltips (tooltip: values, setTooltip arguments, constants and Blockly.Msg strings with tooltip in the name), by the syntax tree. For shortening tooltips.
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
- `projects/fire_<kernel>_<8|16|any>_<variant>.vcsgm` (made by `mkfire.cjs`): Missile 0, Missile 1 and the ball fired from the middle at set angles and speeds: plain,
  pf (check playfield, same speed), bounce (Bounce off the screen edges every frame), wall and wall2 (Bounce off a playfield wall or floor), and for any direction the
  angle sets a to e. Built before and after the any direction change, the 8 and 16 direction ROMs were byte for byte the same.
- `projects/terrain_<kernel>_<side>.vcsgm` (made by `mkterrain.cjs`): the Generate terrain block on the bottom, top, left and right (standard) or bottom and
  right (DPC+, PXE), made in a Run once block, Fire makes new terrain.
- `projects/draw_std.vcsgm`, `draw_dpc.vcsgm`, `draw_pxe.vcsgm` (made by `mkdraw.cjs`): every Draw block of Playfield > Utility in a Run once
  block (straight lines, a line, a fill, a circle, a flipped area, a pixel, a centered area, an erase) and the score set to 777 once
  "Playfield fill done"; for the drawing engine (src/generators/bbasic/pf-draw.js).
- `projects/circle_std.vcsgm`, `circle_dpc.vcsgm`, `circle_dpcspread.vcsgm` (made by `mkcircle.cjs`): the circle block on short rows (std pfres 32 with Superchip, DPC+ pfres 96). A a plain circle (flat), B kept round ("keep it round on short rows"), C kept round with a padding for each side (left 10, right 3, top 12, bottom 15, DPC+ 40: cut to columns 10 to 28 and rows 12 to the last row less the bottom), D a centered area with a padding of 4 and 6 (columns 4 to 25), E a small circle with a padding of 3 on all sides; dpcspread draws B and C over several frames (the 6502 steps): the same picture as dpc. Render frame 400 with `emulator/framepng.cjs`; the score reads 777 when the queue is done. `ERASE=1 node tests/projects/mkcircle.cjs` makes circle_<kernel>_off (the playfield filled first, the circles clear it) and `SPEED=2 node tests/projects/mkcircle.cjs` circle_<kernel>_slow (a Set playfield draw speed block of 2 steps a frame, one kept-round circle): frame 60 shows the middle rows only, frame 200 most of it, frame 3000 all of it.
- `projects/titleshow_<std|dpc>_<on|off>.vcsgm` (made by `mktitleshow.cjs`): Title screen start has Start title screen, Draw title screen and Every 30 frames adding 1 to gState; on: inside While title screen is showing. Read gState with `emulator/ramwatch.cjs` (std $d7, DPC+ var2 $ee): on goes up by 1 every 30 frames, off stays at 1.
- `projects/titleblocks_<std|dpc>_<switch|back|end>.vcsgm` (made by `mktitleblocks.cjs`): a page 4 (page 3 with a red background) and blocks inside While title screen is showing; Title screen update is empty, so the loop draws the page the blocks pick. switch: When graphic 3 of page 3 finishes, gState + 1 and Draw title screen 4 (stays on 4); back: also When graphic 3 of page 4 finishes, gState + 1, Draw title screen 3 and Animate graphic 3 of page 3 (play once), so the pages take turns; end: When graphic 3 of page 3 finishes, gState + 1 and End title screen. Read gState and titleScreenSelectedId by symbol each frame with the frame lengths: switch 3 then 4 at about frame 144; back 3, 4, 3, 4 (about every 142 frames); end the regular screen after about frame 144; no frame drawn twice (261.7 lines; 262.7 on the DPC+ regular screen).
- `projects/twotone_dpc.vcsgm`, `twotone_dpc_bg.vcsgm` (BG=66, a red page), `twotone_std.vcsgm` (STD=1), `twotone_std_rows.vcsgm` (STD=1 ROWS=1) (made by `mktwotone.cjs`): a two-tone 48x2 title graphic of 16 rows (a frame of lit pixels and a test row of 1 to 6 lit pixels a column; rows: row r lights r + 1 pixels), left colors a blue ramp and right colors an orange ramp. Render frame 60 with `emulator/framepng.cjs` and read rows of pixels: the graphic at pixels 56 to 103, the left color to 79, the right from 80, every row its colors on DPC+ (the first row's on std), 32 lines, the page color everywhere else.
- `roms/`: the ROMs and symbols last built from them (`resbl.bin` from `tests/tia/mkresbl.cjs`).
- `projects/score_layout_<normal|33|42|51>.vcsgm` and `projects/score_blocks_<33|42|51>.vcsgm` (made by `mkscore.cjs`): the standard kernel with the Score tab's layout set (normal, two scores 3+3, 4+2, 5+1) and the score 123456, and with the Score left and Score right set and change blocks (left set to 123, right set to 45, left change by 2, right change by 5). Render the picture with `emulator/picsame.cjs` (PNG=prefix SHOW=frame) and read the digits: 123 and 456, 1234 and 56, 12345 and 6; with the blocks 125 and 050, 0125 and 50, 00125 and 9 (the right score stops at its largest). The normal layout builds must stay byte identical to builds before the layout setting existed.
- `projects/blink_<std|dpc>_<plain|color>.vcsgm` (made by `mkblink.cjs`): HELLO 123 with Blink text forever; color also sets the text color (row 1) every frame in gameplay_update. Read TextColor and textBlink by symbol every few frames (a varwatch style script): the color has to alternate between the set color (shown) and the background color (hidden, bit 7 of textBlink set) in step, so the set color block does not stop the blink.
- `projects/offset_<std|dpc>_<right|wrap_right|left|wrap_left>.vcsgm` (made by `mkoffset.cjs`; offset_std_none.vcsgm is the same project with no offset block): the Playfield offset block over the whole playfield every frame on the base project (its Background 1 pattern, 11 rows). Check that wrap left and wrap right keep every row's count of lit pixels from frame to frame (the pixel that leaves a row comes back in the same row) and that all left and all right (the belt) do not. Standard: read the playfield bytes of the RAM (a pfdump style script, columns of a row: byte 0 bit 7 down to 0, byte 1 bit 0 up, byte 2 bit 7 down, byte 3 bit 0 up); DPC+: count the lit pixels of each line of two frames in the pictures from `emulator/picsame.cjs`. Done 2026-11-17: standard wrap right and wrap left rotate each row (6 rows by 1 column a frame), DPC+ wrap right gives the same counts on every line from frame 60 to 61, the belt does not.
- `projects/terrain_std_bottom_tile.vcsgm`, `terrain_std_left_tile.vcsgm`, `terrain_dpc_bottom_tile.vcsgm`: the Generate terrain block with the tile box ticked (height 2 to 10 or 9, roughness 5). The edge has to come back to where it started: bottom 6 high at column 0 and at column 31 (without tile 6 and 9 or 6 and 9 with other seeds), left 5 rows at the first and the last row (without tile 5 and 8), seen in the playfield RAM, and on DPC+ the first and last column at the same height in the picture.
- `projects/every_x_std.vcsgm` and `every_x_dpc.vcsgm` (made by `mkevery.cjs`): three Every x frames blocks in gameplay_update, x 3 (a counter byte) adding 1 to the score, x 8 (the frame counter mask) adding 1000 and x 5 + 5 (an expression, a counter byte) adding 10000. At frame 91 the standard score has to read 112031 (31, 12 and 10 runs: the first run is at once); DPC+ gets 4 frames fewer of game by then (101029: 29, 11 and 9 runs, the dropdown Every 8 frames block alone gives 11 there too).
- `projects/accel_<std|dpc>_<a|b|c|d>.vcsgm` (made by `mkaccel.cjs`): Accelerate with any direction (the dropdown value ANY) on missile 0, missile 1 and the ball at headings of a full turn of 256 (a: 0, 64, 32; b: 128, 192, 100; c: 8 and 16 direction blocks next to an any one; d: an any block and an 8 or 16 direction one of the same object). Read the fine velocity bytes (missile0VelocityX and so on) by symbol after 100 frames: the rate and the speed limit are split by the sine and the cosine (limit times the sine, rounded), e.g. heading 32 with limit 4 gives 3 and -3, 100 with limit 3 gives 2 and 2, 200 with limit 4 gives -4 and -1. The standard builds set Superchip RAM (three objects with fine velocity need the variables).
- `projects/grav_<std|dpc>_<a|b>.vcsgm` (made by `mkgrav.cjs`): Gravity with a direction on missile 0, missile 1 and the ball (heading of 256 to the turn, 128 down; pull 2 eighths of a pixel a frame, max fall 2): a: 64, 0, 200; b: 128 (the old gravity code), 192, 100. Read the x and y of the objects at frames 30 and 60 by symbol: the speed is 2 then, so about 60 pixels along the heading (heading 64: x +60; 0: y -60; 200: x -58 and y -12; 128: y +60; 192: x -60; 100: x +37 and y +47). The standard builds set Superchip RAM.
- `projects/gravctl_<std|dpc>.vcsgm` (made by `mkgravctl.cjs`): the Start / Stop gravity block (object_gravity_control, no numbers): missile 0 starts Gravity and is stopped at once (missile0y stays 0), missile 1 starts, is stopped and started again and falls (2 pixels a frame by frame 30, the same on the standard and the DPC+ kernel). Read missile0y and missile1y by symbol with `emulator/ramwatch.cjs`.
- `projects/score_multi_<a|b|c>.vcsgm` (made by `mkscore.cjs`): the Score tab's layout 3+3 with Set score layout blocks at the start of the game: a switches to 4+2 (4 digits and 2), b to 5+1 and then Score left change by 2 (00002 and 0), c to 4+2 and back to 3+3 (3 and 3 digits). More than one minikernel is in the ROM, behind the dispatcher. Render with `emulator/picsame.cjs` (PNG=prefix SHOW=frame) and read the digit counts; a one layout project (score_layout_33) must build as before.
- `projects/score_font_<a|b>.vcsgm` (made by `mkscore.cjs`): a secondary score font (alarmclock) with a two score layout, Set font secondary at the start of the game. a: 3+3 only, left 123 and right 255 (picture: 123 and 255 in the seven segment digits); b: 3+3 with a switch to 4+2 (two minikernels, dispatcher), left 200 and right 56 (0200 and 56 in the same font).
- `projects/score_value_<a|b>.vcsgm` (made by `mkscore.cjs`): the Score left and Score right value blocks. a: 3+3, left 123, right 200, left set to (Score right), right set to (Score left + 1): the picture reads 200 and 201; b: 3+3 with a switch to 4+2, left 99, right set to (Score left): 0099 and 99.
- `projects/score_value_<c|d>.vcsgm` (made by `mkscore.cjs`): the same value blocks inside a custom Function the game calls. c: as a, inside the Function: 200 and 201; d: the 255 cap, left 200 changed by 155 (355), right set to (Score left): 355 and 255.
- `projects/score_bars_<normal|33|42|51>.vcsgm` and `projects/score_one_<a|b|c|d>.vcsgm` (made by `mkscore.cjs`): score bars with each layout (the bars show only with the one score; the three two score layouts draw none), and the one score layout in a project that switches layouts. one a: Score tab one score, Set score layout 3+3; b: Score tab 3+3, Set score layout one score (six digits); c: 3+3 and back to one score; d: bars set, then one score (six digits and both bars).
- `projects/score_five_<a|b|c>.vcsgm` (made by `mkscore.cjs`) and `emulator/scorecols.cjs`: the Score tab's 5 digit switch with the one score layout (a: no layout blocks, b: one score, 3+3 and back, c: 3+3 and a switch to one score). `scorecols.cjs a.bin ...` prints the first and last lit column of the score digits in frame 60: all three read 62 to 99 (middle 80.5, the screen's middle is 80), so the digits are centered the same in the kernel's score and in the minikernel made from it.
- `projects/collstart_<a|b|c|d>.vcsgm` (made by `mkcollstart.cjs`): the When ... collide block (the blocks inside run once, in the frame a collision starts). The score counts the times they run; read at frame 240. a: Player 1 moves up through Player 0, a Score change inside the block: 1; b: the same with an If and Collided, the control: 15; c: Player 0 moves left through the playfield shapes of the template: 9 (one for each shape it meets); d: the same with Collided: 65+.
- `projects/mkterrain.cjs` also makes the DPC+ terrain projects for all four sides and the std variants (`terrain_dpc_*`): the coprocessor's terrain (function 113 of armprog.c, the set k) has to make the same picture as the old 6502 engine (`git stash`, or the ROMs built before the change, then `picsame.cjs old.bin new.bin 300`: only the frames while the old engine is still drawing differ, 18 to 37 of them, none after).
- `projects/titleterr_<std|dpc>.vcsgm` (made by `mktitleterrain.cjs`): terrain made while the Titlescreen Kernel runs (Draw title screen every frame): when Terrain done is true End title screen shows the game screen and the score is set to 777. std: the Draw blocks' steps were in the half of commongamelogic that the Title Screen loop skips, so the terrain never got made (the title screen stayed up); now they run before the return there. (dpc: the demo has no Titlescreen Kernel picture on DPC+ here; it only checks the build.)
- `projects/gravstop_<std|dpc|pxe>_<a|b|c|d|e|f>.vcsgm` (made by `mkgravstop.cjs`): Gravity pulls Player 0 left into a playfield shape; a: If Collided Player 0 and Playfield, Stop gravity Player 0; b: no stop (control, the square goes through); c: the When ... collide block with the Stop inside; d: When Any sprite and Playfield collide with Stop gravity Colliding sprite. a, c and d stop the square at the shape on the three kernels (picture at frame 240); e: Start gravity in the frames of the game, every frame, no Stop: the square falls on and goes through the shape like b (the Start of the next frames does not start it again from 0); f: e with the When Any sprite block after it: the square stops at the shape and stays there.
- `projects/gravout_<std|dpc|pxe>_<when|any>.vcsgm` (made by `mkgravout.cjs`): Player 0 is put at x 140 and Gravity pulls it down onto a floor (a Draw fill of the bottom rows: 9 and 10 on the standard kernel, which has 11 rows without Superchip RAM; 18 to 22 on DPC+ and PXE); when: When Player 0 and Playfield collide with Stop gravity Player 0; any: When Any sprite and Playfield collide with Stop gravity Colliding sprite. The Stop takes the square back up out of the playfield: it rests with its last line on the line above the floor (picsame.cjs frame 400: std 153, floor 154; DPC+ 157, 158; PXE 160, 161). With the code before the fix it sat in the floor.
- `projects/bouncefind_<std|dpc|pxe>_<fire|num|inertia>.vcsgm` (made by `mkbouncefind.cjs`): a frame and a band of bricks drawn by a Run once; If Collided ball and playfield: Bounce ball and, right after it, Find playfield pixel collided with for the ball by its Fire angle (fire) or by 3 (num), the pixel turned off when it is a brick; inertia: Player 0 moved by Accelerate in place of the fired ball (std with Superchip RAM). The Bounce and the Find are one routine (_bouncefind_<object>_<n>) on every kernel (DPC+ fire: the coprocessor's function 101). picsame.cjs: the same pictures as a build of the code before (2000 frames; std fire differs in frames 3 to 8, std inertia in 14 to 77 where the band draws a little faster). In the inertia tests Player 0 gets out of the frame, the same before.
- `projects/firethrottle_<std|dpc|pxe>_<same|mixed>.vcsgm` (made by `mkfirethrottle.cjs`): an Every 4 frames block fires the ball once (If gState = 0) with throttle movement: it moves a pixel every 4 frames; same: the only Fire block of the ball (the throttle byte is the countdown, the interval a constant); mixed: a second Fire block without throttle movement fires it back left once its x is over 60 (it then moves every frame: the countdown in the low nibble, the interval in the high one). picsame.cjs: the same pictures as a build of the code before the packing (600 frames).
- `projects/pfgrav_<std|dpc|pxe>_<a|b|c>.vcsgm` (made by `mkpfgravity.cjs`): the playfield is cleared and given a floating line (row 2, columns 4 to 12), a floating pixel at column 20 row 4, pixels at column 20 row 9 and column 8 row 10; a: Playfield gravity on the whole playfield, then the score is set to 7 once Playfield gravity done is true (every pixel lands on the bottom row or on a pixel below it, the line piles on the pixel of column 8); b: the area from column 0 to 9 and row 0 to 10 only (the line's columns 10 to 12 and the pixels of column 20 stay); c: no gravity block (control); d: the whole playfield with a When playfield gravity is done block that adds 1 to the score (the score ends at 1); e and f: the whole playfield and the area falling one row every 4 frames (mid-fall pictures show the line a few rows down, the end the same as a and b, score 7; the standard kernel and PXE take several hundred frames). Picture at frame 300 (700 on PXE, which starts the game later).
