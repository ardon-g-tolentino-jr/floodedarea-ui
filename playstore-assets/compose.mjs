// Stack captured PNG slices into one full-height screenshot.
//
// Why slices: the browser-capture tool caps a returned image at roughly 1.2 megapixels, so a
// full 9:16 phone frame comes back downscaled (819x1456) while each half comes back at native
// retina resolution (1044x928). Capturing the frame in halves and stitching them here keeps every
// pixel the renderer actually produced; the result is 1044x1856, which `sips` then normalizes to
// the canonical 1080x1920.
//
//   node playstore-assets/compose.mjs <out.png> <top.png> <bottom.png> [...more slices]
//
// Handles 8-bit non-interlaced truecolor PNGs (colour type 2 or 6) — what the capture tool emits.
// Dependency-free: zlib is all that inflating and deflating a PNG actually needs.

import { readFileSync, writeFileSync } from 'node:fs';
import { inflateSync, deflateSync, crc32 } from 'node:zlib';

const SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function decode(file) {
  const buf = readFileSync(file);
  if (!buf.subarray(0, 8).equals(SIG)) throw new Error(`${file}: not a PNG`);

  let width = 0, height = 0, bpp = 0;
  const idat = [];
  for (let i = 8; i < buf.length; ) {
    const len = buf.readUInt32BE(i);
    const type = buf.toString('ascii', i + 4, i + 8);
    const body = buf.subarray(i + 8, i + 8 + len);
    if (type === 'IHDR') {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      const [depth, colour, , , interlace] = [body[8], body[9], body[10], body[11], body[12]];
      if (depth !== 8) throw new Error(`${file}: expected 8-bit, got ${depth}`);
      if (interlace !== 0) throw new Error(`${file}: interlaced PNGs are not supported`);
      if (colour !== 2 && colour !== 6) throw new Error(`${file}: unsupported colour type ${colour}`);
      bpp = colour === 2 ? 3 : 4;
    } else if (type === 'IDAT') {
      idat.push(body);
    }
    i += 12 + len;
  }

  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * bpp;
  const px = Buffer.alloc(height * stride);

  // Undo the per-row filters (PNG spec §9.2). Each row is prefixed with its filter byte and is
  // predicted from the pixel to the left (a), the row above (b), and up-left (c).
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const cur = px.subarray(y * stride, (y + 1) * stride);
    const prev = y > 0 ? px.subarray((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0;
      const b = prev ? prev[x] : 0;
      const c = prev && x >= bpp ? prev[x - bpp] : 0;
      let v = src[x];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      } else if (filter !== 0) throw new Error(`${file}: bad filter ${filter} on row ${y}`);
      cur[x] = v & 0xff;
    }
  }
  return { width, height, bpp, px };
}

function chunk(type, body) {
  const out = Buffer.alloc(body.length + 12);
  out.writeUInt32BE(body.length, 0);
  out.write(type, 4, 'ascii');
  body.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, 'ascii'), body])) >>> 0, body.length + 8);
  return out;
}

function encode({ width, height, bpp, px }) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = bpp === 3 ? 2 : 6;
  const stride = width * bpp;
  const raw = Buffer.alloc(height * (stride + 1));
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none — the deflate pass carries the compression
    px.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  return Buffer.concat([
    SIG,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const [out, ...slices] = process.argv.slice(2);
if (!out || slices.length < 1) {
  console.error('usage: node playstore-assets/compose.mjs <out.png> <slice.png> [slice.png ...]');
  process.exit(1);
}

const parts = slices.map(decode);
const width = parts[0].width;
const bpp = parts[0].bpp;
for (const [i, p] of parts.entries()) {
  if (p.width !== width) throw new Error(`${slices[i]}: width ${p.width} != ${width}`);
  if (p.bpp !== bpp) throw new Error(`${slices[i]}: colour type differs from the first slice`);
}

const height = parts.reduce((n, p) => n + p.height, 0);
const px = Buffer.concat(parts.map((p) => p.px));
writeFileSync(out, encode({ width, height, bpp, px }));
console.log(`${out} — ${width}x${height} from ${parts.map((p) => `${p.width}x${p.height}`).join(' + ')}`);
