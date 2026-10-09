import { paintRGBA, inkOf, thumbnail } from '../../utils/art.js';
import * as store from '../../utils/store.js';

// Page-level state (one play page at a time).
let cv, ctx, W = 0, H = 0, base, baseCtx, cur, s = 1, tx = 0, ty = 0, queued = false, g = null, saveTimer = 0, page;

const hexToHsl = hex => {
  const [r, gg, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, gg, b), min = Math.min(r, gg, b), l = (max + min) / 2, d = max - min;
  if (!d) return [0, 0, Math.round(l * 100)];
  const sat = d / (1 - Math.abs(2 * l - 1));
  const h = max === r ? ((gg - b) / d + 6) % 6 : max === gg ? (b - r) / d + 2 : (r - gg) / d + 4;
  return [Math.round(h * 60), Math.round(sat * 100), Math.round(l * 100)];
};
const hslToHex = ([h, sat, l]) => {
  sat /= 100; l /= 100;
  const a = sat * Math.min(l, 1 - l), f = n => { const k = (n + h / 30) % 12; return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
  return '#' + [f(0), f(8), f(4)].map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('');
};

function rebuild() {
  const im = baseCtx.createImageData(cur.w, cur.h);
  paintRGBA(im.data, cur.palette, cur.cells, cur.filled, cur.sel);
  baseCtx.putImageData(im, 0, 0);
}

function draw() {
  if (queued || !cv) return;
  queued = true;
  cv.requestAnimationFrame(() => {
    queued = false;
    ctx.fillStyle = '#e8dfc9';
    ctx.fillRect(0, 0, W, H);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(base, tx, ty, cur.w * s, cur.h * s);
    if (s < 6) return;
    const x0 = Math.max(0, Math.floor(-tx / s)), x1 = Math.min(cur.w, Math.ceil((W - tx) / s));
    const y0 = Math.max(0, Math.floor(-ty / s)), y1 = Math.min(cur.h, Math.ceil((H - ty) / s));
    ctx.beginPath();
    for (let x = x0; x <= x1; x++) { ctx.moveTo(tx + x * s, ty + y0 * s); ctx.lineTo(tx + x * s, ty + y1 * s); }
    for (let y = y0; y <= y1; y++) { ctx.moveTo(tx + x0 * s, ty + y * s); ctx.lineTo(tx + x1 * s, ty + y * s); }
    ctx.strokeStyle = 'rgba(0,0,0,.12)';
    ctx.lineWidth = 1;
    ctx.stroke();
    if (s < 16) return; // ponytail: redraws every visible number per frame; cache a text layer if pinch stutters
    ctx.font = `${Math.round(s * (s > 30 ? 0.42 : 0.5))}px sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const i = y * cur.w + x;
      if (cur.filled[i]) continue;
      ctx.fillStyle = cur.cells[i] === cur.sel ? '#fff' : '#77736b';
      ctx.fillText(String(cur.cells[i] + 1), tx + (x + 0.5) * s, ty + (y + 0.5) * s);
    }
  });
}

function fit() {
  s = Math.min(W / cur.w, H / cur.h) * 0.95;
  tx = (W - cur.w * s) / 2; ty = (H - cur.h * s) / 2;
  draw();
}

function zoomAt(px, py, f) {
  const ns = Math.min(Math.max(s * f, Math.min(W / cur.w, H / cur.h) * 0.5), 80);
  tx = px - (px - tx) * ns / s; ty = py - (py - ty) * ns / s; s = ns;
  draw();
}

function fillCell(x, y) {
  if (x < 0 || y < 0 || x >= cur.w || y >= cur.h) return;
  const i = y * cur.w + x;
  if (cur.filled[i] || cur.cells[i] !== cur.sel) return;
  cur.filled[i] = 1;
  baseCtx.fillStyle = cur.palette[cur.sel];
  baseCtx.fillRect(x, y, 1, 1);
  cur.left[cur.sel]--;
  cur.done++;
}

function stamp(x, y) {
  const r = (cur.size - 1) / 2, R = Math.ceil(r);
  for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
    if (dx * dx + dy * dy <= (r + 0.5) ** 2) fillCell(x + dx, y + dy);
  }
}

function bucket(x, y) {
  if (x < 0 || y < 0 || x >= cur.w || y >= cur.h) return;
  const i0 = y * cur.w + x, c = cur.cells[i0];
  if (c !== cur.sel || cur.filled[i0]) return;
  const seen = new Uint8Array(cur.w * cur.h), stack = [i0];
  seen[i0] = 1;
  while (stack.length) {
    const i = stack.pop(), cx = i % cur.w, cy = (i / cur.w) | 0;
    fillCell(cx, cy);
    for (const [nx, ny] of [[cx - 1, cy], [cx + 1, cy], [cx, cy - 1], [cx, cy + 1]]) {
      const j = ny * cur.w + nx;
      if (nx >= 0 && ny >= 0 && nx < cur.w && ny < cur.h && !seen[j] && cur.cells[j] === c && !cur.filled[j]) { seen[j] = 1; stack.push(j); }
    }
  }
}

function changed() {
  page.setData({ done: cur.done, blocks: Math.floor(cur.done / cur.filled.length * 20) });
  clearTimeout(saveTimer);
  saveTimer = setTimeout(save, 800);
  draw();
}

function save() {
  clearTimeout(saveTimer);
  if (!cur) return;
  store.writeBin(`f-${cur.id}`, cur.filled);
  store.putMeta({ ...cur.meta, palette: cur.palette, done: cur.done, thumb: thumbnail(cur.w, cur.h, cur.palette, cur.cells, cur.filled) });
}

function select(k) {
  cur.sel = k;
  rebuild();
  page.setData({ sel: k, left: cur.left.slice(), hsl: hexToHsl(cur.palette[k]) });
  draw();
}

function nextIfDone() {
  if (cur.left[cur.sel]) return;
  const next = cur.left.findIndex(n => n > 0);
  if (next >= 0) select(next);
  else { select(cur.sel); wx.showToast({ title: '整幅画完成了！', icon: 'none' }); }
}

// ---- gestures: one finger paints (drag = line), two fingers pan + pinch; bucket: tap fills, drag pans ----
const pt = t => ({ x: t.x, y: t.y });
const cellAt = p => [Math.floor((p.x - tx) / s), Math.floor((p.y - ty) / s)];
function paintTo(p) {
  const [x, y] = cellAt(p), [lx, ly] = g.last || [x, y];
  const n = Math.max(Math.abs(x - lx), Math.abs(y - ly));
  for (let k = 1; k <= n; k++) stamp(Math.round(lx + (x - lx) * k / n), Math.round(ly + (y - ly) * k / n));
  stamp(x, y);
  g.last = [x, y];
  changed();
}
function startPaint() {
  if (!g || g.multi || g.painting) return;
  clearTimeout(g.timer);
  g.painting = true;
  paintTo(g.start);
}

Page({
  data: { palette: [], inks: [], left: [], sel: 0, done: 0, total: 0, blocks: 0, tool: 'brush', size: 1, recolor: false, hsl: [0, 0, 0] },

  onLoad({ id }) {
    page = this;
    const meta = store.metas().find(m => m.id === id);
    const cells = store.readBin(`c-${id}`), filled = store.readBin(`f-${id}`);
    const left = meta.palette.map(() => 0);
    cells.forEach((c, i) => filled[i] || left[c]++);
    cur = { id, meta, w: meta.w, h: meta.h, palette: meta.palette.slice(), cells, filled, left, done: filled.reduce((a, b) => a + b, 0), sel: 0, size: 1 };
    this.setData({ palette: cur.palette, inks: cur.palette.map(inkOf), total: cells.length, done: cur.done, blocks: Math.floor(cur.done / cells.length * 20), left: left.slice() });
  },

  onReady() {
    wx.createSelectorQuery().select('#c').fields({ node: true, size: true }).exec(([r]) => {
      const dpr = wx.getWindowInfo().pixelRatio;
      cv = r.node; W = r.width; H = r.height;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      ctx = cv.getContext('2d');
      ctx.scale(dpr, dpr);
      base = wx.createOffscreenCanvas({ type: '2d', width: cur.w, height: cur.h });
      baseCtx = base.getContext('2d');
      fit();
      select(Math.max(0, cur.left.findIndex(n => n > 0)));
    });
  },

  onHide() { save(); },
  onUnload() { save(); cur = null; cv = null; },

  pick(e) { select(+e.currentTarget.dataset.k); },
  setTool(e) { this.setData({ tool: e.currentTarget.dataset.t, recolor: false }); },
  onSize(e) { cur.size = Math.min(25, Math.max(1, cur.size + +e.currentTarget.dataset.d)); this.setData({ size: cur.size }); },
  toggleRecolor() { this.setData({ recolor: !this.data.recolor, hsl: hexToHsl(cur.palette[cur.sel]) }); },

  // Recolor the selected number: live while dragging, saved on release.
  onHsl(e) {
    const hsl = this.data.hsl.slice();
    hsl[+e.currentTarget.dataset.i] = e.detail.value;
    const hex = hslToHex(hsl);
    cur.palette[cur.sel] = hex;
    this.setData({ hsl, [`palette[${cur.sel}]`]: hex, [`inks[${cur.sel}]`]: inkOf(hex) });
    rebuild();
    draw();
  },
  onHslDone(e) { this.onHsl(e); save(); },

  ts(e) {
    const t = e.touches;
    if (t.length === 1 && !g) {
      g = { start: pt(t[0]), prev: [pt(t[0])], painting: false, multi: false, moved: false, last: null };
      if (this.data.tool === 'brush') g.timer = setTimeout(startPaint, 90);
    } else if (g && t.length >= 2 && !g.painting) {
      g.multi = true;
      clearTimeout(g.timer);
      g.prev = [pt(t[0]), pt(t[1])];
    }
  },

  tm(e) {
    if (!g) return;
    const t = e.touches;
    if (g.multi) {
      if (t.length < 2) return;
      const [a, b] = g.prev, c = pt(t[0]), d = pt(t[1]);
      if (!b) { g.prev = [c, d]; return; }
      tx += (c.x + d.x - a.x - b.x) / 2; ty += (c.y + d.y - a.y - b.y) / 2;
      zoomAt((c.x + d.x) / 2, (c.y + d.y) / 2, Math.hypot(c.x - d.x, c.y - d.y) / Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)));
      g.prev = [c, d];
      return;
    }
    const q = pt(t[0]);
    if (this.data.tool === 'bucket') {
      if (Math.hypot(q.x - g.start.x, q.y - g.start.y) > 6) g.moved = true;
      if (g.moved) { tx += q.x - g.prev[0].x; ty += q.y - g.prev[0].y; draw(); }
      g.prev = [q];
      return;
    }
    if (!g.painting && Math.hypot(q.x - g.start.x, q.y - g.start.y) > 4) startPaint();
    if (g.painting) paintTo(q);
  },

  te(e) {
    if (!g || e.touches.length) return;
    if (!g.multi && this.data.tool === 'bucket' && !g.moved) { bucket(...cellAt(g.start)); changed(); }
    else if (!g.multi && !g.painting) startPaint(); // quick tap
    clearTimeout(g.timer);
    g = null;
    nextIfDone();
  },

  tc() { if (g) clearTimeout(g.timer); g = null; },
});
