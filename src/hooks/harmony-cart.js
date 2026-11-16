'use strict';

import Vue from 'vue';
import VueCompositionApi, {ref} from '@vue/composition-api';
import {findHarmonyCart, pickHarmonyCart, serialSupported} from '../utils/harmony-serial';
import {harmonyArmFileFor} from '../utils/harmony-rom';

Vue.use(VueCompositionApi);

// The Harmony Cart found on a serial port ({port, part, label}), or null.
const harmonyCart = ref(null);

// The bankswitch files added in the Harmony popup ({name: Uint8Array}, from the HarmonyCart program's arm folder), kept in
// localStorage for next time.
const ARM_FILES_KEY = 'vcsgm-harmony-arm';

const toBase64 = (bytes) => {
  let text = '';
  for (let i = 0; i < bytes.length; i++) text += String.fromCharCode(bytes[i]);
  return btoa(text);
};

const fromBase64 = (text) => {
  const raw = atob(text);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
};

const loadArmFiles = () => {
  const files = {};
  try {
    const stored = JSON.parse(localStorage.getItem(ARM_FILES_KEY)) || {};
    Object.entries(stored).forEach(([name, text]) => {
      try {
        files[name] = fromBase64(text);
      } catch (e) {
        // (A damaged entry is left out.)
      }
    });
  } catch (e) {
    // (None kept.)
  }
  return files;
};

const harmonyArmFiles = ref(loadArmFiles());

const saveArmFiles = () => {
  try {
    localStorage.setItem(ARM_FILES_KEY, JSON.stringify(Object.fromEntries(
        Object.entries(harmonyArmFiles.value).map(([name, bytes]) => [name, toBase64(bytes)]))));
  } catch (e) {
    // (Not kept for next time.)
  }
};

export const useHarmonyArmFiles = () => harmonyArmFiles;

// Adds the picked files (File objects); a file of the same name replaces the one there.
export const addHarmonyArmFiles = async (files) => {
  const added = {...harmonyArmFiles.value};
  for (const file of files) {
    // (The bankswitch files are a few KB; anything far bigger is not one.)
    if (file.size > 64 * 1024) continue;
    added[file.name] = new Uint8Array(await file.arrayBuffer());
  }
  harmonyArmFiles.value = added;
  saveArmFiles();
};

// The bankswitch files are fetched from the HarmonyCart program's repository on GitHub (its arm folder; raw.githubusercontent.com
// lets a page read them) the first time a ROM needs one, then kept with the others. Not part of VCS Game Maker. A file of that name
// added by hand (batari's 2600+ versions, say) is kept and not fetched over.
const ARM_FILES_URL = 'https://raw.githubusercontent.com/sa666666/harmonycart/master/arm/';
// The file being fetched ({name, error}: error '' while it is on its way), or null.
const harmonyArmFetch = ref(null);
let fetching = null;

export const useHarmonyArmFetch = () => harmonyArmFetch;

const hasArmFile = (name) => Object.keys(harmonyArmFiles.value).some((key) => key.toLowerCase() === name.toLowerCase());

// Makes sure the named file is there, fetching it if not. Gives back whether it is there.
export const ensureHarmonyArmFile = async (name) => {
  if (!name || hasArmFile(name)) return true;
  if (fetching && fetching.name === name) return fetching.promise;
  harmonyArmFetch.value = {name, error: ''};
  const promise = (async () => {
    try {
      const response = await fetch(`${ARM_FILES_URL}${encodeURIComponent(name)}`);
      if (!response.ok) throw new Error(`GitHub answered ${response.status}`);
      const bytes = new Uint8Array(await response.arrayBuffer());
      // (A bankswitch file is a few KB.)
      if (!bytes.length || bytes.length > 64 * 1024) throw new Error('not a bankswitch file');
      harmonyArmFiles.value = {...harmonyArmFiles.value, [name]: bytes};
      saveArmFiles();
      harmonyArmFetch.value = null;
      return true;
    } catch (e) {
      harmonyArmFetch.value = {name, error: (e && e.message) || 'not fetched'};
      return false;
    } finally {
      fetching = null;
    }
  })();
  fetching = {name, promise};
  return promise;
};

export const clearHarmonyArmFiles = () => {
  harmonyArmFiles.value = {};
  saveArmFiles();
};

// Whether a ROM can be written into the connected cart now: a cart answered, the ROM runs on it, and its bankswitch file (if it
// needs one) was added. The emulator's Write ROM button shows only then.
export const harmonyReadyFor = (rom, config) => {
  if (!harmonyCart.value || !rom) return false;
  try {
    const armName = harmonyArmFileFor(rom, config);
    return !armName || Object.keys(harmonyArmFiles.value).some((name) => name.toLowerCase() === armName.toLowerCase());
  } catch (e) {
    return false;
  }
};
// While a write runs, nothing looks for the cart (looking resets it).
const harmonyCartBusy = ref(false);

let searching = null;
let listening = false;

export const useHarmonyCart = () => harmonyCart;
export const useHarmonyCartBusy = () => harmonyCartBusy;

// Looks for a cart on the serial ports the page may use. Looking resets the cart, so it is done when the app starts, when a USB
// serial port is plugged in and when asked, not all the time.
export const searchForHarmonyCart = async () => {
  if (!serialSupported() || harmonyCartBusy.value) return harmonyCart.value;
  if (!searching) {
    searching = (async () => {
      try {
        harmonyCart.value = await findHarmonyCart();
      } catch (e) {
        harmonyCart.value = null;
      } finally {
        searching = null;
      }
      return harmonyCart.value;
    })();
  }
  return searching;
};

// Picks a port and looks for a cart on it (the Harmony popup's Connect cart): a browser shows no port to the page before one is
// picked. Gives back an error message, or '' when a cart was found.
export const connectHarmonyCart = async () => {
  if (harmonyCartBusy.value) return 'The cart is busy.';
  try {
    harmonyCart.value = await pickHarmonyCart();
    return '';
  } catch (e) {
    // (Closing the chooser without picking a port is not an error to show.)
    if (e && e.name === 'NotFoundError') return '';
    return e && e.message ? `No Harmony Cart answered on that port (${e.message})` : 'No Harmony Cart answered on that port.';
  }
};

// Starts looking, and follows ports being plugged in and out.
export const watchForHarmonyCart = () => {
  if (!serialSupported() || listening) return;
  listening = true;
  navigator.serial.addEventListener('connect', () => {
    // (The USB serial driver needs a moment before the port opens.)
    setTimeout(searchForHarmonyCart, 1000);
  });
  navigator.serial.addEventListener('disconnect', (event) => {
    if (harmonyCart.value && event.target === harmonyCart.value.port) harmonyCart.value = null;
  });
  searchForHarmonyCart();
};
