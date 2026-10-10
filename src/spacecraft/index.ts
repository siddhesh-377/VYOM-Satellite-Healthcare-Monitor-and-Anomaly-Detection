import * as THREE from 'three';
import { buildHumanExploration } from './humanExploration';
import { buildObservationSatellite } from './observationSatellite';
import { buildPlanetaryProbe } from './planetaryProbe';
import { buildAstrophysicsObservatory } from './astrophysicsObservatory';

export interface SpacecraftDef {
  id: string;
  title: string;
  subtitle: string;
  file: string;
  axis: string;
  build: () => THREE.Group;
}

export const SPACECRAFT: SpacecraftDef[] = [
  {
    id: 'human',
    title: 'Human Exploration Spacecraft',
    subtitle: 'Crewed deep-space vehicle — crew module, heat shield, service module, 4 solar wings, main + auxiliary engines',
    file: 'human_exploration_spacecraft',
    axis: '+X forward (docking end), assembly stack along X',
    build: buildHumanExploration,
  },
  {
    id: 'satellite',
    title: 'Orbital Observation Satellite',
    subtitle: 'Earth-observation bus — nadir optical telescope, multispectral imager, solar wing, X-band downlink, propulsion deck',
    file: 'orbital_observation_satellite',
    axis: '-Z nadir (Earth), +Z zenith, +X velocity',
    build: buildObservationSatellite,
  },
  {
    id: 'probe',
    title: 'Planetary Exploration Probe',
    subtitle: 'Outer-planet orbiter — 4 m HGA, equipment modules, propulsion truss, 3 RTGs, magnetometer boom, entry probe',
    file: 'planetary_exploration_probe',
    axis: '+Z = HGA boresight, propulsion at -Z',
    build: buildPlanetaryProbe,
  },
  {
    id: 'observatory',
    title: 'Astrophysics Observatory',
    subtitle: 'Segmented infrared observatory — 18 gold segments, tripod secondary, ISIM, 5-layer sunshield, bus + solar array',
    file: 'astrophysics_observatory',
    axis: '+Y cold side (optics), -Y sun side (bus), +Z boresight',
    build: buildAstrophysicsObservatory,
  },
];
