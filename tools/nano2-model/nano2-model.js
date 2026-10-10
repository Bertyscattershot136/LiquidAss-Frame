// Procedural assPod nano (2nd generation): an extruded anodized-aluminum tube whose long sides
// roll a full half circle, cut square at both ends and closed by flat plastic caps (hold switch on
// top; dock connector and headphone jack on the bottom), a small LCD near the top and a click wheel
// that rocks and a center button that sinks. Everything is built from code and canvases; there are
// no asset files.
//
// Dimensions from the blueprint (90 x 40 x 6.5 mm, window 31.62 x 24.04 mm) and the user guide's
// front, top and bottom views (wheel, center button, hold switch and port positions).
//
// Local frame (as tools/asspod-model): meters, origin at the body center, +X right, +Y toward the
// hold switch, +Z out of the screen. Wheel angle: 0 = top (MENU), clockwise seen from the front.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { drawPeachSilhouette } from '../../device/asspod/src/brand/peach.js';

const MM = 0.001;

export const GEOMETRY = Object.freeze({
  BODY: Object.freeze({ w: 40 * MM, h: 90 * MM, d: 6.5 * MM }),
  WINDOW: Object.freeze({ cy: (45 - 4.1 - 24.04 / 2) * MM, w: 31.62 * MM, h: 24.04 * MM }),
  LCD: Object.freeze({ w: 29.6 * MM, h: 22.2 * MM }),   // 1.5", 176 x 132
  WHEEL: Object.freeze({ cy: (45 - 58.3) * MM, rOuter: 15.2 * MM, rCenter: 6.55 * MM }),
  CAP: Object.freeze({ wall: 0.4 * MM, recess: 0.25 * MM }),
});

const { BODY, WINDOW, LCD, WHEEL, CAP } = GEOMETRY;
const HW = BODY.w / 2;
const HH = BODY.h / 2;
const HD = BODY.d / 2;
const EDGE_R = HD;                       // the long sides are a full half circle
const FLAT_HW = HW - EDGE_R;             // half-width of the flat front and back
const FRONT_Z = HD;
const BACK_Z = -HD;
const WELL_R = WHEEL.rOuter + 0.08 * MM; // hole in the front around the wheel
const WELL_DEPTH = 1.3 * MM;
const WHEEL_T = 0.8 * MM;                // wheel and button thickness, so their sides show when they move
const CENTER_GAP = 0.15 * MM;            // between the button and the wheel's inner edge
const ROCK_ANGLE = -2.2 * Math.PI / 180;
const SINK = 0.4 * MM;
const GRAIN_TILE = 16 * MM;              // one grain texture tile spans 16 mm of aluminum
export const SECTOR_ANGLE = Object.freeze({ menu: 0, next: Math.PI / 2, play: Math.PI, prev: Math.PI * 1.5 });

// Anodized colors, picked against the 2006 lineup shot. `metal` is the tint of the aluminum
// (metalness 1), `wheel`/`label`/`gap` the click wheel. The end caps are white plastic on every one.
export const FINISHES = Object.freeze({
  silver: { name: 'Silver', metal: '#d3d6da', rough: 0.42, wheel: '#f3f3f1', label: '#9a9da2', gap: '#b9bbbe' },
  green: { name: 'Green', metal: '#7fd12a', rough: 0.4, wheel: '#f3f3f1', label: '#9a9da2', gap: '#b9bbbe' },
  blue: { name: 'Blue', metal: '#1ea9e3', rough: 0.4, wheel: '#f3f3f1', label: '#9a9da2', gap: '#b9bbbe' },
  pink: { name: 'Pink', metal: '#ec2c95', rough: 0.4, wheel: '#f3f3f1', label: '#9a9da2', gap: '#b9bbbe' },
  black: { name: 'Black', metal: '#16171a', rough: 0.46, wheel: '#2e2f33', label: '#d9dadc', gap: '#18181a' },
  red: { name: '(PRODUCT)RED', metal: '#e0121b', rough: 0.4, wheel: '#f3f3f1', label: '#9a9da2', gap: '#b9bbbe' },
});

// ---------------------------------------------------------------- geometry

// Cross-section in XZ: flat front and back joined by half-circle sides. Counter-clockwise from +X
// toward +Z. Each point carries its arc length, so the grain runs on unstretched around the roll.
const SIDE_SEGS = 24;
function crossSection(flatHw, r) {
  const pts = [];
  // right half circle, from the bottom of the back (-90 deg) up through +X to the front (+90 deg)
  for (let i = 0; i <= SIDE_SEGS; i++) {
    const a = -Math.PI / 2 + Math.PI * i / SIDE_SEGS;
    pts.push([flatHw + Math.cos(a) * r, Math.sin(a) * r]);
  }
  // left half circle, from the front over -X to the back
  for (let i = 0; i <= SIDE_SEGS; i++) {
    const a = Math.PI / 2 + Math.PI * i / SIDE_SEGS;
    pts.push([-flatHw + Math.cos(a) * r, Math.sin(a) * r]);
  }
  let s = 0;
  return pts.map((p, i) => {
    if (i > 0) s += Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]);
    return { x: p[0], z: p[1], s };
  });
}

// The two rolled sides and the back, swept straight along Y and cut square at both ends. The flat
// front is its own shape (frontFace) so it can carry the wheel's hole. Segments: 0..SIDE_SEGS-1
// roll the right side, SIDE_SEGS is the flat front (skipped), then the left side, then the closing
// segment is the flat back.
function buildTube() {
  const ring = crossSection(FLAT_HW, EDGE_R);
  const n = ring.length;
  const perimeter = ring[n - 1].s + Math.hypot(ring[0].x - ring[n - 1].x, ring[0].z - ring[n - 1].z);
  const pos = [];
  const nor = [];
  const uv = [];
  const idx = [];
  const ys = [-HH, -HH / 3, HH / 3, HH];
  // The back is one long segment; it needs its own vertices for the wrap-around uv.
  const verts = [...ring, { x: ring[0].x, z: ring[0].z, s: perimeter }];
  for (const y of ys) {
    for (let i = 0; i < verts.length; i++) {
      const p = verts[i];
      pos.push(p.x, y, p.z);
      const cx = p.x >= 0 ? FLAT_HW : -FLAT_HW;
      // flat back points (the closing segment) face -Z; roll points face out of their circle
      const onBack = i === verts.length - 1 || (i === 0);
      const nx = (p.x - cx) / EDGE_R, nz = p.z / EDGE_R;
      if (onBack) nor.push(0, 0, -1); else nor.push(nx, 0, nz);
      uv.push(p.s / GRAIN_TILE, y / GRAIN_TILE);
    }
  }
  const rowLen = verts.length;
  for (let j = 0; j < ys.length - 1; j++) {
    for (let i = 0; i < rowLen - 1; i++) {
      if (i === SIDE_SEGS) continue;   // the flat front
      const a = j * rowLen + i, b = a + 1, c = a + rowLen, d = b + rowLen;
      idx.push(a, c, b, b, c, d);   // ring runs counter-clockwise, rows run +Y: faces out
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  // The two points at -90 deg on the right roll and at the end of the left roll belong to both
  // the roll and the back; the roll end vertices keep the roll normal (which there is (0,-1)), so
  // the shading meets the back without a crease.
  return { geo: g, ring, perimeter };
}

// The flat front with the wheel's hole. Its uv continues the tube's arc length across the front.
function buildFront(ring) {
  const sFrontStart = ring[SIDE_SEGS].s;   // the front edge of the right roll, at x = +FLAT_HW
  const shape = new THREE.Shape();
  shape.moveTo(-FLAT_HW, -HH);
  shape.lineTo(FLAT_HW, -HH);
  shape.lineTo(FLAT_HW, HH);
  shape.lineTo(-FLAT_HW, HH);
  shape.closePath();
  const hole = new THREE.Path();
  hole.absarc(0, WHEEL.cy, WELL_R, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  const g = new THREE.ShapeGeometry(shape, 96);
  g.translate(0, 0, FRONT_Z);
  const p = g.attributes.position;
  const uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, (sFrontStart + FLAT_HW - p.getX(i)) / GRAIN_TILE, p.getY(i) / GRAIN_TILE);
  return g;
}

// Ring of triangles between two equal-length point loops in a plane y = const, facing `dir`.
function annulus(outer, inner, y, dir, withUv) {
  const pos = [];
  const nor = [];
  const uv = [];
  const idx = [];
  const n = outer.length;
  for (const p of [...outer, ...inner]) {
    pos.push(p.x, y, p.z);
    nor.push(0, dir, 0);
    uv.push(p.x / GRAIN_TILE, p.z / GRAIN_TILE);
  }
  for (let i = 0; i < n; i++) {
    const a = i, b = (i + 1) % n, c = n + i, d = n + (i + 1) % n;
    if (dir > 0) idx.push(a, c, b, b, c, d); else idx.push(a, b, c, b, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  if (withUv) g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

function fan(ring, y, dir) {
  const pos = [0, y, 0];
  const nor = [0, dir, 0];
  const idx = [];
  for (const p of ring) { pos.push(p.x, y, p.z); nor.push(0, dir, 0); }
  const n = ring.length;
  for (let i = 0; i < n; i++) {
    const a = 1 + i, b = 1 + (i + 1) % n;
    if (dir > 0) idx.push(0, b, a); else idx.push(0, a, b);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  return g;
}

// The inside of the tube between the cut end and a recessed cap (drawn double-sided).
function innerWall(ring, y0, y1) {
  const pos = [];
  const idx = [];
  const n = ring.length;
  for (const y of [y0, y1]) for (const p of ring) pos.push(p.x, y, p.z);
  for (let i = 0; i < n; i++) {
    const a = i, b = (i + 1) % n, c = n + i, d = n + (i + 1) % n;
    idx.push(a, b, c, b, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function stripTo(g, keep) {
  const out = g.index ? g.toNonIndexed() : g;
  for (const k of Object.keys(out.attributes)) if (!keep.includes(k)) out.deleteAttribute(k);
  return out;
}
const onlyPositionNormal = (g) => stripTo(g, ['position', 'normal']);

// Both ends, cut square: the tube's wall as a thin aluminum rim and the plastic cap set into it.
function buildEnds() {
  const outer = crossSection(FLAT_HW, EDGE_R);
  const inner = crossSection(FLAT_HW, EDGE_R - CAP.wall);
  const rims = [], caps = [], walls = [];
  for (const dir of [1, -1]) {
    const y = dir * HH;
    rims.push(annulus(outer, inner, y, dir, true));
    walls.push(innerWall(inner, y, y - dir * CAP.recess));
    caps.push(fan(inner, y - dir * CAP.recess, dir));
  }
  return {
    rim: mergeGeometries(rims.map((g) => stripTo(g, ['position', 'normal', 'uv']))),
    cap: mergeGeometries(caps.map(onlyPositionNormal)),
    wall: mergeGeometries(walls.map(onlyPositionNormal)),
  };
}

// The well behind the wheel: a dark wall and floor, so a rocking wheel never shows the hollow body.
function buildWell() {
  const wall = new THREE.CylinderGeometry(WELL_R, WELL_R, WELL_DEPTH, 96, 1, true);
  wall.rotateX(Math.PI / 2);
  wall.translate(0, WHEEL.cy, FRONT_Z - WELL_DEPTH / 2);
  const floor = new THREE.CircleGeometry(WELL_R, 96);
  floor.translate(0, WHEEL.cy, FRONT_Z - WELL_DEPTH);
  return mergeGeometries([wall, floor].map(onlyPositionNormal));
}

function roundedRectShape(w, h, r, cx = 0, cy = 0) {
  const s = new THREE.Shape();
  const x0 = cx - w / 2, y0 = cy - h / 2, x1 = cx + w / 2, y1 = cy + h / 2;
  const q = Math.PI / 2;
  s.moveTo(x0 + r, y0);
  s.lineTo(x1 - r, y0);
  s.absarc(x1 - r, y0 + r, r, -q, 0, false);
  s.lineTo(x1, y1 - r);
  s.absarc(x1 - r, y1 - r, r, 0, q, false);
  s.lineTo(x0 + r, y1);
  s.absarc(x0 + r, y1 - r, r, q, 2 * q, false);
  s.lineTo(x0, y0 + r);
  s.absarc(x0 + r, y0 + r, r, 2 * q, 3 * q, false);
  return s;
}
const stadiumShape = (w, h, cx = 0) => roundedRectShape(w, h, h / 2 - 1e-7, cx, 0);

function paint(g, hex) {
  const c = new THREE.Color(hex);
  const n = g.attributes.position.count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

// A flat shape laid on a cap face: up = the top cap (+Y), else the bottom. Shape x stays model x.
function onCap(shape, color, up, lift) {
  const g = new THREE.ShapeGeometry(shape, 12);
  const y = HH - CAP.recess + lift;
  if (up) { g.rotateX(-Math.PI / 2); g.translate(0, y, 0); } else { g.rotateX(Math.PI / 2); g.translate(0, -y, 0); }
  return paint(onlyPositionNormal(g), color);
}

// Hold switch (top), dock connector and headphone jack (bottom), measured off the user guide's end
// views: one vertex-colored mesh. The hold slider is separate (it is the cap's plastic).
const HOLD = Object.freeze({ x0: -17.6 * MM, x1: -6.3 * MM, h: 3.0 * MM, knobW: 4.6 * MM, knobH: 2.3 * MM });
function buildPorts() {
  const parts = [];
  // Hold switch: a pill-shaped slot, dark inside.
  parts.push(onCap(stadiumShape(HOLD.x1 - HOLD.x0, HOLD.h, (HOLD.x0 + HOLD.x1) / 2), '#070708', true, 0.02 * MM));
  // Dock connector: the opening with a square key hole at each end and the contact tongue.
  const dockCx = -6.4 * MM;
  parts.push(onCap(roundedRectShape(21.6 * MM, 2.4 * MM, 0.5 * MM, dockCx, 0), '#0b0b0c', false, 0.02 * MM));
  parts.push(onCap(roundedRectShape(15.0 * MM, 1.3 * MM, 0.25 * MM, -6.5 * MM, 0), '#3b3c40', false, 0.04 * MM));
  for (const x of [-16.1 * MM, 3.4 * MM]) parts.push(onCap(roundedRectShape(1.0 * MM, 1.0 * MM, 0.12 * MM, x, 0), '#2a2b2e', false, 0.04 * MM));
  // Headphone jack: a bright metal ring around a black hole.
  const jx = 16.45 * MM;
  const ring = new THREE.Shape();
  ring.absarc(jx, 0, 2.15 * MM, 0, Math.PI * 2, false);
  const inner = new THREE.Path();
  inner.absarc(jx, 0, 1.7 * MM, 0, Math.PI * 2, true);
  ring.holes.push(inner);
  parts.push(onCap(ring, '#a5a8ad', false, 0.02 * MM));
  const hole = new THREE.Shape();
  hole.absarc(jx, 0, 1.7 * MM, 0, Math.PI * 2, false);
  parts.push(onCap(hole, '#000000', false, 0.02 * MM));
  return mergeGeometries(parts);
}

// The hold slider: a raised pill parked at the left of the slot (hold off), with rounded shoulders.
function buildHoldKnob() {
  const shape = stadiumShape(HOLD.knobW, HOLD.knobH, HOLD.x0 + 0.35 * MM + HOLD.knobW / 2);
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: 0.25 * MM, bevelEnabled: true, bevelThickness: 0.15 * MM, bevelSize: 0.12 * MM, bevelSegments: 3, curveSegments: 16,
  });
  g.rotateX(-Math.PI / 2);   // extrusion +Z becomes +Y
  g.translate(0, HH - CAP.recess - 0.1 * MM, 0);
  return g;
}

// ---------------------------------------------------------------- canvases

// Bead-blasted aluminum: blurred noise as a tileable normal map, plus the same noise as roughness
// variation. Built once and shared.
let grainMaps = null;
function getGrainMaps() {
  if (grainMaps) return grainMaps;
  const S = 512;
  let h = new Float32Array(S * S);
  for (let i = 0; i < h.length; i++) h[i] = Math.random();
  // one wrap-around box blur: grains a couple of texels wide instead of single-pixel sparkle
  for (let pass = 0; pass < 1; pass++) {
    const o = new Float32Array(S * S);
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        let sum = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) sum += h[((y + dy + S) % S) * S + ((x + dx + S) % S)];
        o[y * S + x] = sum / 9;
      }
    }
    h = o;
  }
  const nCv = document.createElement('canvas');
  const rCv = document.createElement('canvas');
  nCv.width = nCv.height = rCv.width = rCv.height = S;
  const nImg = nCv.getContext('2d').createImageData(S, S);
  const rImg = rCv.getContext('2d').createImageData(S, S);
  const k = 9;   // slope strength
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const i = y * S + x;
      const dx = (h[y * S + (x + 1) % S] - h[y * S + (x - 1 + S) % S]) * k;
      const dy = (h[((y + 1) % S) * S + x] - h[((y - 1 + S) % S) * S + x]) * k;
      const l = Math.hypot(dx, dy, 1);
      nImg.data[i * 4] = Math.round((-dx / l * 0.5 + 0.5) * 255);
      nImg.data[i * 4 + 1] = Math.round((dy / l * 0.5 + 0.5) * 255);
      nImg.data[i * 4 + 2] = Math.round((1 / l * 0.5 + 0.5) * 255);
      nImg.data[i * 4 + 3] = 255;
      const r = Math.round(255 * (0.9 + 0.5 * (h[i] - 0.5)));   // roughly 0.8..1 x roughness
      rImg.data[i * 4] = rImg.data[i * 4 + 1] = rImg.data[i * 4 + 2] = Math.max(0, Math.min(255, r));
      rImg.data[i * 4 + 3] = 255;
    }
  }
  nCv.getContext('2d').putImageData(nImg, 0, 0);
  rCv.getContext('2d').putImageData(rImg, 0, 0);
  const normal = new THREE.CanvasTexture(nCv);
  const rough = new THREE.CanvasTexture(rCv);
  for (const t of [normal, rough]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  grainMaps = { normal, rough };
  return grainMaps;
}

const WHEEL_PX = 1024;

export function drawWheel(canvas, fin) {
  const g = canvas.getContext('2d');
  const S = WHEEL_PX;
  const c = S / 2;
  const pxPerM = S / (2 * WHEEL.rOuter);
  const mm = pxPerM * MM;
  g.clearRect(0, 0, S, S);
  g.fillStyle = fin.gap;
  g.fillRect(0, 0, S, S);
  g.beginPath();
  g.arc(c, c, c - 0.1 * mm, 0, Math.PI * 2);
  g.fillStyle = fin.wheel;
  g.fill();

  g.fillStyle = fin.label;
  const labelR = 11.4 * mm;
  g.save();
  g.font = `700 ${Math.round(2.1 * mm)}px "Myriad Pro", "Helvetica Neue", Helvetica, Arial, sans-serif`;
  g.textBaseline = 'middle';
  g.textAlign = 'left';
  const track = 0.22 * mm;
  let total = -track;
  for (const ch of 'MENU') total += g.measureText(ch).width + track;
  let x = c - total / 2;
  for (const ch of 'MENU') { g.fillText(ch, x, c - labelR); x += g.measureText(ch).width + track; }
  g.restore();

  const triH = 1.7 * mm, triW = 1.4 * mm, barW = 0.4 * mm;
  const tri = (x0, cy, dir) => {
    g.beginPath();
    g.moveTo(x0, cy - triH / 2);
    g.lineTo(x0 + dir * triW, cy);
    g.lineTo(x0, cy + triH / 2);
    g.closePath();
    g.fill();
  };
  { // next
    const w = triW * 2 + barW;
    const x0 = c + labelR - w / 2;
    tri(x0, c, 1);
    tri(x0 + triW, c, 1);
    g.fillRect(x0 + triW * 2 - 0.03 * mm, c - triH / 2, barW, triH);
  }
  { // previous
    const w = triW * 2 + barW;
    const x1 = c - labelR + w / 2;
    tri(x1, c, -1);
    tri(x1 - triW, c, -1);
    g.fillRect(x1 - triW * 2 - barW + 0.03 * mm, c - triH / 2, barW, triH);
  }
  { // play/pause
    const gap = 0.42 * mm, pw = 0.38 * mm;
    const w = triW + gap + pw * 2 + 0.34 * mm;
    const x0 = c - w / 2;
    const cy = c + labelR;
    tri(x0, cy, 1);
    g.fillRect(x0 + triW + gap, cy - triH / 2, pw, triH);
    g.fillRect(x0 + triW + gap + pw + 0.34 * mm, cy - triH / 2, pw, triH);
  }
}

export function holdLabelCanvas() {
  const cv = document.createElement('canvas');
  cv.width = 256;
  cv.height = 64;
  const g = cv.getContext('2d');
  g.fillStyle = '#fff';
  g.font = '600 44px "Helvetica Neue", Helvetica, Arial, sans-serif';
  g.textBaseline = 'middle';
  g.fillText('HOLD', 4, 34);
  return cv;
}

// The back's laser engraving as an alpha mask over the whole back (white = engraved).
export function engravingCanvas() {
  const W = 512;
  const H = Math.round(W * BODY.h / BODY.w);
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const g = cv.getContext('2d');
  const k = W / (BODY.w / MM);   // px per mm
  g.fillStyle = '#000';
  g.fillRect(0, 0, W, H);
  const font = (weight, sizeMm) => `${weight} ${sizeMm * k}px "Myriad Pro", "Helvetica Neue", Helvetica, Arial, sans-serif`;
  g.fillStyle = '#fff';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  drawPeachSilhouette(g, W / 2, 36.5 * k, 10 * k, '#fff');
  g.font = font(600, 6.2);
  g.fillText('assPod', W / 2, 46.5 * k);
  g.font = font(400, 2.1);
  g.fillText('4GB', W / 2, 70 * k);
  g.lineWidth = 0.18 * k;
  g.strokeStyle = '#fff';
  g.strokeRect(W / 2 - 3.6 * k, 68.6 * k, 7.2 * k, 2.8 * k);
  g.font = font(400, 0.95);
  g.fillText('Designed by assPod in California  Assembled in a drawer', W / 2, 75.6 * k);
  g.fillText('Model No. A1199-ASS  Rated 5-30V  1A Max', W / 2, 77.1 * k);
  return cv;
}

// ---------------------------------------------------------------- springs

// Exact critically damped step, stable at any dt.
function springStep(s, target, w, dt) {
  const d = s.x - target;
  const c = s.v + w * d;
  const e = Math.exp(-w * dt);
  s.x = target + (d + c * dt) * e;
  s.v = (s.v - c * w * dt) * e;
}

// ---------------------------------------------------------------- model

/**
 * @param {{ envMap?: THREE.Texture|null, finish?: keyof FINISHES, screenCanvas: HTMLCanvasElement, anisotropy?: number }} o
 */
export function createNano2Model({ envMap = null, finish = 'silver', screenCanvas, anisotropy = 1 }) {
  const root = new THREE.Group();
  root.name = 'nano2';

  const grain = getGrainMaps();
  grain.normal.anisotropy = grain.rough.anisotropy = anisotropy;
  // Anodized aluminum: tinted metal, bead-blasted (the grain), under a thin sealed oxide that gives
  // it a faint second sheen.
  const metalMat = new THREE.MeshPhysicalMaterial({
    color: 0xd3d6da, metalness: 1, roughness: 0.42, envMap, envMapIntensity: 1,
    normalMap: grain.normal, normalScale: new THREE.Vector2(0.08, 0.08), roughnessMap: grain.rough,
    clearcoat: 0.3, clearcoatRoughness: 0.3,
  });
  const capMat = new THREE.MeshStandardMaterial({ color: 0xf1f1ef, metalness: 0, roughness: 0.45, envMap });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.8, side: THREE.DoubleSide });

  const tube = buildTube();
  const shell = new THREE.Mesh(tube.geo, metalMat);
  shell.name = 'shell';
  const front = new THREE.Mesh(buildFront(tube.ring), metalMat);
  front.name = 'front';
  const ends = buildEnds();
  const rim = new THREE.Mesh(ends.rim, metalMat);
  const cap = new THREE.Mesh(ends.cap, capMat);
  cap.name = 'caps';
  const wall = new THREE.Mesh(ends.wall, darkMat);
  const well = new THREE.Mesh(buildWell(), darkMat);
  const ports = new THREE.Mesh(buildPorts(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.4, envMap }));
  ports.name = 'ports';
  const knob = new THREE.Mesh(buildHoldKnob(), capMat);
  knob.name = 'hold';
  const holdTex = new THREE.CanvasTexture(holdLabelCanvas());
  holdTex.anisotropy = anisotropy;
  const holdLabel = new THREE.Mesh(
    new THREE.PlaneGeometry(4.6 * MM, 1.15 * MM),
    new THREE.MeshBasicMaterial({ color: 0x8a8d92, alphaMap: holdTex, transparent: true, opacity: 0.9, depthWrite: false }),
  );
  holdLabel.rotation.x = -Math.PI / 2;
  holdLabel.position.set(-5.4 * MM + 2.3 * MM + 0.2 * MM, HH - CAP.recess + 0.02 * MM, 0.05 * MM);
  root.add(shell, front, rim, cap, wall, well, ports, knob, holdLabel);

  // ---- screen: black window, LCD, glass
  const screenTex = new THREE.CanvasTexture(screenCanvas);
  screenTex.colorSpace = THREE.SRGBColorSpace;
  screenTex.anisotropy = anisotropy;
  const windowMesh = new THREE.Mesh(
    new THREE.ShapeGeometry(roundedRectShape(WINDOW.w, WINDOW.h, 0.6 * MM), 4),
    new THREE.MeshBasicMaterial({ color: 0x050607 }),
  );
  windowMesh.position.set(0, WINDOW.cy, FRONT_Z + 0.02 * MM);
  const lcd = new THREE.Mesh(new THREE.PlaneGeometry(LCD.w, LCD.h), new THREE.MeshBasicMaterial({ map: screenTex, toneMapped: false }));
  lcd.position.set(0, WINDOW.cy, FRONT_Z + 0.04 * MM);
  lcd.name = 'lcd';
  const glass = new THREE.Mesh(
    new THREE.ShapeGeometry(roundedRectShape(WINDOW.w, WINDOW.h, 0.6 * MM), 4),
    new THREE.MeshStandardMaterial({
      color: 0x000000, metalness: 0, roughness: 0.04, envMap, envMapIntensity: 0.8,
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    }),
  );
  glass.position.set(0, WINDOW.cy, FRONT_Z + 0.08 * MM);
  glass.renderOrder = 2;
  root.add(windowMesh, lcd, glass);

  // ---- click wheel (rocks as one group) and the aluminum center button (sinks)
  const wheelGroup = new THREE.Group();
  wheelGroup.position.set(0, WHEEL.cy, FRONT_Z);
  root.add(wheelGroup);
  const wheelCanvas = document.createElement('canvas');
  wheelCanvas.width = wheelCanvas.height = WHEEL_PX;
  const wheelTex = new THREE.CanvasTexture(wheelCanvas);
  wheelTex.colorSpace = THREE.SRGBColorSpace;
  wheelTex.anisotropy = anisotropy;
  const wheelMat = new THREE.MeshStandardMaterial({ map: wheelTex, roughness: 0.42, metalness: 0, envMap, envMapIntensity: 0.6 });
  const innerR = WHEEL.rCenter + CENTER_GAP;
  const wheelTop = new THREE.RingGeometry(innerR, WHEEL.rOuter, 160, 1);   // uvs: its bounding square = the canvas
  const sideUv = (geo) => { const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, 0.5, 0.0005); return geo; };
  const wheelSide = sideUv(new THREE.CylinderGeometry(WHEEL.rOuter, WHEEL.rOuter, WHEEL_T, 160, 1, true));
  wheelSide.rotateX(Math.PI / 2);
  wheelSide.translate(0, 0, -WHEEL_T / 2);
  const wheelInner = sideUv(new THREE.CylinderGeometry(innerR, innerR, WHEEL_T, 96, 1, true));
  wheelInner.rotateX(Math.PI / 2);
  wheelInner.translate(0, 0, -WHEEL_T / 2);
  const wheel = new THREE.Mesh(mergeGeometries([wheelTop, wheelSide, wheelInner].map((g) => stripTo(g, ['position', 'normal', 'uv']))), wheelMat);
  wheel.material.side = THREE.DoubleSide;   // the inner wall is seen from inside the ring
  wheel.name = 'wheel';
  wheelGroup.add(wheel);

  const buttonGeo = new THREE.CylinderGeometry(WHEEL.rCenter, WHEEL.rCenter, WHEEL_T, 96, 1, false);
  buttonGeo.rotateX(Math.PI / 2);
  buttonGeo.translate(0, 0, -WHEEL_T / 2);
  { // grain uvs in the same scale as the body
    const p = buttonGeo.attributes.position, uv = buttonGeo.attributes.uv;
    for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / GRAIN_TILE, p.getY(i) / GRAIN_TILE);
  }
  const button = new THREE.Mesh(buttonGeo, metalMat);
  button.name = 'center';
  wheelGroup.add(button);

  // ---- back engraving: the laser takes the dye with it, so the mark reads paler and smoother
  const engraveTex = new THREE.CanvasTexture(engravingCanvas());
  engraveTex.anisotropy = anisotropy;
  const engravingMat = new THREE.MeshStandardMaterial({
    color: 0xffffff, metalness: 1, roughness: 0.22, envMap,
    alphaMap: engraveTex, transparent: true, depthWrite: false,
  });
  const engravingGeo = new THREE.PlaneGeometry(BODY.w, BODY.h);
  engravingGeo.rotateY(Math.PI);   // faces -Z and reads unmirrored from behind
  const engraving = new THREE.Mesh(engravingGeo, engravingMat);
  engraving.position.set(0, 0, BACK_Z - 0.02 * MM);
  engraving.renderOrder = 1;
  engraving.name = 'engraving';
  root.add(engraving);

  // ---- state
  let currentFinish = null;
  function setFinish(key) {
    const k = FINISHES[key] ? key : 'silver';
    if (k === currentFinish) return;
    currentFinish = k;
    const f = FINISHES[k];
    metalMat.color.set(f.metal);
    metalMat.roughness = f.rough;
    metalMat.clearcoat = k === 'black' ? 0.2 : 0.3;
    // Undyed aluminum shows through the engraving: a pale version of the anodized tint.
    engravingMat.color.set(f.metal).lerp(new THREE.Color(0xffffff), k === 'black' ? 0.55 : 0.4);
    drawWheel(wheelCanvas, f);
    wheelTex.needsUpdate = true;
  }
  setFinish(finish);

  const rock = { x: 0, v: 0 };
  let rockTarget = 0;
  const rockAxis = new THREE.Vector3(1, 0, 0);
  const sink = { x: 0, v: 0 };
  let sinkTarget = 0;
  const pressed = new Set();

  function pressDown(part) {
    if (pressed.has(part)) return;
    pressed.add(part);
    if (part === 'select') {
      sinkTarget = 1;
    } else if (part in SECTOR_ANGLE) {
      const a = SECTOR_ANGLE[part];
      rockAxis.set(Math.cos(a), -Math.sin(a), 0);   // tilt the pressed side into the well
      rockTarget = 1;
    }
  }
  function pressUp(part) {
    if (!pressed.delete(part)) return;
    if (part === 'select') sinkTarget = 0;
    else if (part in SECTOR_ANGLE) rockTarget = 0;
  }

  function update(dt) {
    springStep(rock, rockTarget, rockTarget ? 70 : 38, dt);
    springStep(sink, sinkTarget, sinkTarget ? 70 : 38, dt);
    wheelGroup.quaternion.setFromAxisAngle(rockAxis, ROCK_ANGLE * rock.x);
    button.position.z = -SINK * sink.x;
  }

  function markScreenDirty() { screenTex.needsUpdate = true; }

  // ---- wheel hit testing
  const _inv = new THREE.Matrix4();
  const _ray = new THREE.Ray();
  /** Where a ray meets the front plane, in wheel coords (units of rOuter, y up); null if it misses. */
  function projectToWheel(raycaster, out = { x: 0, y: 0 }) {
    root.updateWorldMatrix(true, false);
    _inv.copy(root.matrixWorld).invert();
    _ray.copy(raycaster.ray).applyMatrix4(_inv);
    const dz = _ray.direction.z;
    if (dz > -1e-9) return null;   // parallel, or looking at the back
    const t = (FRONT_Z - _ray.origin.z) / dz;
    if (t < 0) return null;
    out.x = (_ray.origin.x + _ray.direction.x * t) / WHEEL.rOuter;
    out.y = (_ray.origin.y + _ray.direction.y * t - WHEEL.cy) / WHEEL.rOuter;
    return out;
  }
  /** { angle (0 = MENU, clockwise), r (0..1), onCenter } or null off the wheel. */
  function hitTestWheel(raycaster) {
    const p = projectToWheel(raycaster);
    if (!p) return null;
    const r = Math.hypot(p.x, p.y);
    if (r > 1) return null;
    let angle = Math.atan2(p.x, p.y);
    if (angle < 0) angle += Math.PI * 2;
    return { angle, r, onCenter: r * WHEEL.rOuter < WHEEL.rCenter };
  }
  /** The button under a wheel hit: 'select' or the sector's name. */
  function partAt(hit) {
    if (hit.onCenter) return 'select';
    const q = Math.round(hit.angle / (Math.PI / 2)) % 4;
    return ['menu', 'next', 'play', 'prev'][q];
  }

  return {
    root,
    setFinish,
    markScreenDirty,
    pressDown,
    pressUp,
    update,
    hitTestWheel,
    projectToWheel,
    partAt,
    get finish() { return currentFinish; },
    parts: { shell, front, rim, cap, wall, well, ports, knob, holdLabel, lcd, glass, wheel, button, wheelGroup, engraving },
  };
}
