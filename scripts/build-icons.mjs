#!/usr/bin/env node
/*
 * Guidonian Hand brand mark: deterministic vector geometry (ADR 0046, ADR 0047).
 *
 * The hand is a union of primitives measured off a reference drawing (64-unit reference tile):
 * one palm path plus tapered digits, authored thumb-right and mirrored when fitted. The thread is a 3D Catmull-Rom curve (z > 0 in front of
 * the hand, z < 0 behind it) split into front and back runs where it crosses z = 0.
 *
 *   node scripts/build-icons.mjs            public/favicon.svg, docs/brand/guidonica-mark.svg + #g-hand symbol in index.html
 *   node scripts/build-icons.mjs --raster   also apple-touch-icon.png, favicon.ico and the web app manifest
 *                                           icons icon-192/512.png + icon-maskable-512.png (Firefox headless)
 *
 * Zero dependencies. Every coordinate is rounded to 2 decimals so output is byte-stable.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { deflateSync, inflateSync } from 'node:zlib';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const GRID = 64;
const TAU = 2 * Math.PI;

const r2 = (v) => Math.round(v * 100) / 100;
const n = (v) => String(r2(v) === 0 ? 0 : r2(v));
const pt = (p) => `${n(p[0])} ${n(p[1])}`;
// Component-wise, so they work on 2D (x, y) and 3D (x, y, z) points alike.
const add = (a, b) => a.map((v, i) => v + b[i]);
const sub = (a, b) => a.map((v, i) => v - b[i]);
const mul = (a, k) => a.map((v) => v * k);
const lerp = (a, b, t) => add(a, mul(sub(b, a), t));
const unit = (a) => mul(a, 1 / Math.hypot(...a));
const clamp01 = (t) => Math.min(Math.max(t, 0), 1);

/* ---------------------------------------------------------------- geometry */

// Authoring frame = the reference drawing: little finger on the left, thumb on the right.
// fitter() mirrors it, so the icon shows the student's own left palm (thumb on the left).
// Reference-tile units. root = axis point at the palm crease, tip = extreme tip point,
// wb / wt = width at the root / across the tip, sink = how far the digit runs on under the palm.
const FINGERS = [
  { name: 'little', root: [17.6, 29.5], tip: [13.45, 15.57], wb: 4.4, wt: 3.5, sink: 3 },
  { name: 'ring', root: [23.9, 27.5], tip: [20.69, 6.89], wb: 5, wt: 4, sink: 3 },
  { name: 'middle', root: [30.8, 27], tip: [29.23, 3.2], wb: 5.3, wt: 4.4, sink: 3 },
  { name: 'index', root: [37.97, 28], tip: [40.44, 7.38], wb: 5.2, wt: 4, sink: 3 },
];
const THUMB = { name: 'thumb', root: [46, 39.5], tip: [55.8, 27.6], wb: 6, wt: 4, sink: 2.5 };
// Stations (gamut positions) and joints as a fraction of root → tip.
const T = { base: 0.06, mid: 0.4, upper: 0.675, tip: 0.86 };
const TT = { base: 0.2, joint: 0.53, tip: 0.86 };

/** Tapered digit: straight axis, slightly convex edges, semicircular tip. nl = unit normal towards the little-finger side. */
function digit({ name, root, tip, wb, wt, sink }) {
  const len = Math.hypot(tip[0] - root[0], tip[1] - root[1]);
  const d = unit(sub(tip, root));
  const nl = [d[1], -d[0]];
  const rt = wt / 2;
  const tc = 1 - rt / len; // tip-circle centre
  const at = (t) => add(root, mul(d, t * len));
  const half = (t) => (wb + (wt - wb) * clamp01(t / tc)) / 2;
  const base = at(-sink / len);
  const c = at(tc);
  const bulge = wb * 0.07;
  const mid = lerp(base, c, 0.5);
  const hm = (wb + wt) / 4;
  const path = `M ${pt(add(base, mul(nl, wb / 2)))} Q ${pt(add(mid, mul(nl, hm + bulge)))} ${pt(add(c, mul(nl, rt)))} ` +
    `A ${n(rt)} ${n(rt)} 0 0 1 ${pt(sub(c, mul(nl, rt)))} Q ${pt(sub(mid, mul(nl, hm + bulge)))} ${pt(sub(base, mul(nl, wb / 2)))} Z`;
  return { name, root, tip, wb, wt, len, d, nl, at, half, path, edge: (t, s) => add(at(t), mul(nl, s * half(t))) };
}

// Palm outline below the crease line, measured off the reference: hypothenar, wrist, thenar.
const PALM_OUTLINE = 'C 16.3 35 17.1 41 18.2 46.2 C 18.9 49.6 19.9 52.6 21.9 54.9 L 21.9 59.3 Q 30.5 59.9 39.1 59.3 C 39.8 57.2 40.1 55.2 40.5 53.6 C 42.4 50.6 46 47.8 47.4 44.4';

function palmPath(fingers, thumb) {
  const [little, ring, middle, index] = fingers;
  const valley = (a, b) => { const m = lerp(a.edge(0, -1), b.edge(0, 1), 0.5); return [m[0], m[1] + 1]; };
  return `M ${pt(little.edge(0, 1))} ${PALM_OUTLINE} ` +
    `L ${pt(thumb.edge(0, -1))} L ${pt(thumb.edge(0, 1))} ` +
    `C ${pt(add(thumb.edge(0, 1), [-1.4, -0.4]))} ${pt(add(index.edge(0, -1), [1.6, 3.6]))} ${pt(index.edge(0, -1))} ` +
    `L ${pt(index.edge(0, 1))} Q ${pt(valley(middle, index))} ${pt(middle.edge(0, -1))} ` +
    `L ${pt(middle.edge(0, 1))} Q ${pt(valley(ring, middle))} ${pt(ring.edge(0, -1))} ` +
    `L ${pt(ring.edge(0, 1))} Q ${pt(valley(little, ring))} ${pt(little.edge(0, -1))} Z`;
}

/* -------------------------------------------------------------------- thread */

const GAP = 0.6; // thread clearance around a digit
const SMALL_RUN = 7; // shortest front run kept at the small detail level

// Helix around a digit axis from t0 to t1: offset nl·R·cos φ in the picture plane, z = R·sin φ.
// phase π/2 starts on the front centre line; its projection is the familiar wrap ellipse.
function coil(g, t0, t1, turns, phase = Math.PI / 2) {
  const steps = Math.max(2, Math.ceil(Math.abs(turns) * 6));
  return Array.from({ length: steps + 1 }, (_, i) => {
    const s = i / steps;
    const t = t0 + (t1 - t0) * s;
    const phi = phase + TAU * turns * s;
    const R = g.half(t) + GAP;
    return [...add(g.at(t), mul(g.nl, R * Math.cos(phi))), R * Math.sin(phi)];
  });
}
// A point on the front centre line of a digit (where a station sits).
const front = (g, t) => [...g.at(t), g.half(t) + GAP];
// A point just beyond a digit's edge (s = +1 on the nl side, −1 opposite), where the thread changes sides.
const rim = (g, t, s) => [...add(g.at(t), mul(g.nl, s * (g.half(t) + GAP))), 0];

/**
 * The thread, after the reference drawing. Γ glows on the thumb tip; two thumb turns cross the
 * front at Γ, A and B (the opening of the gamut); the thread dives behind the thenar, surfaces at
 * the index base, swings an S across the palm, wraps the wrist, climbs behind the hand, crosses the
 * index, slips behind the middle finger and runs down across the palm top behind the hypothenar.
 */
function threadPoints({ thumb, index, little }) {
  return [
    ...coil(thumb, TT.tip, TT.base, 2), ...coil(thumb, TT.base, TT.base - (TT.tip - TT.base) / 8, 0.25).slice(1),
    [45.4, 43.4, -1.8], [41, 36, -1.8],
    rim(index, -0.05, -1),
    [35, 31.6, 1.6], [27.4, 35.6, 1.6], [20.6, 40.6, 1.6], [18.9, 45.4, 0.8], [20.6, 49.8, 1.6],
    [28, 51.6, 1.6], [36.2, 52.8, 1.6], [40.8, 55.6, 0], [39.2, 57.6, -1.6],
    [35, 45, -2], [37.6, 24, -2],
    rim(index, 0.58, -1), front(index, 0.43), rim(index, 0.28, 1),
    [33.2, 24.6, -1.6], [28.4, 26.8, 0],
    [23, 29.6, 1.4], [17.6, 32.8, 1.2], rim(little, -0.45, 1), [16.4, 39, -1.4],
  ];
}
// Gamut stations the thread's front passes cross, in order.
const THREAD_STATIONS = ['Γ', 'A', 'B'];

/** Raw hand geometry (reference-tile units) before fitting into an icon box. */
export function handGeometry() {
  const fingers = FINGERS.map(digit);
  const thumb = digit(THUMB);
  const [little, ring, middle, index] = fingers;
  const on = (g, t) => ({ digit: g, t, p: g.at(t) });
  // The gamut in historical order: a clockwise spiral that walks inward.
  const gamut = [
    ['Γ', on(thumb, TT.tip)], ['A', on(thumb, TT.joint)], ['B', on(thumb, TT.base)],
    ['C', on(index, T.base)], ['D', on(middle, T.base)], ['E', on(ring, T.base)], ['F', on(little, T.base)],
    ['G', on(little, T.mid)], ['a', on(little, T.upper)], ['b', on(little, T.tip)],
    ['c', on(ring, T.tip)], ['d', on(middle, T.tip)], ['e', on(index, T.tip)],
    ['f', on(index, T.upper)], ['g', on(index, T.mid)],
    ['aa', on(middle, T.mid)], ['bb', on(ring, T.mid)], ['cc', on(ring, T.upper)], ['dd', on(middle, T.upper)],
  ].map(([name, s]) => ({ name, ...s }));
  const points = threadPoints({ thumb, index, little }).filter((p, i, a) => i === 0 || Math.hypot(...sub(p, a[i - 1])) > 1e-6);
  return {
    palm: palmPath(fingers, thumb),
    fingers,
    thumb,
    gamut: gamut.map(({ name, digit: g, t, p }) => ({ name, p, front: front(g, t) })),
    thread: { stations: THREAD_STATIONS, points, runs: splitRuns(points) },
    joints: [
      ...fingers.flatMap((f) => [T.mid, T.upper].map((t) => ({ g: f, t }))),
      { g: thumb, t: TT.joint },
    ],
  };
}

/* ------------------------------------------------- 3D curve → front/back runs */

function bezAt(b, t) {
  const u = 1 - t;
  return b[0].map((_, i) => u * u * u * b[0][i] + 3 * u * u * t * b[1][i] + 3 * u * t * t * b[2][i] + t * t * t * b[3][i]);
}

function splitBez(b, t) {
  const [p0, p1, p2, p3] = b;
  const a = lerp(p0, p1, t);
  const m = lerp(p1, p2, t);
  const c = lerp(p2, p3, t);
  const d = lerp(a, m, t);
  const e = lerp(m, c, t);
  const f = lerp(d, e, t);
  return [[p0, a, d, f], [f, e, c, p3]];
}

/**
 * Uniform Catmull-Rom through the 3D points as cubic Béziers, cut at every z = 0 crossing
 * (de Casteljau at the bisected root) and grouped into maximal runs on one side of the hand.
 */
function splitRuns(points) {
  const P = [points[0], ...points, points[points.length - 1]];
  const pieces = [];
  for (let i = 1; i < P.length - 2; i++) {
    let seg = [P[i], add(P[i], mul(sub(P[i + 1], P[i - 1]), 1 / 6)), sub(P[i + 1], mul(sub(P[i + 2], P[i]), 1 / 6)), P[i + 1]];
    const roots = [];
    const N = 32;
    for (let k = 0; k < N; k++) {
      let lo = k / N;
      let hi = (k + 1) / N;
      const zl = bezAt(seg, lo)[2];
      if (Math.sign(zl) * Math.sign(bezAt(seg, hi)[2]) >= 0) continue;
      for (let it = 0; it < 40; it++) {
        const mid = (lo + hi) / 2;
        if (Math.sign(bezAt(seg, mid)[2]) === Math.sign(zl)) lo = mid; else hi = mid;
      }
      roots.push((lo + hi) / 2);
    }
    let done = 0;
    for (const t of roots) {
      const [l, rest] = splitBez(seg, (t - done) / (1 - done));
      pieces.push(l);
      seg = rest;
      done = t;
    }
    pieces.push(seg);
  }
  const runs = [];
  for (const b of pieces) {
    const isFront = bezAt(b, 0.5)[2] >= 0;
    const last = runs[runs.length - 1];
    const c = ` C ${pt(b[1])} ${pt(b[2])} ${pt(b[3])}`;
    const len = Math.hypot(b[3][0] - b[0][0], b[3][1] - b[0][1]);
    if (last && last.front === isFront) { last.d += c; last.len += len; }
    else runs.push({ front: isFront, d: `M ${pt(b[0])}${c}`, len });
  }
  return runs;
}

/* ------------------------------------------------------------ fit & render */

// Uniform scale + translate that centres the hand's bounding box inside [m, 64 − m], mirrored in x
// (scale −k) so the thumb lands on the left. Lighting offsets in the authoring frame are x-flipped to match.
function fitter(g, margin) {
  const ps = [];
  for (const m of g.palm.matchAll(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g)) ps.push([+m[1], +m[2]]);
  for (const f of [...g.fingers, g.thumb]) ps.push(f.tip, add(f.at(1), mul(f.nl, f.wt / 2)), sub(f.at(1), mul(f.nl, f.wt / 2)));
  const xs = ps.map((p) => p[0]);
  const ys = ps.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const k = (GRID - 2 * margin) / Math.max(x1 - x0, y1 - y0);
  const ox = GRID / 2 + ((x0 + x1) / 2) * k;
  const oy = GRID / 2 - ((y0 + y1) / 2) * k;
  const r4 = (v) => String(Math.round(v * 1e4) / 1e4);
  return { k, transform: `matrix(${r4(-k)} 0 0 ${r4(k)} ${r4(ox)} ${r4(oy)})` };
}

// A thin crescent along the cubic p0 → p3: two curves whose control points are pushed ±w apart.
function taper(p0, c1, c2, p3, w) {
  const nrm = mul((([x, y]) => [-y, x])(unit(sub(p3, p0))), w);
  return `M ${pt(p0)} C ${pt(add(c1, nrm))} ${pt(add(c2, nrm))} ${pt(p3)} C ${pt(sub(c2, nrm))} ${pt(sub(c1, nrm))} ${pt(p0)} Z`;
}

// Two short curved creases on the palm side of a joint, bowed towards the tip.
function knuckle(g, t) {
  const h = g.half(t);
  const o = (dt, s) => add(g.at(t + dt / g.len), mul(g.nl, s * h));
  return [
    taper(o(0, 0.62), o(0.35, 0.3), o(0.35, -0.1), o(0.05, -0.35), 0.12),
    taper(o(-0.55, 0.3), o(-0.3, 0.05), o(-0.3, -0.3), o(-0.5, -0.55), 0.1),
  ].join(' ');
}

const PALM_LINES = [
  [[17.4, 34.8], [22, 33.4], [28.6, 33.2], [34.6, 30.4], 0.2], // heart
  [[41.6, 36.6], [35, 36.8], [26.6, 39.4], [21.6, 42.8], 0.22], // head
  [[41, 37.6], [36.4, 41.4], [35.6, 47.6], [37.6, 53], 0.24], // life
  [[24.4, 55.4], [27.6, 55.9], [31.4, 55.9], [34.6, 55.3], 0.14], // wrist creases
  [[25.6, 56.9], [28.4, 57.3], [31.8, 57.3], [33.6, 56.9], 0.11],
];

/** Fitted hand for one detail level, as SVG fragments in reference units inside a fit transform. */
function shapes(detail, margin) {
  const g = handGeometry();
  const fit = fitter(g, margin);
  const digits = [...g.fingers, g.thumb];
  // Below 48 px a coil is noise: the small level keeps only the long front runs.
  const front = g.thread.runs.filter((r) => r.front && (detail === 'full' || r.len >= SMALL_RUN));
  const back = g.thread.runs.filter((r) => !r.front);
  const start = g.thread.points[0];
  return { g, fit, digits, silhouette: [...digits.map((f) => f.path), g.palm], front, back, start };
}

/** Flat header glyph (small detail): hand in currentColor, thread in the accent with a knockout halo. */
export function buildGlyphSymbol() {
  const s = shapes('small', 1.5);
  const k = s.fit.k;
  const line = 2.4 / k;
  const halo = line + 2.4 / k;
  const bead = 3 / k;
  const runs = s.front.map((r) => r.d).join(' ');
  return [
    '<symbol id="g-hand" viewBox="0 0 64 64">',
    `<g transform="${s.fit.transform}">`,
    '<mask id="g-hand-cut" maskUnits="userSpaceOnUse" x="-20" y="-20" width="110" height="110">',
    '<rect x="-20" y="-20" width="110" height="110" fill="#fff"/>',
    `<path d="${runs}" fill="none" stroke="#000" stroke-width="${n(halo)}" stroke-linecap="round" stroke-linejoin="round"/>`,
    `<circle cx="${n(s.start[0])}" cy="${n(s.start[1])}" r="${n(bead + 1.1 / k)}" fill="#000"/>`,
    '</mask>',
    `<g fill="currentColor" mask="url(#g-hand-cut)">${s.silhouette.map((d) => `<path d="${d}"/>`).join('')}</g>`,
    '<g style="fill:var(--accent);stroke:var(--accent)">',
    `<path d="${runs}" fill="none" stroke-width="${n(line)}" stroke-linecap="round" stroke-linejoin="round"/>`,
    `<circle cx="${n(s.start[0])}" cy="${n(s.start[1])}" r="${n(bead)}" stroke="none"/>`,
    '</g>',
    '</g>',
    '</symbol>',
  ].join('');
}

/**
 * Gel app-icon tile. detail 'small' → favicon, 'full' → apple-touch-icon.
 * bleed (default: full) → full-bleed square without the rim, since iOS applies its own mask.
 * margin → space between the hand's bounding box and the tile edge (64-unit grid); the maskable
 * icon widens it to keep the hand inside Android's safe circle.
 */
export function buildTileSvg({ detail = 'small', size = GRID, bleed = detail === 'full', margin = detail === 'full' ? 5.5 : 4 } = {}) {
  const full = detail === 'full';
  const s = shapes(detail, margin);
  const k = s.fit.k;
  const rx = bleed ? 0 : 14;
  const line = (full ? 1.25 : 2.7) / k;
  const bead = (full ? 2.2 : 3.4) / k;
  const handPaths = s.silhouette.map((d) => `<path d="${d}"/>`).join('');
  const frontD = s.front.map((r) => r.d).join(' ');
  const tube = [
    `<path d="${frontD}" fill="none" stroke="#008a70" stroke-width="${n(line + 0.7 / k)}" stroke-linejoin="round"/>`,
    `<path d="${frontD}" fill="none" stroke="#2ef0c8" stroke-width="${n(line)}" stroke-linejoin="round"/>`,
    full ? `<path d="${frontD}" fill="none" stroke="#fff" stroke-opacity="0.35" stroke-width="${n(line * 0.32)}" stroke-linejoin="round" transform="translate(${n(line * 0.16)} ${n(-line * 0.2)})"/>` : '',
  ];
  const defs = [
    '<linearGradient id="gel" x1="0" y1="0" x2="0" y2="1">',
    '<stop offset="0" stop-color="#1d9c82"/><stop offset="0.5" stop-color="#0a6f5b"/><stop offset="1" stop-color="#065646"/>',
    '</linearGradient>',
    // Diagonal sheen: fades out towards its curved lower edge instead of stopping at a hard line.
    '<linearGradient id="sheen" gradientUnits="userSpaceOnUse" x1="21" y1="-4" x2="31" y2="22">',
    '<stop offset="0" stop-color="#fff" stop-opacity="0.42"/><stop offset="0.7" stop-color="#fff" stop-opacity="0.13"/><stop offset="1" stop-color="#fff" stop-opacity="0.03"/>',
    '</linearGradient>',
    '<radialGradient id="glow"><stop offset="0" stop-color="#00ffcc" stop-opacity="0.85"/><stop offset="1" stop-color="#00ffcc" stop-opacity="0"/></radialGradient>',
    `<clipPath id="tile"><rect width="64" height="64" rx="${rx}"/></clipPath>`,
  ];
  let hand;
  if (full) {
    // Light from the top-left: every digit is white on its lit edge, grey on the far edge.
    for (const f of s.digits) {
      const t = 0.5;
      const a = sub(f.at(t), mul(f.nl, f.half(t)));
      const b = add(f.at(t), mul(f.nl, f.half(t)));
      defs.push(`<linearGradient id="d-${f.name}" gradientUnits="userSpaceOnUse" x1="${n(a[0])}" y1="${n(a[1])}" x2="${n(b[0])}" y2="${n(b[1])}">` +
        '<stop offset="0" stop-color="#fff"/><stop offset="0.45" stop-color="#f4f7f8"/><stop offset="1" stop-color="#d3dde0"/></linearGradient>');
    }
    defs.push(
      '<radialGradient id="palm" gradientUnits="userSpaceOnUse" cx="37" cy="37" r="27" fx="39" fy="34">',
      '<stop offset="0" stop-color="#fff"/><stop offset="0.5" stop-color="#f3f6f7"/><stop offset="0.82" stop-color="#dce4e6"/><stop offset="1" stop-color="#c3cfd2"/></radialGradient>',
    );
    hand = [
      `<g fill="#003d31" fill-opacity="0.35" transform="translate(${n(-0.6 / k)} ${n(1.2 / k)})">${handPaths}</g>`,
      `<path d="${s.back.map((r) => r.d).join(' ')}" fill="none" stroke="#0b8a72" stroke-width="${n(line * 0.72)}"/>`,
      // Outline of the union: every primitive stroked, then every fill on top hides the inner seams.
      `<g fill="none" stroke="#a9bcc0" stroke-width="${n(1 / k)}" stroke-linejoin="round">${handPaths}</g>`,
      ...s.digits.map((f) => `<path d="${f.path}" fill="url(#d-${f.name})"/>`),
      `<path d="${s.g.palm}" fill="url(#palm)"/>`,
      `<g fill="#9fb0b4">${PALM_LINES.map(([a, b, c, d, w]) => `<path d="${taper(a, b, c, d, w)}"/>`).join('')}` +
        `${s.g.joints.map(({ g, t }) => `<path d="${knuckle(g, t)}"/>`).join('')}</g>`,
      ...tube,
    ];
  } else {
    defs.push(
      '<linearGradient id="pearl" gradientUnits="userSpaceOnUse" x1="14" y1="6" x2="50" y2="60">',
      '<stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#dfeeea"/></linearGradient>',
    );
    hand = [
      `<g fill="#003d31" fill-opacity="0.38" transform="translate(${n(-0.6 / k)} ${n(1.2 / k)})">${handPaths}</g>`,
      `<g fill="url(#pearl)">${handPaths}</g>`,
      ...tube,
    ];
  }
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${size}" height="${size}">`,
    `<defs>${defs.join('')}</defs>`,
    `<rect width="64" height="64" rx="${rx}" fill="url(#gel)"/>`,
    '<path d="M 0 0 L 64 0 L 64 11.5 Q 30 19 0 36.5 Z" fill="url(#sheen)" clip-path="url(#tile)"/>',
    bleed ? '' : `<rect x="1.4" y="1.4" width="61.2" height="61.2" rx="${rx - 1.4}" fill="none" stroke="#fff" stroke-opacity="0.85" stroke-width="${full ? 0.8 : 1.1}"/>`,
    `<g transform="${s.fit.transform}">`,
    ...hand,
    `<circle cx="${n(s.start[0])}" cy="${n(s.start[1])}" r="${n(bead * 2.1)}" fill="url(#glow)"/>`,
    `<circle cx="${n(s.start[0])}" cy="${n(s.start[1])}" r="${n(bead)}" fill="#2ef0c8" stroke="#008a70" stroke-width="${n((full ? 0.6 : 1) / k)}"/>`,
    '</g>',
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

// Maskable icon margin: the hand's silhouette must stay inside the central circle of radius 0.4 · size
// (25.6 units on the 64 grid) that every Android launcher mask preserves.
export const MASKABLE_MARGIN = 12;

function main() {
  const favicon = buildTileSvg({ detail: 'small' });
  writeFileSync(join(ROOT, 'public/favicon.svg'), `${favicon}\n`);
  mkdirSync(join(ROOT, 'docs/brand'), { recursive: true });
  writeFileSync(join(ROOT, 'docs/brand/guidonica-mark.svg'), `${buildTileSvg({ detail: 'full', bleed: false, size: 256 })}\n`);

  const indexPath = join(ROOT, 'index.html');
  const html = readFileSync(indexPath, 'utf-8');
  const next = html.replace(/<symbol id="g-hand"[\s\S]*?<\/symbol>/, buildGlyphSymbol());
  if (next !== html) writeFileSync(indexPath, next);

  if (process.argv.includes('--raster')) {
    writeFileSync(join(ROOT, 'public/apple-touch-icon.png'), rasterize(buildTileSvg({ detail: 'full' }), 180));
    // The tile's rx = 14 on the 64 grid → 7 px at 32 px.
    writeFileSync(join(ROOT, 'public/favicon.ico'), pngToIco(roundCorners(rasterize(favicon, 32), 7), 32));
    // Web app manifest: rimmed rounded tiles for 'any' (rx = 14/64 of the size), full bleed for 'maskable'.
    for (const size of [192, 512]) {
      writeFileSync(join(ROOT, `public/icon-${size}.png`), roundCorners(rasterize(buildTileSvg({ detail: 'full', bleed: false }), size), (size * 14) / GRID));
    }
    writeFileSync(join(ROOT, 'public/icon-maskable-512.png'), rasterize(buildTileSvg({ detail: 'full', margin: MASKABLE_MARGIN }), 512));
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
