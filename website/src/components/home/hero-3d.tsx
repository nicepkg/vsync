/**
 * =============================================================================
 * vibe-sync 3D Hero - "The Pulse of Truth"
 * =============================================================================
 * Visualizing the synchronization process:
 * 1. Source pulses (The Truth)
 * 2. Data travels (The Sync)
 * 3. Targets react (The Update)
 *
 * Style: Neon Constructivist (No textures, pure geometry)
 * =============================================================================
 */
"use client";
import {
  Sphere,
  Octahedron,
  Icosahedron,
  Float,
  PerspectiveCamera,
  Stars,
  Ring,
} from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useRef, useMemo, useState } from "react";
import * as THREE from "three";
// --- Constants ---
const SYNC_CYCLE = 3; // Seconds per full sync cycle
const PACKET_SPEED = 1.5; // How fast data flies
const THEME = {
  core: "#ffffff", // Pure White (Source)
  packet: "#00f3ff", // Cyan (Data)
  synced: "#00ff88", // Green (Success)
  idle: "#555555", // Dim (Waiting)
  grid: "#1a1a2e",
};
// --- Components ---
/**
 * The Source of Truth
 * Emits a "Scan Wave" every cycle.
 */
function SourceHub() {
  const meshRef = useRef<THREE.Mesh>(null);
  const waveRef = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    const cyclePos = t % SYNC_CYCLE;

    // 1. Heartbeat Pulse at start of cycle
    if (meshRef.current) {
      // Sharp pulse at t=0
      const pulse = Math.exp(-10 * cyclePos) * 0.5;
      const scale = 1 + pulse;
      meshRef.current.scale.setScalar(scale);

      // Constant slow rotation
      meshRef.current.rotation.y = t * 0.5;
      meshRef.current.rotation.z = t * 0.2;
    }
    // 2. Expanding Wave (The "Diff" calculation)
    if (waveRef.current) {
      // Wave expands from 0 to 1.5 then disappears
      const waveProgress = cyclePos / 1.5;
      if (waveProgress < 1) {
        waveRef.current.scale.setScalar(1 + waveProgress * 8);
        (waveRef.current.material as THREE.MeshBasicMaterial).opacity =
          1 - waveProgress;
        waveRef.current.visible = true;
      } else {
        waveRef.current.visible = false;
      }
    }
  });
  return (
    <group>
      {/* The Core Kernel */}
      <Icosahedron ref={meshRef} args={[0.8, 0]}>
        <meshBasicMaterial color={THEME.core} wireframe />
      </Icosahedron>

      {/* Inner Glow */}
      <Sphere args={[0.4, 16, 16]}>
        <meshBasicMaterial color={THEME.core} />
      </Sphere>
      {/* The Diff Wave */}
      <Ring ref={waveRef} args={[0.8, 0.85, 32]}>
        <meshBasicMaterial
          color={THEME.packet}
          transparent
          side={THREE.DoubleSide}
        />
      </Ring>
    </group>
  );
}
/**
 * Sync Data Packet
 * Travels from Source to Target.
 */
function DataPacket({
  curve,
  onImpact,
}: {
  curve: THREE.Curve<THREE.Vector3>;
  onImpact: () => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const hasImpacted = useRef(false);
  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    const cyclePos = t % SYNC_CYCLE;

    // Start traveling after the "Wave" (approx 0.5s delay)
    const travelStart = 0.5;
    const travelDuration = 1.0;

    if (cyclePos > travelStart && cyclePos < travelStart + travelDuration) {
      // Normalized progress 0 -> 1
      const progress = (cyclePos - travelStart) / travelDuration;

      if (meshRef.current) {
        meshRef.current.visible = true;
        const point = curve.getPoint(progress);
        meshRef.current.position.copy(point);
        meshRef.current.rotation.x += 0.2;
        meshRef.current.rotation.y += 0.2;
      }
      // Reset impact flag
      hasImpacted.current = false;
    } else {
      if (meshRef.current) meshRef.current.visible = false;

      // Trigger impact right when it finishes
      if (cyclePos >= travelStart + travelDuration && !hasImpacted.current) {
        onImpact();
        hasImpacted.current = true;
      }
    }
  });
  return (
    <mesh ref={meshRef} visible={false}>
      <boxGeometry args={[0.2, 0.2, 0.2]} />
      <meshBasicMaterial color={THEME.packet} />
    </mesh>
  );
}
/**
 * Target Tool Node
 * Reacts when data arrives.
 */
function ToolNode({
  position,
  color,
  curve,
}: {
  position: [number, number, number];
  color: string;
  curve: THREE.Curve<THREE.Vector3>;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const [impactTime, setImpactTime] = useState(-100);
  const handleImpact = () => {
    setImpactTime(Date.now());
  };
  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    const timeSinceImpact = (Date.now() - impactTime) / 1000;
    if (meshRef.current && glowRef.current) {
      // Default Rotation
      meshRef.current.rotation.y += 0.01;

      // IMPACT REACTION: Flash white and scale up
      if (timeSinceImpact < 0.5) {
        const reaction = 1 - timeSinceImpact / 0.5; // 1 -> 0

        // Flash color: Mix idle color with White based on reaction strength
        // We simulate this by swapping materials or just scaling the "glow" shell heavily
        glowRef.current.scale.setScalar(1 + reaction * 0.5);
        (glowRef.current.material as THREE.MeshBasicMaterial).opacity =
          reaction;
        (glowRef.current.material as THREE.MeshBasicMaterial).color.set(
          "white",
        );

        meshRef.current.scale.setScalar(1 + reaction * 0.3);
      } else {
        // Settle down
        glowRef.current.scale.setScalar(1.1);
        (glowRef.current.material as THREE.MeshBasicMaterial).opacity = 0.1;
        (glowRef.current.material as THREE.MeshBasicMaterial).color.set(color);
        meshRef.current.scale.setScalar(1);
      }
    }
  });
  return (
    <group>
      <Float
        speed={2}
        rotationIntensity={1}
        floatIntensity={0.5}
        position={position}
      >
        {/* The Tool Shape */}
        <Octahedron ref={meshRef} args={[0.5, 0]}>
          <meshBasicMaterial color={color} wireframe />
        </Octahedron>

        {/* The Glow Shell (Reacts to Sync) */}
        <Sphere ref={glowRef} args={[0.5, 16, 16]}>
          <meshBasicMaterial color={color} transparent opacity={0.1} />
        </Sphere>
      </Float>

      {/* The Connection Wire */}
      <LineCurve curve={curve} color={color} opacity={0.2} />

      {/* The Data Packet traveling on the wire */}
      <DataPacket curve={curve} onImpact={handleImpact} />
    </group>
  );
}
function LineCurve({
  curve,
  color,
  opacity,
}: {
  curve: THREE.Curve<THREE.Vector3>;
  color: string;
  opacity: number;
}) {
  const points = useMemo(() => curve.getPoints(30), [curve]);
  const positions = useMemo(
    () => new Float32Array(points.flatMap((p) => [p.x, p.y, p.z])),
    [points],
  );

  return (
    <line>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={points.length}
          array={positions}
          itemSize={3}
          args={[positions, 3]}
        />
      </bufferGeometry>
      <lineBasicMaterial color={color} transparent opacity={opacity} />
    </line>
  );
}
function Scene() {
  // Define targets and their curves
  const targets = useMemo(() => {
    const positions = [
      [-3.5, 2, 0], // Claude
      [3.5, 1.5, 1], // Cursor
      [-2.5, -3, 2], // OpenCode
      [3, -2.5, -1], // Codex
    ];

    return positions.map((pos, i) => {
      const start = new THREE.Vector3(0, 0, 0);
      const end = new THREE.Vector3(...pos);
      const mid = start.clone().lerp(end, 0.5);
      mid.y += 1.5; // Arc height

      return {
        pos: pos as [number, number, number],
        curve: new THREE.QuadraticBezierCurve3(start, mid, end),
        color: i % 2 === 0 ? "#00f3ff" : "#ff00aa", // Alternating Neon Colors
      };
    });
  }, []);
  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 0, 12]} fov={40} />

      <SourceHub />

      {targets.map((t, i) => (
        <ToolNode key={i} position={t.pos} color={t.color} curve={t.curve} />
      ))}
      <Stars
        radius={40}
        depth={50}
        count={3000}
        factor={4}
        saturation={0}
        fade
        speed={1}
      />
    </>
  );
}
export function Hero3D() {
  return (
    <div className="absolute inset-0 -z-10 h-full w-full opacity-70">
      <Canvas dpr={[1, 2]} gl={{ antialias: true, alpha: true }}>
        <Scene />
      </Canvas>
    </div>
  );
}
