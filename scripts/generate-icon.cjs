/**
 * Generates public/icon.png (512x512) and public/icon.ico
 * Uses only Node.js built-ins — no external packages required.
 */

const zlib = require('zlib')
const fs = require('fs')
const path = require('path')

const W = 512, H = 512
const BG = [0, 61, 165]   // #003DA5
const FG = [255, 255, 255]

// ── Pixel buffer ───────────────────────────────────────────────────────────────
const pixels = Buffer.alloc(W * H * 3)
for (let i = 0; i < W * H; i++) {
  pixels[i * 3]     = BG[0]
  pixels[i * 3 + 1] = BG[1]
  pixels[i * 3 + 2] = BG[2]
}

function fillRect(x0, y0, x1, y1, color) {
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * W + x) * 3
      pixels[i]     = color[0]
      pixels[i + 1] = color[1]
      pixels[i + 2] = color[2]
    }
  }
}

// Draw bold "E" centered on 512x512
// Total glyph: 200w × 280h, centered at (256, 256)
const gx = 156, gy = 116  // top-left of glyph
const stroke = 48          // bar thickness

fillRect(gx,          gy,          gx + stroke,      gy + 280, FG) // vertical
fillRect(gx,          gy,          gx + 200,         gy + stroke, FG) // top
fillRect(gx,          gy + 116,    gx + 160,         gy + 116 + stroke, FG) // middle
fillRect(gx,          gy + 232,    gx + 200,         gy + 280, FG) // bottom

// ── PNG helpers ────────────────────────────────────────────────────────────────
function crc32(buf) {
  let c = 0xFFFFFFFF
  for (const b of buf) {
    c ^= b
    for (let i = 0; i < 8; i++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1)
  }
  return (c ^ 0xFFFFFFFF) >>> 0
}

function pngChunk(type, data) {
  const out = Buffer.alloc(12 + data.length)
  out.writeUInt32BE(data.length, 0)
  out.write(type, 4, 'ascii')
  data.copy(out, 8)
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, 'ascii'), data])), 8 + data.length)
  return out
}

function buildPng(w, h, pixelBuf) {
  const raw = Buffer.alloc(h * (1 + w * 3))
  for (let y = 0; y < h; y++) {
    raw[y * (1 + w * 3)] = 0  // filter: none
    pixelBuf.copy(raw, y * (1 + w * 3) + 1, y * w * 3, (y + 1) * w * 3)
  }
  const compressed = zlib.deflateSync(raw)

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0)
  ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8  // bit depth
  ihdr[9] = 2  // RGB
  // bytes 10-12 already 0 (compression/filter/interlace)

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', compressed),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}

// ── Build 512x512 PNG ─────────────────────────────────────────────────────────
const png512 = buildPng(W, H, pixels)
const outPng = path.resolve(__dirname, '../public/icon.png')
fs.writeFileSync(outPng, png512)
console.log('icon.png written:', outPng)

// ── Build ICO (contains the 512×512 PNG) ──────────────────────────────────────
// ICO format: header + directory entry + raw image bytes (PNG is valid)
const icoHeader = Buffer.alloc(6)
icoHeader.writeUInt16LE(0, 0)  // reserved
icoHeader.writeUInt16LE(1, 2)  // type: ICO
icoHeader.writeUInt16LE(1, 4)  // count

const dataOffset = 6 + 16  // header + one directory entry
const dir = Buffer.alloc(16)
dir[0] = 0   // width: 0 = 256+ px
dir[1] = 0   // height: 0 = 256+ px
dir[2] = 0   // palette colors
dir[3] = 0   // reserved
dir.writeUInt16LE(1, 4)               // planes
dir.writeUInt16LE(32, 6)              // bpp
dir.writeUInt32LE(png512.length, 8)   // image size
dir.writeUInt32LE(dataOffset, 12)     // image offset

const outIco = path.resolve(__dirname, '../public/icon.ico')
fs.writeFileSync(outIco, Buffer.concat([icoHeader, dir, png512]))
console.log('icon.ico written:', outIco)
