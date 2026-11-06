import assert from 'node:assert/strict'
import { inflateSync } from 'node:zlib'

// Read driver PNG evidence, without changing pixels or accepting a blank image
// as a completed visual check. Native Safari currently returns 8-bit RGBA.
export function inspectPngEvidence(bytes) {
  assert.ok(bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
  const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20), color = bytes[25]
  assert.ok(width > 0 && height > 0 && width * height <= 20_000_000)
  assert.equal(bytes[24], 8); assert.equal(bytes[28], 0)
  assert.ok(color === 2 || color === 6, 'Unsupported screenshot PNG format')
  const channels = color === 6 ? 4 : 3, stride = width * channels, chunks = []
  for (let at = 8; at + 12 <= bytes.length;) {
    const length = bytes.readUInt32BE(at), kind = bytes.toString('ascii', at + 4, at + 8)
    assert.ok(at + length + 12 <= bytes.length)
    if (kind === 'IDAT') chunks.push(bytes.subarray(at + 8, at + length + 8))
    at += length + 12
  }
  const raw = inflateSync(Buffer.concat(chunks), { maxOutputLength: (stride + 1) * height })
  assert.equal(raw.length, (stride + 1) * height)
  let previous = Buffer.alloc(stride), background, distinctPixels = 0
  const colors = new Set()
  const paeth = (a, b, c) => { const p = a + b - c, x = Math.abs(p - a), y = Math.abs(p - b), z = Math.abs(p - c); return x <= y && x <= z ? a : y <= z ? b : c }
  for (let y = 0, at = 0; y < height; y++) {
    const filter = raw[at++], row = Buffer.from(raw.subarray(at, at + stride)); at += stride
    assert.ok(filter <= 4)
    for (let x = 0; x < stride; x++) {
      const left = x >= channels ? row[x - channels] : 0, above = previous[x], diagonal = x >= channels ? previous[x - channels] : 0
      row[x] = (row[x] + (filter === 0 ? 0 : filter === 1 ? left : filter === 2 ? above : filter === 3 ? Math.floor((left + above) / 2) : paeth(left, above, diagonal))) & 255
    }
    for (let x = 0; x < stride; x += channels) {
      const rgb = (row[x] << 16) | (row[x + 1] << 8) | row[x + 2]
      background ??= rgb
      if (rgb !== background) distinctPixels++
      if (colors.size < 10000) colors.add(rgb)
    }
    previous = row
  }
  return { width, height, colors: colors.size, distinctPixels }
}
