import { useMemo, useRef } from "react";
import { useFrame, useLoader } from "@react-three/fiber";
import * as THREE from "three";

const DAY_MAP = "/textures/earth_day.jpg";
const CLOUDS_MAP = "/textures/earth_clouds.jpg";
const SURFACE_MAP = "/textures/earth_bump.jpg";

const INITIAL_ROTATION_Y = THREE.MathUtils.degToRad(-110);
const INITIAL_ROTATION_X = THREE.MathUtils.degToRad(-6);

interface EarthProps {
  reducedMotion: boolean;
}

// Subtle orbital tracks & illustrative satellite markers
function OrbitalSystem({ reducedMotion }: { reducedMotion: boolean }) {
  const sat1Ref = useRef<THREE.Group>(null);
  const sat2Ref = useRef<THREE.Group>(null);

  // Generate orbit ring points for LEO (Low Earth Orbit)
  const leoPoints = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    const segments = 90;
    const r = 1.32;
    for (let i = 0; i <= segments; i++) {
      const theta = (i / segments) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(theta) * r, 0, Math.sin(theta) * r));
    }
    return pts;
  }, []);

  // Generate orbit ring points for SSO (Sun-Synchronous Polar Orbit)
  const ssoPoints = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    const segments = 90;
    const r = 1.42;
    for (let i = 0; i <= segments; i++) {
      const theta = (i / segments) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(theta) * r, 0, Math.sin(theta) * r));
    }
    return pts;
  }, []);

  const leoGeo = useMemo(() => new THREE.BufferGeometry().setFromPoints(leoPoints), [leoPoints]);
  const ssoGeo = useMemo(() => new THREE.BufferGeometry().setFromPoints(ssoPoints), [ssoPoints]);

  useFrame((state) => {
    if (reducedMotion) return;
    const t = state.clock.getElapsedTime();
    if (sat1Ref.current) {
      const a1 = t * 0.28;
      sat1Ref.current.position.set(Math.cos(a1) * 1.32, 0, Math.sin(a1) * 1.32);
    }
    if (sat2Ref.current) {
      const a2 = t * 0.18 + 2.1;
      sat2Ref.current.position.set(Math.cos(a2) * 1.42, 0, Math.sin(a2) * 1.42);
    }
  });

  return (
    <>
      {/* Primary LEO Orbital Plane (28.5° inclination) */}
      <group rotation={[THREE.MathUtils.degToRad(28.5), 0, THREE.MathUtils.degToRad(18)]}>
        {/* @ts-expect-error Three line JSX */}
        <line geometry={leoGeo}>
          <lineBasicMaterial color="#00d4ff" transparent opacity={0.28} depthWrite={false} />
        </line>
        <group ref={sat1Ref} position={[1.32, 0, 0]}>
          <mesh>
            <boxGeometry args={[0.03, 0.02, 0.02]} />
            <meshStandardMaterial color="#e0f4ff" metalness={0.9} roughness={0.15} />
          </mesh>
          <mesh position={[0.03, 0, 0]}>
            <boxGeometry args={[0.028, 0.003, 0.02]} />
            <meshStandardMaterial color="#0088cc" metalness={0.8} roughness={0.2} />
          </mesh>
          <mesh position={[-0.03, 0, 0]}>
            <boxGeometry args={[0.028, 0.003, 0.02]} />
            <meshStandardMaterial color="#0088cc" metalness={0.8} roughness={0.2} />
          </mesh>
          <mesh>
            <sphereGeometry args={[0.01, 8, 8]} />
            <meshBasicMaterial color="#00d4ff" transparent opacity={0.9} />
          </mesh>
        </group>
      </group>

      {/* Secondary Polar SSO Orbital Plane (97.8° inclination) */}
      <group rotation={[THREE.MathUtils.degToRad(97.8), THREE.MathUtils.degToRad(45), 0]}>
        {/* @ts-expect-error Three line JSX */}
        <line geometry={ssoGeo}>
          <lineBasicMaterial color="#5dade2" transparent opacity={0.2} depthWrite={false} />
        </line>
        <group ref={sat2Ref} position={[1.42, 0, 0]}>
          <mesh>
            <boxGeometry args={[0.024, 0.018, 0.018]} />
            <meshStandardMaterial color="#ffffff" metalness={0.85} roughness={0.2} />
          </mesh>
          <mesh position={[0, 0.022, 0]}>
            <boxGeometry args={[0.018, 0.003, 0.024]} />
            <meshStandardMaterial color="#3a82f6" metalness={0.7} roughness={0.3} />
          </mesh>
          <mesh>
            <sphereGeometry args={[0.008, 8, 8]} />
            <meshBasicMaterial color="#60a5fa" transparent opacity={0.85} />
          </mesh>
        </group>
      </group>
    </>
  );
}

export default function Earth({ reducedMotion }: EarthProps) {
  const earthGroupRef = useRef<THREE.Group>(null);
  const cloudsRef = useRef<THREE.Mesh>(null);

  // Load textures through standard Three.js texture loader via R3F
  const [dayMap, cloudsMap, surfaceMap] = useLoader(THREE.TextureLoader, [
    DAY_MAP,
    CLOUDS_MAP,
    SURFACE_MAP,
  ]);

  useMemo(() => {
    dayMap.colorSpace = THREE.SRGBColorSpace;
    dayMap.wrapS = THREE.RepeatWrapping;
    cloudsMap.wrapS = THREE.RepeatWrapping;
    surfaceMap.wrapS = THREE.RepeatWrapping;
  }, [dayMap, cloudsMap, surfaceMap]);

  useFrame((_, delta) => {
    const clampedDelta = Math.min(delta, 0.1);
    if (!reducedMotion) {
      if (earthGroupRef.current) {
        earthGroupRef.current.rotation.y += clampedDelta * 0.045;
      }
      if (cloudsRef.current) {
        cloudsRef.current.rotation.y += clampedDelta * 0.055;
      }
    }
  });

  return (
    <group>
      {/* Primary Planet Earth Sphere */}
      <group
        ref={earthGroupRef}
        rotation={[INITIAL_ROTATION_X, INITIAL_ROTATION_Y, 0]}
      >
        <mesh>
          <sphereGeometry args={[1, 64, 64]} />
          <meshStandardMaterial
            map={dayMap}
            bumpMap={surfaceMap}
            bumpScale={0.035}
            roughness={0.65}
            metalness={0.08}
          />
        </mesh>

        {/* Dynamic Cloud Sphere Overlay */}
        <mesh ref={cloudsRef} scale={1.012}>
          <sphereGeometry args={[1, 64, 64]} />
          <meshStandardMaterial
            map={cloudsMap}
            transparent
            opacity={0.38}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>

        {/* Atmosphere Limb Glow */}
        <mesh scale={1.025}>
          <sphereGeometry args={[1, 32, 32]} />
          <meshBasicMaterial
            color="#00d4ff"
            transparent
            opacity={0.12}
            side={THREE.BackSide}
          />
        </mesh>
      </group>

      {/* Orbiting Satellites */}
      <OrbitalSystem reducedMotion={reducedMotion} />
    </group>
  );
}
