import * as THREE from 'three';
import { M } from '../three/materials';
import {
  V, box, cylX, cylY, torusX, latheX, capGeo, strutGeo, merge, placed, mesh, group, explode,
  nozzle, mountRadial, orient, solarWing, deg,
} from '../three/geo';

/**
 * Crewed Deep-Space Vehicle (Orion / ESM class).
 * Assembly axis: +X = forward (docking end).  Heat shield plane at x = 0.
 */
export function buildHumanExploration(): THREE.Group {
  const m = M();
  const root = group('Crewed_Deep_Space_Vehicle');

  // ------------------------------------------------------------------ Docking mechanism
  const dock = group('Docking_Mechanism', [3.15, 0, 0], [3.6, 0, 0]);
  dock.add(mesh(cylX(0.62, 0.62, 0.38, 48), m.whitePaint, 'Docking_Tunnel', [0.19, 0, 0]));
  dock.add(mesh(cylX(0.85, 0.85, 0.1, 48), m.aluminum, 'Docking_Flange', [0.42, 0, 0]));
  dock.add(mesh(torusX(0.72, 0.065, 64), m.brightAluminum, 'Soft_Capture_Ring', [0.56, 0, 0]));
  const petals: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 3; i++) {
    const a = deg(60 + i * 120);
    const g = box(0.05, 0.22, 0.28);
    g.translate(0.62, 0.0, 0.72);
    g.rotateZ(0);
    g.rotateX(a);
    petals.push(g);
  }
  dock.add(mesh(merge(petals), m.aluminum, 'Guide_Petals'));
  dock.add(mesh(cylX(0.5, 0.5, 0.06, 48), m.grayPaint, 'Forward_Hatch', [0.45, 0, 0]));
  dock.add(mesh(cylX(0.08, 0.08, 0.14, 16), m.darkMetal, 'Hatch_Window_Port', [0.5, 0, 0]));
  // docking camera + light
  dock.add(mesh(cylX(0.05, 0.05, 0.12, 16), m.darkMetal, 'Docking_Camera', [0.48, 0.95, 0.15]));
  dock.add(mesh(cylX(0.05, 0.05, 0.1, 16), m.whitePaint, 'Docking_Light', [0.47, 0.95, -0.15]));
  root.add(dock);

  // ------------------------------------------------------------------ Crew module
  const cm = group('Crew_Module', [0, 0, 0], [2.1, 0, 0]);
  // conical backshell: (radius, x)
  // profile ordered base -> apex (increasing axial coordinate) so lathe normals face outward
  const shell = latheX(
    [[2.5, 0.0], [2.5, 0.32], [2.42, 0.48], [1.06, 3.02], [0.98, 3.15], [0.55, 3.15]],
    96,
  );
  cm.add(mesh(shell, m.tiles, 'Backshell_Thermal_Protection'));
  cm.add(mesh(cylX(1.0, 1.0, 0.05, 64), m.grayPaint, 'Forward_Bay_Cover', [3.12, 0, 0]));
  cm.add(mesh(torusX(2.5, 0.05, 96), m.titanium, 'Backshell_Base_Ring', [0.3, 0, 0]));
  // cone half-angle from the profile ((2.42-1.06)/(3.02-0.48)) ≈ 28.2°
  const alpha = 28.2;
  const rAt = (x: number) => 2.42 - (x - 0.48) * Math.tan(deg(alpha));
  // windows: two forward-facing + two side
  const wins: Array<[number, number, string]> = [
    [2.05, 12, 'Window_Forward_Left'], [2.05, -12, 'Window_Forward_Right'],
    [1.5, 105, 'Window_Side_Left'], [1.5, -105, 'Window_Side_Right'],
  ];
  for (const [x, phi, n] of wins) {
    const w = mesh(box(0.36, 0.3, 0.1), [m.darkMetal, m.darkMetal, m.darkMetal, m.darkMetal, m.glass, m.darkMetal], n);
    mountRadial(w, 'x', x, rAt(x) - 0.03, phi, alpha);
    cm.add(w);
  }
  // side hatch
  const hatch = mesh(box(0.8, 1.0, 0.07), m.grayPaint, 'Side_Hatch');
  mountRadial(hatch, 'x', 1.45, rAt(1.45) - 0.02, 180, alpha);
  cm.add(hatch);
  // reaction-control thruster ports (12 around the base) and 4 pitch thrusters near the apex
  const rcsPorts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 12; i++) {
    const phi = 15 + i * 30;
    const hole = new THREE.CylinderGeometry(0.07, 0.07, 0.06, 16);
    hole.rotateX(Math.PI / 2);
    const o = new THREE.Object3D();
    mountRadial(o, 'x', 0.7, rAt(0.7), phi, alpha);
    o.updateMatrix();
    hole.applyMatrix4(o.matrix);
    rcsPorts.push(hole);
  }
  cm.add(mesh(merge(rcsPorts), m.rubber, 'Crew_Module_RCS_Ports'));
  // parachute compartment covers (3 on forward bay)
  const chutes: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 3; i++) {
    const g = cylX(0.22, 0.22, 0.03, 24);
    const a = deg(i * 120 + 90);
    g.translate(3.14, Math.cos(a) * 0.65, Math.sin(a) * 0.65);
    chutes.push(g);
  }
  cm.add(mesh(merge(chutes), m.whitePaint, 'Parachute_Bay_Covers'));
  root.add(cm);

  // ------------------------------------------------------------------ Heat shield
  const hs = group('Heat_Shield', [0, 0, 0], [0.9, 0, 0]);
  const cap = capGeo(2.56, 0.58, 96, 14);
  cap.rotateZ(-Math.PI / 2); // apex toward -X
  hs.add(mesh(cap, m.ablative, 'Ablative_Shield'));
  hs.add(mesh(torusX(2.56, 0.07, 96), m.titanium, 'Shield_Attach_Ring', [0.03, 0, 0]));
  hs.add(mesh(cylX(2.52, 2.52, 0.06, 96), m.titanium, 'Shield_Carrier_Structure', [0.03, 0, 0]));
  root.add(hs);

  // ------------------------------------------------------------------ Crew module adapter
  const cma = group('Crew_Module_Adapter', [0, 0, 0]);
  cma.add(mesh(cylX(2.5, 2.5, 0.62, 96), m.whitePaint, 'Adapter_Barrel', [-0.31, 0, 0]));
  cma.add(mesh(torusX(2.5, 0.04, 96), m.aluminum, 'Adapter_Separation_Plane', [-0.62, 0, 0]));
  const umb = mesh(box(0.5, 0.4, 0.3), m.darkMetal, 'Umbilical_Interface_Panel');
  mountRadial(umb, 'x', -0.31, 2.5, 90);
  cma.add(umb);
  const wire = mesh(cylX(0.06, 0.06, 0.9, 16), m.blackMLI, 'Umbilical_Harness', [-0.25, 2.62, 0.35]);
  cma.add(wire);
  root.add(cma);

  // ------------------------------------------------------------------ Service module
  const sm = group('Service_Module', [0, 0, 0], [-1.7, 0, 0]);
  sm.add(mesh(cylX(2.05, 2.05, 4.0, 96), m.silverMLI, 'Service_Module_Structure', [-2.62, 0, 0]));
  sm.add(mesh(cylX(2.5, 2.05, 0.5, 96), m.whitePaint, 'Forward_Transition_Cone', [-0.87, 0, 0]));
  sm.add(mesh(cylX(2.05, 2.28, 0.7, 96, true), m.grayPaint, 'Aft_Skirt', [-4.97, 0, 0]));
  sm.add(mesh(torusX(2.07, 0.04, 96), m.aluminum, 'Forward_Frame_Ring', [-1.1, 0, 0]));
  sm.add(mesh(torusX(2.07, 0.04, 96), m.aluminum, 'Aft_Frame_Ring', [-4.6, 0, 0]));
  sm.add(mesh(cylX(2.0, 2.0, 0.05, 96), m.darkMetal, 'Aft_Bulkhead', [-4.63, 0, 0]));
  // six radiator panels around the barrel
  for (let i = 0; i < 6; i++) {
    const r = mesh(box(1.55, 2.6, 0.05), [m.whitePaint, m.whitePaint, m.whitePaint, m.whitePaint, m.radiator, m.whitePaint], `Radiator_Panel_${i + 1}`);
    mountRadial(r, 'x', -2.9, 2.085, 30 + i * 60);
    sm.add(r);
  }
  // phased-array antennas
  for (const [phi, n] of [[0, 'Phased_Array_Antenna_Port'], [180, 'Phased_Array_Antenna_Starboard']] as const) {
    const a = mesh(box(0.7, 0.7, 0.09), m.whitePaint, n);
    mountRadial(a, 'x', -1.55, 2.1, phi);
    sm.add(a);
  }
  // star trackers + sun sensors
  const st = mesh(cylX(0.07, 0.09, 0.3, 20), m.darkMetal, 'Star_Tracker_Pair');
  mountRadial(st, 'x', -1.5, 2.1, 240);
  st.rotateX(deg(-35));
  sm.add(st);
  // RCS pods (4)
  for (let i = 0; i < 4; i++) {
    const pod = group(`RCS_Pod_${i + 1}`);
    pod.add(mesh(box(0.5, 0.42, 0.26), m.silverMLI, `RCS_Pod_${i + 1}_Housing`, [0, 0, 0.13]));
    const dirs: Array<[THREE.Vector3, [number, number, number], string]> = [
      [V(0, 1, 0), [0, 0.28, 0.16], 'Fwd'], [V(0, -1, 0), [0, -0.28, 0.16], 'Aft'],
      [V(1, 0, 0), [0.32, 0, 0.16], 'Tan_A'], [V(-1, 0, 0), [-0.32, 0, 0.16], 'Tan_B'],
    ];
    for (const [d, p, s] of dirs) {
      const nz = nozzle(0.03, 0.08, 0.16, `RCS_Pod_${i + 1}_Thruster_${s}`, d);
      nz.position.set(...p);
      pod.add(nz);
    }
    mountRadial(pod, 'x', -1.35, 2.05, 45 + i * 90);
    sm.add(pod);
  }
  root.add(sm);

  // ------------------------------------------------------------------ Solar array wings (X configuration)
  for (let i = 0; i < 4; i++) {
    const phi = deg(45 + i * 90);
    const radial = V(0, Math.cos(phi), Math.sin(phi));
    const wing = solarWing({ name: `Solar_Array_Wing_${i + 1}`, panels: 3, w: 2.1, h: 1.95, gap: 0.08, yoke: 0.95 });
    // radial direction with a 12° forward cant, cells facing +X
    const c = Math.cos(deg(12)), s = Math.sin(deg(12));
    const dir = radial.clone().multiplyScalar(c).add(V(s, 0, 0));
    const cellNormal = V(c, 0, 0).sub(radial.clone().multiplyScalar(s)); // perpendicular to dir
    orient(wing, dir, cellNormal);
    wing.position.copy(radial.clone().multiplyScalar(2.05)).add(V(-4.25, 0, 0));
    explode(wing, [0, radial.y * 2.0, radial.z * 2.0]);
    root.add(wing);
  }

  // ------------------------------------------------------------------ Main engine
  const eng = group('Main_Engine', [-4.63, 0, 0], [-3.6, 0, 0]);
  const bell = nozzle(0.24, 0.8, 1.55, 'Main_Engine_Nozzle', V(-1, 0, 0));
  bell.position.set(-0.25, 0, 0);
  eng.add(bell);
  eng.add(mesh(cylX(0.36, 0.36, 0.3, 32), m.darkMetal, 'Gimbal_Mount', [-0.1, 0, 0]));
  eng.add(mesh(cylX(1.05, 0.95, 0.04, 64), m.blackMLI, 'Engine_Heat_Shield_Blanket', [-0.05, 0, 0]));
  const actuators = merge([
    strutGeo(V(-0.05, 0.9, 0), V(-0.65, 0.42, 0), 0.035),
    strutGeo(V(-0.05, 0, 0.9), V(-0.65, 0, 0.42), 0.035),
  ]);
  eng.add(mesh(actuators, m.aluminum, 'Thrust_Vector_Actuators'));
  root.add(eng);

  // ------------------------------------------------------------------ Auxiliary engines (8)
  const aux = group('Auxiliary_Engine_Ring', [-4.63, 0, 0], [-2.3, 0, 0]);
  for (let i = 0; i < 8; i++) {
    const a = deg(22.5 + i * 45);
    const nz = nozzle(0.06, 0.18, 0.45, `Auxiliary_Engine_${i + 1}`, V(-1, 0, 0));
    nz.position.set(-0.08, Math.cos(a) * 1.55, Math.sin(a) * 1.55);
    aux.add(nz);
  }
  const auxMounts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 8; i++) {
    const a = deg(22.5 + i * 45);
    auxMounts.push(placed(cylX(0.1, 0.1, 0.1, 16), [-0.04, Math.cos(a) * 1.55, Math.sin(a) * 1.55]));
  }
  aux.add(mesh(merge(auxMounts), m.darkMetal, 'Auxiliary_Engine_Mounts'));
  root.add(aux);

  // ------------------------------------------------------------------ Helium pressurant tanks (visible inside aft skirt)
  const tanks = group('Pressurant_Tank_Set', [0, 0, 0], [-2.0, 0, 0]);
  for (let i = 0; i < 4; i++) {
    const a = deg(i * 90);
    const p: [number, number, number] = [-4.98, Math.cos(a) * 0.95, Math.sin(a) * 0.95];
    tanks.add(mesh(new THREE.SphereGeometry(0.36, 32, 24), m.titanium, `Helium_Tank_${i + 1}`, p));
    const strap = cylY(0.37, 0.37, 0.05, 32, true);
    strap.rotateZ(Math.PI / 2);
    tanks.add(mesh(strap, m.darkMetal, `Helium_Tank_${i + 1}_Strap`, p));
  }
  root.add(tanks);

  return root;
}
