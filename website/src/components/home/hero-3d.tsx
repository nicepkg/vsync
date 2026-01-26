/* eslint-disable react-hooks/purity */
/**
 * =============================================================================
 * vsync 3D Hero - "The Pulse of Truth"
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
const THEME = {
  core: "#ffffff", // Pure White (Source)
  packet: "#00f3ff", // Cyan (Data)
  synced: "#00ff88", // Green (Success)
  idle: "#555555", // Dim (Waiting)
  grid: "#1a1a2e",
  trail: "#0088ff", // Blue trail
  pulse: "#ff00ff", // Magenta pulse
};

// --- Components ---

/**
 * The Source of Truth
 * Emits a "Scan Wave" every cycle.
 */
function SourceHub() {
  const meshRef = useRef<THREE.Mesh>(null);
  const waveRef = useRef<THREE.Mesh>(null);
  const orbitRing1 = useRef<THREE.Mesh>(null);
  const orbitRing2 = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);

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
          (1 - waveProgress) * 0.8;
        waveRef.current.visible = true;
      } else {
        waveRef.current.visible = false;
      }
    }

    // 3. Orbital Rings
    if (orbitRing1.current) {
      orbitRing1.current.rotation.x = t * 0.3;
      orbitRing1.current.rotation.y = t * 0.5;
    }
    if (orbitRing2.current) {
      orbitRing2.current.rotation.x = -t * 0.4;
      orbitRing2.current.rotation.z = t * 0.3;
    }

    // 4. Pulsing Glow
    if (glowRef.current) {
      const glowPulse = 1 + Math.sin(t * 2) * 0.2;
      glowRef.current.scale.setScalar(glowPulse);
      (glowRef.current.material as THREE.MeshBasicMaterial).opacity =
        0.3 + Math.sin(t * 2) * 0.1;
    }
  });

  return (
    <group>
      {/* Outer Glow Sphere */}
      <Sphere ref={glowRef} args={[1.2, 32, 32]}>
        <meshBasicMaterial color={THEME.pulse} transparent opacity={0.3} />
      </Sphere>

      {/* The Core Kernel */}
      <Icosahedron ref={meshRef} args={[0.8, 0]}>
        <meshBasicMaterial color={THEME.core} wireframe />
      </Icosahedron>

      {/* Inner Solid Glow */}
      <Sphere args={[0.5, 16, 16]}>
        <meshBasicMaterial color={THEME.core} toneMapped={false} />
      </Sphere>

      {/* Orbital Rings */}
      <Ring ref={orbitRing1} args={[1.0, 1.05, 32]}>
        <meshBasicMaterial
          color={THEME.packet}
          transparent
          opacity={0.4}
          side={THREE.DoubleSide}
        />
      </Ring>
      <Ring ref={orbitRing2} args={[1.2, 1.25, 32]}>
        <meshBasicMaterial
          color={THEME.pulse}
          transparent
          opacity={0.3}
          side={THREE.DoubleSide}
        />
      </Ring>

      {/* The Diff Wave */}
      <Ring ref={waveRef} args={[0.8, 0.9, 64]}>
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
 * Particle Trail Effect
 */
function ParticleTrail({
  curve,
  color,
}: {
  curve: THREE.Curve<THREE.Vector3>;
  color: string;
}) {
  const particlesRef = useRef<THREE.Points>(null);

  const particleData = useMemo(() => {
    const count = 30;
    const positions = new Float32Array(count * 3);
    const alphas = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      alphas[i] = i / count;
    }

    return { positions, alphas, count };
  }, []);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    const cyclePos = t % SYNC_CYCLE;
    const travelStart = 0.5;
    const travelDuration = 1.0;

    if (cyclePos > travelStart && cyclePos < travelStart + travelDuration) {
      const progress = (cyclePos - travelStart) / travelDuration;

      if (particlesRef.current?.geometry.attributes.position) {
        const positions = particlesRef.current.geometry.attributes.position
          .array as Float32Array;

        for (let i = 0; i < particleData.count; i++) {
          const particleProgress = Math.max(0, progress - i * 0.02);
          const point = curve.getPoint(Math.min(1, particleProgress));

          positions[i * 3] = point.x;
          positions[i * 3 + 1] = point.y;
          positions[i * 3 + 2] = point.z;
        }

        particlesRef.current.geometry.attributes.position.needsUpdate = true;

        // Fade in/out
        const mat = particlesRef.current.material as THREE.PointsMaterial;
        mat.opacity = Math.sin(progress * Math.PI) * 0.8;
      }
    }
  });

  return (
    <points ref={particlesRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={particleData.count}
          array={particleData.positions}
          itemSize={3}
          args={[particleData.positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.08}
        color={color}
        transparent
        opacity={0.8}
        sizeAttenuation
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

/**
 * Sync Data Packet
 * Travels from Source to Target with enhanced visuals.
 */
function DataPacket({
  curve,
  onImpact,
  color,
}: {
  curve: THREE.Curve<THREE.Vector3>;
  onImpact: () => void;
  color: string;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
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

      if (meshRef.current && glowRef.current) {
        meshRef.current.visible = true;
        glowRef.current.visible = true;

        const point = curve.getPoint(progress);
        meshRef.current.position.copy(point);
        glowRef.current.position.copy(point);

        // Rotation
        meshRef.current.rotation.x += 0.2;
        meshRef.current.rotation.y += 0.2;

        // Pulsing glow
        const glowPulse = 1 + Math.sin(t * 10) * 0.3;
        glowRef.current.scale.setScalar(glowPulse);
      }

      // Reset impact flag
      hasImpacted.current = false;
    } else {
      if (meshRef.current) meshRef.current.visible = false;
      if (glowRef.current) glowRef.current.visible = false;

      // Trigger impact right when it finishes
      if (cyclePos >= travelStart + travelDuration && !hasImpacted.current) {
        onImpact();
        hasImpacted.current = true;
      }
    }
  });

  return (
    <group>
      {/* Glow sphere */}
      <Sphere ref={glowRef} args={[0.25, 16, 16]} visible={false}>
        <meshBasicMaterial color={color} transparent opacity={0.5} />
      </Sphere>

      {/* Main packet */}
      <mesh ref={meshRef} visible={false}>
        <octahedronGeometry args={[0.15, 0]} />
        <meshBasicMaterial color={color} wireframe />
      </mesh>
    </group>
  );
}

/**
 * Target Tool Node
 * Reacts when data arrives with enhanced feedback.
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
  const shockwaveRef = useRef<THREE.Mesh>(null);
  const [impactTime, setImpactTime] = useState(-100);

  const handleImpact = () => {
    setImpactTime(Date.now());
  };

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    const timeSinceImpact = (Date.now() - impactTime) / 1000;

    if (meshRef.current && glowRef.current && shockwaveRef.current) {
      // Default Rotation
      meshRef.current.rotation.y += 0.01;
      meshRef.current.rotation.x = Math.sin(t * 0.5) * 0.2;

      // IMPACT REACTION: Flash white and scale up
      if (timeSinceImpact < 0.6) {
        const reaction = 1 - timeSinceImpact / 0.6; // 1 -> 0

        // Flash and scale
        glowRef.current.scale.setScalar(1 + reaction * 0.8);
        (glowRef.current.material as THREE.MeshBasicMaterial).opacity =
          reaction * 0.6;
        (glowRef.current.material as THREE.MeshBasicMaterial).color.set(
          "white",
        );

        meshRef.current.scale.setScalar(1 + reaction * 0.4);

        // Shockwave
        shockwaveRef.current.visible = true;
        shockwaveRef.current.scale.setScalar(1 + reaction * 2);
        (shockwaveRef.current.material as THREE.MeshBasicMaterial).opacity =
          (1 - reaction) * 0.5;
      } else {
        // Settle down
        glowRef.current.scale.setScalar(1.2);
        (glowRef.current.material as THREE.MeshBasicMaterial).opacity = 0.15;
        (glowRef.current.material as THREE.MeshBasicMaterial).color.set(color);
        meshRef.current.scale.setScalar(1);
        shockwaveRef.current.visible = false;
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
        <Sphere ref={glowRef} args={[0.6, 16, 16]}>
          <meshBasicMaterial color={color} transparent opacity={0.15} />
        </Sphere>

        {/* Impact Shockwave */}
        <Ring ref={shockwaveRef} args={[0.5, 0.6, 32]} visible={false}>
          <meshBasicMaterial
            color={color}
            transparent
            opacity={0.5}
            side={THREE.DoubleSide}
          />
        </Ring>
      </Float>

      {/* The Connection Wire */}
      <LineCurve curve={curve} color={color} opacity={0.25} />

      {/* Particle Trail */}
      <ParticleTrail curve={curve} color={color} />

      {/* The Data Packet traveling on the wire */}
      <DataPacket curve={curve} onImpact={handleImpact} color={color} />
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
  const lineRef = useRef<THREE.Line>(null);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (lineRef.current) {
      const mat = lineRef.current.material as THREE.LineBasicMaterial;
      // Gentle pulse
      mat.opacity = opacity + Math.sin(t * 2) * 0.1;
    }
  });

  const points = useMemo(() => curve.getPoints(50), [curve]);
  const positions = useMemo(
    () => new Float32Array(points.flatMap((p) => [p.x, p.y, p.z])),
    [points],
  );

  return (
    <line ref={lineRef as unknown as React.Ref<SVGLineElement>}>
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

/**
 * Ambient Floating Particles
 */
function AmbientParticles() {
  const particlesRef = useRef<THREE.Points>(null);

  const positions = useMemo(() => {
    const pos = new Float32Array(300 * 3);
    for (let i = 0; i < 300; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 25;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 25;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 25;
    }
    return pos;
  }, []);

  useFrame((state) => {
    if (particlesRef.current) {
      particlesRef.current.rotation.y = state.clock.getElapsedTime() * 0.03;
      particlesRef.current.rotation.x = state.clock.getElapsedTime() * 0.02;
    }
  });

  return (
    <points ref={particlesRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={300}
          array={positions}
          itemSize={3}
          args={[positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.02}
        color={THEME.packet}
        transparent
        opacity={0.3}
        sizeAttenuation
      />
    </points>
  );
}

function Scene() {
  // Define targets and their curves
  const targets = useMemo(() => {
    const positions = [
      [-3.5, 2, 0], // Top left
      [3.5, 1.5, 1], // Top right
      [-2.5, -3, 2], // Bottom left
      [3, -2.5, -1], // Bottom right
    ];

    const colors = [
      "#00f3ff", // Cyan
      "#ff00aa", // Magenta
      "#00ff88", // Green
      "#ffaa00", // Orange
    ];

    return positions.map((pos, i) => {
      const start = new THREE.Vector3(0, 0, 0);
      const end = new THREE.Vector3(...pos);
      const mid = start.clone().lerp(end, 0.5);
      mid.y += 1.5; // Arc height

      return {
        pos: pos as [number, number, number],
        curve: new THREE.QuadraticBezierCurve3(start, mid, end),
        color: colors[i] ?? "#00f3ff",
      };
    });
  }, []);

  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 0, 12]} fov={45} />

      {/* Enhanced Lighting */}
      <ambientLight intensity={0.2} />
      <pointLight position={[0, 0, 0]} intensity={2} color={THEME.core} />
      <pointLight position={[5, 5, 5]} intensity={1} color={THEME.packet} />
      <pointLight position={[-5, -5, -5]} intensity={1} color={THEME.pulse} />

      <SourceHub />

      {targets.map((t, i) => (
        <ToolNode key={i} position={t.pos} color={t.color} curve={t.curve} />
      ))}

      <AmbientParticles />

      <Stars
        radius={50}
        depth={50}
        count={4000}
        factor={4}
        saturation={0}
        fade
        speed={0.5}
      />
    </>
  );
}

export function Hero3D() {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10 h-full w-full opacity-50">
      <Canvas dpr={[1, 2]} gl={{ antialias: true, alpha: true }}>
        <Scene />
      </Canvas>
    </div>
  );
}
