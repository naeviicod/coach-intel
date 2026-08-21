const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const notes = fs.readFileSync(path.join(root, 'src', 'renderer', 'pages', 'teamHub', 'sections', 'notes.js'), 'utf8');
const app = fs.readFileSync(path.join(root, 'src', 'renderer', 'app.js'), 'utf8');

test('team notes expose attachments and protect an active shared draft', () => {
  assert.match(notes, /attachNoteImage/);
  assert.match(notes, /Reload newer version/);
  assert.match(notes, /updated_by/);
  assert.match(notes, /debounceSave/);
  assert.match(app, /cci:remote-data-change/);
  assert.match(app, /event\.defaultPrevented/);
});
