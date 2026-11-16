'use strict';

import {BAUD_RATE, HarmonyCart} from './harmony-cart';

// The Web Serial side of the Harmony Cart writer (utils/harmony-cart.js has the protocol). Web Serial is in Chrome, Edge and the
// desktop app (Electron; background.js lets the page see the serial ports).

export const serialSupported = () => typeof navigator !== 'undefined' && !!navigator.serial;

// USB serial chips a Harmony Cart may use (FTDI on the mini USB carts, WCH CH340/CH341 on the micro USB ones, Silicon Labs). Only ports with one of these, or the one a cart was last found on, are
// tried by themselves: trying a port resets what is on it through its DTR and RTS lines.
const LIKELY_VENDORS = [0x0403, 0x1A86, 0x10C4];
const LAST_PORT_KEY = 'vcsgm-harmony-port';

const portKey = (port) => {
  const info = port.getInfo ? port.getInfo() : {};
  return info.usbVendorId === undefined ? null : `${info.usbVendorId}:${info.usbProductId}`;
};

// The cart's USB connection, from its USB serial chip: the micro USB carts (newer Harmony and Harmony Encore boards) have a WCH
// CH340, the mini USB ones an FTDI chip (AtariAge's Harmony forum, the drivers for each).
const USB_CHIPS = {
  0x1A86: 'micro USB (CH340)',
  0x0403: 'mini USB (FTDI)',
  0x10C4: 'USB (Silicon Labs)',
};

export const portLabel = (port) => {
  const info = port.getInfo ? port.getInfo() : {};
  if (info.usbVendorId === undefined) return 'serial port';
  const hex = (v) => v.toString(16).toUpperCase().padStart(4, '0');
  return USB_CHIPS[info.usbVendorId] || `USB serial ${hex(info.usbVendorId)}:${hex(info.usbProductId)}`;
};

// What a found cart is ({port, part, label}, see findHarmonyCart), as one line: the chip and its memory, and the USB connection.
// (Not the model: the Harmony, the Harmony Encore and the Concerto all have the LPC2103 and report the same part number.)
export const harmonyCartText = (cart) => {
  const {part} = cart;
  return `${part.name}, ${part.flashKb} KB flash, ${part.ramKb} KB RAM, ${cart.label}`;
};

const rememberPort = (port) => {
  try {
    const key = portKey(port);
    if (key) localStorage.setItem(LAST_PORT_KEY, key);
  } catch (e) {
    // (Nothing remembered.)
  }
};

const isLikelyCart = (port) => {
  const info = port.getInfo ? port.getInfo() : {};
  let last = null;
  try {
    last = localStorage.getItem(LAST_PORT_KEY);
  } catch (e) {
    // (Nothing remembered.)
  }
  return LIKELY_VENDORS.includes(info.usbVendorId) || (!!last && portKey(port) === last);
};

/**
 * A link (see utils/harmony-cart.js) over an open Web Serial port.
 */
class WebSerialLink {
  /**
   * port: a Web Serial port, not open yet.
   * @param {SerialPort} port
   */
  constructor(port) {
    this.port = port;
    this.text = '';
    this.waiters = [];
    this.reader = null;
    this.writer = null;
    this.closed = false;
  }

  /**
   * Opens the port at the cart's baud rate and starts reading.
   */
  async open() {
    await this.port.open({baudRate: BAUD_RATE, dataBits: 8, stopBits: 1, parity: 'none', flowControl: 'none'});
    this.writer = this.port.writable.getWriter();
    this.reading = this.readLoop();
  }

  /**
   * Keeps what arrives in this.text and wakes whatever waits for it.
   */
  async readLoop() {
    while (!this.closed && this.port.readable) {
      this.reader = this.port.readable.getReader();
      try {
        for (;;) {
          const {value, done} = await this.reader.read();
          if (done) break;
          let chunk = '';
          for (let i = 0; i < value.length; i++) chunk += String.fromCharCode(value[i]);
          this.text += chunk;
          this.waiters.forEach((wake) => wake());
        }
      } catch (e) {
        // A framing or parity error ends the read; the loop starts a new one.
        if (this.closed) break;
      } finally {
        this.reader.releaseLock();
        this.reader = null;
      }
    }
  }

  /**
   * Drops what has arrived so far.
   */
  clear() {
    this.text = '';
  }

  /**
   * Waits ms milliseconds.
   * @param {number} ms
   * @return {Promise<void>}
   */
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Sends a string (one byte a character) or bytes.
   * @param {string|Uint8Array} data
   */
  async write(data) {
    let bytes = data;
    if (typeof data === 'string') {
      bytes = new Uint8Array(data.length);
      for (let i = 0; i < data.length; i++) bytes[i] = data.charCodeAt(i) & 0xFF;
    }
    await this.writer.write(bytes);
  }

  /**
   * Sets the DTR and RTS lines (true is set).
   * @param {boolean} dtr
   * @param {boolean} rts
   */
  async setModemLines(dtr, rts) {
    await this.port.setSignals({dataTerminalReady: dtr, requestToSend: rts});
  }

  /**
   * Waits until test(received) gives {value, end} (see utils/harmony-cart.js), or null after ms.
   * @param {Function} test
   * @param {number} ms
   * @return {Promise<*>}
   */
  waitFor(test, ms) {
    return new Promise((resolve) => {
      let timer = null;
      const check = () => {
        const result = test(this.text);
        if (!result) return false;
        this.text = this.text.slice(result.end);
        finish(result.value);
        return true;
      };
      const finish = (value) => {
        clearTimeout(timer);
        this.waiters = this.waiters.filter((wake) => wake !== wakeUp);
        resolve(value);
      };
      const wakeUp = () => check();
      if (check()) return;
      this.waiters.push(wakeUp);
      timer = setTimeout(() => finish(null), ms);
    });
  }

  /**
   * Stops reading and closes the port.
   */
  async close() {
    this.closed = true;
    try {
      if (this.reader) await this.reader.cancel();
    } catch (e) {
      // (Already gone.)
    }
    try {
      await this.reading;
    } catch (e) {
      // (Already gone.)
    }
    try {
      if (this.writer) this.writer.releaseLock();
    } catch (e) {
      // (Already released.)
    }
    try {
      await this.port.close();
    } catch (e) {
      // (The cart was unplugged.)
    }
  }
}

// Opens the port, runs work(cart) with a connected HarmonyCart, then lets the cart run its program and closes the port.
export const withHarmonyCart = async (port, options, work) => {
  const link = new WebSerialLink(port);
  await link.open();
  const cart = new HarmonyCart(link, options);
  try {
    await cart.connect();
    rememberPort(port);
    return await work(cart);
  } finally {
    try {
      await cart.resetInto(false);
    } catch (e) {
      // (The cart was unplugged.)
    }
    await link.close();
  }
};

// The first port with a Harmony Cart on it: {port, part, label}, or null. Only likely ports are tried (see isLikelyCart).
export const findHarmonyCart = async (options = {}) => {
  if (!serialSupported()) return null;
  const ports = (await navigator.serial.getPorts()).filter(isLikelyCart);
  for (const port of ports) {
    try {
      const part = await withHarmonyCart(port, options, async (cart) => cart.part);
      return {port, part, label: portLabel(port)};
    } catch (e) {
      // Not a cart (or busy): the next one.
    }
  }
  return null;
};

// Asks for a port (the browser's port chooser; the desktop app picks the USB serial port itself, see background.js) and looks for a
// cart on it: {port, part, label}. A browser keeps the choice, so the cart is then found by itself next time. Has to run from a
// click. Throws when no port was picked or no cart answered.
export const pickHarmonyCart = async (options = {}) => {
  if (!serialSupported()) throw new Error('This browser can not use serial ports: use Chrome or Edge, or the desktop app.');
  const port = await navigator.serial.requestPort();
  const part = await withHarmonyCart(port, options, async (cart) => cart.part);
  return {port, part, label: portLabel(port)};
};
