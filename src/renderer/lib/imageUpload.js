// Every org logo, team logo, and profile/player photo goes through here on
// its way in. The OS file picker hands back whatever the person chose —
// often a multi-megabyte phone photo or an untouched export — so this
// downsizes it and re-encodes as WebP on a <canvas> before it ever touches
// disk or gets synced to cloud storage. A data: URL source (not file://)
// keeps the canvas untainted so toBlob() can actually read it back.
const MAX_DIMENSION = 512;
const WEBP_QUALITY = 0.86;

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not read that image.'));
    img.src = src;
  });
}

function fitWithin(width, height, max) {
  if (width <= max && height <= max) return { width, height };
  const scale = max / Math.max(width, height);
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

// Returns an ArrayBuffer of WebP bytes for an already-known file path.
export async function compressImageFromPath(sourcePath, { maxDimension = MAX_DIMENSION, quality = WEBP_QUALITY } = {}) {
  const dataUrl = await window.cci.readImageAsDataUrl(sourcePath);
  const img = await loadImage(dataUrl);
  const { width, height } = fitWithin(img.naturalWidth, img.naturalHeight, maxDimension);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d').drawImage(img, 0, 0, width, height);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', quality));
  if (!blob) throw new Error('Could not encode that image.');
  return blob.arrayBuffer();
}

// Returns an ArrayBuffer of WebP bytes, or null if the user cancelled the picker.
export async function pickAndCompressImage(opts) {
  const sourcePath = await window.cci.pickImage();
  if (!sourcePath) return null;
  return compressImageFromPath(sourcePath, opts);
}
