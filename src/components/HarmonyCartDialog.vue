<template>
  <v-dialog v-model="open" width="540" :persistent="writing">
    <template v-slot:activator="{ on, attrs }">
      <v-btn
        icon
        small
        class="emulator-flat-icon-btn"
        title="Harmony Cart: connect the cart, add bankswitch files, save for its SD card"
        v-bind="attrs"
        v-on="on"
      >
        <!-- A yin-yang with thinner lines than the icon font's (mdi-yin-yang). In a v-icon element, so the
             toolbar's icon size and colors (App.vue) apply to it. -->
        <span class="v-icon notranslate harmony-cart-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="9.6" fill="none" stroke="currentColor" stroke-width="1.4" />
            <path
              d="M12 2.4 A4.8 4.8 0 0 1 12 12 A4.8 4.8 0 0 0 12 21.6 A9.6 9.6 0 0 1 12 2.4 Z M12 5.6 A1.6 1.6 0 1 0 12 8.8 A1.6 1.6 0 1 0 12 5.6 Z"
              fill="currentColor"
              fill-rule="evenodd"
            />
            <circle cx="12" cy="16.8" r="1.6" fill="currentColor" />
          </svg>
        </span>
      </v-btn>
    </template>
    <v-card>
      <v-card-title>Harmony Cart</v-card-title>
      <v-card-text class="harmony-cart-text">
        <v-radio-group v-model="settings.mode" dense hide-details class="mt-0" :disabled="writing" @change="saveSettings">
          <v-radio value="developer" label="Developer Mode" />
          <v-radio value="sd" label="SD card" />
          <v-radio value="bios" label="BIOS" />
        </v-radio-group>
        <template v-if="settings.mode !== 'bios'">
          <div v-if="disabledReason" class="harmony-cart-line error--text mt-2">{{ disabledReason }}</div>
          <div v-else-if="modeProblem" class="harmony-cart-line error--text mt-2">{{ modeProblem }}</div>
        </template>
        <template v-if="settings.mode !== 'sd'">
          <div class="harmony-cart-line mt-2">
            <strong>Cart:</strong>
            {{ cart ? cartText : 'not connected' }}
          </div>
          <div v-if="!serialOk" class="harmony-cart-line error--text">
            This browser can not use serial ports: use Chrome or Edge, or the desktop app. Saving for the SD card still works.
          </div>
          <div v-else-if="!cart" class="harmony-cart-line">
            Plug the cart into this computer's USB port, then use Connect cart and pick its port.
          </div>
        </template>
        <template v-if="settings.mode === 'developer'">
          <div v-if="!romProblem && armName" class="harmony-cart-line">
            <strong>Bankswitch file:</strong> {{ armName }}
            <span v-if="armLoaded">(ready)</span>
            <span v-else-if="armFetch && armFetch.name === armName && armFetch.error" class="error--text">
              (could not be fetched: {{ armFetch.error }}; add it below)
            </span>
            <span v-else>(fetching...)</span>
          </div>
          <div v-else-if="!romProblem" class="harmony-cart-line"><strong>Bankswitch file:</strong> none needed (DPC+)</div>
          <v-alert type="warning" dense text class="mt-3">
            The ROM takes the place of the cart's loader, so the cart runs only this ROM and no longer reads the SD card. Write the BIOS
            to use the SD card again.
          </v-alert>
          <v-checkbox
            v-model="settings.verify"
            dense
            hide-details
            label="Read each part back after writing it"
            :disabled="writing"
            @change="saveSettings"
          />
          <div class="harmony-cart-fields">
            <v-text-field
              v-model.number="settings.retries"
              type="number"
              min="1"
              max="10"
              dense
              label="Tries per block"
              hint="How often a block is sent before giving up"
              persistent-hint
              :disabled="writing"
              @change="saveSettings"
            />
            <v-text-field
              v-model.number="settings.connectionAttempts"
              type="number"
              min="1"
              max="100"
              dense
              label="Connection attempts"
              hint="How often the cart is reset to reach it"
              persistent-hint
              :disabled="writing"
              @change="saveSettings"
            />
          </div>
          <v-checkbox
            v-model="settings.delayAfterWrite"
            dense
            label="Pause after each write"
            hint="For USB serial adapters that drop data; much slower."
            persistent-hint
            :disabled="writing"
            @change="saveSettings"
          />
          <div class="harmony-cart-line mt-3">
            <strong>Bankswitch files:</strong>
            {{ armNames.length ? armNames.join(', ') : 'none yet' }}
          </div>
          <div class="harmony-cart-line harmony-cart-note">
            Fetched from the <a :href="harmonySoftwareUrl" target="_blank" rel="noopener">HarmonyCart program</a> when needed.
          </div>
          <div class="harmony-cart-line harmony-cart-note expert-hidden">
            For a 2600+, add batari's <a :href="plusArmUrls.f8" target="_blank" rel="noopener">F8.arm</a> and
            <a :href="plusArmUrls.f6f4" target="_blank" rel="noopener">F6.arm, F4.arm</a>.
          </div>
          <div class="mt-1">
            <v-btn small text :disabled="writing" @click="$refs.armInput.click()">Add bankswitch files...</v-btn>
            <v-btn v-if="armNames.length" small text :disabled="writing" @click="clearArmFiles">Remove them</v-btn>
            <input
              ref="armInput"
              type="file"
              accept=".arm"
              multiple
              class="harmony-cart-file-input"
              @change="handleArmFiles"
            >
          </div>
        </template>
        <template v-else-if="settings.mode === 'sd'">
          <v-radio-group
            v-model="settings.sdTarget"
            dense
            hide-details
            class="mt-2"
            @change="saveSettings"
          >
            <v-radio value="single" label="Single game (Atari 2600+ / 7800+)" />
            <v-radio value="menu" label="Multicart" />
          </v-radio-group>
          <template v-if="settings.sdTarget === 'single'">
            <div class="harmony-cart-line harmony-cart-note expert-hidden">
              The cart boots this game instead of its menu. Needs BIOS 1.06 and 2600+ firmware 1.1x-r3 or later. Delete the file to get
              the menu back.
            </div>
          </template>
          <div v-if="!sdProblem" class="harmony-cart-line mt-2">
            <strong>File:</strong> {{ sdFileName }}
          </div>
          <div v-if="!sdProblem && needsEncore" class="harmony-cart-line harmony-cart-note">
            A 64K ROM runs only on a Harmony Encore.
          </div>
          <template v-if="sdSupported">
            <div class="harmony-cart-line mt-2">
              <strong>SD card:</strong> {{ sdFolder ? sdFolder.label : 'not picked' }}
            </div>
            <div v-if="sdFolder" class="mt-1">
              <v-btn small text :loading="sdLoading" @click="refreshSd">Refresh</v-btn>
            </div>
            <template v-if="sdFolder">
              <div v-if="sdRoms === null && !sdLoading" class="harmony-cart-line error--text">
                The SD card can not be read: is it in the card reader?
              </div>
              <template v-else-if="sdRoms">
                <div class="harmony-cart-line mt-2">
                  <strong>ROMs on the SD card:</strong> {{ sdRoms.length }}
                </div>
                <div v-if="sdRoms.length" class="harmony-cart-sd-list">
                  <div
                    v-for="item in sdRoms"
                    :key="item.path"
                    class="harmony-cart-sd-row"
                    :class="item.path.toLowerCase() === sdFileName.toLowerCase() ? 'harmony-cart-sd-this' : ''"
                  >
                    <span class="harmony-cart-sd-name">{{ item.path }}</span>
                    <span class="harmony-cart-sd-size">{{ sizeText(item.size) }}</span>
                  </div>
                </div>
              </template>
            </template>
          </template>
          <div v-else class="harmony-cart-line">
            Put the cart's SD card in this computer's card reader, then pick the card (or a folder on it) in the save dialog.
          </div>
        </template>
        <template v-else>
          <div class="harmony-cart-line mt-2">
            The BIOS is two files from the
            <a :href="harmonySoftwareUrl" target="_blank" rel="noopener">HarmonyCart program</a> (AtariAge), each for the TV type
            (NTSC, PAL50 or PAL60): the loader (eeloader_ntsc.bin, eeloader_pal50.bin, eeloader_pal60.bin) goes into the cart over USB,
            and the menu (hbios_ntsc.bin, hbios_pal50.bin, hbios_pal60.bin) goes on the SD card as hbios.bin.
          </div>
          <div class="harmony-cart-line mt-3">
            <strong>Loader:</strong> {{ loaderFile ? loaderFile.name : 'none picked' }}
          </div>
          <div>
            <v-btn small text :disabled="writing" @click="$refs.loaderInput.click()">Pick loader...</v-btn>
            <v-btn small text color="primary" :disabled="!canWriteLoader" :loading="writing" @click="writeLoader">
              Write loader
            </v-btn>
            <input ref="loaderInput" type="file" accept=".bin" class="harmony-cart-file-input" @change="handleLoaderFile">
          </div>
          <div class="harmony-cart-line mt-2">
            <strong>Menu:</strong> {{ menuFile ? menuFile.name : 'none picked' }}
          </div>
          <div>
            <v-btn small text :disabled="writing" @click="$refs.menuInput.click()">Pick menu...</v-btn>
            <v-btn small text color="primary" :disabled="!menuFile || writing" @click="saveMenu">Save to SD card as hbios.bin</v-btn>
            <input ref="menuInput" type="file" accept=".bin" class="harmony-cart-file-input" @change="handleMenuFile">
          </div>
        </template>
        <v-progress-linear
          v-if="settings.mode !== 'sd' && (writing || progress > 0)"
          :value="progress"
          height="6"
          rounded
          class="mt-3"
        />
        <div v-if="status" class="harmony-cart-line mt-2" :class="failed ? 'error--text' : ''">{{ status }}</div>
        <div v-if="log.length && settings.mode !== 'sd'" class="harmony-cart-log">
          <div v-for="(line, index) in log" :key="index">{{ line }}</div>
        </div>
      </v-card-text>
      <v-card-actions>
        <v-btn
          v-if="settings.mode !== 'sd' && serialOk"
          text
          :disabled="writing || searching"
          :loading="searching"
          @click="connect"
        >
          Connect cart...
        </v-btn>
        <v-btn
          v-if="settings.mode === 'sd' && sdSupported"
          text
          :disabled="sdLoading"
          @click="pickSd"
        >
          Pick SD card...
        </v-btn>
        <v-spacer />
        <v-btn v-if="writing" text color="error" @click="cancel">Cancel</v-btn>
        <v-btn v-else text @click="open = false">Close</v-btn>
        <v-btn
          v-if="settings.mode === 'developer'"
          text
          color="primary"
          :loading="writing"
          :disabled="!canWrite"
          @click="write"
        >
          Write
        </v-btn>
        <v-btn
          v-else-if="settings.mode === 'sd'"
          text
          color="primary"
          :disabled="!!sdProblem || !!disabledReason"
          @click="saveToSd"
        >
          Save to SD card
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script>
import {DEFAULT_CONNECTION_ATTEMPTS, DEFAULT_RETRIES} from '../utils/harmony-cart';
import {lastSdFolder, listSdRoms, pickSdFolder, sdFolderSupported, writeSdFile} from '../utils/harmony-sd';
import {harmonyArmFileFor, harmonyImageFor, harmonyNeedsEncore, harmonySdExtensionFor} from '../utils/harmony-rom';
import {harmonyCartText, serialSupported, withHarmonyCart} from '../utils/harmony-serial';
import {addHarmonyArmFiles, clearHarmonyArmFiles, connectHarmonyCart, ensureHarmonyArmFile, useHarmonyArmFetch, useHarmonyArmFiles,
  useHarmonyCart, useHarmonyCartBusy} from '../hooks/harmony-cart';

// The HarmonyCart program's releases (version 2.0 and later, with its source), where its arm folder and BIOS files come from.
const HARMONY_SOFTWARE_URL = 'https://github.com/sa666666/harmonycart/releases';
// batari's 2600+ bankswitch files, in the AtariAge thread on the Harmony and the Atari 2600+ (F8.arm in one post, F6.arm and F4.arm
// in the next).
const PLUS_ARM_URLS = {
  f8: 'https://forums.atariage.com/topic/354381-new-atari-2600/?do=findComment&comment=5358194',
  f6f4: 'https://forums.atariage.com/topic/354381-new-atari-2600/?do=findComment&comment=5358283',
};
const SETTINGS_KEY = 'vcsgm-harmony-settings';

const loadJson = (key, fallback) => {
  try {
    const stored = JSON.parse(localStorage.getItem(key));
    return stored && typeof stored === 'object' ? stored : fallback;
  } catch (e) {
    return fallback;
  }
};

export default {
  name: 'HarmonyCartDialog',
  props: {
    // The built ROM's bytes (null before the first build).
    rom: {type: Uint8Array, default: null},
    configuration: {type: Object, default: () => ({})},
    // Why the ROM can not go on the cart (a PXE project), shown in the popup.
    disabledReason: {type: String, default: ''},
    // The ROM's file name without its extension (the project title and version, as Save ROM uses).
    romName: {type: String, default: 'rom'},
  },
  setup() {
    return {cartRef: useHarmonyCart(), busyRef: useHarmonyCartBusy(), armFilesRef: useHarmonyArmFiles(), armFetchRef: useHarmonyArmFetch()};
  },
  data() {
    return {
      open: false,
      serialOk: serialSupported(),
      harmonySoftwareUrl: HARMONY_SOFTWARE_URL,
      plusArmUrls: PLUS_ARM_URLS,
      settings: {
        mode: 'developer', verify: true, retries: DEFAULT_RETRIES,
        connectionAttempts: DEFAULT_CONNECTION_ATTEMPTS, delayAfterWrite: false, sdTarget: 'menu',
        ...loadJson(SETTINGS_KEY, {}),
      },
      writing: false,
      // The SD card's folder (utils/harmony-sd.js), the ROMs on it (null: not read, or unreadable) and whether it is being read.
      sdSupported: sdFolderSupported(),
      sdFolder: lastSdFolder(),
      sdRoms: null,
      sdLoading: false,
      // The BIOS files picked in the BIOS choice: {name, bytes} (not kept: picked again when needed).
      loaderFile: null,
      menuFile: null,
      searching: false,
      progress: 0,
      status: '',
      failed: false,
      log: [],
      abort: null,
    };
  },
  computed: {
    cart() {
      return this.cartRef;
    },
    cartText() {
      return this.cart ? harmonyCartText(this.cart) : '';
    },
    armFiles() {
      return this.armFilesRef;
    },
    armFetch() {
      return this.armFetchRef;
    },
    armNames() {
      return Object.keys(this.armFiles).sort();
    },
    armName() {
      if (!this.rom) return null;
      try {
        return harmonyArmFileFor(this.rom, this.configuration);
      } catch (e) {
        return null;
      }
    },
    armLoaded() {
      const wanted = (this.armName || '').toLowerCase();
      return this.armNames.some((name) => name.toLowerCase() === wanted);
    },
    romProblem() {
      if (!this.rom) return 'There is no built ROM yet: use "Update ROM" first.';
      try {
        harmonyArmFileFor(this.rom, this.configuration);
        return '';
      } catch (e) {
        return e.message;
      }
    },
    // What stops saving for the SD card ('' when nothing does): the SD card takes 64K ROMs too (for the Encore).
    sdProblem() {
      if (!this.rom) return 'There is no built ROM yet: use "Update ROM" first.';
      try {
        harmonySdExtensionFor(this.rom, this.configuration);
        return '';
      } catch (e) {
        return e.message;
      }
    },
    modeProblem() {
      return this.settings.mode === 'sd' ? this.sdProblem : this.romProblem;
    },
    needsEncore() {
      return harmonyNeedsEncore(this.rom, this.configuration);
    },
    sdFileName() {
      if (!this.rom) return '';
      try {
        const extension = harmonySdExtensionFor(this.rom, this.configuration);
        // (A single game for the 2600+ is found by its name, at the top of the card; the cart works out its type.)
        if (this.settings.sdTarget === 'single') return 'autorom.bin';
        return `${this.romName}.${extension}`;
      } catch (e) {
        return '';
      }
    },
    canWriteLoader() {
      return !!this.cart && !!this.loaderFile && !this.writing && !this.searching;
    },
    canWrite() {
      return !!this.cart && !this.romProblem && (!this.armName || this.armLoaded) && !this.writing && !this.searching;
    },
  },
  watch: {
    open(isOpen) {
      if (isOpen && this.settings.mode === 'sd') this.refreshSd();
      // (The ROM's bankswitch file, fetched if it is not there yet.)
      if (isOpen && this.armName) ensureHarmonyArmFile(this.armName);
    },
    armName(name) {
      if (this.open && name) ensureHarmonyArmFile(name);
    },
    'settings.mode'(mode) {
      if (this.open && mode === 'sd') this.refreshSd();
    },
  },
  methods: {
    saveSettings() {
      try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings));
      } catch (e) {
        // (Not kept for next time.)
      }
    },
    async handleArmFiles(event) {
      await addHarmonyArmFiles([...(event.target.files || [])]);
      event.target.value = '';
    },
    clearArmFiles() {
      clearHarmonyArmFiles();
    },
    // Write ROM (App.vue): opens the popup in developer mode and writes the ROM into the cart.
    writeNow() {
      this.settings.mode = 'developer';
      this.saveSettings();
      this.open = true;
      if (this.canWrite) this.write();
    },
    // Picks the cart's port (the browser's port chooser; the desktop app picks the USB serial port itself) and checks that a cart
    // answers on it. A browser keeps the choice, so the cart is found by itself after that.
    async connect() {
      this.searching = true;
      this.status = '';
      this.failed = false;
      try {
        const problem = await connectHarmonyCart();
        if (problem) {
          this.status = problem;
          this.failed = true;
        }
      } finally {
        this.searching = false;
      }
    },
    // Saves the ROM under its SD card name.
    saveToSd() {
      if (this.sdFileName) this.saveFile(this.rom, this.sdFileName);
    },
    // Saves the picked menu as hbios.bin (the name the cart's loader looks for on the SD card).
    saveMenu() {
      if (this.menuFile) this.saveFile(this.menuFile.bytes, 'hbios.bin');
    },
    async readPicked(event) {
      const file = (event.target.files || [])[0];
      event.target.value = '';
      return file ? {name: file.name, bytes: new Uint8Array(await file.arrayBuffer())} : null;
    },
    async handleLoaderFile(event) {
      const file = await this.readPicked(event);
      if (file) this.loaderFile = file;
    },
    async handleMenuFile(event) {
      const file = await this.readPicked(event);
      if (file) this.menuFile = file;
    },
    // Writes the picked loader into the cart's flash (as a ROM is in developer mode), which brings back the SD card menu.
    writeLoader() {
      if (!this.loaderFile) return;
      this.writeImage(this.loaderFile.bytes, 'The loader is written. The cart reads its SD card again.');
    },
    async pickSd() {
      this.status = '';
      this.failed = false;
      try {
        const folder = await pickSdFolder();
        if (!folder) return;
        this.sdFolder = folder;
        await this.refreshSd();
      } catch (e) {
        this.status = e.message || String(e);
        this.failed = true;
      }
    },
    async refreshSd() {
      if (!this.sdFolder) return;
      this.sdLoading = true;
      try {
        this.sdRoms = await listSdRoms(this.sdFolder);
      } finally {
        this.sdLoading = false;
      }
    },
    sizeText(bytes) {
      return bytes >= 1024 ? `${Math.round(bytes / 1024)} KB` : `${bytes} bytes`;
    },
    // Saves bytes under a name: straight onto the picked SD card, else a save dialog where the browser has one (Chrome, Edge), else
    // a download, which the desktop app shows a save dialog for.
    async saveFile(bytes, name) {
      this.status = '';
      this.failed = false;
      if (this.sdFolder) {
        try {
          const replacing = (this.sdRoms || []).some((item) => item.path.toLowerCase() === name.toLowerCase());
          await writeSdFile(this.sdFolder, name, bytes);
          this.status = `${replacing ? 'Replaced' : 'Saved'} ${name} on the SD card.`;
          await this.refreshSd();
        } catch (e) {
          this.status = e.message || String(e);
          this.failed = true;
        }
        return;
      }
      const blob = new Blob([bytes], {type: 'application/octet-stream'});
      if (window.showSaveFilePicker) {
        try {
          const handle = await window.showSaveFilePicker({suggestedName: name});
          const writable = await handle.createWritable();
          await writable.write(blob);
          await writable.close();
          this.status = `Saved ${handle.name}.`;
        } catch (e) {
          if (e && e.name !== 'AbortError') {
            this.status = e.message || String(e);
            this.failed = true;
          }
        }
        return;
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
    cancel() {
      if (this.abort) this.abort.abort();
    },
    async write() {
      if (this.armName && !(await ensureHarmonyArmFile(this.armName))) {
        this.status = `${this.armName} could not be fetched; add it with Add bankswitch files.`;
        this.failed = true;
        return;
      }
      let image;
      try {
        ({image} = harmonyImageFor(this.rom, this.configuration, this.armFiles));
      } catch (e) {
        this.status = e.message;
        this.failed = true;
        return;
      }
      this.writeImage(image, 'The cart now runs this ROM.');
    },
    // Writes an image into the cart's flash and starts it; done: the last words of the message when it worked.
    async writeImage(image, done) {
      this.log = [];
      this.status = '';
      this.failed = false;
      this.progress = 0;
      const {port} = this.cart;
      const options = {
        retries: Number(this.settings.retries) || DEFAULT_RETRIES,
        connectionAttempts: Number(this.settings.connectionAttempts) || DEFAULT_CONNECTION_ATTEMPTS,
        delayAfterWrite: !!this.settings.delayAfterWrite,
        log: (line) => this.log.push(line),
      };
      this.abort = new AbortController();
      const {signal} = this.abort;
      this.writing = true;
      this.busyRef = true;
      const started = Date.now();
      try {
        await withHarmonyCart(port, options, async (cart) => {
          await cart.write(image, {
            verify: !!this.settings.verify,
            signal,
            onProgress: (done, total) => {
              this.progress = total ? Math.round((done / total) * 100) : 0;
            },
          });
          await cart.run();
        });
        this.progress = 100;
        this.status = `Written in ${Math.round((Date.now() - started) / 1000)} seconds. ${done}`;
      } catch (e) {
        this.status = e.message || String(e);
        this.failed = true;
      } finally {
        this.writing = false;
        this.busyRef = false;
        this.abort = null;
      }
    },
  },
};
</script>

<style scoped>
/* The yin-yang, as big as the font icons beside it. */
.harmony-cart-icon svg {
  width: 1em;
  height: 1em;
}
.harmony-cart-text {
  font-size: 14px;
}
.harmony-cart-line {
  margin-top: 4px;
}
.harmony-cart-fields {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  margin-top: 8px;
}
.harmony-cart-file-input {
  display: none;
}
.harmony-cart-note {
  font-size: 12px;
  opacity: 0.75;
}
.harmony-cart-sd-list {
  margin-top: 4px;
  max-height: 180px;
  overflow-y: auto;
  border: 1px solid rgba(128, 128, 128, 0.3);
  border-radius: 4px;
  font-size: 13px;
}
.harmony-cart-sd-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 2px 8px;
}
.harmony-cart-sd-this {
  font-weight: bold;
}
.harmony-cart-sd-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.harmony-cart-sd-size {
  flex-shrink: 0;
  opacity: 0.7;
}
.harmony-cart-log {
  margin-top: 8px;
  max-height: 140px;
  overflow-y: auto;
  font-family: monospace;
  font-size: 12px;
}
</style>
