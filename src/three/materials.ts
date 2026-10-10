import * as THREE from 'three';
import { carbonTexture, mliNormalMap, radiatorTexture, solarCellTexture } from './textures';

export interface Mats {
  goldMLI: THREE.MeshStandardMaterial;
  amberMLI: THREE.MeshStandardMaterial;
  silverMLI: THREE.MeshStandardMaterial;
  blackMLI: THREE.MeshStandardMaterial;
  aluminum: THREE.MeshStandardMaterial;
  brightAluminum: THREE.MeshStandardMaterial;
  tiles: THREE.MeshStandardMaterial;
  whitePaint: THREE.MeshStandardMaterial;
  grayPaint: THREE.MeshStandardMaterial;
  darkMetal: THREE.MeshStandardMaterial;
  titanium: THREE.MeshStandardMaterial;
  carbon: THREE.MeshStandardMaterial;
  carbonWeave: THREE.MeshStandardMaterial;
  copper: THREE.MeshStandardMaterial;
  inconel: THREE.MeshStandardMaterial;
  solar: THREE.MeshStandardMaterial;
  solarBack: THREE.MeshStandardMaterial;
  radiator: THREE.MeshStandardMaterial;
  mirrorGold: THREE.MeshStandardMaterial;
  mirrorSilver: THREE.MeshStandardMaterial;
  glass: THREE.MeshStandardMaterial;
  ablative: THREE.MeshStandardMaterial;
  sunshield: THREE.MeshStandardMaterial;
  rubber: THREE.MeshStandardMaterial;
  antennaMesh: THREE.MeshStandardMaterial;
  red: THREE.MeshStandardMaterial;
}

let cache: Mats | null = null;

function std(name: string, p: THREE.MeshStandardMaterialParameters) {
  const m = new THREE.MeshStandardMaterial(p);
  m.name = name;
  return m;
}

export function M(): Mats {
  if (cache) return cache;
  const mliN = mliNormalMap();
  mliN.repeat.set(3, 3);
  const solarTex = solarCellTexture();
  const radTex = radiatorTexture();
  const carbonTex = carbonTexture();
  const ns = new THREE.Vector2(0.9, 0.9);

  cache = {
    goldMLI: std('MLI_Gold_Kapton', { color: 0xc4922c, metalness: 0.88, roughness: 0.36, normalMap: mliN, normalScale: ns }),
    amberMLI: std('MLI_Amber_Kapton', { color: 0xb0641c, metalness: 0.82, roughness: 0.4, normalMap: mliN, normalScale: ns }),
    silverMLI: std('MLI_Aluminized_Silver', { color: 0xd4d8dd, metalness: 0.95, roughness: 0.3, normalMap: mliN, normalScale: ns }),
    blackMLI: std('MLI_Black_Kapton', { color: 0x1b1b1e, metalness: 0.6, roughness: 0.55, normalMap: mliN, normalScale: ns }),
    aluminum: std('Aluminum_6061_Machined', { color: 0xb2b6bb, metalness: 1.0, roughness: 0.42 }),
    brightAluminum: std('Aluminum_Polished', { color: 0xd0d3d7, metalness: 1.0, roughness: 0.2 }),
    tiles: std('Backshell_Thermal_Tiles', { color: 0xc6c8c7, metalness: 0.78, roughness: 0.42 }),
    whitePaint: std('Thermal_Paint_White', { color: 0xe8e9e5, metalness: 0.05, roughness: 0.55 }),
    grayPaint: std('Paint_Gray_Structural', { color: 0x8b8f94, metalness: 0.25, roughness: 0.6 }),
    darkMetal: std('Steel_Dark_Anodized', { color: 0x44474c, metalness: 0.9, roughness: 0.45 }),
    titanium: std('Titanium_Pressure_Vessel', { color: 0x9e988d, metalness: 0.95, roughness: 0.3 }),
    carbon: std('Carbon_Composite_Black', { color: 0x202124, metalness: 0.4, roughness: 0.5 }),
    carbonWeave: std('Carbon_Honeycomb_Panel', { map: carbonTex, metalness: 0.45, roughness: 0.55 }),
    copper: std('Copper_Alloy', { color: 0xb87333, metalness: 1.0, roughness: 0.35 }),
    inconel: std('Inconel_Nozzle_Heat_Tinted', { color: 0x6e6661, metalness: 0.95, roughness: 0.38, side: THREE.DoubleSide }),
    solar: std('Solar_Cell_TripleJunction_GaAs', { map: solarTex, metalness: 0.55, roughness: 0.32 }),
    solarBack: std('Solar_Panel_Composite_Substrate', { color: 0x3c3e42, metalness: 0.3, roughness: 0.8 }),
    radiator: std('Radiator_OSR_Panel', { map: radTex, metalness: 0.5, roughness: 0.22 }),
    mirrorGold: std('Mirror_Gold_Coated_Beryllium', { color: 0xffd58a, metalness: 1.0, roughness: 0.04 }),
    mirrorSilver: std('Mirror_Protected_Silver', { color: 0xf2f3f5, metalness: 1.0, roughness: 0.05 }),
    glass: std('Optical_Glass_AR_Coated', { color: 0x0a1526, metalness: 0.9, roughness: 0.06 }),
    ablative: std('Ablative_Heat_Shield_AVCOAT', { color: 0x5b4738, metalness: 0.08, roughness: 0.95 }),
    sunshield: std('Sunshield_Kapton_Silicon_Doped', { color: 0xe6daf0, metalness: 0.92, roughness: 0.26, side: THREE.DoubleSide }),
    rubber: std('Rubber_Black', { color: 0x111214, metalness: 0.0, roughness: 0.9 }),
    antennaMesh: std('Antenna_Reflector_Composite', { color: 0xdedfd9, metalness: 0.35, roughness: 0.45, side: THREE.DoubleSide }),
    red: std('Marking_Red', { color: 0xb3261e, metalness: 0.2, roughness: 0.6 }),
  };
  return cache;
}
