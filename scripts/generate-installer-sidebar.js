const fs = require('node:fs');
const path = require('node:path');
const { PNG } = require('pngjs');

const root = path.join(__dirname, '..');
const WIDTH = 164;
const HEIGHT = 314;
const BACKGROUND = [13, 17, 19];
const SLOTS = [
  { label: 'Coach Intel', path: path.join(root, 'build', 'icon.png'), x: 52, y: 16, width: 60, height: 60 },
  { label: 'organization', selected: 'organization', x: 27, y: 86, width: 110, height: 110 },
  { label: 'team', selected: 'team', x: 32, y: 203, width: 100, height: 100 },
];

function parseArguments(argv) {
  const valueFor = (flag, fallback) => {
    const index = argv.indexOf(flag);
    if (index === -1) return fallback;
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`${flag} requires a path.`);
    return path.resolve(value);
  };

  return {
    configPath: valueFor('--config', path.join(root, 'build', 'installer-brand', 'selection.json')),
    outputPath: valueFor('--output', path.join(root, 'build', 'installerSidebar.bmp')),
  };
}

function readSelection(configPath) {
  let selection;
  try {
    selection = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (error) {
    throw new Error(`Unable to read installer brand selection: ${configPath} (${error.message})`);
  }

  for (const key of ['organization', 'team']) {
    const item = selection?.[key];
    if (!item || typeof item.name !== 'string' || !item.name.trim() || typeof item.logo !== 'string' || !item.logo.trim()) {
      throw new Error(`Installer brand selection requires ${key}.name and ${key}.logo.`);
    }
  }
  return selection;
}

function readLogo(filePath, label) {
  try {
    const image = PNG.sync.read(fs.readFileSync(filePath));
    if (!image.width || !image.height) throw new Error('image has no pixels');
    return image;
  } catch (error) {
    throw new Error(`Unable to read selected ${label} logo: ${filePath} (${error.message})`);
  }
}

function drawContained(canvas, image, slot) {
  const scale = Math.min(slot.width / image.width, slot.height / image.height);
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const left = slot.x + Math.floor((slot.width - width) / 2);
  const top = slot.y + Math.floor((slot.height - height) / 2);

  for (let y = 0; y < height; y++) {
    const targetY = top + y;
    if (targetY < 0 || targetY >= HEIGHT) continue;
    const sourceY = Math.min(image.height - 1, Math.floor((y * image.height) / height));
    for (let x = 0; x < width; x++) {
      const targetX = left + x;
      if (targetX < 0 || targetX >= WIDTH) continue;
      const sourceX = Math.min(image.width - 1, Math.floor((x * image.width) / width));
      const source = ((sourceY * image.width) + sourceX) * 4;
      const target = ((targetY * WIDTH) + targetX) * 3;
      const alpha = image.data[source + 3] / 255;
      for (let channel = 0; channel < 3; channel++) {
        canvas[target + channel] = Math.round((image.data[source + channel] * alpha) + (canvas[target + channel] * (1 - alpha)));
      }
    }
  }
}

function encodeTopDownBmp(canvas) {
  const rowStride = Math.ceil((WIDTH * 3) / 4) * 4;
  const pixelBytes = rowStride * HEIGHT;
  const output = Buffer.alloc(54 + pixelBytes);
  output.write('BM', 0, 'ascii');
  output.writeUInt32LE(output.length, 2);
  output.writeUInt32LE(54, 10);
  output.writeUInt32LE(40, 14);
  output.writeInt32LE(WIDTH, 18);
  output.writeInt32LE(-HEIGHT, 22);
  output.writeUInt16LE(1, 26);
  output.writeUInt16LE(24, 28);
  output.writeUInt32LE(pixelBytes, 34);
  output.writeInt32LE(3780, 38);
  output.writeInt32LE(3780, 42);

  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      const source = ((y * WIDTH) + x) * 3;
      const target = 54 + (y * rowStride) + (x * 3);
      output[target] = canvas[source + 2];
      output[target + 1] = canvas[source + 1];
      output[target + 2] = canvas[source];
    }
  }
  return output;
}

function generateSidebar({ configPath, outputPath }) {
  const selection = readSelection(configPath);
  const selectionDir = path.dirname(configPath);
  const canvas = Buffer.alloc(WIDTH * HEIGHT * 3);
  for (let offset = 0; offset < canvas.length; offset += 3) canvas.set(BACKGROUND, offset);

  for (const slot of SLOTS) {
    const selected = slot.selected ? selection[slot.selected] : null;
    const imagePath = selected ? path.resolve(selectionDir, selected.logo) : slot.path;
    drawContained(canvas, readLogo(imagePath, slot.label), slot);
  }

  const temporary = `${outputPath}.tmp`;
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  try {
    fs.writeFileSync(temporary, encodeTopDownBmp(canvas));
    fs.renameSync(temporary, outputPath);
  } finally {
    fs.rmSync(temporary, { force: true });
  }

  return {
    organizationName: selection.organization.name,
    teamName: selection.team.name,
    width: WIDTH,
    height: HEIGHT,
  };
}

if (require.main === module) {
  try {
    const result = generateSidebar(parseArguments(process.argv.slice(2)));
    console.log(`Generated ${result.width}x${result.height} installer sidebar for ${result.organizationName} / ${result.teamName}.`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { encodeTopDownBmp, generateSidebar, parseArguments, readSelection };
