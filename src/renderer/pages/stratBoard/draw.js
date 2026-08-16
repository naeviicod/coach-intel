export const DRAW_COLOR = '#b6f542';

export function paintDrawings(cx, drawings, w, h) {
  cx.clearRect(0, 0, w, h);
  cx.lineCap = 'round';
  cx.lineJoin = 'round';
  for (const d of drawings) paintOne(cx, d, w, h);
}

export function paintOne(cx, d, w, h) {
  const color = d.color || DRAW_COLOR;
  cx.strokeStyle = color;
  cx.fillStyle = color;
  cx.lineWidth = 2.5;

  if (d.type === 'path' && d.points?.length > 1) {
    cx.beginPath();
    d.points.forEach(([x, y], i) => {
      const px = x * w;
      const py = y * h;
      if (i === 0) cx.moveTo(px, py);
      else cx.lineTo(px, py);
    });
    cx.stroke();
    return;
  }

  if (d.type === 'arrow' || d.type === 'line') {
    const fx = d.from[0] * w;
    const fy = d.from[1] * h;
    const tx = d.to[0] * w;
    const ty = d.to[1] * h;
    cx.beginPath();
    cx.moveTo(fx, fy);
    cx.lineTo(tx, ty);
    cx.stroke();
    if (d.type === 'arrow') {
      const angle = Math.atan2(ty - fy, tx - fx);
      cx.beginPath();
      cx.moveTo(tx, ty);
      cx.lineTo(tx - 10 * Math.cos(angle - 0.4), ty - 10 * Math.sin(angle - 0.4));
      cx.lineTo(tx - 10 * Math.cos(angle + 0.4), ty - 10 * Math.sin(angle + 0.4));
      cx.closePath();
      cx.fill();
    }
    return;
  }

  if (d.type === 'zone') {
    cx.beginPath();
    cx.arc(d.cx * w, d.cy * h, d.r * Math.min(w, h), 0, Math.PI * 2);
    cx.globalAlpha = 0.16;
    cx.fill();
    cx.globalAlpha = 1;
    cx.stroke();
    return;
  }

  if (d.type === 'rect') {
    const x = Math.min(d.a[0], d.b[0]) * w;
    const y = Math.min(d.a[1], d.b[1]) * h;
    const rw = Math.abs(d.b[0] - d.a[0]) * w;
    const rh = Math.abs(d.b[1] - d.a[1]) * h;
    cx.globalAlpha = 0.14;
    cx.fillRect(x, y, rw, rh);
    cx.globalAlpha = 1;
    cx.strokeRect(x, y, rw, rh);
    return;
  }

  if (d.type === 'pin') {
    const x = d.x * w;
    const y = d.y * h;
    cx.beginPath();
    cx.moveTo(x, y);
    cx.lineTo(x - 6, y - 16);
    cx.lineTo(x + 6, y - 16);
    cx.closePath();
    cx.fill();
    cx.beginPath();
    cx.arc(x, y - 18, 5, 0, Math.PI * 2);
    cx.fill();
    if (d.text) {
      cx.font = '600 12px -apple-system, sans-serif';
      cx.fillText(d.text, x + 8, y - 14);
    }
    return;
  }

  if (d.type === 'text') {
    cx.font = '600 13px -apple-system, sans-serif';
    cx.fillText(d.text, d.x * w, d.y * h);
  }
}

export function hitDrawingIndex(drawings, x, y, threshold = 0.03) {
  let best = -1;
  let bestD = threshold;
  drawings.forEach((d, i) => {
    const dist = distanceToDrawing(d, x, y);
    if (dist < bestD) {
      bestD = dist;
      best = i;
    }
  });
  return best;
}

function distanceToDrawing(d, x, y) {
  if (d.type === 'path' && d.points?.length) {
    let min = 1;
    for (let i = 1; i < d.points.length; i++) {
      min = Math.min(min, distToSeg(x, y, d.points[i - 1], d.points[i]));
    }
    return min;
  }
  if ((d.type === 'arrow' || d.type === 'line') && d.from && d.to) {
    return distToSeg(x, y, d.from, d.to);
  }
  if (d.type === 'zone') {
    return Math.abs(Math.hypot(x - d.cx, y - d.cy) - d.r);
  }
  if (d.type === 'rect' && d.a && d.b) {
    const left = Math.min(d.a[0], d.b[0]);
    const right = Math.max(d.a[0], d.b[0]);
    const top = Math.min(d.a[1], d.b[1]);
    const bottom = Math.max(d.a[1], d.b[1]);
    const inside = x >= left && x <= right && y >= top && y <= bottom;
    if (inside) return 0;
    return Math.min(
      Math.abs(x - left),
      Math.abs(x - right),
      Math.abs(y - top),
      Math.abs(y - bottom)
    );
  }
  if (d.type === 'text' || d.type === 'pin') {
    return Math.hypot(x - d.x, y - d.y);
  }
  return 1;
}

function distToSeg(x, y, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = dx * dx + dy * dy;
  if (!len) return Math.hypot(x - a[0], y - a[1]);
  const t = Math.min(1, Math.max(0, ((x - a[0]) * dx + (y - a[1]) * dy) / len));
  return Math.hypot(x - (a[0] + t * dx), y - (a[1] + t * dy));
}
