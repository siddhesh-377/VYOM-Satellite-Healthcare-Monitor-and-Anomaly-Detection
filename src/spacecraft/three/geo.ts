import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { M } from './materials';

export type V3 = [number, number, number];
export const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const deg = (d: number) => (d * Math.PI) / 180;

export function mesh(
  geo: THREE.BufferGeometry,
  mat: THREE.Material | THREE.Material[],
  name: string,
  pos?: V3,
  rot?: V3,
) {
  const m = new THREE.Mesh(geo, mat);
  m.name = name;
  m.castShadow = true;
  m.receiveShadow = true;
  if (pos) m.position.set(...pos);
  if (rot) m.rotation.set(...rot);
  return m;
}

/** Group with optional explode vector (world-axis offset at full explosion, in metres). */
export function group(name: string, pos?: V3, explode?: V3) {
  const g = new THREE.Group();
  g.name = name;
  if (pos) g.position.set(...pos);
  if (explode) g.userData.explode = explode;
  return g;
}

export function explode<T extends THREE.Object3D>(obj: T, offset: V3): T {
  obj.userData.explode = offset;
  return obj;
}

// ---------- Primitive geometries along specific axes ----------

/** Cylinder along +X (rTop is at +X). */
export function cylX(rTop: number, rBot: number, len: number, seg = 48, open = false) {
  const g = new THREE.CylinderGeometry(rTop, rBot, len, seg, 1, open);
  g.rotateZ(-Math.PI / 2);
  return g;
}
/** Cylinder along +Z (rTop is at +Z). */
export function cylZ(rTop: number, rBot: number, len: number, seg = 48, open = false) {
  const g = new THREE.CylinderGeometry(rTop, rBot, len, seg, 1, open);
  g.rotateX(Math.PI / 2);
  return g;
}
export function cylY(rTop: number, rBot: number, len: number, seg = 48, open = false) {
  return new THREE.CylinderGeometry(rTop, rBot, len, seg, 1, open);
}
export function box(w: number, h: number, d: number) {
  return new THREE.BoxGeometry(w, h, d);
}
export function torusX(r: number, tube: number, seg = 48) {
  const g = new THREE.TorusGeometry(r, tube, 12, seg);
  g.rotateY(Math.PI / 2);
  return g;
}
export function torusZ(r: number, tube: number, seg = 48) {
  return new THREE.TorusGeometry(r, tube, 12, seg);
}
export function torusY(r: number, tube: number, seg = 48) {
  const g = new THREE.TorusGeometry(r, tube, 12, seg);
  g.rotateX(Math.PI / 2);
  return g;
}

/** Cylinder strut between two points (already transformed, ready to merge). */
export function strutGeo(a: THREE.Vector3, b: THREE.Vector3, r: number, seg = 10) {
  const dir = b.clone().sub(a);
  const len = dir.length();
  const g = new THREE.CylinderGeometry(r, r, len, seg, 1);
  const q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), dir.normalize());
  g.applyMatrix4(new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), q, V(1, 1, 1)));
  return g;
}

export function merge(geos: THREE.BufferGeometry[]) {
  const out = mergeGeometries(geos, false);
  if (!out) throw new Error('merge failed');
  geos.forEach((g) => g.dispose());
  return out;
}

/** Transformed copy helper for merging. */
export function placed(g: THREE.BufferGeometry, pos: V3, rot: V3 = [0, 0, 0]) {
  const m = new THREE.Matrix4().compose(
    V(...pos),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)),
    V(1, 1, 1),
  );
  g.applyMatrix4(m);
  return g;
}

/** Rocket nozzle bell: chamber at top, throat at y=0, exit at y=-len (points -Y). */
export function bellGeo(throatR: number, exitR: number, len: number, seg = 40, steps = 18) {
  const pts: THREE.Vector2[] = [];
  pts.push(new THREE.Vector2(0.001, len * 0.42));
  pts.push(new THREE.Vector2(throatR * 1.7, len * 0.42));
  pts.push(new THREE.Vector2(throatR * 1.7, len * 0.18));
  pts.push(new THREE.Vector2(throatR * 1.25, len * 0.08));
  pts.push(new THREE.Vector2(throatR, 0));
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    pts.push(new THREE.Vector2(throatR + (exitR - throatR) * Math.pow(t, 0.58), -t * len));
  }
  pts.push(new THREE.Vector2(exitR * 0.96, -len * 0.985));
  // LatheGeometry normals face outward only for profiles with increasing Y -> build exit-to-chamber
  pts.reverse();
  const g = new THREE.LatheGeometry(pts, seg);
  return g;
}

/** Nozzle mesh pointing its exit toward `dir`. */
export function nozzle(throatR: number, exitR: number, len: number, name: string, dir: THREE.Vector3, mat?: THREE.Material) {
  const m = mesh(bellGeo(throatR, exitR, len), mat ?? M().inconel, name);
  m.quaternion.setFromUnitVectors(V(0, -1, 0), dir.clone().normalize());
  return m;
}

/** Parabolic dish surface. Opens toward +Y, vertex at origin. */
export function dishGeo(R: number, depth: number, seg = 72, rings = 16, holeR = 0) {
  const f = (R * R) / (4 * depth);
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= rings; i++) {
    const x = holeR + ((R - holeR) * i) / rings;
    pts.push(new THREE.Vector2(x, (x * x) / (4 * f)));
  }
  return new THREE.LatheGeometry(pts, seg);
}

/** Spherical cap: base radius R, sag depth, apex toward -Y, rim at y=0. */
export function capGeo(R: number, sag: number, seg = 64, rings = 12) {
  const sphereR = (R * R + sag * sag) / (2 * sag);
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= rings; i++) {
    const x = (R * i) / rings;
    const y = -(sag - (sphereR - Math.sqrt(sphereR * sphereR - x * x)));
    pts.push(new THREE.Vector2(x, y));
  }
  return new THREE.LatheGeometry(pts, seg);
}

export function latheX(profile: [number, number][], seg = 64) {
  const g = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), seg);
  g.rotateZ(-Math.PI / 2);
  return g;
}
export function latheZ(profile: [number, number][], seg = 64) {
  const g = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), seg);
  g.rotateX(Math.PI / 2);
  return g;
}

// ---------- Orientation helpers ----------

/** Orient object so its local +X points along xAxis and local +Z along zAxis. */
export function orient(obj: THREE.Object3D, xAxis: THREE.Vector3, zAxis: THREE.Vector3) {
  const x = xAxis.clone().normalize();
  const z = zAxis.clone().normalize();
  const y = new THREE.Vector3().crossVectors(z, x).normalize();
  obj.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
}

/**
 * Mount an object on the surface of a body of revolution.
 * axis 'x': body axis is X. Object local +Z = outward normal, local +Y = along body +axis.
 * alphaDeg: cone half-angle (positive = radius shrinking toward +axis).
 */
export function mountRadial(obj: THREE.Object3D, axis: 'x' | 'z', along: number, r: number, phiDeg: number, alphaDeg = 0) {
  const phi = deg(phiDeg);
  const a = deg(alphaDeg);
  const c = Math.cos(phi), s = Math.sin(phi);
  if (axis === 'x') {
    obj.position.set(along, r * c, r * s);
    const n = V(Math.sin(a), Math.cos(a) * c, Math.cos(a) * s);
    const up = V(Math.cos(a), -Math.sin(a) * c, -Math.sin(a) * s); // along +X, tilted with the cone
    orient(obj, new THREE.Vector3().crossVectors(up, n), n);
  } else {
    obj.position.set(r * c, r * s, along);
    const n = V(Math.cos(a) * c, Math.cos(a) * s, Math.sin(a));
    const up = V(-Math.sin(a) * c, -Math.sin(a) * s, Math.cos(a));
    orient(obj, new THREE.Vector3().crossVectors(up, n), n);
  }
  return obj;
}

// ---------- Assemblies ----------

export interface WingOpts {
  name: string;
  panels: number;
  w: number; // panel length along wing axis (local +X)
  h: number; // panel height (local Y)
  gap?: number;
  yoke?: number;
  thickness?: number;
}

/** Deployed solar wing extending along local +X from the hinge at origin, cells facing local +Z. */
export function solarWing(o: WingOpts) {
  const m = M();
  const g = group(o.name);
  const gap = o.gap ?? 0.06;
  const yoke = o.yoke ?? 0.6;
  const t = o.thickness ?? 0.045;
  const cellMat = m.solar;
  const yokeParts: THREE.BufferGeometry[] = [
    strutGeo(V(0, 0, 0), V(yoke, o.h * 0.42, 0), 0.03),
    strutGeo(V(0, 0, 0), V(yoke, -o.h * 0.42, 0), 0.03),
    strutGeo(V(yoke, o.h * 0.42, 0), V(yoke, -o.h * 0.42, 0), 0.025),
    placed(new THREE.CylinderGeometry(0.07, 0.07, 0.34, 20), [0, 0, 0]),
  ];
  g.add(mesh(merge(yokeParts), m.aluminum, `${o.name}_Yoke`));
  const hinges: THREE.BufferGeometry[] = [];
  const ribs: THREE.BufferGeometry[] = [];
  for (let i = 0; i < o.panels; i++) {
    const x0 = yoke + i * (o.w + gap);
    const p = mesh(box(o.w, o.h, t), [m.aluminum, m.aluminum, m.aluminum, m.aluminum, cellMat, m.solarBack], `${o.name}_Panel_${i + 1}`, [x0 + o.w / 2, 0, 0]);
    g.add(p);
    // hinge pins at panel boundaries
    const hx = i === 0 ? yoke : x0 - gap / 2;
    for (const sy of [1, -1]) hinges.push(placed(new THREE.CylinderGeometry(0.035, 0.035, 0.26, 12), [hx, sy * o.h * 0.4, 0]));
    // rear stiffener ribs
    ribs.push(placed(box(0.04, o.h * 0.92, 0.05), [x0 + o.w * 0.25, 0, -t / 2 - 0.025]));
    ribs.push(placed(box(0.04, o.h * 0.92, 0.05), [x0 + o.w * 0.75, 0, -t / 2 - 0.025]));
    ribs.push(placed(box(o.w * 0.92, 0.04, 0.05), [x0 + o.w / 2, 0, -t / 2 - 0.025]));
  }
  g.add(mesh(merge(hinges), m.darkMetal, `${o.name}_Hinges`));
  g.add(mesh(merge(ribs), m.carbon, `${o.name}_Stiffeners`));
  return g;
}

/** Triangular lattice truss boom along +X. */
export function trussGeo(len: number, width: number, bays: number, r = 0.012) {
  const h = (width * Math.sqrt(3)) / 2;
  const verts = [V(0, (h * 2) / 3, 0), V(0, -h / 3, width / 2), V(0, -h / 3, -width / 2)];
  const geos: THREE.BufferGeometry[] = [];
  for (const v of verts) geos.push(strutGeo(v, v.clone().setX(len), r * 1.4));
  const bay = len / bays;
  for (let i = 0; i <= bays; i++) {
    const x = i * bay;
    for (let j = 0; j < 3; j++) {
      const a = verts[j].clone().setX(x), b = verts[(j + 1) % 3].clone().setX(x);
      geos.push(strutGeo(a, b, r));
      if (i < bays) {
        const dir = i % 2 === 0 ? 1 : 0;
        const c = verts[(j + dir) % 3].clone().setX(x);
        const d = verts[(j + 1 - dir) % 3].clone().setX(x + bay);
        geos.push(strutGeo(c, d, r * 0.8));
      }
    }
  }
  return merge(geos);
}

/** Finned RTG (radioisotope thermoelectric generator) along local +Y. */
export function rtg(name: string, len = 1.14, r = 0.21, fins = 8) {
  const m = M();
  const g = group(name);
  g.add(mesh(cylY(r, r, len, 32), m.blackMLI, `${name}_Converter_Housing`));
  g.add(mesh(cylY(r * 0.55, r * 0.75, 0.12, 24), m.darkMetal, `${name}_End_Dome`, [0, len / 2 + 0.06, 0]));
  g.add(mesh(cylY(r * 0.75, r * 0.55, 0.12, 24), m.darkMetal, `${name}_Mount_Dome`, [0, -len / 2 - 0.06, 0]));
  const finGeos: THREE.BufferGeometry[] = [];
  for (let i = 0; i < fins; i++) {
    const a = (i / fins) * Math.PI * 2;
    const fin = box(0.02, len * 0.92, r * 1.9);
    fin.translate(0, 0, r * 0.95 + r * 0.7);
    fin.rotateY(a);
    finGeos.push(fin);
  }
  g.add(mesh(merge(finGeos), m.aluminum, `${name}_Radiator_Fins`));
  return g;
}
