#!/usr/bin/env node
/*
 * Guidonian Hand brand mark: deterministic vector geometry (ADR 0046).
 *
 * The hand is a union of primitives on a 64-unit grid: a palm path plus
 * capsule phalanges. One Catmull-Rom spline walks the 19 on-hand gamut
 * positions (Γ … dd) in their historical order.
 *
 *   node scripts/build-icons.mjs            public/favicon.svg + #g-hand symbol in index.html
 *   node scripts/build-icons.mjs --raster   also apple-touch-icon.png + favicon.ico (Firefox headless)
 *
 * Zero dependencies. Every coordinate is rounded to 2 decimals so output is byte-stable.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { deflateSync, inflateSync } from 'node:zlib';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const GRID = 64;

const r2 = (v) => Math.round(v * 100) / 100;
const n = (v) => String(r2(v) === 0 ? 0 : r2(v));
const pt = (p) => `${n(p[0])} ${n(p[1])}`;
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const mul = (a, k) => [a[0] * k, a[1] * k];
const lerp = (a, b, t) => add(a, mul(sub(b, a), t));
const unit = (a) => mul(a, 1 / Math.hypot(a[0], a[1]));
const dirOf = (deg) => [Math.sin((deg * Math.PI) / 180), -Math.cos((deg * Math.PI) / 180)];

/* ---------------------------------------------------------------- geometry */

// Left hand, palm towards the viewer: little finger on the left, thumb on the right.
// root = base crease on the palm arc, angle = fan from vertical (+ leans right), len = root → tip.
const MIDDLE = 27;
const WIDTH = 5.8;
const FINGERS = [
  { name: 'little', root: [20.2, 34.4], angle: -18, len: 0.74 * MIDDLE },
  { name: 'ring', root: [26.8, 32.2], angle: -6, len: 0.92 * MIDDLE },
  { name: 'middle', root: [33.4, 31.6], angle: 5, len: 1.0 * MIDDLE },
  { name: 'index', root: [39.8, 32.6], angle: 16, len: 0.93 * MIDDLE },
];
// Phalanx crease positions as a fraction of root → tip; the gamut sits on base, joints and tip.
const T = { base: 0.04, mid: 0.42, upper: 0.7, tip: 0.9 };
const THUMB = { base: [39.8, 50], joint: [47.2, 43], tip: [50.8, 35], width: [10.4, 8.6] };
const PALM = 'M 17.8 34 C 16.6 42 17.4 50 20.6 54.6 C 24 59 35 59.2 38.8 55.4 C 41.4 53 45 50 45.8 46.4 C 45 41.6 43.2 37 42.4 34.4 C 41.9 33 41 32.6 40 32.4 L 21 33 Z';

/** Raw hand geometry before fitting into an icon box. */
export function handGeometry() {
  const fingers = FINGERS.map((f) => {
    const d = dirOf(f.angle);
    const r = WIDTH / 2;
    const at = (t) => add(f.root, mul(d, t * f.len));
    return {
      name: f.name,
      // Centre line: starts r below the crease (overlapping the palm), ends r short of the tip.
      a: sub(f.root, mul(d, r)),
      b: at(1 - r / f.len),
      r,
      angle: f.angle,
      len: f.len,
      joints: { base: at(T.base), mid: at(T.mid), upper: at(T.upper), tip: at(T.tip) },
      creases: [T.mid, T.upper].map(at),
      dir: d,
    };
  });
  const [little, ring, middle, index] = fingers;
  const thumbTip = sub(THUMB.tip, mul(unit(sub(THUMB.tip, THUMB.joint)), THUMB.width[1] * 0.12));
  const thumb = {
    name: 'thumb',
    segments: [
      { a: THUMB.base, b: THUMB.joint, r: THUMB.width[0] / 2 },
      { a: THUMB.joint, b: THUMB.tip, r: THUMB.width[1] / 2 },
    ],
    joints: { base: lerp(THUMB.base, THUMB.joint, 0.22), joint: THUMB.joint, tip: thumbTip },
    creases: [THUMB.joint],
    dir: unit(sub(THUMB.tip, THUMB.base)),
  };
  // The gamut in historical order: a clockwise spiral that walks inward.
  const gamut = [
    ['Γ', thumb.joints.tip], ['A', thumb.joints.joint], ['B', thumb.joints.base],
    ['C', index.joints.base], ['D', middle.joints.base], ['E', ring.joints.base], ['F', little.joints.base],
    ['G', little.joints.mid], ['a', little.joints.upper], ['b', little.joints.tip],
    ['c', ring.joints.tip], ['d', middle.joints.tip], ['e', index.joints.tip],
    ['f', index.joints.upper], ['g', index.joints.mid],
    ['aa', middle.joints.mid], ['bb', ring.joints.mid], ['cc', ring.joints.upper], ['dd', middle.joints.upper],
  ].map(([name, p]) => ({ name, p }));
  return { palm: PALM, fingers, thumb, gamut };
}

/* ------------------------------------------------------------ fit & render */

// Uniform scale + translate that centres the hand's bounding box inside [m, 64 − m].
function fitter(g, margin) {
  const xs = [];
  const ys = [];
  const push = (p, r = 0) => { xs.push(p[0] - r, p[0] + r); ys.push(p[1] - r, p[1] + r); };
  for (const f of g.fingers) { push(f.a, f.r); push(f.b, f.r); }
  for (const s of g.thumb.segments) { push(s.a, s.r); push(s.b, s.r); }
  for (const m of g.palm.matchAll(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g)) push([+m[1], +m[2]]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const k = (GRID - 2 * margin) / Math.max(x1 - x0, y1 - y0);
  const ox = GRID / 2 - ((x0 + x1) / 2) * k;
  const oy = GRID / 2 - ((y0 + y1) / 2) * k;
  return { k, p: (q) => [q[0] * k + ox, q[1] * k + oy] };
}

function capsule(a, b, r) {
  const nrm = mul((([x, y]) => [-y, x])(unit(sub(b, a))), r);
  return `M ${pt(add(a, nrm))} L ${pt(add(b, nrm))} A ${n(r)} ${n(r)} 0 0 0 ${pt(sub(b, nrm))} ` +
    `L ${pt(sub(a, nrm))} A ${n(r)} ${n(r)} 0 0 0 ${pt(add(a, nrm))} Z`;
}

function palmPath(d, fit) {
  return d.replace(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g, (_, x, y) => pt(fit.p([+x, +y])));
}

// Uniform Catmull-Rom through the points, emitted as cubic Béziers.
function spline(points) {
  const P = [points[0], ...points, points[points.length - 1]];
  let d = `M ${pt(P[1])}`;
  for (let i = 1; i < P.length - 2; i++) {
    const c1 = add(P[i], mul(sub(P[i + 1], P[i - 1]), 1 / 6));
    const c2 = sub(P[i + 1], mul(sub(P[i + 2], P[i]), 1 / 6));
    d += ` C ${pt(c1)} ${pt(c2)} ${pt(P[i + 1])}`;
  }
  return d;
}

// Short stroke across a phalanx at point c, perpendicular to dir, inset from both edges.
function crease(c, dir, half) {
  const nrm = mul([-dir[1], dir[0]], half);
  return `M ${pt(sub(c, nrm))} L ${pt(add(c, nrm))}`;
}

// The small level walks the same spiral through fewer stations so it survives 16–32 px.
const SMALL_STATIONS = ['Γ', 'B', 'C', 'F', 'G', 'b', 'c', 'd', 'e', 'g', 'aa'];

/** Fitted hand shapes for one detail level. */
function shapes(detail, margin) {
  const g = handGeometry();
  const fit = fitter(g, margin);
  const k = fit.k;
  const hand = [
    palmPath(g.palm, fit),
    ...g.thumb.segments.map((s) => capsule(fit.p(s.a), fit.p(s.b), s.r * k)),
    ...g.fingers.map((f) => capsule(fit.p(f.a), fit.p(f.b), f.r * k)),
  ];
  const stations = detail === 'full' ? g.gamut : g.gamut.filter((s) => SMALL_STATIONS.includes(s.name));
  const pts = stations.map((s) => fit.p(s.p));
  const creases = detail === 'full'
    ? [
      ...g.fingers.flatMap((f) => f.creases.map((c) => crease(fit.p(c), f.dir, f.r * k * 0.62))),
      crease(fit.p(g.thumb.creases[0]), g.thumb.dir, 3.3 * 0.62 * k),
    ]
    : [];
  return { hand, spiral: spline(pts), start: pts[0], end: pts[pts.length - 1], creases, k };
}

/** Flat header glyph (small detail): hand in currentColor, spiral in the accent with a knockout halo. */
export function buildGlyphSymbol() {
  const s = shapes('small', 2);
  const line = 2.2;
  const halo = line + 2.2;
  return [
    '<symbol id="g-hand" viewBox="0 0 64 64">',
    '<mask id="g-hand-cut" maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64">',
    '<rect width="64" height="64" fill="#fff"/>',
    `<path d="${s.spiral}" fill="none" stroke="#000" stroke-width="${n(halo)}" stroke-linecap="round" stroke-linejoin="round"/>`,
    `<circle cx="${n(s.start[0])}" cy="${n(s.start[1])}" r="${n(3 + 1.1)}" fill="#000"/>`,
    '</mask>',
    `<g fill="currentColor" mask="url(#g-hand-cut)">${s.hand.map((d) => `<path d="${d}"/>`).join('')}</g>`,
    `<g style="fill:var(--accent);stroke:var(--accent)">`,
    `<path d="${s.spiral}" fill="none" stroke-width="${n(line)}" stroke-linecap="round" stroke-linejoin="round"/>`,
    `<circle cx="${n(s.start[0])}" cy="${n(s.start[1])}" r="3" stroke="none"/>`,
    '</g>',
    '</symbol>',
  ].join('');
}

/**
 * Gel app-icon tile. detail 'small' → favicon (rounded tile), 'full' → apple-touch-icon
 * (full-bleed square; iOS applies its own mask).
 */
export function buildTileSvg({ detail = 'small', size = GRID } = {}) {
  const full = detail === 'full';
  const s = shapes(detail, full ? 9 : 5);
  const rx = full ? 0 : 14;
  const line = full ? 1.15 : 2.6;
  const bead = full ? 2.3 : 3.4;
  const handPaths = s.hand.map((d) => `<path d="${d}"/>`).join('');
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${size}" height="${size}">`,
    '<defs>',
    '<linearGradient id="gel" x1="0" y1="0" x2="0" y2="1">',
    '<stop offset="0" stop-color="#17a387"/><stop offset="0.5" stop-color="#00826a"/><stop offset="1" stop-color="#006e58"/>',
    '</linearGradient>',
    '<linearGradient id="gloss" x1="0" y1="0" x2="0" y2="1">',
    '<stop offset="0" stop-color="#fff" stop-opacity="0.5"/><stop offset="1" stop-color="#fff" stop-opacity="0.06"/>',
    '</linearGradient>',
    '<linearGradient id="pearl" gradientUnits="userSpaceOnUse" x1="14" y1="6" x2="50" y2="60">',
    '<stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#e6fff8"/>',
    '</linearGradient>',
    '<radialGradient id="glow"><stop offset="0" stop-color="#00ffcc" stop-opacity="0.85"/><stop offset="1" stop-color="#00ffcc" stop-opacity="0"/></radialGradient>',
    '</defs>',
    `<rect width="64" height="64" rx="${rx}" fill="url(#gel)"/>`,
    // Gloss cap on the top half, then the 1px top specular.
    `<path d="M ${rx ? 3 : 0} ${rx ? 14 : 0} ${rx ? 'Q 3 3 14 3 L 50 3 Q 61 3 61 14' : 'L 64 0'} L ${rx ? 61 : 64} 26 Q 32 34 ${rx ? 3 : 0} 26 Z" fill="url(#gloss)"/>`,
    rx
      ? '<path d="M 6 1.5 L 58 1.5" stroke="#fff" stroke-opacity="0.75" stroke-width="1" stroke-linecap="round"/>'
      : '<path d="M 0 0.5 L 64 0.5" stroke="#fff" stroke-opacity="0.6" stroke-width="1"/>',
    // Contact shadow: the hand silhouette offset down-right (light from top-left).
    `<g fill="#003d31" fill-opacity="0.38" transform="translate(0.6 1.2)">${handPaths}</g>`,
    `<g fill="url(#pearl)">${handPaths}</g>`,
    s.creases.length
      ? `<path d="${s.creases.join(' ')}" fill="none" stroke="#7fbfae" stroke-width="0.9" stroke-linecap="round"/>`
      : '',
    `<path d="${s.spiral}" fill="none" stroke="#006652" stroke-width="${n(line)}" stroke-linecap="round" stroke-linejoin="round"/>`,
    full ? `<circle cx="${n(s.end[0])}" cy="${n(s.end[1])}" r="${n(bead * 0.7)}" fill="#006652"/>` : '',
    `<circle cx="${n(s.start[0])}" cy="${n(s.start[1])}" r="${n(bead * 2.1)}" fill="url(#glow)"/>`,
    `<circle cx="${n(s.start[0])}" cy="${n(s.start[1])}" r="${n(bead)}" fill="#00ffcc" stroke="#006652" stroke-width="${full ? 0.8 : 1.1}"/>`,
    '</svg>',
  ].join('');
}

/* ------------------------------------------------------------------ rasters */

// Rasterizes an SVG string at size × size through headless Firefox (a dev-only step).
function rasterize(svg, size) {
  const dir = mkdtempSync(join(tmpdir(), 'guidonica-icons-'));
  try {
    const html = join(dir, 'tile.html');
    const png = join(dir, 'out.png');
    writeFileSync(html, `<!doctype html><html><body style="margin:0;background:transparent">${svg.replace(/width="\d+" height="\d+"/, `width="${size}" height="${size}" style="display:block"`)}</body></html>`);
    execFileSync('firefox', ['--headless', '--no-remote', '--profile', join(dir, 'p'), '--screenshot', png, `--window-size=${size},${size}`, pathToFileURL(html).href], { stdio: 'ignore' });
    return readFileSync(png);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const CRC_TABLE = Array.from({ length: 256 }, (_, i) => {
  let c = i;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

/**
 * Screenshots have an opaque page background, so the rounded tile's corners come out white.
 * Decodes the 8-bit RGBA PNG, multiplies alpha by the rounded-rect coverage (4×4 supersampled)
 * and re-encodes it. Pure Node (zlib); handles the 5 PNG scanline filters.
 */
export function roundCorners(png, rx) {
  const w = png.readUInt32BE(16);
  const h = png.readUInt32BE(20);
  if (png[24] !== 8 || png[25] !== 6 || png[28] !== 0) throw new Error('expected 8-bit RGBA, non-interlaced PNG');
  const idat = [];
  for (let o = 8; o < png.length;) {
    const len = png.readUInt32BE(o);
    if (png.toString('ascii', o + 4, o + 8) === 'IDAT') idat.push(png.subarray(o + 8, o + 8 + len));
    o += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = w * 4;
  const px = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    for (let x = 0; x < stride; x++) {
      const v = raw[y * (stride + 1) + 1 + x];
      const a = x >= 4 ? px[y * stride + x - 4] : 0;
      const b = y > 0 ? px[(y - 1) * stride + x] : 0;
      const c = x >= 4 && y > 0 ? px[(y - 1) * stride + x - 4] : 0;
      const p = a + b - c;
      const pa = Math.abs(p - a);
      const pb = Math.abs(p - b);
      const pc = Math.abs(p - c);
      const pred = [0, a, b, (a + b) >> 1, pa <= pb && pa <= pc ? a : pb <= pc ? b : c][f];
      px[y * stride + x] = (v + pred) & 0xff;
    }
  }
  const inside = (x, y) => {
    const cx = Math.min(Math.max(x, rx), w - rx);
    const cy = Math.min(Math.max(y, rx), h - rx);
    return (x - cx) ** 2 + (y - cy) ** 2 <= rx * rx;
  };
  const out = Buffer.alloc(h * (stride + 1));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let cover = 0;
      for (let sy = 0; sy < 4; sy++) for (let sx = 0; sx < 4; sx++) cover += inside(x + (sx + 0.5) / 4, y + (sy + 0.5) / 4);
      const i = y * stride + x * 4;
      px.copy(out, y * (stride + 1) + 1 + x * 4, i, i + 3);
      out[y * (stride + 1) + 1 + x * 4 + 3] = Math.round((px[i + 3] * cover) / 16);
    }
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  return Buffer.concat([
    png.subarray(0, 8),
    chunk('IHDR', png.subarray(16, 29)),
    chunk('IDAT', deflateSync(out, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Wraps one PNG in an ICO container (PNG-in-ICO, valid since Windows Vista). */
export function pngToIco(png, size) {
  const head = Buffer.alloc(22);
  head.writeUInt16LE(0, 0); // reserved
  head.writeUInt16LE(1, 2); // type: icon
  head.writeUInt16LE(1, 4); // image count
  head.writeUInt8(size >= 256 ? 0 : size, 6);
  head.writeUInt8(size >= 256 ? 0 : size, 7);
  head.writeUInt8(0, 8); // palette
  head.writeUInt8(0, 9); // reserved
  head.writeUInt16LE(1, 10); // colour planes
  head.writeUInt16LE(32, 12); // bits per pixel
  head.writeUInt32LE(png.length, 14);
  head.writeUInt32LE(22, 18); // image offset
  return Buffer.concat([head, png]);
}

function main() {
  const favicon = buildTileSvg({ detail: 'small' });
  writeFileSync(join(ROOT, 'public/favicon.svg'), `${favicon}\n`);

  const indexPath = join(ROOT, 'index.html');
  const html = readFileSync(indexPath, 'utf-8');
  const next = html.replace(/<symbol id="g-hand"[\s\S]*?<\/symbol>/, buildGlyphSymbol());
  if (next !== html) writeFileSync(indexPath, next);

  if (process.argv.includes('--raster')) {
    writeFileSync(join(ROOT, 'public/apple-touch-icon.png'), rasterize(buildTileSvg({ detail: 'full' }), 180));
    // The tile's rx = 14 on the 64 grid → 7 px at 32 px.
    writeFileSync(join(ROOT, 'public/favicon.ico'), pngToIco(roundCorners(rasterize(favicon, 32), 7), 32));
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
