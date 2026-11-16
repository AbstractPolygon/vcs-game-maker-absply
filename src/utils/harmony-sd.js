'use strict';

// The Harmony popup's SD card: the folder picked as the cart's SD card, the ROMs on it, and saving a file onto it. The desktop app
// does it in its main process (background.js: harmony:pick-sd-folder, harmony:list-sd, harmony:write-sd); Chrome and Edge through
// their folder picker (showDirectoryPicker). A folder is {label, path} in the desktop app (the path kept for next time) or
// {label, handle} in a browser (kept until the page is reloaded).

// The extensions the HarmonyCart program opens as ROMs (its file filter), compared in any case.
const ROM_EXTENSIONS = new Set(['a26', 'bin', 'rom', '2k', '4k', 'f4', 'f4s', 'f6', 'f6s', 'f8', 'f8s', 'fa', 'fe', '3f', '3e', 'e0',
  'e7', 'cv', 'ua', 'ar', 'dpc', '084', 'cu']);
const FOLDER_KEY = 'vcsgm-harmony-sd-folder';
// The deepest folder and the most files listed (an SD card full of ROMs stays quick).
const MAX_DEPTH = 5;
const MAX_FILES = 5000;

let browserFolder = null;

const desktop = () => (typeof window !== 'undefined' && window.electronAPI && window.electronAPI.pickSdFolder ? window.electronAPI : null);

export const sdFolderSupported = () => !!desktop() || (typeof window !== 'undefined' && !!window.showDirectoryPicker);

const isRom = (name) => ROM_EXTENSIONS.has((name.split('.').pop() || '').toLowerCase()) && name.includes('.');

// The folder picked before (the desktop app's path, kept; a browser's, until the page is reloaded), or null.
export const lastSdFolder = () => {
  if (desktop()) {
    try {
      const path = localStorage.getItem(FOLDER_KEY);
      return path ? {label: path, path} : null;
    } catch (e) {
      return null;
    }
  }
  return browserFolder;
};

// Asks for the SD card's folder; null when none was picked.
export const pickSdFolder = async () => {
  const api = desktop();
  if (api) {
    const path = await api.pickSdFolder();
    if (!path) return null;
    try {
      localStorage.setItem(FOLDER_KEY, path);
    } catch (e) {
      // (Not kept for next time.)
    }
    return {label: path, path};
  }
  try {
    const handle = await window.showDirectoryPicker({id: 'harmony-sd', mode: 'readwrite'});
    browserFolder = {label: handle.name, handle};
    return browserFolder;
  } catch (e) {
    if (e && e.name === 'AbortError') return null;
    throw e;
  }
};

const listHandle = async (handle, prefix, depth, roms) => {
  if (depth > MAX_DEPTH) return;
  for await (const entry of handle.values()) {
    if (roms.length >= MAX_FILES) return;
    if (entry.name.startsWith('.') || entry.name === 'System Volume Information') continue;
    if (entry.kind === 'directory') await listHandle(entry, `${prefix}${entry.name}/`, depth + 1, roms);
    else if (isRom(entry.name)) {
      const file = await entry.getFile();
      roms.push({path: `${prefix}${entry.name}`, size: file.size});
    }
  }
};

// The ROM files in the folder ({path from the folder, size}), sorted by path; null when the folder can not be read (the card was
// taken out).
export const listSdRoms = async (folder) => {
  if (!folder) return null;
  let roms;
  if (folder.path) {
    roms = await desktop().listSdFolder(folder.path);
    if (!roms) return null;
  } else {
    roms = [];
    try {
      await listHandle(folder.handle, '', 0, roms);
    } catch (e) {
      return null;
    }
  }
  return roms.sort((a, b) => a.path.localeCompare(b.path, undefined, {sensitivity: 'base'}));
};

// Saves bytes as name at the top of the folder (replacing a file of that name).
export const writeSdFile = async (folder, name, bytes) => {
  if (folder.path) {
    const result = await desktop().writeSdFile(folder.path, name, bytes);
    if (!result || !result.success) throw new Error((result && result.error) || 'The file was not saved.');
    return;
  }
  const file = await folder.handle.getFileHandle(name, {create: true});
  const writable = await file.createWritable();
  await writable.write(bytes);
  await writable.close();
};
