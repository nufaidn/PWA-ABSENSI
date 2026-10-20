/**
 * Generates the PWA icon set into `public/icons/`.
 *
 * Icons are drawn programmatically rather than checked in as binaries so the
 * brand mark and the manifest can never drift apart, and the repo stays free of
 * opaque assets. Run with: `npm run icons`
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { deflateSync } from "node:zlib";

const BRAND = [0x2f, 0x55, 0xd4];
const WHITE = [0xff, 0xff, 0xff];

// ---------------------------------------------------------------------------
// PNG encoding (RGBA, 8-bit)
// ---------------------------------------------------------------------------

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let crc = -1;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typeAndData = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData));
  return Buffer.concat([length, typeAndData, crc]);
}

function encodePng(width, height, rgba) {
  const stride = width * 4 + 1;
  const raw = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y += 1) {
    raw[y * stride] = 0; // filter type: none
    rgba.copy(raw, y * stride + 1, y * width * 4, (y + 1) * width * 4);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  ihdr[10] = 0; // deflate
  ihdr[11] = 0; // adaptive filtering
  ihdr[12] = 0; // no interlace

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------------------
// Tiny anti-aliased raster canvas
// ---------------------------------------------------------------------------

class Canvas {
  constructor(size) {
    this.size = size;
    this.data = Buffer.alloc(size * size * 4);
  }

  /** Composites `color` over the pixel with coverage `alpha` (0–1). */
  blend(x, y, color, alpha) {
    if (alpha <= 0) return;
    const { size, data } = this;
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const a = Math.min(1, alpha);
    const offset = (y * size + x) * 4;
    const dstA = data[offset + 3] / 255;
    const outA = a + dstA * (1 - a);
    if (outA <= 0) return;
    for (let c = 0; c < 3; c += 1) {
      data[offset + c] = Math.round(
        (color[c] * a + data[offset + c] * dstA * (1 - a)) / outA,
      );
    }
    data[offset + 3] = Math.round(outA * 255);
  }

  /**
   * Fills the area where `sdf(x, y)` is negative, using 3x3 supersampling so
   * curves come out smooth without needing a real path-filling library.
   */
  fill(sdf, color) {
    const offsets = [-0.33, 0, 0.33];
    for (let y = 0; y < this.size; y += 1) {
      for (let x = 0; x < this.size; x += 1) {
        let covered = 0;
        for (const dy of offsets) {
          for (const dx of offsets) {
            if (sdf(x + dx, y + dy) <= 0) covered += 1;
          }
        }
        if (covered > 0) this.blend(x, y, color, covered / 9);
      }
    }
  }
}

/** Signed distance to a rounded rectangle centred at (cx, cy). */
function roundedRectSdf(cx, cy, halfW, halfH, radius) {
  const qx = Math.abs(cx) - (halfW - radius);
  const qy = Math.abs(cy) - (halfH - radius);
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
  const inside = Math.min(Math.max(qx, qy), 0);
  return outside + inside - radius;
}

/** Signed distance to a line segment, used to stroke the checkmark. */
function segmentSdf(px, py, ax, ay, bx, by, radius) {
  const vx = bx - ax;
  const vy = by - ay;
  const wx = px - ax;
  const wy = py - ay;
  const t = Math.max(0, Math.min(1, (wx * vx + wy * vy) / (vx * vx + vy * vy)));
  return Math.hypot(wx - vx * t, wy - vy * t) - radius;
}

function subtract(a, b) {
  return (x, y) => Math.max(a(x, y), -b(x, y));
}

// ---------------------------------------------------------------------------
// The mark: a calendar with a check, on a brand-filled rounded square
// ---------------------------------------------------------------------------

function drawIcon(size, { maskable = false } = {}) {
  const canvas = new Canvas(size);

  // The maskable variant is padded to Android's 20% safe area so the glyph
  // survives circular and squircle launcher masks.
  const pad = maskable ? size * 0.1 : 0;
  const plateHalf = size / 2 - pad;
  const plateRadius = plateHalf * (maskable ? 1 : 0.44);

  canvas.fill(
    (x, y) => roundedRectSdf(x + 0.5 - size / 2, y + 0.5 - size / 2, plateHalf, plateHalf, plateRadius),
    BRAND,
  );

  // Glyph geometry, expressed relative to the plate so both variants match.
  const unit = plateHalf * 1.34;
  const stroke = unit * 0.115;
  const cx = size / 2;
  const cy = size / 2;

  // Calendar outline.
  const calHalfW = unit * 0.5;
  const calHalfH = unit * 0.46;
  const calRadius = unit * 0.15;
  const calOutline = (x, y) =>
    Math.abs(
      roundedRectSdf(x + 0.5 - cx, y + 0.5 - cy, calHalfW, calHalfH, calRadius),
    ) - stroke / 2;

  canvas.fill(calOutline, WHITE);

  // Binding tabs poking above the calendar body.
  const tabHalfW = stroke * 0.55;
  const tabTop = cy - calHalfH - unit * 0.13;
  const tabBottom = cy - calHalfH + unit * 0.06;
  canvas.fill((x, y) => {
    for (const offset of [-0.24, 0.24]) {
      const tabX = cx + unit * offset;
      if (
        roundedRectSdf(x + 0.5 - tabX, y + 0.5 - (tabTop + tabBottom) / 2, tabHalfW, (tabBottom - tabTop) / 2, tabHalfW) <=
        0
      ) {
        return -1;
      }
    }
    return 1;
  }, WHITE);

  // Checkmark, punched out of the calendar body.
  const check = (x, y) =>
    Math.min(
      segmentSdf(
        x + 0.5,
        y + 0.5,
        cx - unit * 0.24,
        cy + unit * 0.1,
        cx - unit * 0.06,
        cy + unit * 0.26,
        stroke / 2,
      ),
      segmentSdf(
        x + 0.5,
        y + 0.5,
        cx - unit * 0.06,
        cy + unit * 0.26,
        cx + unit * 0.26,
        cy - unit * 0.14,
        stroke / 2,
      ),
    );

  // The check is clipped to the calendar interior so it never overlaps the
  // outline stroke or escapes the plate.
  const clippedCheck = subtract(
    (x, y) => roundedRectSdf(x + 0.5 - cx, y + 0.5 - cy, calHalfW, calHalfH, calRadius) + stroke,
    check,
  );

  canvas.fill(clippedCheck, BRAND);
  canvas.fill(check, WHITE);

  return encodePng(size, size, canvas.data);
}

const outputDir = join(process.cwd(), "public", "icons");
mkdirSync(outputDir, { recursive: true });

const targets = [
  { file: "icon-192.png", size: 192, maskable: false },
  { file: "icon-512.png", size: 512, maskable: false },
  { file: "icon-maskable-512.png", size: 512, maskable: true },
  { file: "apple-touch-icon.png", size: 180, maskable: true },
];

for (const target of targets) {
  writeFileSync(join(outputDir, target.file), drawIcon(target.size, { maskable: target.maskable }));
  process.stdout.write(`generated ${target.file} (${target.size}x${target.size})\n`);
}