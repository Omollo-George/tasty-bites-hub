import React, { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float } from "@react-three/drei";

import * as THREE from "three";

/**
 * Restaurant 3D animated interior background for POS.
 * - Transparent background: designed to sit behind UI.
 * - Procedural materials only (no external textures).
 * - Performance: uses instancing + low mesh counts to target < 30 draw calls.
 */

function useCameraDrift({ ampRad = 0.08, zoomMin = 0.98, zoomMax = 1.02 }) {
  const groupRef = useRef();

  useFrame(({ clock, camera }) => {
    const t = clock.getElapsedTime();

    // Side-to-side drift (approx ~5 degrees)
    const yaw = Math.sin(t * 0.22) * ampRad;
    camera.rotation.y = yaw;

    // Slight zoom oscillation (parallax effect)
    const z = THREE.MathUtils.lerp(zoomMin, zoomMax, (Math.sin(t * 0.15) + 1) / 2);
    camera.zoom = z;

    camera.updateProjectionMatrix();

    if (groupRef.current) {
      // Subtle camera position drift
      camera.position.x = Math.sin(t * 0.2) * 0.12;
      camera.position.y = 1.6 + Math.sin(t * 0.13) * 0.04;
      camera.lookAt(0, 1.2, 0);
    }
  });

  return groupRef;
}

function WarmBokehLights({ count = 26 }) {
  const points = useMemo(() => {
    const arr = new Array(count).fill(0).map((_, i) => {
      // Warm orange/yellow range
      const hue = 28 + (i % 5) * 3;
      const sat = 92;
      const lightness = 56 + (i % 7);

      const color = new THREE.Color(
        `hsl(${hue} ${sat}% ${lightness}%)`
      );

      return {
        position: new THREE.Vector3(
          (Math.random() - 0.5) * 7.5,
          1.2 + Math.random() * 2.2,
          (Math.random() - 0.15) * 6.5
        ),
        color,
        // twinkle speed + amplitude
        phase: Math.random() * Math.PI * 2,
        tw: 0.6 + Math.random() * 1.2,
        size: 0.05 + Math.random() * 0.09,
      };
    });
    return arr;
  }, [count]);

  // One Points draw call: PointsMaterial + per-vertex colors
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const positions = new Float32Array(points.length * 3);
    const colors = new Float32Array(points.length * 3);
    const sizes = new Float32Array(points.length);

    points.forEach((p, i) => {
      positions[i * 3 + 0] = p.position.x;
      positions[i * 3 + 1] = p.position.y;
      positions[i * 3 + 2] = p.position.z;

      colors[i * 3 + 0] = p.color.r;
      colors[i * 3 + 1] = p.color.g;
      colors[i * 3 + 2] = p.color.b;

      sizes[i] = p.size;
    });

    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    g.setAttribute("size", new THREE.BufferAttribute(sizes, 1));

    return g;
  }, [points]);

  const material = useMemo(() => {
    // Use additive blending for bokeh-like glow
    const m = new THREE.PointsMaterial({
      vertexColors: true,
      size: 0.18,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    return m;
  }, []);

  const ref = useRef();

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();

    // Subtle twinkle by moving points in place (single draw call)
    const pos = geometry.attributes.position;
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      const ix = i * 3;
      // Pull x/z slightly + pulse y
      pos.array[ix + 0] = p.position.x + Math.sin(t * 0.9 + p.phase) * 0.08;
      pos.array[ix + 1] = p.position.y + Math.sin(t * (0.7 + p.tw) + p.phase) * 0.12;
      pos.array[ix + 2] = p.position.z + Math.cos(t * 0.55 + p.phase) * 0.06;
    }
    pos.needsUpdate = true;
  });

  return <points ref={ref} geometry={geometry} material={material} />;
}

function ProceduralRestaurant() {
  // Low poly + simple shader-like materials: wood + metal + cushions.
  const woodMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color("#2a170f"),
        roughness: 0.95,
        metalness: 0.05,
      }),
    []
  );

  const chairMat = woodMat;

  const seatMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color("#1a1110"),
        roughness: 0.9,
        metalness: 0.02,
      }),
    []
  );

  const tableTopMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color("#3a2318"),
        roughness: 0.92,
        metalness: 0.03,
      }),
    []
  );

  const metalMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color("#3b3f52"),
        roughness: 0.45,
        metalness: 0.65,
      }),
    []
  );

  // Fewer meshes: use grouped primitives.
  return (
    <group position={[0, 0, 0]}>
      {/* Floor */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, 0]}
        receiveShadow={false}
      >
        <planeGeometry args={[18, 12, 1, 1]} />
        <meshStandardMaterial color={"#140c0a"} roughness={1} />
      </mesh>

      {/* Tables (2) */}
      <group position={[-3.2, 0, -1.5]}>
        <mesh position={[0, 1.05, 0]} material={tableTopMat} castShadow={false}>
          <boxGeometry args={[2.6, 0.12, 1.6]} />
        </mesh>
        {/* Legs as single geometry (keep draw calls low) */}
        <mesh material={woodMat} castShadow={false} position={[0, 0.55, 0]}>
          <boxGeometry args={[2.3, 0.7, 1.25]} />
        </mesh>

        {/* Chairs (simple blocks) */}
        {[
          [-2.0, 0, -0.9],
          [2.0, 0, -0.9],
          [-2.0, 0, 0.9],
          [2.0, 0, 0.9],
        ].map((p, i) => (
          <group key={i} position={p} rotation={[0, (i % 2) * Math.PI * 0.5, 0]}>
            <mesh position={[0, 0.55, 0]} material={seatMat}>
              <boxGeometry args={[0.55, 0.12, 0.55]} />
            </mesh>
            <mesh position={[0, 0.3, 0]} material={chairMat}>
              <boxGeometry args={[0.62, 0.6, 0.62]} />
            </mesh>
            <mesh position={[0, 0.95, 0]} material={metalMat}>
              <boxGeometry args={[0.5, 0.04, 0.5]} />
            </mesh>
          </group>
        ))}
      </group>

      <group position={[3.0, 0, -2.3]}>
        <mesh position={[0, 1.0, 0]} material={tableTopMat} castShadow={false}>
          <boxGeometry args={[2.2, 0.12, 1.3]} />
        </mesh>
        <mesh material={woodMat} castShadow={false} position={[0, 0.52, 0]}>
          <boxGeometry args={[1.95, 0.7, 1.1]} />
        </mesh>

        {[
          [-1.7, 0, -0.7],
          [1.7, 0, -0.7],
          [-1.7, 0, 0.7],
          [1.7, 0, 0.7],
        ].map((p, i) => (
          <group key={i} position={p} rotation={[0, (i % 2) * Math.PI * 0.5, 0]}>
            <mesh position={[0, 0.53, 0]} material={seatMat}>
              <boxGeometry args={[0.5, 0.12, 0.5]} />
            </mesh>
            <mesh position={[0, 0.28, 0]} material={chairMat}>
              <boxGeometry args={[0.57, 0.6, 0.57]} />
            </mesh>
            <mesh position={[0, 0.88, 0]} material={metalMat}>
              <boxGeometry args={[0.45, 0.04, 0.45]} />
            </mesh>
          </group>
        ))}
      </group>

      {/* Background wall haze blob (cheap atmosphere silhouette) */}
      <Float speed={0.5} floatIntensity={0.15}>
        <mesh position={[0, 1.8, -4.8]}>
          <sphereGeometry args={[3.8, 24, 24]} />
          <meshStandardMaterial
            color={"#0b1326"}
            roughness={1}
            metalness={0}
            transparent
            opacity={0.25}
          />
        </mesh>
      </Float>
    </group>
  );
}

function DustParticles({ amount = 600 }) {
  const count = amount;

  const pointsRef = useRef(null);
  const points = useMemo(() => {
    const col = new THREE.Color("#f59e0b");

    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    const sizes = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const ix = i * 3;
      const x = (Math.random() - 0.5) * 10;
      const y = Math.random() * 2.2;
      const z = -Math.random() * 8;

      // Bias dust to lower region (like photo bokeh)
      const yy = y * (0.35 + Math.random() * 0.65);

      positions[ix + 0] = x;
      positions[ix + 1] = yy;
      positions[ix + 2] = z;

      colors[ix + 0] = col.r;
      colors[ix + 1] = col.g;
      colors[ix + 2] = col.b;

      seeds[i] = Math.random() * 1000;
      sizes[i] = 0.01 + Math.random() * 0.03;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute("size", new THREE.BufferAttribute(sizes, 1));

    const material = new THREE.PointsMaterial({
      vertexColors: true,
      size: 0.06,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    return { geometry, material, seeds };
  }, [count]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const geom = points.geometry;
    const pos = geom.attributes.position;

    // Cheap dust drift: small upward + lateral sinusoidal
    for (let i = 0; i < count; i++) {
      const ix = i * 3;
      const seed = points.seeds[i];
      const driftX = Math.sin(t * 0.35 + seed) * 0.03;
      const driftY = Math.sin(t * 0.28 + seed * 0.7) * 0.04;
      const driftZ = Math.cos(t * 0.22 + seed) * 0.02;

      pos.array[ix + 0] += driftX;
      pos.array[ix + 1] += driftY;
      pos.array[ix + 2] += driftZ;

      // Soft wrap to keep within bounds
      if (pos.array[ix + 1] > 2.4) pos.array[ix + 1] = 0.1;
    }

    pos.needsUpdate = true;
  });

  return <points ref={pointsRef} geometry={points.geometry} material={points.material} />;
}

function RestaurantScene() {
  const groupRef = useCameraDrift({ ampRad: 0.09, zoomMin: 0.98, zoomMax: 1.02 });

  return (
    <group ref={groupRef}>
      {/* Dark navy/charcoal base */}
      <color attach="background" args={["#0b1326"]} />

      {/* Lightweight atmosphere (fog) */}
      <fog attach="fog" args={["#0b1326", 2.5, 9.5]} />

      <ProceduralRestaurant />
      <WarmBokehLights count={24} />
      <DustParticles amount={600} />
    </group>
  );
}

export default function Restaurant3DBackground({ className = "", style = {} }) {
  return (
    <div
      className={className}
      style={{
        position: "absolute",
        inset: 0,
        zIndex: -1,
        pointerEvents: "none",
        background: "transparent",
        ...style,
      }}
    >
      <Canvas
        style={{ width: "100%", height: "100%" }}
        camera={{ position: [0, 1.6, 3.9], fov: 45, near: 0.1, far: 30, zoom: 1 }}
        gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
      >
        <RestaurantScene />

        {/* Subtle tone + ensure UI readability */}
        <ambientLight intensity={0.55} color="#f59e0b" />
        <directionalLight position={[2, 4, 3]} intensity={0.35} color="#f59e0b" />
      </Canvas>
    </div>
  );
}
