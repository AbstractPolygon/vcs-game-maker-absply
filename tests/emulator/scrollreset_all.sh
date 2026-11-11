#!/bin/sh
# Builds every project of tests/projects/mkscroll.cjs (the dev server has to be running) and runs tests/emulator/scrollreset.cjs on each.
# usage (from the repo): sh tests/emulator/scrollreset_all.sh [name ...]
cd "$(dirname "$0")/.." || exit 1
names="$*"
[ -z "$names" ] && names="std_fit std_tall std_fit2 std_fitc std_tallc dpc_fit dpc_tall dpc_plain dpc_tallc pxe_fit pxe_tall pxe_plain"
projects="$(cd projects && (pwd -W 2>/dev/null || pwd))"
for n in $names; do
  (cd browser && VCSGM_PATH="$projects/scroll_$n.vcsgm" ROMOUT="../out/scroll_$n.bin" STEPS=./loadsym.cjs node cdp2c.cjs 2>&1 | grep -i "saved\|PAGE EXCEPTION" | head -2)
  case $n in pxe*) wait=400;; *) wait=90;; esac
  WAIT=$wait node emulator/scrollreset.cjs "out/scroll_$n.bin" | tail -1
done
