const $ = s => document.querySelector(s);
// Show any crash on screen: there is no console on the iPad.
const oops = e => {
  const el = document.body.appendChild(Object.assign(document.createElement('div'), { className: 'err' }));
  el.textContent = '出错了：' + (e?.reason?.message || e?.message || e?.reason || e);
  el.onclick = () => el.remove();
};
addEventListener('error', oops);
addEventListener('unhandledrejection', oops);
const canvas = (w, h) => Object.assign(document.createElement('canvas'), { width: w, height: h }).getContext('2d');
const home = $('#home'), play = $('#play'), stage = $('#stage'), cv = $('#stage canvas'), ctx = cv.getContext('2d');

// ---- storage: 'art' = generated puzzle (never changes), 'meta' = progress + thumbnail ----
const dbp = new Promise((ok, err) => {
  const r = indexedDB.open('colorbook', 2);
  r.onupgradeneeded = () => {
    for (const name of [...r.result.objectStoreNames]) r.result.deleteObjectStore(name); // v1 = old region puzzles
    r.result.createObjectStore('art', { keyPath: 'id' });
    r.result.createObjectStore('meta', { keyPath: 'id' });
  };
  r.onsuccess = () => { r.result.onversionchange = () => r.result.close(); ok(r.result); };
  r.onerror = () => err(r.error);
  r.onblocked = () => err(new Error('旧版本页面还开着，请关掉其它填色标签页后刷新'));
});
async function db(store, mode, fn) {
  const d = await dbp;
  return new Promise((ok, err) => {
    const t = d.transaction(store, mode), req = fn(t.objectStore(store));
    t.oncomplete = () => ok(req.result);
    t.onerror = () => err(t.error);
  });
}
navigator.storage?.persist?.();
if ('serviceWorker' in navigator && isSecureContext) navigator.serviceWorker.register('sw.js');

// ---- home ----
$('#colors').oninput = e => $('#colorsOut').textContent = e.target.value;

async function showHome() {
  play.hidden = true; home.hidden = false;
  const metas = (await db('meta', 'readonly', s => s.getAll())).sort((a, b) => b.created - a.created);
  const g = $('#gallery');
  g.innerHTML = metas.length ? '' : '<p class="empty">还没有作品，导入一张照片开始吧。</p>';
  for (const m of metas) {
    const done = m.filled.reduce((a, b) => a + b, 0);
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `<img src="${m.thumb}" alt="" style="image-rendering:pixelated"><div class="meta"><span>${Math.floor(done / m.filled.length * 100)}%</span><button class="del">删除</button></div>`;
    card.onclick = () => open(m.id);
    card.querySelector('.del').onclick = async e => {
      e.stopPropagation();
      if (!confirm('删除这幅作品？')) return;
      await db('art', 'readwrite', s => s.delete(m.id));
      await db('meta', 'readwrite', s => s.delete(m.id));
      showHome();
    };
    g.append(card);
  }
}

$('#file').onchange = async e => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  const status = $('#status');
  status.textContent = '生成中…';
  try {
    const img = await createImageBitmap(file);
    const long = +$('#detail').value, F = Math.min(4, Math.max(1, Math.floor(2400 / long))); // iOS caps canvas area
    const k = long / Math.max(img.width, img.height);
    const w = Math.max(1, Math.round(img.width * k)), h = Math.max(1, Math.round(img.height * k));
    const c = canvas(w * F, h * F);
    c.imageSmoothingQuality = 'high';
    c.drawImage(img, 0, 0, w * F, h * F);
    const { data } = c.getImageData(0, 0, w * F, h * F);
    const puzzle = await new Promise((ok, err) => {
      const wk = new Worker('worker.js?v=5', { type: 'module' });
      wk.onmessage = m => { wk.terminate(); ok(m.data); };
      wk.onerror = m => { wk.terminate(); err(m.message || '生成程序加载失败'); };
      wk.postMessage({ rgba: data, w, h, opts: { f: F, colors: +$('#colors').value, wb: $('#wb').checked } }, [data.buffer]);
    });
    const id = Date.now().toString(36);
    const filled = new Uint8Array(w * h);
    await db('art', 'readwrite', s => s.put({ id, ...puzzle }));
    await db('meta', 'readwrite', s => s.put({ id, created: Date.now(), filled, thumb: thumbnail(puzzle, filled) }));
    status.textContent = '';
    open(id);
  } catch (err) {
    status.textContent = '生成失败：' + err;
  }
};

// ---- the picture as a w x h bitmap: filled = its color, unfilled = faint grey of the photo, selected = dark grey ----
const rgbOf = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
const lum = ([r, g, b]) => 0.299 * r + 0.587 * g + 0.114 * b;

function bitmap(p, filled, sel) {
  const im = new ImageData(p.w, p.h), rgb = p.palette.map(rgbOf);
  const ghost = rgb.map(c => 255 - (255 - lum(c)) * 0.5);
  for (let i = 0; i < p.w * p.h; i++) {
    const c = p.cells[i];
    const [r, g, b] = filled[i] ? rgb[c] : c === sel ? [150, 150, 158] : [ghost[c], ghost[c], ghost[c]];
    im.data.set([r, g, b, 255], i * 4);
  }
  return im;
}

function thumbnail(p, filled) {
  const c = canvas(p.w, p.h);
  c.putImageData(bitmap(p, filled, -1), 0, 0);
  const out = document.createElement('canvas');
  const k = Math.max(1, Math.floor(320 / Math.max(p.w, p.h)));
  out.width = p.w * k; out.height = p.h * k;
  const o = out.getContext('2d');
  o.imageSmoothingEnabled = false;
  o.drawImage(c.canvas, 0, 0, out.width, out.height);
  return out.toDataURL('image/png');
}

// ---- play ----
let cur = null, sel = 0, left = [], done = 0, base = null, saveTimer = 0, tool = 'brush', size = 1;

async function open(id) {
  const [p, m] = await Promise.all([db('art', 'readonly', s => s.get(id)), db('meta', 'readonly', s => s.get(id))]);
  cur = { ...p, meta: m, filled: m.filled };
  home.hidden = true; play.hidden = false; $('#done').hidden = true;
  left = p.palette.map(() => 0);
  p.cells.forEach((c, i) => cur.filled[i] || left[c]++);
  done = cur.filled.reduce((a, b) => a + b, 0);
  base = canvas(p.w, p.h);
  $('#palette').innerHTML = p.palette.map((hex, k) =>
    `<button data-k="${k}" style="background:${hex};color:${lum(rgbOf(hex)) > 150 ? '#222' : '#fff'}">${k + 1}</button>`).join('');
  resize();
  fit();
  select(Math.max(0, left.findIndex(n => n > 0)));
  progress();
}

function select(k) {
  sel = k;
  base.putImageData(bitmap(cur, cur.filled, sel), 0, 0);
  document.querySelectorAll('#palette button').forEach((b, j) => {
    b.classList.toggle('on', j === k);
    b.classList.toggle('done', !left[j]);
  });
  $('#pick').value = cur.palette[k];
  document.querySelector('#palette .on')?.scrollIntoView({ inline: 'nearest', block: 'nearest' });
  draw();
}
$('#tools').onclick = e => {
  const t = e.target.closest('[data-tool]')?.dataset.tool;
  if (!t) return;
  tool = t;
  document.querySelectorAll('[data-tool]').forEach(b => b.classList.toggle('on', b.dataset.tool === tool));
  $('#sizeBox').hidden = tool !== 'brush';
};
$('#size').oninput = e => { size = +e.target.value; $('#sizeOut').textContent = size; };
// Recolor the selected number: live preview while picking, saved when the picker closes.
$('#pick').oninput = e => {
  cur.palette[sel] = e.target.value;
  const b = document.querySelectorAll('#palette button')[sel];
  b.style.background = e.target.value;
  b.style.color = lum(rgbOf(e.target.value)) > 150 ? '#222' : '#fff';
  base.putImageData(bitmap(cur, cur.filled, sel), 0, 0);
  draw();
};
$('#pick').onchange = () => {
  const { id, w, h, palette, cells } = cur;
  db('art', 'readwrite', s => s.put({ id, w, h, palette, cells }));
  save();
};
$('#palette').onclick = e => { const k = e.target.dataset?.k; if (k != null) select(+k); };

// Fill one cell if it has the selected number. Callers batch, then call changed().
function fillCell(x, y) {
  if (x < 0 || y < 0 || x >= cur.w || y >= cur.h) return;
  const i = y * cur.w + x;
  if (cur.filled[i] || cur.cells[i] !== sel) return;
  cur.filled[i] = 1;
  base.fillStyle = cur.palette[sel];
  base.fillRect(x, y, 1, 1);
  left[sel]--;
  done++;
}

// Brush: a round stamp `size` cells across.
function stamp(x, y) {
  const r = (size - 1) / 2, R = Math.ceil(r);
  for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
    if (dx * dx + dy * dy <= (r + 0.5) ** 2) fillCell(x + dx, y + dy);
  }
}

// Bucket: every connected cell with the same number.
function bucket(x, y) {
  if (x < 0 || y < 0 || x >= cur.w || y >= cur.h) return;
  const i0 = y * cur.w + x, c = cur.cells[i0];
  if (c !== sel || cur.filled[i0]) return;
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
  progress();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(save, 800);
  draw();
}

// After a stroke ends: color finished -> jump to the next one.
function nextIfDone() {
  if (left[sel]) return;
  const next = left.findIndex(n => n > 0);
  if (next >= 0) select(next);
  else { select(sel); $('#done').hidden = false; setTimeout(() => $('#done').hidden = true, 2500); }
}

function progress() {
  $('#progress').textContent = `${done} / ${cur.filled.length}`;
}

function save() {
  clearTimeout(saveTimer);
  if (!cur) return Promise.resolve();
  cur.meta.filled = cur.filled;
  cur.meta.thumb = thumbnail(cur, cur.filled);
  return db('meta', 'readwrite', s => s.put(cur.meta));
}
$('#back').onclick = async () => { await save(); cur = null; showHome(); };
document.addEventListener('visibilitychange', () => document.hidden && save());

// ---- drawing: s = screen px per cell; grid at >= 6px, numbers at >= 14px, only for visible cells ----
let s = 1, tx = 0, ty = 0, W = 0, H = 0, queued = false;
function resize() {
  const r = stage.getBoundingClientRect(), dpr = devicePixelRatio || 1;
  W = r.width; H = r.height;
  cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
function fit() {
  s = Math.min(W / cur.w, H / cur.h) * 0.95;
  tx = (W - cur.w * s) / 2; ty = (H - cur.h * s) / 2;
  draw();
}
function draw() {
  if (queued || !cur) return;
  queued = true;
  requestAnimationFrame(() => {
    queued = false;
    if (!cur) return;
    ctx.fillStyle = '#ebe8e0';
    ctx.fillRect(0, 0, W, H);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(base.canvas, tx, ty, cur.w * s, cur.h * s);
    if (s < 6) return;
    const x0 = Math.max(0, Math.floor(-tx / s)), x1 = Math.min(cur.w, Math.ceil((W - tx) / s));
    const y0 = Math.max(0, Math.floor(-ty / s)), y1 = Math.min(cur.h, Math.ceil((H - ty) / s));
    ctx.beginPath();
    for (let x = x0; x <= x1; x++) { ctx.moveTo(tx + x * s, ty + y0 * s); ctx.lineTo(tx + x * s, ty + y1 * s); }
    for (let y = y0; y <= y1; y++) { ctx.moveTo(tx + x0 * s, ty + y * s); ctx.lineTo(tx + x1 * s, ty + y * s); }
    ctx.strokeStyle = 'rgba(0,0,0,.12)';
    ctx.lineWidth = 1;
    ctx.stroke();
    if (s < 16) return; // ponytail: redraws every visible number per frame; cache a text layer if pinch stutters on iPad
    ctx.font = `${Math.round(s * (s > 30 ? 0.42 : 0.5))}px -apple-system, system-ui, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const i = y * cur.w + x;
      if (cur.filled[i]) continue;
      ctx.fillStyle = cur.cells[i] === sel ? '#fff' : '#77736b';
      ctx.fillText(cur.cells[i] + 1, tx + (x + 0.5) * s, ty + (y + 0.5) * s);
    }
  });
}
function zoomAt(px, py, f) {
  const min = Math.min(W / cur.w, H / cur.h) * 0.5, ns = Math.min(Math.max(s * f, min), 80);
  tx = px - (px - tx) * ns / s; ty = py - (py - ty) * ns / s; s = ns;
  draw();
}

// ---- gestures: one finger / pencil paints (drag paints a line), two fingers pan + pinch ----
// A finger waits briefly before painting so the first finger of a pinch doesn't paint.
const pts = new Map();
let g = null;
const local = e => { const r = stage.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
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
stage.onpointerdown = e => {
  stage.setPointerCapture(e.pointerId);
  const p = local(e);
  pts.set(e.pointerId, p);
  if (pts.size === 1) {
    g = { start: p, painting: false, multi: false, last: null, moved: false };
    if (tool === 'bucket') return;
    if (e.pointerType === 'touch') g.timer = setTimeout(startPaint, 90);
    else startPaint();
  } else if (!g.painting) {
    g.multi = true;
    clearTimeout(g.timer);
  }
};
stage.onpointermove = e => {
  const p = pts.get(e.pointerId);
  if (!p || !g) return;
  const q = local(e);
  if (!g.multi && tool === 'bucket') {
    if (Math.hypot(q.x - g.start.x, q.y - g.start.y) > 6) g.moved = true;
    if (g.moved) { tx += q.x - p.x; ty += q.y - p.y; draw(); }
    p.x = q.x; p.y = q.y;
    return;
  }
  if (!g.multi) {
    if (!g.painting && Math.hypot(q.x - g.start.x, q.y - g.start.y) > 4) startPaint();
    if (g.painting) paintTo(q);
    return;
  }
  const [a, b] = [...pts.values()].map(v => ({ ...v }));
  p.x = q.x; p.y = q.y;
  const [c, d] = [...pts.values()];
  if (!b) return;
  tx += (c.x + d.x - a.x - b.x) / 2; ty += (c.y + d.y - a.y - b.y) / 2;
  zoomAt((c.x + d.x) / 2, (c.y + d.y) / 2, Math.hypot(c.x - d.x, c.y - d.y) / Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)));
};
const end = tap => e => {
  if (!pts.delete(e.pointerId)) return;
  if (tap && g && !g.multi && tool === 'bucket' && !g.moved) { bucket(...cellAt(g.start)); changed(); }
  else if (tap && g && !g.multi && !g.painting) startPaint(); // quick tap
  if (!pts.size) { clearTimeout(g?.timer); g = null; if (cur) nextIfDone(); }
};
stage.onpointerup = end(true);
stage.onpointercancel = end(false);
stage.addEventListener('wheel', e => {
  e.preventDefault();
  if (e.ctrlKey) { const p = local(e); zoomAt(p.x, p.y, Math.exp(-e.deltaY / 100)); }
  else { tx -= e.deltaX; ty -= e.deltaY; draw(); }
}, { passive: false });
addEventListener('resize', () => { if (cur) { resize(); draw(); } });

showHome();
