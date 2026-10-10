import * as THREE from 'three';

const basePositions = new WeakMap<THREE.Object3D, THREE.Vector3>();

/** Ensure unique node names (required so exported animation tracks bind to the right node). */
export function uniquifyNames(root: THREE.Object3D) {
  const seen = new Map<string, number>();
  root.traverse((o) => {
    if (!o.name) o.name = o.type;
    const n = seen.get(o.name) ?? 0;
    if (n > 0) {
      let candidate = `${o.name}_${n + 1}`;
      while (seen.has(candidate)) candidate = `${candidate}_b`;
      seen.set(o.name, n + 1);
      o.name = candidate;
    }
    seen.set(o.name, (seen.get(o.name) ?? 0) + 1);
  });
}

/** Record assembled positions of every exploding component. */
export function prepareModel(root: THREE.Object3D) {
  uniquifyNames(root);
  root.traverse((o) => {
    if (o.userData.explode) basePositions.set(o, o.position.clone());
  });
  root.updateMatrixWorld(true);
}

/** t = 0 assembled, t = 1 fully exploded. Offsets are along each component's assembly axis. */
export function applyExplode(root: THREE.Object3D, t: number) {
  root.traverse((o) => {
    const e = o.userData.explode as [number, number, number] | undefined;
    if (!e) return;
    const b = basePositions.get(o);
    if (!b) return;
    o.position.set(b.x + e[0] * t, b.y + e[1] * t, b.z + e[2] * t);
  });
}

/** Build a keyframe clip (assembled -> exploded -> assembled) for export into the GLB. */
export function buildExplodeClip(root: THREE.Object3D, duration = 6) {
  const tracks: THREE.KeyframeTrack[] = [];
  root.traverse((o) => {
    const e = o.userData.explode as [number, number, number] | undefined;
    const b = basePositions.get(o);
    if (!e || !b) return;
    tracks.push(
      new THREE.VectorKeyframeTrack(
        `${o.name}.position`,
        [0, duration * 0.4, duration * 0.6, duration],
        [b.x, b.y, b.z, b.x + e[0], b.y + e[1], b.z + e[2], b.x + e[0], b.y + e[1], b.z + e[2], b.x, b.y, b.z],
      ),
    );
  });
  return new THREE.AnimationClip('Exploded_View', duration, tracks);
}

export interface ComponentInfo {
  name: string;
  meshes: number;
  children: string[];
  object: THREE.Object3D;
}

export function listComponents(root: THREE.Object3D): ComponentInfo[] {
  return root.children.map((c) => {
    let meshes = 0;
    const children: string[] = [];
    c.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) meshes++;
      if (o !== c && o.parent === c) children.push(o.name);
    });
    return { name: c.name, meshes, children, object: c };
  });
}

export function countMeshes(root: THREE.Object3D) {
  let n = 0, tris = 0;
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      n++;
      const g = m.geometry;
      tris += g.index ? g.index.count / 3 : g.attributes.position.count / 3;
    }
  });
  return { meshes: n, triangles: Math.round(tris) };
}
