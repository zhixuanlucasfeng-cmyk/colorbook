// Minimal PNG encoder (uncompressed deflate) -> data URL. Lets thumbnails skip canvas export APIs.
const CRC = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (u8, from, to) => {
  let c = 0xffffffff;
  for (let i = from; i < to; i++) c = CRC[(c ^ u8[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function base64(u8) {
  let s = '';
  for (let i = 0; i < u8.length; i += 3) {
    const n = (u8[i] << 16) | ((u8[i + 1] || 0) << 8) | (u8[i + 2] || 0);
    s += B64[n >> 18] + B64[(n >> 12) & 63] + (i + 1 < u8.length ? B64[(n >> 6) & 63] : '=') + (i + 2 < u8.length ? B64[n & 63] : '=');
  }
  return s;
}

// rgb: w*h*3 bytes
export function pngDataURL(rgb, w, h) {
  const raw = new Uint8Array((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) raw.set(rgb.subarray(y * w * 3, (y + 1) * w * 3), y * (w * 3 + 1) + 1);
  const blocks = Math.ceil(raw.length / 65535) || 1;
  const z = new Uint8Array(2 + raw.length + blocks * 5 + 4);
  z[0] = 0x78; z[1] = 0x01;
  let o = 2, a = 1, b = 0;
  for (let i = 0; i < raw.length || o === 2; i += 65535) {
    const len = Math.min(65535, raw.length - i);
    z[o++] = i + len >= raw.length ? 1 : 0;
    z[o++] = len & 255; z[o++] = len >> 8; z[o++] = ~len & 255; z[o++] = (~len >> 8) & 255;
    z.set(raw.subarray(i, i + len), o); o += len;
  }
  for (const v of raw) { a = (a + v) % 65521; b = (b + a) % 65521; }
  const ad = ((b << 16) | a) >>> 0;
  z[o++] = ad >>> 24; z[o++] = (ad >> 16) & 255; z[o++] = (ad >> 8) & 255; z[o++] = ad & 255;

  const chunk = (type, data) => {
    const c = new Uint8Array(12 + data.length), dv = new DataView(c.buffer);
    dv.setUint32(0, data.length);
    for (let i = 0; i < 4; i++) c[4 + i] = type.charCodeAt(i);
    c.set(data, 8);
    dv.setUint32(8 + data.length, crc32(c, 4, 8 + data.length));
    return c;
  };
  const ihdr = new Uint8Array(13), dv = new DataView(ihdr.buffer);
  dv.setUint32(0, w); dv.setUint32(4, h); ihdr[8] = 8; ihdr[9] = 2; // 8-bit RGB
  const parts = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', z.subarray(0, o)), chunk('IEND', new Uint8Array(0))];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let p = 0;
  for (const part of parts) { out.set(part, p); p += part.length; }
  return 'data:image/png;base64,' + base64(out);
}
