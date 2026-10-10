import * as THREE from 'three';
import { M } from '../three/materials';
import {
  V, box, cylZ, cylY, cylX, torusZ, strutGeo, merge, placed, mesh, group, explode,
  nozzle, mountRadial, dishGeo, capGeo, trussGeo, rtg, deg, latheX,
} from '../three/geo';

/**
 * Outer-planet orbiter with atmospheric entry probe (Cassini / Galileo class).
 * Assembly axis: +Z = high-gain antenna boresight (up). Propulsion at -Z.
 */
export function buildPlanetaryProbe(): THREE.Group {
  const m = M();
  const root = group('Outer_Planet_Exploration_Probe');

  // ------------------------------------------------------------------ High-gain antenna
  const hgaZ = 2.45;
  const hga = group('High_Gain_Antenna', [0, 0, hgaZ], [0, 0, 3.2]);
  const dish = mesh(dishGeo(2.0, 0.5, 96, 20, 0.2), m.antennaMesh, 'HGA_Reflector');
  dish.rotation.x = Math.PI / 2; // lathe opens toward +Y -> rotate so it opens toward +Z
  hga.add(dish);
  hga.add(mesh(torusZ(2.0, 0.04, 96), m.aluminum, 'HGA_Rim_Ring', [0, 0, 0.5]));
  // rear ribs
  const ribs: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 12; i++) {
    const a = deg(i * 30);
    ribs.push(strutGeo(V(Math.cos(a) * 0.3, Math.sin(a) * 0.3, -0.05), V(Math.cos(a) * 1.95, Math.sin(a) * 1.95, 0.42), 0.02));
  }
  hga.add(mesh(merge(ribs), m.aluminum, 'HGA_Backing_Ribs'));
  hga.add(mesh(cylZ(0.3, 0.3, 0.3, 48), m.darkMetal, 'HGA_Hub', [0, 0, -0.1]));
  hga.add(mesh(cylZ(0.14, 0.18, 0.6, 32), m.whitePaint, 'Ka_X_Band_Feed_Horn', [0, 0, 0.35]));
  root.add(hga);

  // ------------------------------------------------------------------ Subreflector assembly
  const sub = group('Subreflector_Assembly', [0, 0, hgaZ], [0, 0, 4.6]);
  const subStruts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 4; i++) {
    const a = deg(45 + i * 90);
    subStruts.push(strutGeo(V(Math.cos(a) * 1.5, Math.sin(a) * 1.5, 0.3), V(Math.cos(a) * 0.22, Math.sin(a) * 0.22, 1.95), 0.025));
  }
  sub.add(mesh(merge(subStruts), m.carbon, 'Subreflector_Quadripod'));
  const subDish = mesh(capGeo(0.28, 0.05, 48, 8), m.mirrorSilver, 'Subreflector');
  subDish.rotation.x = Math.PI / 2; // apex toward +Z? cap apex toward -Y -> rotate so it points down (+Z axis facing dish)
  subDish.position.set(0, 0, 2.0);
  sub.add(subDish);
  sub.add(mesh(cylZ(0.3, 0.3, 0.08, 48), m.whitePaint, 'Subreflector_Housing', [0, 0, 2.06]));
  root.add(sub);

  // ------------------------------------------------------------------ Low-gain antenna
  const lga = group('Low_Gain_Antenna_1', [0, 0, hgaZ + 2.1], [0, 0, 5.6]);
  lga.add(mesh(cylZ(0.05, 0.05, 0.3, 16), m.whitePaint, 'LGA_Mast', [0, 0, 0.15]));
  lga.add(mesh(cylZ(0.12, 0.05, 0.14, 24), m.whitePaint, 'LGA_Horn', [0, 0, 0.37]));
  root.add(lga);

  // ------------------------------------------------------------------ Upper equipment module (12-bay electronics bus)
  const uem = group('Upper_Equipment_Module', [0, 0, 1.3], [0, 0, 1.6]);
  uem.add(mesh(cylZ(1.3, 1.3, 1.15, 12), m.goldMLI, 'UEM_Electronics_Bus'));
  uem.add(mesh(cylZ(1.34, 1.34, 0.06, 12), m.aluminum, 'UEM_Upper_Shear_Plate', [0, 0, 0.58]));
  uem.add(mesh(cylZ(1.34, 1.34, 0.06, 12), m.aluminum, 'UEM_Lower_Shear_Plate', [0, 0, -0.58]));
  const longerons: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 12; i++) {
    const a = deg(i * 30 + 15);
    longerons.push(placed(box(0.06, 0.06, 1.15), [Math.cos(a) * 1.27, Math.sin(a) * 1.27, 0]));
  }
  uem.add(mesh(merge(longerons), m.aluminum, 'UEM_Bay_Longerons'));
  // HGA support cone from UEM to antenna hub
  uem.add(mesh(cylZ(0.5, 1.0, 0.55, 48, true), m.silverMLI, 'HGA_Support_Cone', [0, 0, 0.85]));
  // louvered bays
  for (let i = 0; i < 4; i++) {
    const lv = mesh(box(0.5, 0.7, 0.03), m.brightAluminum, `UEM_Bay_Louvers_${i + 1}`);
    mountRadial(lv, 'z', 0, 1.275, i * 90 + 75); // centred on the 12-gon bay flats (15° + 30°k)
    uem.add(lv);
  }
  // sun sensors and stellar reference units
  const sru = mesh(cylY(0.09, 0.07, 0.3, 20), m.darkMetal, 'Stellar_Reference_Unit');
  mountRadial(sru, 'z', 0.2, 1.28, 105);
  sru.rotateX(deg(-50));
  uem.add(sru);
  root.add(uem);

  // ------------------------------------------------------------------ Lower equipment module
  const lem = group('Lower_Equipment_Module', [0, 0, 0.25], [0, 0, 0]);
  lem.add(mesh(cylZ(1.12, 1.12, 1.0, 48), m.blackMLI, 'LEM_Structure'));
  lem.add(mesh(cylZ(1.18, 1.18, 0.08, 48), m.aluminum, 'LEM_Interface_Ring_Upper', [0, 0, 0.5]));
  lem.add(mesh(cylZ(1.18, 1.18, 0.08, 48), m.aluminum, 'LEM_Interface_Ring_Lower', [0, 0, -0.5]));
  // radioisotope heater & cabling conduits
  const conduits: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 6; i++) {
    const a = deg(i * 60 + 10);
    conduits.push(placed(cylZ(0.04, 0.04, 1.0, 12), [Math.cos(a) * 1.14, Math.sin(a) * 1.14, 0]));
  }
  lem.add(mesh(merge(conduits), m.silverMLI, 'Cable_Harness_Conduits'));
  root.add(lem);

  // ------------------------------------------------------------------ Propulsion module (open truss with tanks)
  const pm = group('Propulsion_Module', [0, 0, -1.1], [0, 0, -2.0]);
  const pmTruss: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 8; i++) {
    const a = deg(i * 45);
    pmTruss.push(strutGeo(V(Math.cos(a) * 1.05, Math.sin(a) * 1.05, 0.85), V(Math.cos(a) * 1.05, Math.sin(a) * 1.05, -0.85), 0.035));
    const b = deg((i + 1) * 45);
    pmTruss.push(strutGeo(V(Math.cos(a) * 1.05, Math.sin(a) * 1.05, 0.85), V(Math.cos(b) * 1.05, Math.sin(b) * 1.05, -0.85), 0.02));
  }
  pm.add(mesh(merge(pmTruss), m.aluminum, 'PM_Truss_Longerons'));
  pm.add(mesh(torusZ(1.05, 0.04, 64), m.aluminum, 'PM_Upper_Ring', [0, 0, 0.85]));
  pm.add(mesh(torusZ(1.05, 0.04, 64), m.aluminum, 'PM_Lower_Ring', [0, 0, -0.85]));
  // MLI wrap covers 225° of the module so the tank bay stays visible
  const partialWrap = new THREE.CylinderGeometry(1.08, 1.08, 1.7, 48, 1, true, 0, Math.PI * 1.25);
  partialWrap.rotateX(Math.PI / 2);
  pm.add(mesh(partialWrap, m.goldMLI, 'PM_MLI_Wrap'));
  pm.add(mesh(new THREE.SphereGeometry(0.58, 40, 28), m.titanium, 'Oxidizer_Tank', [0.45, 0.0, 0.0]));
  pm.add(mesh(new THREE.SphereGeometry(0.58, 40, 28), m.titanium, 'Fuel_Tank', [-0.45, 0.0, 0.0]));
  pm.add(mesh(new THREE.SphereGeometry(0.28, 24, 16), m.titanium, 'Helium_Tank', [0, -0.72, 0]));
  pm.add(mesh(merge([
    strutGeo(V(0.45, 0.58, 0), V(0.45, 0.95, 0.6), 0.012),
    strutGeo(V(-0.45, 0.58, 0), V(-0.45, 0.95, 0.6), 0.012),
    strutGeo(V(0, -1.0, 0), V(0, -0.7, -0.9), 0.012),
  ]), m.brightAluminum, 'PM_Propellant_Lines'));
  pm.add(mesh(cylZ(0.9, 0.9, 0.05, 48), m.carbonWeave, 'PM_Lower_Deck', [0, 0, -0.9]));
  root.add(pm);

  // ------------------------------------------------------------------ Main engine assembly (redundant pair)
  const mea = group('Main_Engine_Assembly', [0, 0, -2.0], [0, 0, -3.8]);
  for (const [sx, n] of [[1, 'Main_Engine_A'], [-1, 'Main_Engine_B']] as const) {
    const nz = nozzle(0.08, 0.36, 0.85, n, V(0, 0, -1));
    nz.position.set(sx * 0.4, 0, -0.05);
    mea.add(nz);
    mea.add(mesh(cylZ(0.12, 0.12, 0.2, 24), m.darkMetal, `${n}_Gimbal`, [sx * 0.4, 0, 0.05]));
  }
  mea.add(mesh(box(1.1, 0.4, 0.08), m.aluminum, 'Engine_Mount_Beam', [0, 0, 0.1]));
  const cover = mesh(cylZ(0.9, 0.95, 0.06, 48), m.goldMLI, 'Engine_Thermal_Cover_Ring');
  cover.position.set(0, 0, 0.02);
  mea.add(cover);
  root.add(mea);

  // ------------------------------------------------------------------ RTGs (3)
  for (let i = 0; i < 3; i++) {
    const a = deg(i * 120); // 0°, 120°, 240° — clear of the -X entry probe and the ±Y pallets
    const r = rtg(`RTG_${i + 1}`);
    const radial = V(Math.cos(a), Math.sin(a), 0);
    // mounted on a tilted pair of struts, tilted 25° down from horizontal
    const base = radial.clone().multiplyScalar(1.15).add(V(0, 0, -0.1));
    const tilt = deg(25);
    const axis = radial.clone().multiplyScalar(Math.cos(tilt)).add(V(0, 0, -Math.sin(tilt)));
    const centre = base.clone().add(axis.clone().multiplyScalar(0.95));
    r.position.copy(centre);
    r.quaternion.setFromUnitVectors(V(0, 1, 0), axis);
    const struts = merge([
      strutGeo(base.clone().add(V(0, 0, 0.5)), centre.clone().sub(axis.clone().multiplyScalar(0.62)), 0.03),
      strutGeo(base.clone().add(V(0, 0, -0.5)), centre.clone().sub(axis.clone().multiplyScalar(0.62)), 0.03),
      strutGeo(base.clone().add(V(0, 0, 0.5)), base.clone().add(V(0, 0, -0.5)), 0.03),
    ]);
    const asm = group(`RTG_Assembly_${i + 1}`);
    asm.add(r);
    asm.add(mesh(struts, m.aluminum, `RTG_${i + 1}_Support_Struts`));
    explode(asm, [radial.x * 2.0, radial.y * 2.0, -0.6]);
    root.add(asm);
  }

  // ------------------------------------------------------------------ Magnetometer boom (+X)
  const boom = group('Magnetometer_Boom', [1.3, 0, 1.55], [2.8, 0, 0]);
  boom.add(mesh(trussGeo(10.0, 0.28, 20, 0.012), m.carbon, 'Boom_Lattice_Truss'));
  boom.add(mesh(box(0.14, 0.14, 0.22), m.goldMLI, 'Fluxgate_Magnetometer_Inboard', [5.5, 0, 0.2]));
  boom.add(mesh(box(0.16, 0.16, 0.26), m.goldMLI, 'Vector_Helium_Magnetometer_Outboard', [10.1, 0, 0.0]));
  boom.add(mesh(cylX(0.25, 0.25, 0.12, 24), m.aluminum, 'Boom_Canister_Hinge', [0.0, 0, 0]));
  root.add(boom);

  // ------------------------------------------------------------------ Remote sensing pallet (-Y)
  const rsp = group('Remote_Sensing_Pallet', [0, -1.3, 1.25], [0, -2.2, 0]);
  rsp.add(mesh(box(1.4, 0.08, 0.9), m.aluminum, 'RSP_Mounting_Plate', [0, -0.3, 0]));
  rsp.add(mesh(merge([strutGeo(V(-0.6, -0.26, 0.3), V(-0.5, 0.0, 0.2), 0.03), strutGeo(V(0.6, -0.26, 0.3), V(0.5, 0.0, 0.2), 0.03), strutGeo(V(0, -0.26, -0.4), V(0, 0, -0.3), 0.03)]), m.aluminum, 'RSP_Mount_Struts'));
  const nac = mesh(cylY(0.17, 0.17, 1.0, 40), m.carbon, 'Narrow_Angle_Camera', [-0.4, -0.85, -0.1]);
  rsp.add(nac);
  rsp.add(mesh(cylY(0.19, 0.17, 0.2, 40, true), m.blackMLI, 'NAC_Sunshade', [-0.4, -1.42, -0.1]));
  rsp.add(mesh(cylY(0.17, 0.17, 0.02, 40), m.glass, 'NAC_Aperture', [-0.4, -1.36, -0.1]));
  rsp.add(mesh(cylY(0.11, 0.11, 0.5, 32), m.carbon, 'Wide_Angle_Camera', [0.0, -0.6, -0.1]));
  rsp.add(mesh(cylY(0.11, 0.11, 0.02, 32), m.glass, 'WAC_Aperture', [0.0, -0.86, -0.1]));
  rsp.add(mesh(box(0.5, 0.6, 0.55), m.silverMLI, 'Imaging_Spectrometer', [0.45, -0.65, 0.05]));
  rsp.add(mesh(box(0.2, 0.08, 0.3), m.glass, 'Spectrometer_Entrance_Slit', [0.45, -0.98, 0.05]));
  rsp.add(mesh(box(0.6, 0.3, 0.3), m.goldMLI, 'Thermal_Infrared_Radiometer', [0.15, -0.5, 0.5]));
  rsp.add(mesh(box(0.04, 0.5, 0.6), m.radiator, 'Detector_Passive_Cooler', [0.75, -0.6, 0.05]));
  root.add(rsp);

  // ------------------------------------------------------------------ Fields & particles pallet (+Y)
  const fpp = group('Fields_And_Particles_Pallet', [0, 1.3, 1.1], [0, 2.2, 0]);
  fpp.add(mesh(box(1.2, 0.08, 0.8), m.aluminum, 'FPP_Mounting_Plate', [0, 0.3, 0]));
  fpp.add(mesh(box(0.45, 0.5, 0.45), m.goldMLI, 'Plasma_Spectrometer', [-0.35, 0.6, 0.0]));
  fpp.add(mesh(cylY(0.2, 0.2, 0.3, 32), m.darkMetal, 'Ion_Mass_Spectrometer', [0.3, 0.55, 0.0]));
  fpp.add(mesh(cylY(0.22, 0.2, 0.05, 32), m.copper, 'IMS_Entrance_Grid', [0.3, 0.72, 0.0]));
  fpp.add(mesh(box(0.3, 0.3, 0.3), m.silverMLI, 'Dust_Analyzer', [0.3, 0.5, -0.5]));
  const dustCone = mesh(new THREE.ConeGeometry(0.22, 0.3, 32, 1, true), m.aluminum, 'Dust_Analyzer_Aperture');
  dustCone.rotation.x = Math.PI;
  dustCone.position.set(0.3, 0.8, -0.5);
  fpp.add(dustCone);
  root.add(fpp);

  // ------------------------------------------------------------------ Plasma wave antennas (3 x 6 m rods)
  const pwa = group('Plasma_Wave_Antenna_Set', [0, 0, 0.5], [0, 0, 0]);
  const pwaDirs = [V(-0.35, -0.85, -0.2), V(-0.75, -0.6, -0.3), V(-0.3, -0.9, -0.5)];
  pwaDirs.forEach((d, i) => {
    d.normalize();
    const start = V(d.x * 1.15, d.y * 1.15, 0);
    pwa.add(mesh(strutGeo(start, start.clone().add(d.clone().multiplyScalar(6)), 0.012), m.brightAluminum, `Plasma_Wave_Antenna_${i + 1}`));
  });
  pwa.add(mesh(box(0.3, 0.3, 0.3), m.darkMetal, 'PWA_Deployment_Mechanism', [-0.75, -0.85, 0]));
  explode(pwa, [-1.0, -1.6, 0]);
  root.add(pwa);

  // ------------------------------------------------------------------ Thruster clusters (4)
  for (let i = 0; i < 4; i++) {
    const a = deg(45 + i * 90);
    const tc = group(`Thruster_Cluster_${i + 1}`);
    const radial = V(Math.cos(a), Math.sin(a), 0);
    const pos = radial.clone().multiplyScalar(1.55).add(V(0, 0, -1.5));
    tc.position.copy(pos);
    tc.add(mesh(box(0.22, 0.22, 0.3), m.silverMLI, `Thruster_Cluster_${i + 1}_Housing`));
    const n1 = nozzle(0.015, 0.05, 0.12, `Thruster_Cluster_${i + 1}_Z_Thruster`, V(0, 0, -1));
    n1.position.set(0, 0, -0.17);
    tc.add(n1);
    const tan = V(-radial.y, radial.x, 0);
    const n2 = nozzle(0.015, 0.05, 0.12, `Thruster_Cluster_${i + 1}_Y_Thruster`, tan);
    n2.position.copy(tan.clone().multiplyScalar(0.13));
    tc.add(n2);
    const n3 = nozzle(0.015, 0.05, 0.12, `Thruster_Cluster_${i + 1}_Y_Thruster_Neg`, tan.clone().negate());
    n3.position.copy(tan.clone().multiplyScalar(-0.13));
    tc.add(n3);
    const arm = merge([strutGeo(V(0, 0, 0).sub(radial.clone().multiplyScalar(0.5)).add(V(0, 0, 0.3)), V(0, 0, 0), 0.025), strutGeo(radial.clone().multiplyScalar(-0.5).add(V(0, 0, -0.1)), V(0, 0, 0), 0.025)]);
    tc.add(mesh(arm, m.aluminum, `Thruster_Cluster_${i + 1}_Outrigger`));
    explode(tc, [radial.x * 1.4, radial.y * 1.4, -0.5]);
    root.add(tc);
  }

  // ------------------------------------------------------------------ Atmospheric entry probe (-X)
  const probe = group('Atmospheric_Entry_Probe', [-1.3, 0, 0.9], [-2.8, 0, 0]);
  // front heat shield: 60° half-angle cone, axis -X
  const shield = latheX([[0.0, -1.55], [0.35, -1.5], [1.3, -0.95], [1.35, -0.9]], 64);
  probe.add(mesh(shield, m.amberMLI, 'Probe_Front_Heat_Shield'));
  const back = latheX([[1.35, -0.9], [1.3, -0.85], [0.9, -0.45], [0.55, -0.4]], 64);
  probe.add(mesh(back, m.whitePaint, 'Probe_Back_Cover'));
  probe.add(mesh(torusZ(1.35, 0.04, 64).rotateY(Math.PI / 2), m.aluminum, 'Probe_Shoulder_Ring', [-0.9, 0, 0]));
  probe.add(mesh(cylX(0.55, 0.55, 0.15, 48), m.darkMetal, 'Probe_Spin_Eject_Device', [-0.33, 0, 0]));
  const probeStruts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 3; i++) {
    const a = deg(i * 120 + 90);
    probeStruts.push(strutGeo(V(0, Math.cos(a) * 0.9, Math.sin(a) * 0.9), V(-0.4, Math.cos(a) * 0.45, Math.sin(a) * 0.45), 0.03));
  }
  probe.add(mesh(merge(probeStruts), m.aluminum, 'Probe_Support_Truss'));
  probe.add(mesh(cylX(0.08, 0.08, 0.1, 16), m.whitePaint, 'Probe_Relay_Antenna', [-0.25, 0, 0.6]));
  root.add(probe);

  return root;
}
