// PWA用アイコン(PNG)を外部ライブラリなしで描く。紺の夜空に黄色い三日月と小さな星3つ。
// 出力: app/icons/icon-192.png, icon-512.png, maskable-512.png, apple-touch-icon.png
const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

function crc32(buf) { let c, crc = 0xffffffff; for (let n = 0; n < buf.length; n++) { c = (crc ^ buf[n]) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c; } return (crc ^ 0xffffffff) >>> 0; }
function chunk(type, data) { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, crc]); }
function png(w, h, px) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) px.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const SKY_TOP = hex('#16224d'), SKY_BOT = hex('#0a1024'), MOON = hex('#ffd96a'), STAR = hex('#eef1ff');
// 4つの角を持つ星(きらめき)の形
const sparkle = (fx, fy, cx, cy, s) => { const dx = Math.abs(fx - cx) / s, dy = Math.abs(fy - cy) / s; return Math.sqrt(dx) + Math.sqrt(dy) < 1; };

function draw(size, pad) {
  const S = 4, px = Buffer.alloc(size * size * 4);
  const u = v => v * (1 - 2 * pad) + pad, sc = 1 - 2 * pad;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const acc = [0, 0, 0];
    for (let sy = 0; sy < S; sy++) for (let sx = 0; sx < S; sx++) {
      const fx = (x + (sx + 0.5) / S) / size, fy = (y + (sy + 0.5) / S) / size;
      const t = fy; let col = SKY_TOP.map((c, i) => c + (SKY_BOT[i] - c) * t);
      // 三日月 = 大きい円 − ずらした円
      const d1 = Math.hypot(fx - u(0.44), fy - u(0.52)), d2 = Math.hypot(fx - u(0.58), fy - u(0.42));
      if (d1 < 0.30 * sc && d2 > 0.27 * sc) col = MOON;
      if (sparkle(fx, fy, u(0.76), u(0.68), 0.11 * sc)) col = STAR;
      if (sparkle(fx, fy, u(0.80), u(0.24), 0.07 * sc)) col = MOON;
      if (sparkle(fx, fy, u(0.22), u(0.20), 0.05 * sc)) col = STAR;
      acc[0] += col[0]; acc[1] += col[1]; acc[2] += col[2];
    }
    const i = (y * size + x) * 4;
    px[i] = acc[0] / 16; px[i + 1] = acc[1] / 16; px[i + 2] = acc[2] / 16; px[i + 3] = 255;
  }
  return png(size, size, px);
}
const out = path.join(__dirname, '../app/icons');
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'icon-192.png'), draw(192, 0.03));
fs.writeFileSync(path.join(out, 'icon-512.png'), draw(512, 0.03));
fs.writeFileSync(path.join(out, 'maskable-512.png'), draw(512, 0.14));
fs.writeFileSync(path.join(out, 'apple-touch-icon.png'), draw(180, 0.05));
console.log('icons written');
