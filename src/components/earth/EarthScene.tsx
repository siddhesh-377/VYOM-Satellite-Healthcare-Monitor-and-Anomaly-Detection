import { Suspense, useEffect, useMemo, useState, Component, type ReactNode } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import Earth from "./Earth";
import Starfield from "./Starfield";

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mql.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  return reduced;
}

function isWebGLAvailable() {
  try {
    const canvas = document.createElement("canvas");
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext("webgl") || canvas.getContext("experimental-webgl"))
    );
  } catch {
    return false;
  }
}

class EarthErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode; onError?: () => void },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode; fallback: ReactNode; onError?: () => void }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error("Earth scene WebGL rendering error, switching to high-fidelity globe:", error);
    this.props.onError?.();
  }

  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

// High-fidelity fallback that renders a realistic illuminated Earth sphere
export function StaticEarthFallback() {
  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        height: "100%",
        width: "100%",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        backgroundColor: "#020409",
        background: "radial-gradient(circle at 50% 50%, rgba(0, 180, 255, 0.08) 0%, rgba(2, 4, 9, 1) 75%)",
      }}
    >
      {/* Background Star Dots */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "radial-gradient(1px 1px at 20px 30px, #ffffff, rgba(0,0,0,0)), radial-gradient(1.5px 1.5px at 140px 90px, #00d4ff, rgba(0,0,0,0)), radial-gradient(1px 1px at 280px 220px, #ffffff, rgba(0,0,0,0)), radial-gradient(1.5px 1.5px at 400px 360px, #5dade2, rgba(0,0,0,0)), radial-gradient(1px 1px at 180px 450px, #ffffff, rgba(0,0,0,0))",
          backgroundSize: "450px 450px",
          opacity: 0.55,
        }}
      />

      {/* Primary LEO Orbit Track Ring */}
      <div
        style={{
          position: "absolute",
          width: "min(460px, 80%)",
          height: "min(460px, 80%)",
          borderRadius: "50%",
          border: "1px dashed rgba(0, 212, 255, 0.28)",
          transform: "rotateX(68deg) rotateY(18deg)",
          pointerEvents: "none",
        }}
      >
        {/* Orbiting Satellite Marker */}
        <div
          style={{
            position: "absolute",
            top: "-4px",
            left: "50%",
            width: "8px",
            height: "8px",
            borderRadius: "50%",
            backgroundColor: "#00d4ff",
            boxShadow: "0 0 10px #00d4ff",
          }}
        />
      </div>

      {/* Realistic 3D Earth Globe Sphere with Shading & Atmospheric Halo */}
      <div
        style={{
          position: "relative",
          width: "min(340px, 60vw)",
          aspectRatio: "1 / 1",
          borderRadius: "50%",
          backgroundImage: "url(/textures/earth_day.jpg)",
          backgroundSize: "200% 100%",
          backgroundPosition: "38% center",
          boxShadow:
            "0 0 50px rgba(0, 212, 255, 0.28), inset -45px -25px 65px rgba(0, 0, 0, 0.95), inset 15px 15px 30px rgba(255, 255, 255, 0.15)",
          border: "1px solid rgba(0, 212, 255, 0.35)",
          overflow: "hidden",
        }}
      >
        {/* Day/Night Soft Terminator Shadow */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            background:
              "linear-gradient(105deg, rgba(255,255,255,0.05) 0%, rgba(0,0,0,0) 45%, rgba(2,6,16,0.92) 80%, rgba(1,3,8,0.98) 100%)",
            pointerEvents: "none",
          }}
        />

        {/* Atmosphere Limb Scattering Rim */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            boxShadow: "inset 0 0 25px rgba(0, 212, 255, 0.45)",
            pointerEvents: "none",
          }}
        />
      </div>

      {/* Aerospace Telemetry Live Badge */}
      <div
        style={{
          position: "absolute",
          bottom: 24,
          fontFamily: "var(--font-mono, monospace)",
          fontSize: 9,
          letterSpacing: "0.14em",
          color: "rgba(0, 212, 255, 0.85)",
          textTransform: "uppercase",
          background: "rgba(5, 12, 25, 0.88)",
          padding: "5px 14px",
          borderRadius: 4,
          border: "1px solid rgba(0, 212, 255, 0.25)",
          backdropFilter: "blur(8px)",
        }}
      >
        ● EARTH SENSOR ACTIVE • LEO ORBIT VIEW
      </div>
    </div>
  );
}

function SceneLoader() {
  return (
    <div
      style={{
        display: "flex",
        height: "100%",
        width: "100%",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        gap: 14,
        backgroundColor: "#020409",
      }}
    >
      <div
        style={{
          width: 38,
          height: 38,
          borderRadius: "50%",
          border: "2px solid rgba(0, 212, 255, 0.2)",
          borderTopColor: "#00d4ff",
          animation: "spin 1s linear infinite",
        }}
      />
      <span
        style={{
          fontFamily: "var(--font-mono, monospace)",
          fontSize: 9,
          letterSpacing: "0.14em",
          color: "rgba(0, 212, 255, 0.75)",
        }}
      >
        INITIALIZING ORBITAL SENSORS...
      </span>
    </div>
  );
}

export default function EarthScene() {
  const reducedMotion = usePrefersReducedMotion();
  const [hasContextError, setHasContextError] = useState(false);
  const webglAvailable = useMemo(() => isWebGLAvailable(), []);

  if (!webglAvailable || hasContextError) {
    return <StaticEarthFallback />;
  }

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        backgroundColor: "#020409",
      }}
    >
      <EarthErrorBoundary
        fallback={<StaticEarthFallback />}
        onError={() => setHasContextError(true)}
      >
        <Suspense fallback={<SceneLoader />}>
          <Canvas
            dpr={[1, 1.5]}
            gl={{
              antialias: true,
              alpha: true,
              powerPreference: "default",
              failIfMajorPerformanceCaveat: false,
            }}
            camera={{ position: [0, 0, 2.75], fov: 45, near: 0.1, far: 100 }}
            onCreated={({ gl }) => {
              gl.domElement.addEventListener(
                "webglcontextlost",
                (event) => {
                  event.preventDefault();
                  console.warn("WebGL context lost on Earth scene, switching to fallback.");
                  setHasContextError(true);
                },
                false
              );
            }}
          >
            <ambientLight intensity={0.55} color="#aec3e0" />
            <directionalLight
              position={[4, 1.2, 2.5]}
              intensity={2.2}
              color="#fff6e8"
            />
            <Starfield />
            <Earth reducedMotion={reducedMotion} />
            <OrbitControls
              enablePan={false}
              enableZoom={true}
              enableRotate={true}
              enableDamping={true}
              dampingFactor={0.08}
              rotateSpeed={0.45}
              zoomSpeed={0.55}
              minDistance={1.45}
              maxDistance={5.5}
              minPolarAngle={0.25}
              maxPolarAngle={Math.PI - 0.25}
              target={[0, 0, 0]}
              makeDefault
            />
          </Canvas>
        </Suspense>
      </EarthErrorBoundary>
    </div>
  );
}
