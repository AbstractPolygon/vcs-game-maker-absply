#!/bin/sh
# Starts the program inside the Flatpak: zypak-wrapper (from the Electron base app) runs Electron's sandbox through the Flatpak one.
exec zypak-wrapper /app/vcs-game-maker/vcs-game-maker "$@"
