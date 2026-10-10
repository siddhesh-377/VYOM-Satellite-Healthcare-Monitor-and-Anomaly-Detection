/**
 * VYOM — Gamified 3D Satellite Component (Upgraded Model Suite)
 * High-fidelity aerospace 3D models integrated into Gamification Mode:
 * - Structural Satellite Bus: Machined aluminum frame longerons, gold/silver Kapton MLI, carbon decks
 * - Payloads: Cassegrain Optical Telescope (spider, baffle, OSR radiator, hinged door),
 *   Cryogenic Multispectral Imager (MSI germanium lens & cryocooler), SAR Phased Array Antenna
 * - Power: Articulated Solar Wings with SADA drives, GaAs triple-junction cells, composite substrate
 * - Comms: Steerable Cassegrain High-Gain Parabolic Dish (subreflector & backing ribs), S-band LGA mast
 * - Control: Dual Star Trackers with optical baffles, Hydrazine RCS thruster quads, Reaction Wheels
 * - Internal Systems (X-Ray): Avionics OBC, modular Li-ion batteries, titanium propellant tank, spinning flywheel
 * - Exploded View: Continuous 0.0 to 1.0 kinematics across all subsystems
 */

import React, { useRef, useMemo, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { useGamifiedStore } from '../../../store/gamifiedStore';
import { M, type Mats } from '../../../three/materials';
import {
  box,
  cylZ,
  cylY,
  cylX,
  torusZ,
  strutGeo,
  merge,
  placed,
  mesh,
  dishGeo,
  capGeo,
  deg,
} from '../../../three/geo';

export function GamifiedSatellite3D() {
  const design = useGamifiedStore((s) => s.design);
  const viewMode = useGamifiedStore((s) => s.viewMode);
  const explodeProgress = useGamifiedStore((s) => s.explodeProgress);
  const inspectedComponentId = useGamifiedStore((s) => s.inspectedComponentId);
  const setInspectedComponent = useGamifiedStore((s) => s.setInspectedComponent);
  const activeChallengeIndex = useGamifiedStore((s) => s.activeChallengeIndex);
  const stage = useGamifiedStore((s) => s.stage);

  const groupRef = useRef<THREE.Group>(null);
  const [hoveredComp, setHoveredComp] = useState<string | null>(null);

  // Initialize cached aerospace PBR materials
  const m = useMemo(() => M(), []);

  // Smooth rotation when in assembled mode
  useFrame((_, delta) => {
    if (groupRef.current && viewMode === 'assembled' && explodeProgress < 0.05) {
      groupRef.current.rotation.y += delta * 0.15;
    }
  });

  // Calculate exploded offsets based on explodeProgress
  const ep = explodeProgress;
  const payloadOffset = new THREE.Vector3(0, 0, 2.2 * ep);
  const powerPortOffset = new THREE.Vector3(-2.8 * ep, 0, 0);
  const powerStarboardOffset = new THREE.Vector3(2.8 * ep, 0, 0);
  const commsOffset = new THREE.Vector3(0, 2.0 * ep, 0);
  const controlOffset = new THREE.Vector3(0, 0, -1.9 * ep);

  const isInternalView = viewMode === 'internal';
  const showDamage = stage === 'mission-simulation' && activeChallengeIndex === 0;

  return (
    <>
      <ambientLight intensity={0.55} />
      <directionalLight position={[6, 9, 7]} intensity={2.0} castShadow />
      <directionalLight position={[-6, -4, -5]} intensity={0.6} color="#38bdf8" />
      <pointLight position={[0, 4, 3]} intensity={0.8} color="#ffffff" distance={10} />

      <OrbitControls
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        minDistance={2.5}
        maxDistance={14}
        makeDefault
      />

      <group ref={groupRef} scale={[0.85, 0.85, 0.85]}>
        {/* ── CENTRAL SATELLITE BUS ── */}
        <SatelliteBus
          m={m}
          isInternalView={isInternalView}
          isHovered={hoveredComp === 'bus'}
          onPointerOver={() => setHoveredComp('bus')}
          onPointerOut={() => setHoveredComp(null)}
        />

        {/* ── INTERNAL SYSTEMS (VISIBLE IN INTERNAL X-RAY VIEW) ── */}
        {isInternalView && <InternalSystemsGroup m={m} />}

        {/* ── PAYLOAD SUBSYSTEM (OPTICAL / THERMAL / RADAR) ── */}
        {design.payload && (
          <group position={payloadOffset}>
            <PayloadComponent
              type={design.payload}
              m={m}
              isSelected={inspectedComponentId === design.payload}
              isHovered={hoveredComp === design.payload}
              onClick={() => setInspectedComponent(design.payload)}
              onPointerOver={() => setHoveredComp(design.payload)}
              onPointerOut={() => setHoveredComp(null)}
            />
          </group>
        )}

        {/* ── POWER SUBSYSTEM (SOLAR ARRAY WINGS) ── */}
        {design.power && (
          <>
            <group position={powerPortOffset}>
              <SolarWing
                type={design.power}
                side="port"
                m={m}
                isSelected={inspectedComponentId === design.power}
                isHovered={hoveredComp === design.power}
                hasDamage={showDamage}
                onClick={() => setInspectedComponent(design.power)}
                onPointerOver={() => setHoveredComp(design.power)}
                onPointerOut={() => setHoveredComp(null)}
              />
            </group>
            <group position={powerStarboardOffset}>
              <SolarWing
                type={design.power}
                side="starboard"
                m={m}
                isSelected={inspectedComponentId === design.power}
                isHovered={hoveredComp === design.power}
                hasDamage={false}
                onClick={() => setInspectedComponent(design.power)}
                onPointerOver={() => setHoveredComp(design.power)}
                onPointerOut={() => setHoveredComp(null)}
              />
            </group>
          </>
        )}

        {/* ── COMMUNICATION SUBSYSTEM (WHIP ANTENNA / PARABOLIC DISH) ── */}
        {design.communication && (
          <group position={commsOffset}>
            <CommunicationComponent
              type={design.communication}
              m={m}
              isSelected={inspectedComponentId === design.communication}
              isHovered={hoveredComp === design.communication}
              onClick={() => setInspectedComponent(design.communication)}
              onPointerOver={() => setHoveredComp(design.communication)}
              onPointerOut={() => setHoveredComp(null)}
            />
          </group>
        )}

        {/* ── ATTITUDE CONTROL SUBSYSTEM (RCS / REACTION WHEELS / STAR TRACKERS) ── */}
        {design.control && (
          <group position={controlOffset}>
            <ControlComponent
              type={design.control}
              m={m}
              isSelected={inspectedComponentId === design.control}
              isHovered={hoveredComp === design.control}
              onClick={() => setInspectedComponent(design.control)}
              onPointerOver={() => setHoveredComp(design.control)}
              onPointerOut={() => setHoveredComp(null)}
            />
          </group>
        )}
      </group>
    </>
  );
}

// ── Satellite Bus Model (Observation Satellite Chassis) ────────────────────────

function SatelliteBus({
  m,
  isInternalView,
  isHovered,
  onPointerOver,
  onPointerOut,
}: {
  m: Mats;
  isInternalView: boolean;
  isHovered: boolean;
  onPointerOver: () => void;
  onPointerOut: () => void;
}) {
  const BW = 1.4;
  const BD = 1.3;
  const BH = 1.7;

  // Frame longerons and perimeter decks
  const frameGeo = useMemo(() => {
    const frame: THREE.BufferGeometry[] = [];
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        frame.push(placed(box(0.06, 0.06, BH + 0.02), [(sx * BW) / 2, (sy * BD) / 2, 0]));
      }
    }
    for (const sz of [-1, 1]) {
      frame.push(placed(box(BW + 0.04, 0.06, 0.06), [0, -BD / 2, (sz * BH) / 2]));
      frame.push(placed(box(BW + 0.04, 0.06, 0.06), [0, BD / 2, (sz * BH) / 2]));
      frame.push(placed(box(0.06, BD + 0.04, 0.06), [-BW / 2, 0, (sz * BH) / 2]));
      frame.push(placed(box(0.06, BD + 0.04, 0.06), [BW / 2, 0, (sz * BH) / 2]));
    }
    return merge(frame);
  }, [BW, BD, BH]);

  // Translucent holographic cyan material for X-ray internal view
  const internalMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#00d4ff',
        metalness: 0.1,
        roughness: 0.1,
        transparent: true,
        opacity: 0.2,
        wireframe: true,
        emissive: isHovered ? '#00d4ff' : '#003344',
        emissiveIntensity: isHovered ? 0.6 : 0.2,
      }),
    [isHovered]
  );

  return (
    <group onPointerOver={onPointerOver} onPointerOut={onPointerOut}>
      {/* Main Bus Enclosure */}
      <mesh>
        <boxGeometry args={[BW, BD, BH]} />
        <primitive object={isInternalView ? internalMat : m.goldMLI} attach="material" />
      </mesh>

      {/* Primary Structural Frame */}
      {!isInternalView && (
        <>
          <primitive object={mesh(frameGeo, m.aluminum, 'Primary_Structure_Frame')} />

          {/* Nadir Deck (Carbon Honeycomb) */}
          <mesh position={[0, 0, BH / 2 + 0.02]}>
            <boxGeometry args={[BW - 0.08, BD - 0.08, 0.04]} />
            <primitive object={m.carbonWeave} attach="material" />
          </mesh>

          {/* Zenith Deck (Carbon Honeycomb) */}
          <mesh position={[0, 0, -BH / 2 - 0.02]}>
            <boxGeometry args={[BW - 0.08, BD - 0.08, 0.04]} />
            <primitive object={m.carbonWeave} attach="material" />
          </mesh>

          {/* Side Electrical & Harness Connector Panels */}
          <mesh position={[BW / 2 + 0.02, 0, 0.2]}>
            <boxGeometry args={[0.03, 0.45, 0.35]} />
            <primitive object={m.darkMetal} attach="material" />
          </mesh>
          <mesh position={[-BW / 2 - 0.02, 0, 0.2]}>
            <boxGeometry args={[0.03, 0.45, 0.35]} />
            <primitive object={m.darkMetal} attach="material" />
          </mesh>

          {/* Thermal Louver Arrays */}
          <mesh position={[0, BD / 2 + 0.02, 0]}>
            <boxGeometry args={[0.6, 0.02, 0.5]} />
            <primitive object={m.radiator} attach="material" />
          </mesh>
        </>
      )}
    </group>
  );
}

// ── Internal Systems (X-Ray Mode Flight Hardware) ─────────────────────────────

function InternalSystemsGroup({ m }: { m: Mats }) {
  const wheelRef = useRef<THREE.Group>(null);
  const obcPulseRef = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    if (wheelRef.current) wheelRef.current.rotation.z += delta * 6.0;
    if (obcPulseRef.current) {
      const s = 1.0 + Math.sin(Date.now() * 0.007) * 0.06;
      obcPulseRef.current.scale.set(s, s, s);
    }
  });

  return (
    <group>
      {/* Central Onboard Computer (OBC) Avionics */}
      <mesh ref={obcPulseRef} position={[0, 0, 0]}>
        <boxGeometry args={[0.45, 0.4, 0.4]} />
        <meshStandardMaterial
          color="#00ff88"
          emissive="#00ff88"
          emissiveIntensity={0.8}
          metalness={0.9}
        />
      </mesh>

      {/* Dual Flight-Grade Lithium-Ion Battery Packs */}
      <mesh position={[0, 0.35, 0]}>
        <boxGeometry args={[0.65, 0.22, 0.55]} />
        <primitive object={m.silverMLI} attach="material" />
      </mesh>
      <mesh position={[0, -0.35, 0]}>
        <boxGeometry args={[0.65, 0.22, 0.55]} />
        <primitive object={m.silverMLI} attach="material" />
      </mesh>

      {/* Titanium Hydrazine Propellant Tank */}
      <mesh position={[0, 0, -0.32]}>
        <sphereGeometry args={[0.26, 32, 32]} />
        <primitive object={m.titanium} attach="material" />
      </mesh>

      {/* Spinning 3-Axis Reaction Wheel Flywheel Assembly */}
      <group ref={wheelRef} position={[0.26, 0, 0.24]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.18, 0.18, 0.07, 32]} />
          <primitive object={m.aluminum} attach="material" />
        </mesh>
        <mesh position={[0, 0, 0.04]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.14, 0.02, 16, 32]} />
          <primitive object={m.darkMetal} attach="material" />
        </mesh>
      </group>
    </group>
  );
}

// ── Payload Subsystems (Optical Telescope / Thermal MSI / Radar Panel) ────────

function PayloadComponent({
  type,
  m,
  isSelected,
  isHovered,
  onClick,
  onPointerOver,
  onPointerOut,
}: {
  type: string;
  m: Mats;
  isSelected: boolean;
  isHovered: boolean;
  onClick: () => void;
  onPointerOver: () => void;
  onPointerOut: () => void;
}) {
  const highlightIntensity = isSelected ? 0.7 : isHovered ? 0.4 : 0;
  const highlightColor = isSelected ? '#00ff88' : isHovered ? '#00d4ff' : '#000000';

  // Secondary mirror spider geometry for optical telescope
  const spiderGeo = useMemo(() => {
    const spider: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 4; i++) {
      const a = deg(45 + i * 90);
      spider.push(
        strutGeo(
          new THREE.Vector3(0, 0, 0.95),
          new THREE.Vector3(Math.cos(a) * 0.32, Math.sin(a) * 0.32, 0.95),
          0.008
        )
      );
    }
    spider.push(placed(cylZ(0.08, 0.08, 0.08, 24), [0, 0, 0.95]));
    return merge(spider);
  }, []);

  return (
    <group
      position={[0, 0, 0.85]}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        onPointerOver();
      }}
      onPointerOut={onPointerOut}
    >
      {/* ── 1. High-Resolution Optical Telescope Assembly ── */}
      {type === 'optical-camera' && (
        <group>
          {/* Main Carbon Telescope Barrel */}
          <mesh position={[0, 0, 0.4]}>
            <cylinderGeometry args={[0.34, 0.38, 0.85, 48]} />
            <primitive object={m.carbon} attach="material" />
          </mesh>

          {/* Machined Aluminum Barrel Mounting Flange */}
          <mesh position={[0, 0, 0.02]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.42, 0.42, 0.06, 48]} />
            <primitive object={m.aluminum} attach="material" />
          </mesh>

          {/* Stiffening Rings */}
          <mesh position={[0, 0, 0.3]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.36, 0.02, 16, 48]} />
            <primitive object={m.aluminum} attach="material" />
          </mesh>
          <mesh position={[0, 0, 0.6]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.35, 0.02, 16, 48]} />
            <primitive object={m.aluminum} attach="material" />
          </mesh>

          {/* Stray Light Baffle */}
          <mesh position={[0, 0, 0.82]}>
            <cylinderGeometry args={[0.33, 0.33, 0.32, 48, 1, true]} />
            <primitive object={m.blackMLI} attach="material" />
          </mesh>

          {/* Primary Mirror Aperture Glass */}
          <mesh position={[0, 0, 0.75]}>
            <cylinderGeometry args={[0.3, 0.3, 0.03, 48]} />
            <primitive object={m.glass} attach="material" />
          </mesh>

          {/* 4-Vane Carbon Spider + Secondary Mirror */}
          <primitive object={mesh(spiderGeo, m.carbon, 'Secondary_Spider')} />
          <mesh position={[0, 0, 0.95]}>
            <cylinderGeometry args={[0.06, 0.06, 0.03, 24]} />
            <primitive object={m.mirrorGold} attach="material" />
          </mesh>

          {/* Focal Plane Electronics & OSR Radiator */}
          <mesh position={[0.42, 0, 0.3]}>
            <boxGeometry args={[0.2, 0.32, 0.4]} />
            <primitive object={m.silverMLI} attach="material" />
          </mesh>
          <mesh position={[0.54, 0, 0.3]}>
            <boxGeometry args={[0.02, 0.36, 0.46]} />
            <primitive object={m.radiator} attach="material" />
          </mesh>

          {/* 110° Deployed Protective Aperture Cover Door with Pin */}
          <group position={[0, 0.34, 0.98]} rotation={[-1.9, 0, 0]}>
            <mesh position={[0, 0.34, 0]}>
              <cylinderGeometry args={[0.34, 0.34, 0.03, 48]} />
              <primitive object={m.goldMLI} attach="material" />
            </mesh>
            <mesh position={[0, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.025, 0.025, 0.24, 16]} />
              <primitive object={m.darkMetal} attach="material" />
            </mesh>
          </group>

          {/* Active Highlight Aura */}
          {highlightIntensity > 0 && (
            <mesh position={[0, 0, 0.4]}>
              <cylinderGeometry args={[0.39, 0.43, 0.9, 32]} />
              <meshBasicMaterial
                color={highlightColor}
                wireframe={true}
                transparent={true}
                opacity={highlightIntensity * 0.7}
              />
            </mesh>
          )}
        </group>
      )}

      {/* ── 2. Cryo-Cooled Multispectral Infrared Imager (MSI) ── */}
      {type === 'thermal-sensor' && (
        <group>
          {/* Main Sealed Sensor Enclosure in Aluminized Silver MLI */}
          <mesh position={[0, 0, 0.3]}>
            <boxGeometry args={[0.65, 0.65, 0.6]} />
            <primitive object={m.silverMLI} attach="material" />
          </mesh>

          {/* Cryogenic Radiometer Barrel */}
          <mesh position={[0, 0, 0.65]}>
            <cylinderGeometry args={[0.2, 0.24, 0.32, 36]} />
            <primitive object={m.carbon} attach="material" />
          </mesh>

          {/* Germanium Amber Optical Shroud & IR Lens */}
          <mesh position={[0, 0, 0.82]}>
            <cylinderGeometry args={[0.18, 0.18, 0.04, 36]} />
            <primitive object={m.amberMLI} attach="material" />
          </mesh>
          <mesh position={[0, 0, 0.83]}>
            <cylinderGeometry args={[0.16, 0.16, 0.02, 36]} />
            <primitive object={m.mirrorGold} attach="material" />
          </mesh>

          {/* Dedicated Pulse-Tube Cryocooler & OSR Radiator Panel */}
          <mesh position={[-0.38, 0, 0.3]}>
            <boxGeometry args={[0.03, 0.55, 0.55]} />
            <primitive object={m.radiator} attach="material" />
          </mesh>
          <mesh position={[-0.35, 0, 0.3]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.07, 0.07, 0.16, 20]} />
            <primitive object={m.darkMetal} attach="material" />
          </mesh>

          {/* Active Highlight Aura */}
          {highlightIntensity > 0 && (
            <mesh position={[0, 0, 0.35]}>
              <boxGeometry args={[0.72, 0.72, 0.7]} />
              <meshBasicMaterial
                color={highlightColor}
                wireframe={true}
                transparent={true}
                opacity={highlightIntensity * 0.7}
              />
            </mesh>
          )}
        </group>
      )}

      {/* ── 3. Synthetic Aperture Radar (SAR) Phased Array ── */}
      {type === 'radar' && (
        <group position={[0, 0, 0.2]}>
          {/* Carbon-Composite Honeycomb Structural Backplane */}
          <mesh>
            <boxGeometry args={[1.75, 1.0, 0.07]} />
            <primitive object={m.carbonWeave} attach="material" />
          </mesh>

          {/* Gold Microwave Microstrip Radiating Patch Array */}
          <mesh position={[0, 0, 0.04]}>
            <planeGeometry args={[1.65, 0.9]} />
            <primitive object={m.goldMLI} attach="material" />
          </mesh>

          {/* Waveguide Manifold & RF Feed Horn Truss */}
          <mesh position={[0, 0, -0.05]}>
            <boxGeometry args={[1.5, 0.12, 0.06]} />
            <primitive object={m.aluminum} attach="material" />
          </mesh>
          <mesh position={[0, 0, -0.1]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.05, 0.08, 0.14, 16]} />
            <primitive object={m.darkMetal} attach="material" />
          </mesh>

          {/* Active Highlight Aura */}
          {highlightIntensity > 0 && (
            <mesh>
              <boxGeometry args={[1.82, 1.07, 0.12]} />
              <meshBasicMaterial
                color={highlightColor}
                wireframe={true}
                transparent={true}
                opacity={highlightIntensity * 0.7}
              />
            </mesh>
          )}
        </group>
      )}
    </group>
  );
}

// ── Solar Array Wings (GaAs Photovoltaic Wings with SADA Drive) ───────────────

function SolarWing({
  type,
  side,
  m,
  isSelected,
  isHovered,
  hasDamage,
  onClick,
  onPointerOver,
  onPointerOut,
}: {
  type: string;
  side: 'port' | 'starboard';
  m: Mats;
  isSelected: boolean;
  isHovered: boolean;
  hasDamage: boolean;
  onClick: () => void;
  onPointerOver: () => void;
  onPointerOut: () => void;
}) {
  const dir = side === 'port' ? -1 : 1;
  const highlightIntensity = isSelected ? 0.7 : isHovered ? 0.4 : 0;
  const highlightColor = isSelected ? '#00ff88' : isHovered ? '#00d4ff' : '#000000';

  const sparksRef = useRef<THREE.Mesh>(null);
  useFrame((_, delta) => {
    if (sparksRef.current && hasDamage) {
      sparksRef.current.rotation.z += delta * 9;
      const flicker = 0.6 + Math.random() * 0.9;
      (sparksRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = flicker;
    }
  });

  return (
    <group
      position={[dir * 0.7, 0, 0]}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        onPointerOver();
      }}
      onPointerOut={onPointerOut}
    >
      {/* SADA (Solar Array Drive Assembly) Motor Housing */}
      <mesh position={[dir * 0.1, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.08, 0.08, 0.22, 24]} />
        <primitive object={m.darkMetal} attach="material" />
      </mesh>
      <mesh position={[dir * 0.22, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.035, 0.035, 0.14, 16]} />
        <primitive object={m.aluminum} attach="material" />
      </mesh>

      {/* Articulated Deployment Boom Yoke */}
      <mesh position={[dir * 0.35, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.045, 0.045, 0.2, 16]} />
        <primitive object={m.aluminum} attach="material" />
      </mesh>

      {/* Primary Inboard Solar Wing Panel (Triple-Junction GaAs) */}
      <group position={[dir * 1.35, 0, 0]}>
        <mesh>
          <boxGeometry args={[1.7, 0.85, 0.03]} />
          <primitive object={hasDamage ? m.darkMetal : m.solar} attach="material" />
        </mesh>
        {/* Composite Honeycomb Substrate Backing */}
        <mesh position={[0, 0, -0.018]}>
          <boxGeometry args={[1.7, 0.85, 0.005]} />
          <primitive object={m.solarBack} attach="material" />
        </mesh>
      </group>

      {/* Advanced Articulated Solar Arrays (Second Outboard Panel + Rotary Joint) */}
      {type === 'advanced-solar' && (
        <group position={[dir * 3.0, 0, 0]}>
          {/* Inter-panel Titanium Hinge Joint */}
          <mesh position={[-dir * 0.85, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.025, 0.025, 0.15, 12]} />
            <primitive object={m.titanium} attach="material" />
          </mesh>
          {/* Outboard High-Efficiency Photovoltaic Panel */}
          <mesh>
            <boxGeometry args={[1.5, 0.85, 0.03]} />
            <primitive object={m.solar} attach="material" />
          </mesh>
          <mesh position={[0, 0, -0.018]}>
            <boxGeometry args={[1.5, 0.85, 0.005]} />
            <primitive object={m.solarBack} attach="material" />
          </mesh>
        </group>
      )}

      {/* Damaged Solar Cell Sparking Animation */}
      {hasDamage && (
        <mesh ref={sparksRef} position={[dir * 1.25, 0.15, 0.08]}>
          <sphereGeometry args={[0.14, 16, 16]} />
          <meshStandardMaterial
            color="#ff5500"
            emissive="#ef4444"
            emissiveIntensity={1.8}
            wireframe={true}
          />
        </mesh>
      )}

      {/* Active Highlight Wireframe */}
      {highlightIntensity > 0 && (
        <mesh position={[dir * 1.35, 0, 0]}>
          <boxGeometry args={[1.76, 0.9, 0.05]} />
          <meshBasicMaterial
            color={highlightColor}
            wireframe={true}
            transparent={true}
            opacity={highlightIntensity * 0.7}
          />
        </mesh>
      )}
    </group>
  );
}

// ── Communication Subsystem (Steerable Cassegrain Dish / S-Band Whip) ─────────

function CommunicationComponent({
  type,
  m,
  isSelected,
  isHovered,
  onClick,
  onPointerOver,
  onPointerOut,
}: {
  type: string;
  m: Mats;
  isSelected: boolean;
  isHovered: boolean;
  onClick: () => void;
  onPointerOver: () => void;
  onPointerOut: () => void;
}) {
  const highlightIntensity = isSelected ? 0.7 : isHovered ? 0.4 : 0;
  const highlightColor = isSelected ? '#00ff88' : isHovered ? '#00d4ff' : '#000000';

  // Cassegrain Subreflector Quadripod Struts
  const quadripodGeo = useMemo(() => {
    const struts: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 4; i++) {
      const a = deg(45 + i * 90);
      struts.push(
        strutGeo(
          new THREE.Vector3(Math.cos(a) * 0.42, Math.sin(a) * 0.42, 0.1),
          new THREE.Vector3(Math.cos(a) * 0.08, Math.sin(a) * 0.08, 0.46),
          0.009
        )
      );
    }
    return merge(struts);
  }, []);

  return (
    <group
      position={[0, 0.88, 0]}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        onPointerOver();
      }}
      onPointerOut={onPointerOut}
    >
      {type === 'basic-antenna' ? (
        // ── 1. Omnidirectional S-Band Whip / LGA Mast ──
        <group position={[0, 0.1, 0]}>
          {/* Ground Plane Choke Ring */}
          <mesh position={[0, 0, 0]}>
            <cylinderGeometry args={[0.09, 0.09, 0.02, 24]} />
            <primitive object={m.aluminum} attach="material" />
          </mesh>
          {/* Mast Cylinder */}
          <mesh position={[0, 0.38, 0]}>
            <cylinderGeometry args={[0.018, 0.022, 0.72, 20]} />
            <primitive object={m.aluminum} attach="material" />
          </mesh>
          {/* S-Band Helical/Whip Radiating Tip */}
          <mesh position={[0, 0.76, 0]}>
            <sphereGeometry args={[0.045, 20, 20]} />
            <meshStandardMaterial
              color="#00d4ff"
              emissive="#00d4ff"
              emissiveIntensity={0.7}
              metalness={0.9}
            />
          </mesh>
        </group>
      ) : (
        // ── 2. Steerable High-Gain Cassegrain Parabolic Dish ──
        <group position={[0, 0.25, 0]} rotation={[-0.35, 0, 0]}>
          {/* 2-Axis Elevation/Azimuth Gimbal Yoke */}
          <mesh position={[0, -0.18, 0]}>
            <cylinderGeometry args={[0.05, 0.06, 0.3, 20]} />
            <primitive object={m.darkMetal} attach="material" />
          </mesh>

          {/* Parabolic Reflector Dish with Antenna Composite Mesh */}
          <mesh position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <primitive object={dishGeo(0.62, 0.16, 48, 16, 0.08)} />
            <primitive object={m.antennaMesh} attach="material" />
          </mesh>

          {/* Aluminum Perimeter Rim Ring */}
          <mesh position={[0, 0, 0.16]}>
            <torusGeometry args={[0.62, 0.018, 16, 48]} />
            <primitive object={m.aluminum} attach="material" />
          </mesh>

          {/* Central Hub & Ka/X-Band Feed Horn */}
          <mesh position={[0, 0, 0.04]}>
            <cylinderGeometry args={[0.08, 0.08, 0.08, 24]} />
            <primitive object={m.darkMetal} attach="material" />
          </mesh>
          <mesh position={[0, 0, 0.18]}>
            <cylinderGeometry args={[0.035, 0.055, 0.2, 20]} />
            <primitive object={m.whitePaint} attach="material" />
          </mesh>

          {/* Carbon Quadripod Struts + Secondary Mirror */}
          <primitive object={mesh(quadripodGeo, m.carbon, 'Subreflector_Quadripod')} />
          <mesh position={[0, 0, 0.48]}>
            <primitive object={capGeo(0.09, 0.02, 24, 6)} />
            <primitive object={m.mirrorSilver} attach="material" />
          </mesh>
        </group>
      )}

      {/* Active Highlight Aura */}
      {highlightIntensity > 0 && (
        <mesh position={[0, 0.25, 0]}>
          <sphereGeometry args={[0.7, 24, 24]} />
          <meshBasicMaterial
            color={highlightColor}
            wireframe={true}
            transparent={true}
            opacity={highlightIntensity * 0.5}
          />
        </mesh>
      )}
    </group>
  );
}

// ── Control Subsystem (Dual Star Trackers / Hydrazine RCS / Reaction Wheels) ───

function ControlComponent({
  type,
  m,
  isSelected,
  isHovered,
  onClick,
  onPointerOver,
  onPointerOut,
}: {
  type: string;
  m: Mats;
  isSelected: boolean;
  isHovered: boolean;
  onClick: () => void;
  onPointerOver: () => void;
  onPointerOut: () => void;
}) {
  const highlightIntensity = isSelected ? 0.7 : isHovered ? 0.4 : 0;
  const highlightColor = isSelected ? '#00ff88' : isHovered ? '#00d4ff' : '#000000';

  return (
    <group
      position={[0, 0, -0.88]}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        onPointerOver();
      }}
      onPointerOut={onPointerOut}
    >
      {type === 'basic-control' ? (
        // ── 1. Basic 3-Axis Reaction Wheels & Cold Gas Thruster Quads ──
        <group>
          {/* 4-Corner Cold Gas Thruster Quads */}
          {[-0.52, 0.52].map((x, i) =>
            [-0.48, 0.48].map((y, j) => (
              <group key={`quad-${i}-${j}`} position={[x, y, -0.04]}>
                <mesh rotation={[Math.PI / 2, 0, 0]}>
                  <coneGeometry args={[0.05, 0.14, 16]} />
                  <primitive object={m.titanium} attach="material" />
                </mesh>
              </group>
            ))
          )}

          {/* Central Momentum Wheel Casings */}
          <mesh position={[0, 0, -0.06]}>
            <cylinderGeometry args={[0.18, 0.18, 0.08, 24]} />
            <primitive object={m.aluminum} attach="material" />
          </mesh>
        </group>
      ) : (
        // ── 2. Advanced Hydrazine RCS Thrusters & Dual Star Trackers ──
        <group>
          {/* Hydrazine RCS Rocket Thruster Clusters with Inconel Bell Nozzles */}
          {[-0.52, 0.52].map((x, i) =>
            [-0.48, 0.48].map((y, j) => (
              <group key={`rcs-${i}-${j}`} position={[x, y, -0.05]}>
                <mesh rotation={[Math.PI / 2, 0, 0]}>
                  <cylinderGeometry args={[0.035, 0.08, 0.18, 20]} />
                  <primitive object={m.inconel} attach="material" />
                </mesh>
                <mesh position={[0, 0, 0.06]}>
                  <cylinderGeometry args={[0.04, 0.04, 0.05, 16]} />
                  <primitive object={m.titanium} attach="material" />
                </mesh>
              </group>
            ))
          )}

          {/* Dual Precision Star Tracker Optical Baffles */}
          <group position={[0, 0.45, 0.08]} rotation={[0.42, 0, 0]}>
            {[-0.18, 0.18].map((stX, idx) => (
              <group key={`st-${idx}`} position={[stX, 0, 0]}>
                {/* Machined Bracket */}
                <mesh position={[0, -0.08, 0]}>
                  <boxGeometry args={[0.1, 0.1, 0.06]} />
                  <primitive object={m.aluminum} attach="material" />
                </mesh>
                {/* Optical Barrel */}
                <mesh>
                  <cylinderGeometry args={[0.05, 0.05, 0.22, 20]} />
                  <primitive object={m.darkMetal} attach="material" />
                </mesh>
                {/* Black MLI Optical Baffle */}
                <mesh position={[0, 0.14, 0]}>
                  <cylinderGeometry args={[0.068, 0.052, 0.14, 20, 1, true]} />
                  <primitive object={m.blackMLI} attach="material" />
                </mesh>
              </group>
            ))}
          </group>
        </group>
      )}

      {/* Active Highlight Aura */}
      {highlightIntensity > 0 && (
        <mesh position={[0, 0, -0.06]}>
          <boxGeometry args={[1.3, 1.2, 0.25]} />
          <meshBasicMaterial
            color={highlightColor}
            wireframe={true}
            transparent={true}
            opacity={highlightIntensity * 0.6}
          />
        </mesh>
      )}
    </group>
  );
}
