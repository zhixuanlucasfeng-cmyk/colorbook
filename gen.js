// Photo -> pixel color-by-number puzzle. Pure functions: runs in the worker and in node tests.
// Input is the photo drawn at (w*f) x (h*f); each cell is the average of its f x f block,
// white-balanced, then quantized to `colors` colors with weighted k-means in Lab space.

export function generate(rgba, w, h, { f = 1, colors = 24, wb = true, seed = 1 } = {}) {
  const n = w * h, cell = new Float64Array(n * 3);
  for (let y = 0; y < h * f; y++) for (let x = 0; x < w * f; x++) {
    const s = (y * w * f + x) * 4, c = (((y / f) | 0) * w + ((x / f) | 0)) * 3;
    cell[c] += rgba[s]; cell[c + 1] += rgba[s + 1]; cell[c + 2] += rgba[s + 2];
  }
  for (let i = 0; i < n * 3; i++) cell[i] /= f * f;
  if (wb) whiteBalance(cell, n);

  const idx = kmeans(toLab(cell, n), n, colors, mulberry32(seed));

  // Renumber colors by cell count (1 = most common); palette = mean RGB of its cells.
  const sums = new Map();
  for (let i = 0; i < n; i++) {
    let s = sums.get(idx[i]);
    if (!s) sums.set(idx[i], (s = [0, 0, 0, 0]));
    s[0] += cell[i * 3]; s[1] += cell[i * 3 + 1]; s[2] += cell[i * 3 + 2]; s[3]++;
  }
  const order = [...sums.keys()].sort((a, b) => sums.get(b)[3] - sums.get(a)[3]);
  const remap = new Map(order.map((c, i) => [c, i]));
  const cells = new Uint8Array(n);
  for (let i = 0; i < n; i++) cells[i] = remap.get(idx[i]);
  const palette = order.map(c => {
    const s = sums.get(c);
    return '#' + [0, 1, 2].map(k => Math.round(s[k] / s[3]).toString(16).padStart(2, '0')).join('');
  });
  return { w, h, palette, cells };
}

// White patch: the brightest 1% of the picture (teeth, eye whites, paper, clouds) should be neutral.
// Indoor light tints them yellow; scale channels to undo it. Gain capped so a truly yellow
// bright object can't swing the whole picture blue.
function whiteBalance(cell, n) {
  const lum = i => 0.299 * cell[i * 3] + 0.587 * cell[i * 3 + 1] + 0.114 * cell[i * 3 + 2];
  const hist = new Uint32Array(256);
  for (let i = 0; i < n; i++) hist[Math.min(255, lum(i) | 0)]++;
  let t = 255, acc = 0;
  while (t > 0 && (acc += hist[t]) < n * 0.01) t--;
  const avg = [0, 0, 0];
  for (let i = 0; i < n; i++) if (lum(i) >= t) { avg[0] += cell[i * 3]; avg[1] += cell[i * 3 + 1]; avg[2] += cell[i * 3 + 2]; }
  const top = Math.max(...avg);
  // 85% of the full correction: clipped channels make the full amount overshoot toward blue.
  const gain = avg.map(v => 1 + (Math.min(1.35, top / Math.max(v, 1)) - 1) * 0.85);
  for (let i = 0; i < n * 3; i++) cell[i] = Math.min(255, cell[i] * gain[i % 3]);
}

function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function toLab(rgb, n) {
  const lab = new Float32Array(n * 3);
  const lin = v => (v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  const f = t => t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
  for (let i = 0; i < n; i++) {
    const r = lin(rgb[i * 3]), g = lin(rgb[i * 3 + 1]), b = lin(rgb[i * 3 + 2]);
    const x = f((0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047);
    const y = f(0.2126 * r + 0.7152 * g + 0.0722 * b);
    const z = f((0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883);
    lab[i * 3] = 116 * y - 16; lab[i * 3 + 1] = 500 * (x - y); lab[i * 3 + 2] = 200 * (y - z);
  }
  return lab;
}

// k-means++ over a color histogram (5 bits/channel) where each color counts sqrt(cells).
// Plain k-means spends colors on big areas (sky, wall) and averages small distinct ones (teeth,
// eye whites) into their neighbors; sqrt weighting gives small areas a fair share.
function kmeans(lab, n, k, rand) {
  const bins = new Map();
  for (let i = 0; i < n; i++) {
    const key = ((lab[i * 3] / 3) | 0) * 65536 + (((lab[i * 3 + 1] + 128) / 3) | 0) * 256 + (((lab[i * 3 + 2] + 128) / 3) | 0);
    let b = bins.get(key);
    if (!b) bins.set(key, (b = [0, 0, 0, 0]));
    b[0] += lab[i * 3]; b[1] += lab[i * 3 + 1]; b[2] += lab[i * 3 + 2]; b[3]++;
  }
  const B = bins.size, P = new Float64Array(B * 3), wt = new Float64Array(B);
  let j = 0;
  for (const b of bins.values()) { P[j * 3] = b[0] / b[3]; P[j * 3 + 1] = b[1] / b[3]; P[j * 3 + 2] = b[2] / b[3]; wt[j++] = Math.sqrt(b[3]); }
  const d2 = (X, i, C, c) => {
    const a = X[i * 3] - C[c * 3], b = X[i * 3 + 1] - C[c * 3 + 1], d = X[i * 3 + 2] - C[c * 3 + 2];
    return a * a + b * b + d * d;
  };
  const C = [];
  const push = i => C.push(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]);
  // first center: weighted random
  let t = rand() * wt.reduce((a, b) => a + b, 0), s = 0;
  while ((t -= wt[s]) > 0 && s < B - 1) s++;
  push(s);
  const best = new Float64Array(B).fill(Infinity);
  while (C.length / 3 < k) {
    const c = C.length / 3 - 1;
    let total = 0;
    for (let i = 0; i < B; i++) { best[i] = Math.min(best[i], d2(P, i, C, c)); total += best[i] * wt[i]; }
    if (total === 0) break; // fewer distinct colors than k
    t = rand() * total; s = 0;
    while ((t -= best[s] * wt[s]) > 0 && s < B - 1) s++;
    push(s);
  }
  const K = C.length / 3;
  const nearest = (X, i) => {
    let bc = 0, bd = Infinity;
    for (let c = 0; c < K; c++) { const d = d2(X, i, C, c); if (d < bd) { bd = d; bc = c; } }
    return bc;
  };
  for (let it = 0; it < 20; it++) {
    const acc = new Float64Array(K * 4);
    for (let i = 0; i < B; i++) {
      const c = nearest(P, i);
      for (let q = 0; q < 3; q++) acc[c * 4 + q] += P[i * 3 + q] * wt[i];
      acc[c * 4 + 3] += wt[i];
    }
    for (let c = 0; c < K; c++) if (acc[c * 4 + 3]) for (let q = 0; q < 3; q++) C[c * 3 + q] = acc[c * 4 + q] / acc[c * 4 + 3];
  }
  const idx = new Int32Array(n);
  for (let i = 0; i < n; i++) idx[i] = nearest(lab, i);
  return idx;
}
