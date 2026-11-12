#!/bin/sh
# Builds every project of tests/projects/mkscroll.cjs with the symbols (the dev server has to be running; the build hooks are put in and taken
# out again) and runs tests/emulator/scrollpos.cjs on the ones with a picture it can read (32 columns).
# usage (from the repo): sh tests/emulator/scrollpos_all.sh [name ...]
cd "$(dirname "$0")/.." || exit 1
names="$*"
[ -z "$names" ] && names="std_fit std_tall std_fit2 std_fitc std_tallc std_fith std_tallh std_fite std_talle dpc_fit dpc_tall dpc_plain dpc_tallc dpc_talle pxe_fit pxe_tall pxe_plain pxe_talle"
projects="$(cd projects && (pwd -W 2>/dev/null || pwd))"
node hooks/hook_symtext.cjs > /dev/null
for n in $names; do
  (cd browser && VCSGM_PATH="$projects/scroll_$n.vcsgm" ROMOUT="../out/scroll_$n.bin" STEPS=./loadsym.cjs node cdp2c.cjs 2>&1 | grep -i "PAGE EXCEPTION" | head -1)
  case $n in pxe*) wait=400;; *) wait=90;; esac
  WAIT=$wait node emulator/scrollpos.cjs "out/scroll_$n.bin" "projects/scroll_$n.vcsgm"
done
node hooks/unhook.cjs > /dev/null
