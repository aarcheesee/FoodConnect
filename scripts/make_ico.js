/* eslint-disable */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');

// ---------- Tiny 16x16 favicon (ICO with one 32x32 BMP embedded, generated procedurally) ----------
// We'll write a valid .ico file containing a 32x32 BGRA icon.
// ICO structure:
//   ICONDIR (6 bytes) + 1 ICONDIRENTRY (16 bytes) + BMP pixel data
const SIZE = 32;
const W = SIZE, H = SIZE;
const bpp = 4; // BGRA

function pack16LE(v) { return Buffer.from([v & 0xFF, (v >> 8) & 0xFF]); }
function pack32LE(v) {
  return Buffer.from([
    v & 0xFF, (v >> 8) & 0xFF, (v >> 16) & 0xFF, (v >> 24) & 0xFF,
  ]);
}

// Background gradient pixels + simple plate icon pixels (BMP bottom-up)
const pixels = Buffer.alloc(W * H * bpp);
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const py = H - 1 - y; // bottom-up
    const idx = (y * W + x) * bpp;
    const cx = W / 2, cy = H / 2;
    const dx = (x - cx) / cx, dy = (py - cy) / cy;
    const d = Math.sqrt(dx*dx + dy*dy);
    let r = 0, g = 0, b = 0, a = 0;
    if (d <= 1) {
      // Green rounded square background
      const corner = Math.max(Math.abs(dx), Math.abs(dy));
      if (corner <= 0.95) {
        const t = (py / H);
        r = 39 + t * (22 - 39) | 0;
        g = 174 + t * (160 - 174) | 0;
        b = 96 + t * (133 - 96) | 0;
        a = 255;
      }
      // Plate circle (plate)
      const dxp = (x - cx) / (W*0.28);
      const dyp = (py - cy + 2) / (H*0.22);
      if (dxp*dxp + dyp*dyp <= 1) {
        r = 255; g = 255; b = 255; a = 255;
        // Inner plate ring
        const dxp2 = (x - cx) / (W*0.20);
        const dyp2 = (py - cy + 2) / (H*0.15);
        if (dxp2*dxp2 + dyp2*dyp2 > 0.85 && dxp2*dxp2 + dyp2*dyp2 <= 1) {
          r = 243; g = 156; b = 18; a = 255;
        }
      }
      // Smile dot (eyes)
      const ex1 = cx - 4, ex2 = cx + 4, ey = cy + 2;
      if ((Math.abs(x-ex1)<1.2 && Math.abs(py-ey)<1.2) || (Math.abs(x-ex2)<1.2 && Math.abs(py-ey)<1.2)) {
        r = 255; g = 255; b = 255; a = 255;
      }
      // Smile curve
      const mcx = cx, mcy = cy + 5;
      const distSmile = Math.abs(Math.hypot(x - mcx, py - mcy) - 2.5);
      if (distSmile > 0 && distSmile < 1.6 && x > cx - 4 && x < cx + 4 && py > mcy - 2) {
        r = 255; g = 255; b = 255; a = 255;
      }
    }
    pixels[idx] = b;
    pixels[idx+1] = g;
    pixels[idx+2] = r;
    pixels[idx+3] = a;
  }
}

// AND mask (1bpp bottom-up, each row padded to 4 bytes)
const andRowBytes = Math.ceil(W / 32) * 4;
const andMask = Buffer.alloc(H * andRowBytes, 0xFF); // fully transparent AND (bg handled by XOR alpha already)
// but for pixels with a>0 we want AND=0 (preserve XOR), a==0 => AND=1 => bg
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const py = H - 1 - y;
    const a = pixels[(y * W + x) * 4 + 3];
    if (a > 0) {
      const bit = 7 - (x & 7);
      andMask[py * andRowBytes + (x >> 3)] &= ~(1 << bit);
    }
  }
}

// DIB info header (BITMAPINFOHEADER 40 bytes, height = 2*H for ICO BMP)
const dibSize = 40;
const pixelDataSize = pixels.length;
const andMaskSize = andMask.length;
const bmpTotalSize = dibSize + pixelDataSize + andMaskSize;

const iconDirSize = 6;
const dirEntrySize = 16;
const totalFileSize = iconDirSize + dirEntrySize + bmpTotalSize;

const file = Buffer.alloc(totalFileSize);
let off = 0;
// ICONDIR
file.writeUInt16LE(0, off); off += 2; // reserved
file.writeUInt16LE(1, off); off += 2; // type=1 (ICO)
file.writeUInt16LE(1, off); off += 2; // count=1
// ICONDIRENTRY
file[off++] = W === 256 ? 0 : W; // width
file[off++] = H === 256 ? 0 : H; // height
file[off++] = 0; // color count
file[off++] = 0; // reserved
file.writeUInt16LE(1, off); off += 2; // color planes
file.writeUInt16LE(bpp*8, off); off += 2; // bpp
file.writeUInt32LE(bmpTotalSize, off); off += 4; // bytes in res
file.writeUInt32LE(iconDirSize + dirEntrySize, off); off += 4; // offset to BMP

// BITMAPINFOHEADER
const dibStart = off;
file.writeUInt32LE(dibSize, off); off += 4; // header size
file.writeInt32LE(W, off); off += 4; // width
file.writeInt32LE(2 * H, off); off += 4; // height (2x for XOR+AND)
file.writeUInt16LE(1, off); off += 2; // planes
file.writeUInt16LE(32, off); off += 2; // bit count
file.writeUInt32LE(0, off); off += 4; // compression BI_RGB
file.writeUInt32LE(pixelDataSize + andMaskSize, off); off += 4; // image size
file.writeInt32LE(0, off); off += 4; // x ppm
file.writeInt32LE(0, off); off += 4; // y ppm
file.writeUInt32LE(0, off); off += 4; // colors used
file.writeUInt32LE(0, off); off += 4; // important colors
if (off !== dibStart + dibSize) throw new Error('DIB size mismatch');
// XOR pixels
pixels.copy(file, off); off += pixels.length;
// AND mask
andMask.copy(file, off); off += andMask.length;

fs.writeFileSync(path.join(PUBLIC_DIR, 'favicon.ico'), file);
console.log('Wrote favicon.ico (' + file.length + ' bytes) to ' + path.join(PUBLIC_DIR, 'favicon.ico'));
