import * as THREE from 'three';
import { M } from '../three/materials';
import {
  V, box, cylZ, cylY, cylX, torusZ, torusY, strutGeo, merge, placed, mesh, group,
  nozzle, orient, solarWing, deg, dishGeo,
} from '../three/geo';

/**
 * High-resolution Earth-observation satellite.
 * Frame: +Z = zenith, -Z = nadir (Earth), +X = velocity, +Y = anti-sun side (solar array on +Y).
 */
export function buildObservationSatellite(): THREE.Group {
  const m = M();
  const root = group('Earth_Observation_Satellite');
  const BW = 1.8, BD = 1.6, BH = 2.3; // bus X, Y, Z

  // ------------------------------------------------------------------ Bus
  const bus = group('Spacecraft_Bus');
  bus.add(mesh(box(BW, BD, BH), m.goldMLI, 'Bus_MLI_Enclosure'));
  // aluminium corner longerons + deck frames
  const frame: THREE.BufferGeometry[] = [];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) frame.push(placed(box(0.08, 0.08, BH + 0.04), [sx * BW / 2, sy * BD / 2, 0]));
  for (const sz of [-1, 1]) {
    frame.push(placed(box(BW + 0.08, 0.08, 0.08), [0, -BD / 2, sz * BH / 2]));
    frame.push(placed(box(BW + 0.08, 0.08, 0.08), [0, BD / 2, sz * BH / 2]));
    frame.push(placed(box(0.08, BD + 0.08, 0.08), [-BW / 2, 0, sz * BH / 2]));
    frame.push(placed(box(0.08, BD + 0.08, 0.08), [BW / 2, 0, sz * BH / 2]));
  }
  bus.add(mesh(merge(frame), m.aluminum, 'Primary_Structure_Frame'));
  bus.add(mesh(box(BW - 0.1, BD - 0.1, 0.06), m.carbonWeave, 'Nadir_Deck', [0, 0, -BH / 2 - 0.03]));
  bus.add(mesh(box(BW - 0.1, BD - 0.1, 0.06), m.carbonWeave, 'Zenith_Deck', [0, 0, BH / 2 + 0.03]));
  // access panels / connectors on +X face
  bus.add(mesh(box(0.04, 0.5, 0.35), m.darkMetal, 'Test_Connector_Panel', [BW / 2 + 0.05, -0.3, 0.6]));
  root.add(bus);

  // ------------------------------------------------------------------ Optical telescope assembly (nadir)
  const ota = group('Optical_Telescope_Assembly', [0, 0, -BH / 2], [0, 0, -2.2]);
  ota.add(mesh(cylZ(0.56, 0.56, 1.5, 64), m.carbon, 'Telescope_Barrel', [0, 0, -0.75]));
  ota.add(mesh(cylZ(0.6, 0.6, 0.12, 64), m.aluminum, 'Barrel_Mount_Flange', [0, 0, -0.06]));
  ota.add(mesh(torusZ(0.58, 0.03, 64), m.aluminum, 'Barrel_Stiffening_Ring_1', [0, 0, -0.6]));
  ota.add(mesh(torusZ(0.58, 0.03, 64), m.aluminum, 'Barrel_Stiffening_Ring_2', [0, 0, -1.2]));
  ota.add(mesh(cylZ(0.55, 0.55, 0.5, 64, true), m.blackMLI, 'Stray_Light_Baffle', [0, 0, -1.75]));
  ota.add(mesh(cylZ(0.5, 0.52, 0.04, 64), m.glass, 'Primary_Mirror_Aperture', [0, 0, -1.5]));
  // secondary mirror spider inside the baffle
  const spider: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 4; i++) {
    const a = deg(45 + i * 90);
    spider.push(strutGeo(V(0, 0, -1.85), V(Math.cos(a) * 0.54, Math.sin(a) * 0.54, -1.85), 0.012));
  }
  spider.push(placed(cylZ(0.12, 0.12, 0.12, 24), [0, 0, -1.85]));
  ota.add(mesh(merge(spider), m.carbon, 'Secondary_Mirror_Spider'));
  // focal plane electronics on the +X side of the barrel
  ota.add(mesh(box(0.35, 0.5, 0.6), m.silverMLI, 'Focal_Plane_Electronics', [0.72, 0, -0.55]));
  ota.add(mesh(box(0.04, 0.6, 0.9), m.radiator, 'Focal_Plane_Radiator', [0.92, 0, -0.6]));
  root.add(ota);

  // ------------------------------------------------------------------ Aperture cover (opened 110°)
  const cover = group('Aperture_Cover', [0, 0.58, -BH / 2 - 2.0], [0, 0, -3.3]);
  const lid = mesh(cylZ(0.58, 0.58, 0.05, 64), [m.whitePaint, m.whitePaint, m.goldMLI], 'Aperture_Door');
  lid.position.set(0, -0.58, 0);
  const hinge = group('Aperture_Door_Hinge');
  hinge.add(lid);
  hinge.rotation.x = deg(-110);
  cover.add(hinge);
  cover.add(mesh(cylX(0.05, 0.05, 0.4, 16), m.darkMetal, 'Aperture_Door_Hinge_Pin'));
  root.add(cover);

  // ------------------------------------------------------------------ Multispectral imager (secondary payload)
  const msi = group('Multispectral_Imager', [-0.95, 0.35, -BH / 2 - 0.4], [-1.2, 0, -1.4]);
  msi.add(mesh(box(0.55, 0.55, 0.75), m.silverMLI, 'MSI_Housing'));
  msi.add(mesh(cylZ(0.12, 0.14, 0.3, 32), m.carbon, 'MSI_Telescope', [0.0, 0.0, -0.5]));
  msi.add(mesh(cylZ(0.14, 0.14, 0.02, 32), m.glass, 'MSI_Lens', [0, 0, -0.66]));
  msi.add(mesh(box(0.04, 0.5, 0.6), m.radiator, 'MSI_Detector_Radiator', [-0.3, 0, 0.0]));
  root.add(msi);

  // ------------------------------------------------------------------ Star trackers
  const stAssy = group('Star_Tracker_Assembly', [BW / 2 + 0.1, -0.45, -0.6], [1.4, 0, 0]);
  stAssy.add(mesh(box(0.2, 0.35, 0.3), m.aluminum, 'Star_Tracker_Bracket'));
  for (const [i, ang] of [[-25, 0], [25, 1]] as const) {
    const st = mesh(cylY(0.09, 0.07, 0.32, 24), m.darkMetal, `Star_Tracker_${ang + 1}`);
    st.rotation.set(deg(90 + i), 0, deg(-30));
    st.position.set(0.15, 0, 0.1 + ang * 0.04);
    stAssy.add(st);
    const baffle = mesh(cylY(0.13, 0.09, 0.18, 24, true), m.blackMLI, `Star_Tracker_${ang + 1}_Baffle`);
    baffle.rotation.copy(st.rotation);
    baffle.position.copy(st.position).add(V(0.17, 0, -0.08));
    stAssy.add(baffle);
  }
  root.add(stAssy);

  // ------------------------------------------------------------------ Solar array (single wing on +Y, cells facing -X / sun)
  const wing = solarWing({ name: 'Solar_Array_Wing', panels: 4, w: 1.55, h: 2.35, gap: 0.07, yoke: 0.8 });
  orient(wing, V(0, 1, 0), V(-1, 0, 0));
  wing.position.set(0, BD / 2 + 0.3, 0.1);
  wing.userData.explode = [0, 2.6, 0];
  root.add(wing);
  const sada = group('Solar_Array_Drive_Assembly', [0, BD / 2, 0.1], [0, 1.1, 0]);
  sada.add(mesh(cylY(0.14, 0.14, 0.3, 32), m.darkMetal, 'SADA_Housing', [0, 0.15, 0]));
  sada.add(mesh(cylY(0.06, 0.06, 0.1, 16), m.aluminum, 'SADA_Shaft', [0, 0.32, 0]));
  sada.add(mesh(box(0.4, 0.04, 0.4), m.aluminum, 'SADA_Mount_Plate', [0, 0.02, 0]));
  root.add(sada);

  // ------------------------------------------------------------------ X-band high-gain downlink antenna (gimballed, nadir)
  const hga = group('X_Band_Downlink_Antenna', [0.55, -0.55, -BH / 2 - 0.15], [1.0, -1.0, -1.2]);
  hga.add(mesh(cylZ(0.1, 0.1, 0.3, 24), m.darkMetal, 'Gimbal_Azimuth_Stage', [0, 0, -0.15]));
  hga.add(mesh(cylX(0.08, 0.08, 0.25, 24), m.darkMetal, 'Gimbal_Elevation_Stage', [0, 0, -0.38]));
  const dish = mesh(dishGeo(0.42, 0.1, 64, 12), m.antennaMesh, 'Reflector');
  dish.rotation.x = -Math.PI / 2; // lathe opens toward +Y -> open toward -Z (nadir)
  dish.position.set(0, 0, -0.5);
  hga.add(dish);
  hga.add(mesh(torusY(0.42, 0.012, 64), m.aluminum, 'Reflector_Rim', [0, 0, -0.6]));
  const feed = merge([
    strutGeo(V(0.3, 0, -0.55), V(0, 0, -0.95), 0.01),
    strutGeo(V(-0.15, 0.26, -0.55), V(0, 0, -0.95), 0.01),
    strutGeo(V(-0.15, -0.26, -0.55), V(0, 0, -0.95), 0.01),
    placed(cylZ(0.05, 0.03, 0.12, 16), [0, 0, -0.95]),
  ]);
  hga.add(mesh(feed, m.aluminum, 'Feed_Horn_Assembly'));
  root.add(hga);

  // ------------------------------------------------------------------ Propulsion module (zenith deck)
  const prop = group('Propulsion_Module', [0, 0, BH / 2], [0, 0, 2.0]);
  prop.add(mesh(cylZ(0.62, 0.62, 0.3, 64, true), m.grayPaint, 'Launch_Adapter_Ring', [0, 0, 0.15]));
  prop.add(mesh(torusZ(0.62, 0.025, 64), m.aluminum, 'Separation_Clamp_Band', [0, 0, 0.3]));
  prop.add(mesh(new THREE.SphereGeometry(0.46, 40, 28), m.titanium, 'Hydrazine_Propellant_Tank', [0, 0, 0.5]));
  prop.add(mesh(cylZ(0.47, 0.47, 0.06, 48, true), m.darkMetal, 'Tank_Girth_Band', [0, 0, 0.5]));
  prop.add(mesh(new THREE.SphereGeometry(0.16, 24, 16), m.titanium, 'Helium_Pressurant_Tank', [0.75, 0.55, 0.22]));
  for (let i = 0; i < 4; i++) {
    const a = deg(45 + i * 90);
    const nz = nozzle(0.02, 0.06, 0.14, `Orbit_Adjust_Thruster_${i + 1}`, V(0, 0, 1));
    nz.position.set(Math.cos(a) * 0.72, Math.sin(a) * 0.62, 0.1);
    prop.add(nz);
  }
  // feed lines
  const lines = merge([
    strutGeo(V(0, 0.46, 0.5), V(0.5, 0.62, 0.1), 0.012),
    strutGeo(V(0, -0.46, 0.5), V(-0.5, -0.62, 0.1), 0.012),
    strutGeo(V(0.75, 0.55, 0.22), V(0.3, 0.3, 0.5), 0.01),
  ]);
  prop.add(mesh(lines, m.brightAluminum, 'Propellant_Feed_Lines'));
  root.add(prop);

  // ------------------------------------------------------------------ GPS + S-band antennas (zenith)
  const ant = group('TTC_Antenna_Set', [0, 0, BH / 2], [0, 0, 1.1]);
  ant.add(mesh(cylZ(0.09, 0.09, 0.05, 32), m.whitePaint, 'GPS_Antenna_1', [-0.65, -0.55, 0.03]));
  ant.add(mesh(cylZ(0.09, 0.09, 0.05, 32), m.whitePaint, 'GPS_Antenna_2', [-0.65, 0.55, 0.03]));
  ant.add(mesh(cylZ(0.015, 0.03, 0.42, 16), m.whitePaint, 'S_Band_Omni_Antenna_Zenith', [0.7, -0.6, 0.21]));
  root.add(ant);
  const omniNadir = mesh(cylZ(0.03, 0.015, 0.42, 16), m.whitePaint, 'S_Band_Omni_Antenna_Nadir', [-0.75, -0.65, -BH / 2 - 0.21]);
  omniNadir.userData.explode = [0, 0, -1.0];
  root.add(omniNadir);

  // ------------------------------------------------------------------ Thermal control panels
  const rad = group('Payload_Radiator_Panel', [-BW / 2 - 0.03, 0, 0.15], [-1.4, 0, 0]);
  const radMesh = mesh(box(0.05, 1.3, 1.7), [m.whitePaint, m.radiator, m.whitePaint, m.whitePaint, m.whitePaint, m.whitePaint], 'Radiator_Honeycomb_Panel');
  rad.add(radMesh);
  rad.add(mesh(merge([placed(box(0.04, 0.06, 1.72), [0, 0.6, 0]), placed(box(0.04, 0.06, 1.72), [0, -0.6, 0])]), m.aluminum, 'Radiator_Edge_Stiffeners', [0.02, 0, 0]));
  root.add(rad);

  const louv = group('Thermal_Louver_Assembly', [BW / 2 + 0.03, 0.25, -0.2], [1.4, 0, 0]);
  louv.add(mesh(box(0.03, 0.9, 0.9), m.whitePaint, 'Louver_Frame'));
  const blades: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 9; i++) {
    const b = box(0.04, 0.84, 0.09);
    b.rotateY(deg(35));
    b.translate(0.05, 0, -0.4 + i * 0.1);
    blades.push(b);
  }
  louv.add(mesh(merge(blades), m.brightAluminum, 'Louver_Blades'));
  root.add(louv);

  // ------------------------------------------------------------------ Laser retro-reflector + magnetometer boom
  const lrr = group('Laser_Retroreflector_Array', [0.55, 0.55, -BH / 2 - 0.05], [0, 0, -0.9]);
  lrr.add(mesh(cylZ(0.16, 0.2, 0.1, 32), m.aluminum, 'LRA_Base', [0, 0, 0]));
  const cubes: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 7; i++) {
    const a = deg(i * 60);
    const r = i === 0 ? 0 : 0.1;
    cubes.push(placed(cylZ(0.035, 0.035, 0.04, 12), [Math.cos(a) * r, Math.sin(a) * r, -0.06]));
  }
  lrr.add(mesh(merge(cubes), m.glass, 'Corner_Cube_Reflectors'));
  root.add(lrr);

  const magBoom = group('Magnetometer_Boom', [-BW / 2, -BD / 2 + 0.05, BH / 2 - 0.1], [-0.8, -1.2, 0.6]);
  const dir = V(-1, -1, 0.5).normalize();
  magBoom.add(mesh(strutGeo(V(0, 0, 0), dir.clone().multiplyScalar(2.4), 0.025), m.carbon, 'Boom_Tube'));
  const magHead = mesh(box(0.14, 0.14, 0.2), m.goldMLI, 'Fluxgate_Magnetometer');
  magHead.position.copy(dir.clone().multiplyScalar(2.5));
  magBoom.add(magHead);
  root.add(magBoom);

  return root;
}
