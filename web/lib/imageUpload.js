'use client';

// Member photos come straight from a <input type="file"> — often an
// untouched phone photo or screenshot, several megabytes. Downsize and
// re-encode as WebP on a <canvas> before it ever reaches Storage, so every
// place that displays it (rosters, dashboards) loads fast. Object URLs are
// same-origin for canvas purposes, so this never hits a taint error.
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

// Returns a WebP File (falls back to the original file if compression fails
// for any reason — e.g. an unsupported source format — so an upload never
// hard-fails over an optimization).
export async function compressImageFile(file, { maxDimension = MAX_DIMENSION, quality = WEBP_QUALITY } = {}) {
  if (!file) return file;
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await loadImage(objectUrl);
    const { width, height } = fitWithin(img.naturalWidth, img.naturalHeight, maxDimension);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d').drawImage(img, 0, 0, width, height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', quality));
    if (!blob) return file;
    const name = file.name ? file.name.replace(/\.[^.]+$/, '.webp') : 'photo.webp';
    return new File([blob], name, { type: 'image/webp' });
  } catch {
    return file;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
