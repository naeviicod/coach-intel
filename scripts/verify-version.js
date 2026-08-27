const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const desktop = require(path.join(root, 'package.json'));
const web = require(path.join(root, 'web', 'package.json'));

if (desktop.version !== web.version) {
  throw new Error(`Desktop version ${desktop.version} does not match web version ${web.version}.`);
}

for (const relative of [
  'src/renderer/index.html',
  'src/renderer/pages/settings/sections/about.js',
  'web/components/desktop-shell.js',
  'web/components/settings-sections.js',
]) {
  const content = fs.readFileSync(path.join(root, relative), 'utf8');
  if (!content.includes(desktop.version)) {
    throw new Error(`${relative} does not contain authoritative version ${desktop.version}.`);
  }
}

console.log(`Coach Intel release version ${desktop.version} is consistent.`);
