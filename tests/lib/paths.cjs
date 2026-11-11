// The paths the tests use: the repo (REPO, with a slash at the end), where they write what they make (OUT: tests/out, or TEST_OUT) and the
// Chrome they drive (CHROME, or the first one found).
const fs = require('fs');
const path = require('path');
const REPO = path.resolve(__dirname, '..', '..').replace(/\\/g, '/') + '/';
const OUT = (process.env.TEST_OUT || REPO + 'tests/out').replace(/\\/g, '/');
fs.mkdirSync(OUT, {recursive: true});
const CHROME = process.env.CHROME || ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium', '/usr/bin/chromium-browser', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find((p) => fs.existsSync(p));
module.exports = {REPO, OUT, CHROME};
