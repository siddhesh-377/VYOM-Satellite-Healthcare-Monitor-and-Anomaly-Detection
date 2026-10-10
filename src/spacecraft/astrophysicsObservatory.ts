import * as THREE from 'three';
import { M } from '../three/materials';
import {
  V, box, cylY, cylZ, cylX, strutGeo, merge, placed, mesh, group, explode,
  nozzle, orient, solarWing, dishGeo, capGeo, deg,
} from '../three/geo';

/**
 * Large segmented-mirror infrared observatory (JWST class).
 * Frame: +Y = cold side (telescope), -Y = sun side (bus). Optical boresight = +Z. Sunshield lies in the XZ plane.
 */
export function buildAstrophysicsObservatory(): THREE.Group {
  const m = M();
  const root = group('Infrared_Space_Observatory');

  const F = 1.34; // segment pitch (flat-to-flat + gap)
  const R = 1.32 / Math.sqrt(3); // segment circumradius
  const MC = V(0, 4.3, -3.0); // primary mirror centre
  const segThickness = 0.09;

  const segmentGeo = () => {
    const g = new THREE.CylinderGeometry(R, R, segThickness, 6);
    g.rotateX(Math.PI / 2); // cap (+Y) -> +Z, vertex -> ±Y (pointy top)
    return g;
  };
  const segMats = [m.darkMetal, m.mirrorGold, m.carbon];

  // Positions of 18 hexagonal segments (ring 1 = A, ring 2 = B at 2F, C at sqrt3 F)
  type Seg = { name: string; x: number; y: number };
  const segs: Seg[] = [];
  for (let k = 0; k < 6; k++) {
    const a = deg(k * 60);
    segs.push({ name: `A${k + 1}`, x: Math.cos(a) * F, y: Math.sin(a) * F });
    segs.push({ name: `B${k + 1}`, x: Math.cos(a) * 2 * F, y: Math.sin(a) * 2 * F });
    const c = deg(30 + k * 60);
    segs.push({ name: `C${k + 1}`, x: Math.cos(c) * Math.sqrt(3) * F, y: Math.sin(c) * Math.sqrt(3) * F });
  }

  const makeSegment = (s: Seg, parent: THREE.Group, offsetX: number) => {
    const seg = mesh(segmentGeo(), segMats, `Primary_Mirror_Segment_${s.name}`, [s.x - offsetX, s.y, 0]);
    explode(seg, [0, 0, 1.3]);
    // hexapod actuator stubs behind each segment
    const act: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 3; i++) {
      const a = deg(90 + i * 120);
      act.push(placed(cylZ(0.04, 0.04, 0.22, 10), [Math.cos(a) * 0.35, Math.sin(a) * 0.35, -0.16]));
    }
    const actuators = mesh(merge(act), m.darkMetal, `Segment_${s.name}_Actuators`);
    seg.add(actuators);
    parent.add(seg);
  };

  // ------------------------------------------------------------------ Primary mirror centre section
  const centre = group('Primary_Mirror_Center_Section', [MC.x, MC.y, MC.z], [0, 5.0, 1.0]);
  const bpCentre = new THREE.CylinderGeometry(2.45, 2.45, 0.32, 6);
  bpCentre.rotateX(Math.PI / 2);
  bpCentre.scale(1, 1.35, 1);
  centre.add(mesh(bpCentre, m.carbonWeave, 'Center_Backplane', [0, 0, -0.26]));
  segs.filter((s) => Math.abs(s.x) < 1.45 * F).forEach((s) => makeSegment(s, centre, 0));
  root.add(centre);

  // ------------------------------------------------------------------ Wings
  for (const [side, n] of [[1, 'Starboard'], [-1, 'Port']] as const) {
    const wx = side * (1.5 * F + 0.55);
    const wing = group(`Primary_Mirror_Wing_${n}`, [MC.x + wx, MC.y, MC.z], [side * 2.6, 5.0, 1.0]);
    wing.add(mesh(box(1.7, 3.4, 0.3), m.carbonWeave, `${n}_Wing_Backplane`, [0, 0, -0.25]));
    wing.add(mesh(cylY(0.07, 0.07, 3.0, 16), m.aluminum, `${n}_Wing_Hinge`, [-side * 0.42, 0, -0.25]));
    segs.filter((s) => side * s.x > 1.45 * F).forEach((s) => makeSegment(s, wing, wx));
    root.add(wing);
  }

  // ------------------------------------------------------------------ Aft optics subsystem (centre of primary)
  const aos = group('Aft_Optics_Subsystem', [MC.x, MC.y, MC.z], [0, 5.0, 3.0]);
  aos.add(mesh(box(0.9, 0.9, 1.5), m.carbon, 'AOS_Housing', [0, 0, 0.15]));
  aos.add(mesh(cylZ(0.3, 0.3, 0.06, 32), m.glass, 'Tertiary_Mirror_Aperture', [0, 0, 0.91]));
  root.add(aos);

  // ------------------------------------------------------------------ Backplane support frame + ISIM + radiator
  const bsf = group('Backplane_Support_Frame', [MC.x, MC.y, MC.z], [0, 5.0, -1.2]);
  const bsfStruts: THREE.BufferGeometry[] = [];
  const bsfNodes = [V(-1.8, 2.2, -0.5), V(1.8, 2.2, -0.5), V(-1.8, -2.2, -0.5), V(1.8, -2.2, -0.5)];
  for (const n of bsfNodes) {
    bsfStruts.push(strutGeo(n, V(n.x * 0.6, n.y * 0.5, -1.6), 0.05));
    bsfStruts.push(strutGeo(n, V(n.x, 0, -1.6), 0.04));
  }
  bsfStruts.push(strutGeo(V(-1.8, 0, -1.6), V(1.8, 0, -1.6), 0.05));
  bsfStruts.push(strutGeo(V(-1.08, 1.1, -1.6), V(1.08, 1.1, -1.6), 0.04));
  bsfStruts.push(strutGeo(V(-1.08, -1.1, -1.6), V(1.08, -1.1, -1.6), 0.04));
  bsf.add(mesh(merge(bsfStruts), m.carbon, 'BSF_Truss'));
  bsf.add(mesh(box(2.4, 1.8, 1.4), m.blackMLI, 'Integrated_Science_Instrument_Module', [0, -0.3, -1.9]));
  bsf.add(mesh(box(2.0, 1.4, 0.05), m.aluminum, 'ISIM_Electronics_Compartment', [0, -0.3, -2.63]));
  const adir = mesh(box(3.8, 2.6, 0.08), m.radiator, 'Aft_Deployable_ISIM_Radiator', [0, 0.9, -3.1]);
  adir.rotation.x = deg(-20);
  bsf.add(adir);
  const stk = group('Star_Tracker_Set', [1.0, 0.8, -1.8]);
  for (let i = 0; i < 3; i++) {
    const st = mesh(cylY(0.08, 0.06, 0.3, 20), m.darkMetal, `Star_Tracker_${i + 1}`);
    st.rotation.set(deg(-110), 0, deg(-25 + i * 25));
    st.position.set(i * 0.25, 0, 0);
    stk.add(st);
  }
  bsf.add(stk);
  root.add(bsf);

  // ------------------------------------------------------------------ Secondary mirror support structure
  const SM = V(0, 0, 7.2); // relative to MC
  const smss = group('Secondary_Mirror_Support_Structure', [MC.x, MC.y, MC.z], [0, 5.0, 5.0]);
  const legs = merge([
    strutGeo(V(-2.1, -2.7, -0.1), SM.clone().add(V(0, -0.2, -0.4)), 0.075),
    strutGeo(V(2.1, -2.7, -0.1), SM.clone().add(V(0, -0.2, -0.4)), 0.075),
    strutGeo(V(0, 3.1, -0.1), SM.clone().add(V(0, 0.2, -0.4)), 0.075),
    strutGeo(V(-2.1, -2.7, -0.1), V(2.1, -2.7, -0.1), 0.05),
    strutGeo(V(0, 3.1, -0.1), V(0, 3.1, 1.8), 0.05),
  ]);
  smss.add(mesh(legs, m.carbon, 'SMSS_Tripod_Struts'));
  smss.add(mesh(cylZ(0.42, 0.42, 0.35, 48), m.darkMetal, 'Secondary_Mirror_Housing', [SM.x, SM.y, SM.z + 0.17]));
  const sm = mesh(capGeo(0.37, 0.035, 48, 8), m.mirrorGold, 'Secondary_Mirror');
  sm.rotation.x = Math.PI / 2; // convex side toward the primary (-Z)
  sm.position.copy(SM);
  smss.add(sm);
  // hinge fittings at the strut roots
  smss.add(mesh(merge([placed(box(0.3, 0.3, 0.3), [-2.1, -2.7, -0.1]), placed(box(0.3, 0.3, 0.3), [2.1, -2.7, -0.1]), placed(box(0.3, 0.3, 0.3), [0, 3.1, -0.1])]), m.aluminum, 'SMSS_Deployment_Hinges'));
  root.add(smss);

  // ------------------------------------------------------------------ Deployable tower assembly
  // sits behind the mirror plane (under the backplane) so it never intersects the segments
  const dta = group('Deployable_Tower_Assembly', [0, 0, -3.45], [0, 2.4, 0]);
  dta.add(mesh(cylY(0.32, 0.32, 1.5, 48), m.blackMLI, 'Tower_Lower_Tube', [0, -0.45, 0]));
  dta.add(mesh(cylY(0.26, 0.26, 0.9, 48), m.carbon, 'Tower_Upper_Tube', [0, 0.65, 0]));
  dta.add(mesh(cylY(0.5, 0.5, 0.08, 48), m.aluminum, 'Tower_Base_Flange', [0, -1.2, 0]));
  dta.add(mesh(cylY(0.45, 0.45, 0.08, 48), m.aluminum, 'Tower_Top_Interface', [0, 1.08, 0]));
  root.add(dta);

  // ------------------------------------------------------------------ Sunshield (5 layers)
  const outline: [number, number][] = [[0, 10.8], [4.6, 6.4], [7.1, 0.0], [5.6, -6.6], [0, -10.4]];
  for (let i = 0; i < 5; i++) {
    const scale = 1 - i * 0.03;
    const shape = new THREE.Shape();
    const pts: [number, number][] = [...outline, ...outline.slice(1, -1).reverse().map(([x, z]) => [-x, z] as [number, number])];
    pts.forEach(([x, z], k) => (k === 0 ? shape.moveTo(x * scale, -z * scale) : shape.lineTo(x * scale, -z * scale)));
    shape.closePath();
    const g = new THREE.ShapeGeometry(shape);
    g.rotateX(-Math.PI / 2); // XY -> XZ, shape y -> world -z
    const y = -0.95 + i * 0.22;
    const layer = mesh(g, m.sunshield, `Sunshield_Layer_${i + 1}`, [0, y, 0]);
    layer.castShadow = i === 0;
    explode(layer, [0, -3.0 + i * 1.0, 0]);
    root.add(layer);
  }
  // mid-booms
  const booms = group('Sunshield_Mid_Booms', [0, -1.0, 0], [0, -3.8, 0]);
  booms.add(mesh(cylX(0.08, 0.08, 14.4, 24), m.carbon, 'Mid_Boom_Tube'));
  booms.add(mesh(cylX(0.12, 0.12, 0.6, 24), m.aluminum, 'Mid_Boom_Root_Fitting'));
  booms.add(mesh(merge([placed(box(0.3, 0.25, 0.3), [7.1, 0.0, 0]), placed(box(0.3, 0.25, 0.3), [-7.1, 0.0, 0])]), m.aluminum, 'Mid_Boom_Tip_Spreaders'));
  root.add(booms);
  // unitized pallet structures
  const upsF = group('Forward_Unitized_Pallet_Structure', [0, -1.1, 5.4], [0, -4.4, 1.5]);
  upsF.add(mesh(box(2.4, 0.3, 8.4), m.blackMLI, 'Forward_UPS_Pallet'));
  upsF.add(mesh(merge([placed(box(2.5, 0.08, 0.12), [0, -0.17, -3.8]), placed(box(2.5, 0.08, 0.12), [0, -0.17, 0]), placed(box(2.5, 0.08, 0.12), [0, -0.17, 3.8])]), m.aluminum, 'Forward_UPS_Cross_Beams'));
  root.add(upsF);
  const upsA = group('Aft_Unitized_Pallet_Structure', [0, -1.1, -7.0], [0, -4.4, -1.5]);
  upsA.add(mesh(box(2.4, 0.3, 5.4), m.blackMLI, 'Aft_UPS_Pallet'));
  upsA.add(mesh(merge([placed(box(2.5, 0.08, 0.12), [0, -0.17, -2.4]), placed(box(2.5, 0.08, 0.12), [0, -0.17, 2.4])]), m.aluminum, 'Aft_UPS_Cross_Beams'));
  root.add(upsA);

  // ------------------------------------------------------------------ Momentum trim flap
  const flap = group('Momentum_Trim_Flap', [0, -0.5, -10.4], [0, -2.2, -2.6]);
  const flapPanel = mesh(box(2.6, 1.7, 0.06), [m.aluminum, m.aluminum, m.aluminum, m.aluminum, m.sunshield, m.blackMLI], 'Trim_Flap_Panel');
  flapPanel.rotation.x = deg(-40);
  flapPanel.position.set(0, 0.5, -0.4);
  flap.add(flapPanel);
  flap.add(mesh(merge([strutGeo(V(-1.0, -0.2, 0.6), V(-1.0, 0.1, -0.1), 0.03), strutGeo(V(1.0, -0.2, 0.6), V(1.0, 0.1, -0.1), 0.03)]), m.aluminum, 'Trim_Flap_Struts'));
  root.add(flap);

  // ------------------------------------------------------------------ Spacecraft bus
  const bus = group('Spacecraft_Bus', [0, -2.05, -3.0], [0, -6.0, 0]);
  bus.add(mesh(box(3.6, 1.6, 3.4), m.blackMLI, 'Bus_Enclosure'));
  const busFrame: THREE.BufferGeometry[] = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) busFrame.push(placed(box(0.1, 1.64, 0.1), [sx * 1.8, 0, sz * 1.7]));
  for (const sy of [-1, 1]) {
    busFrame.push(placed(box(3.7, 0.1, 0.1), [0, sy * 0.8, 1.7]));
    busFrame.push(placed(box(3.7, 0.1, 0.1), [0, sy * 0.8, -1.7]));
    busFrame.push(placed(box(0.1, 0.1, 3.5), [1.8, sy * 0.8, 0]));
    busFrame.push(placed(box(0.1, 0.1, 3.5), [-1.8, sy * 0.8, 0]));
  }
  bus.add(mesh(merge(busFrame), m.aluminum, 'Bus_Primary_Frame'));
  bus.add(mesh(box(3.4, 0.06, 3.2), m.carbonWeave, 'Bus_Sun_Side_Deck', [0, -0.83, 0]));
  bus.add(mesh(box(1.6, 0.6, 1.2), m.radiator, 'Bus_Electronics_Radiator', [1.84, 0, 0.6]));
  bus.add(mesh(new THREE.SphereGeometry(0.5, 32, 24), m.titanium, 'Hydrazine_Tank_Exposed_Dome', [-0.9, -0.6, -0.4]));
  for (const [sx, sz, i] of [[-1.4, 1.3, 1], [1.4, 1.3, 2], [-1.4, -1.3, 3], [1.4, -1.3, 4]] as const) {
    const nz = nozzle(0.02, 0.07, 0.16, `Station_Keeping_Thruster_${i}`, V(0, -1, 0));
    nz.position.set(sx, -0.86, sz);
    bus.add(nz);
  }
  bus.add(mesh(cylY(0.03, 0.06, 0.5, 16), m.whitePaint, 'Omni_Antenna', [-1.5, -1.05, 1.2]));
  root.add(bus);

  // ------------------------------------------------------------------ Solar array (5 panels on the sun side, canted 20°)
  const arr = solarWing({ name: 'Solar_Array', panels: 5, w: 1.15, h: 2.1, gap: 0.05, yoke: 0.5 });
  const cant = deg(20);
  orient(arr, V(0, -Math.sin(cant), Math.cos(cant)), V(0, -Math.cos(cant), -Math.sin(cant)));
  arr.position.set(0, -2.95, -1.3);
  explode(arr, [0, -8.0, 1.5]);
  root.add(arr);

  // ------------------------------------------------------------------ High-gain antenna
  const hga = group('High_Gain_Antenna', [1.3, -2.9, -3.6], [1.0, -8.0, 0]);
  hga.add(mesh(cylY(0.09, 0.09, 0.5, 24), m.darkMetal, 'HGA_Gimbal_Mast', [0, -0.25, 0]));
  hga.add(mesh(cylX(0.08, 0.08, 0.3, 24), m.darkMetal, 'HGA_Elevation_Gimbal', [0, -0.55, 0]));
  const d = mesh(dishGeo(0.34, 0.08, 48, 10), m.antennaMesh, 'HGA_Reflector');
  d.rotation.x = Math.PI; // open toward -Y (Earth / sun side)
  d.position.set(0, -0.75, 0);
  hga.add(d);
  hga.add(mesh(merge([
    strutGeo(V(0.3, -0.8, 0), V(0, -1.15, 0), 0.01),
    strutGeo(V(-0.15, -0.8, 0.26), V(0, -1.15, 0), 0.01),
    strutGeo(V(-0.15, -0.8, -0.26), V(0, -1.15, 0), 0.01),
    placed(cylY(0.04, 0.025, 0.1, 16), [0, -1.15, 0]),
  ]), m.aluminum, 'HGA_Feed'));
  root.add(hga);

  return root;
}
