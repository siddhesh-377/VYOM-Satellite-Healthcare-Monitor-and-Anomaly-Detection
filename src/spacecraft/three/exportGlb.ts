import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { applyExplode, buildExplodeClip } from './explode';

export type ExportMode = 'assembled' | 'exploded';

/**
 * Export a model root as a binary glTF (.glb).
 * - assembled: rest pose, with an embedded "Exploded_View" animation clip.
 * - exploded: static exploded arrangement.
 * Returns the Blob (and triggers a browser download if `filename` is given).
 */
export async function exportGLB(root: THREE.Object3D, mode: ExportMode, filename?: string, restoreT = 0): Promise<Blob> {
  const previous = restoreT;
  applyExplode(root, mode === 'exploded' ? 1 : 0);
  root.updateMatrixWorld(true);

  const exporter = new GLTFExporter();
  const animations = mode === 'assembled' ? [buildExplodeClip(root)] : [];

  const buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
    exporter.parse(
      root,
      (result) => resolve(result as ArrayBuffer),
      (err) => reject(err),
      { binary: true, animations, onlyVisible: true, includeCustomExtensions: false },
    );
  });

  applyExplode(root, previous);

  const blob = new Blob([buffer], { type: 'model/gltf-binary' });
  if (filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }
  return blob;
}
