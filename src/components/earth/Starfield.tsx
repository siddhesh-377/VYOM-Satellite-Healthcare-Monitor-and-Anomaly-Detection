import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

// A restrained, subtly twinkling starfield plus a faint blue nebula haze to
// sit behind the Earth without competing for visual attention.
export default function Starfield() {
  const pointsRef = useRef<THREE.Points>(null);
  const nebulaRef = useRef<THREE.Points>(null);

  const starGeometry = useMemo(() => {
    const count = 1800;
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const radius = 18 + Math.random() * 22;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = radius * Math.cos(phi);
      sizes[i] = Math.random() * 1.4 + 0.2;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("size", new THREE.BufferAttribute(sizes, 1));
    return geo;
  }, []);

  const nebulaGeometry = useMemo(() => {
    const count = 160;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const radius = 14 + Math.random() * 10;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta) - 6;
      positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta) + 4;
      positions[i * 3 + 2] = radius * Math.cos(phi) - 10;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return geo;
  }, []);

  useFrame((_, delta) => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y += delta * 0.002;
    }
    if (nebulaRef.current) {
      nebulaRef.current.rotation.y += delta * 0.0012;
    }
  });

  return (
    <>
      <points ref={nebulaRef} geometry={nebulaGeometry}>
        <pointsMaterial
          size={6}
          color="#3a5fb8"
          transparent
          opacity={0.06}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          sizeAttenuation
        />
      </points>
      <points ref={pointsRef} geometry={starGeometry}>
        <pointsMaterial
          size={0.065}
          color="#ffffff"
          transparent
          opacity={0.85}
          depthWrite={false}
          sizeAttenuation
        />
      </points>
    </>
  );
}
