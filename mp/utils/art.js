import { pngDataURL } from './png.js';

export const rgbOf = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
export const lum = ([r, g, b]) => 0.299 * r + 0.587 * g + 0.114 * b;
export const inkOf = hex => (lum(rgbOf(hex)) > 150 ? '#222' : '#fff');

// Color of one cell: filled = its color, unfilled = faint grey of the photo, selected number = dark grey.
export function shader(palette, sel) {
  const rgb = palette.map(rgbOf);
  const ghost = rgb.map(c => { const v = 255 - (255 - lum(c)) * 0.5; return [v, v, v]; });
  return (c, filled) => (filled ? rgb[c] : c === sel ? [150, 150, 158] : ghost[c]);
}

// Into an RGBA buffer (w*h*4) for putImageData.
export function paintRGBA(out, palette, cells, filled, sel) {
  const col = shader(palette, sel);
  for (let i = 0; i < cells.length; i++) {
    const [r, g, b] = col(cells[i], filled[i]);
    out[i * 4] = r; out[i * 4 + 1] = g; out[i * 4 + 2] = b; out[i * 4 + 3] = 255;
  }
}

// ~240px PNG of the current progress, nearest-neighbor so pixels stay crisp.
export function thumbnail(w, h, palette, cells, filled) {
  const long = Math.max(w, h), up = Math.max(1, Math.floor(240 / long)), down = Math.max(1, Math.ceil(long / 240));
  const tw = Math.ceil(w * up / down), th = Math.ceil(h * up / down), col = shader(palette, -1);
  const rgb = new Uint8Array(tw * th * 3);
  for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) {
    const i = Math.min(h - 1, ((y * down / up) | 0)) * w + Math.min(w - 1, ((x * down / up) | 0));
    rgb.set(col(cells[i], filled[i]), (y * tw + x) * 3);
  }
  return pngDataURL(rgb, tw, th);
}
