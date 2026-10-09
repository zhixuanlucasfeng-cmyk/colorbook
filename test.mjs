// node test.mjs — sanity checks for the generator.
import assert from 'node:assert';
import { generate } from './gen.js';

function img(w, h, px) {
  const a = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const [r, g, b] = px(x, y); const i = (y * w + x) * 4;
    a[i] = r; a[i + 1] = g; a[i + 2] = b; a[i + 3] = 255;
  }
  return a;
}

// 4x4 cells drawn at f=2: left half red, right half blue, one cell 50/50 black/white -> grey.
const a = img(8, 8, (x, y) => (x >= 4 && y < 2) ? (x === 4 ? [0, 0, 0] : x === 5 ? [255, 255, 255] : [0, 0, 255]) : x < 4 ? [255, 0, 0] : [0, 0, 255]);
const p = generate(a, 4, 4, { f: 2, colors: 3 });
assert.deepStrictEqual(p.palette.length, 3);
assert.strictEqual(p.palette[p.cells[2]], '#808080', 'box average');
assert.strictEqual(p.palette[p.cells[0]], '#ff0000');
assert.strictEqual(p.cells[0], 0, 'most common color is number 1');
assert.strictEqual(new Set(p.cells).size, 3);

// Fewer colors in image than requested: no empty palette entries.
const q = generate(img(10, 10, x => x < 5 ? [0, 0, 0] : [255, 255, 255]), 10, 10, { colors: 24 });
assert.strictEqual(q.palette.length, 2);

// Portrait under warm light: tiny teeth must come out white-ish, not yellow.
{
  const S = 120, a = new Uint8ClampedArray(S * S * 4), teeth = [];
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const i = y * S + x, u = x / S, v = y / S;
    const inFace = ((u - .5) / .3) ** 2 + ((v - .52) / .38) ** 2 < 1;
    let c = [140, 160, 200];                                            // background
    if (inFace) c = [233 * (1 - .35 * u), 185 * (1 - .35 * u), 160 * (1 - .35 * u)]; // shaded skin
    if (inFace && Math.abs(v - .74) < .025 && Math.abs(u - .5) < .08) { c = [222, 216, 205]; teeth.push(i); }
    a.set([c[0], c[1] * .93, c[2] * .8, 255], i * 4);                  // warm cast
  }
  const yellow = p => { const [r, , b] = [1, 3, 5].map(k => parseInt(p.palette[p.cells[teeth[0]]].slice(k, k + 2), 16)); return r - b; };
  assert.ok(yellow(generate(a, S, S, { colors: 24, wb: false })) > 40, 'without wb teeth are yellow');
  assert.ok(Math.abs(yellow(generate(a, S, S, { colors: 24 }))) < 20, 'with wb teeth are near neutral');
}

const W = 240, H = 180, F = 3;
const big = img(W * F, H * F, (x, y) => [128 + 100 * Math.sin(x / 40), 128 + 100 * Math.cos(y / 30), (x ^ y) & 255]);
const t = performance.now();
const r = generate(big, W, H, { f: F, colors: 32 });
console.log(`${W}x${H} cells, ${r.palette.length} colors, ${Math.round(performance.now() - t)}ms`);
console.log('ok');

// Mini program: shares gen.js (must stay an identical copy) and encodes thumbnails itself.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { thumbnail } from './mp/utils/art.js';
assert.strictEqual(fs.readFileSync('mp/utils/gen.js', 'utf8'), fs.readFileSync('gen.js', 'utf8'), 'mp/utils/gen.js out of sync: cp gen.js mp/utils/');
{
  const w = 7, h = 5, cells = new Uint8Array(w * h).map((_, i) => i % 2), filled = new Uint8Array(w * h).map((_, i) => i % 3 === 0);
  const url = thumbnail(w, h, ['#ff0000', '#00ff00'], cells, filled);
  const tmp = fs.mkdtempSync('/tmp/cb-') + '/t.png';
  fs.writeFileSync(tmp, Buffer.from(url.split(',')[1], 'base64'));
  const info = execFileSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', tmp]).toString();
  assert.match(info, /pixelWidth: 238/); assert.match(info, /pixelHeight: 170/); // 7x5 upscaled x34, decodes fine
}
