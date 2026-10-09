// Prepare a static deployment directory; the app itself needs no build step.
import { cpSync, mkdirSync, rmSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(root, 'dist');
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
const files = ['index.html', 'style.css', 'app.js', 'gen.js', 'worker.js', 'sw.js', 'manifest.json',
  'assets/display.woff2', 'assets/display-OFL.txt', 'mp/utils/art.js', 'mp/utils/png.js',
  ...readdirSync(resolve(root, 'mp/assets')).filter(n => n.endsWith('.svg') || n === 'OFL.txt').map(n => `mp/assets/${n}`)];
for (const file of files) {
  mkdirSync(dirname(resolve(out, file)), { recursive: true });
  cpSync(resolve(root, file), resolve(out, file));
}
console.log(`Static package: ${files.length} files in dist`);
