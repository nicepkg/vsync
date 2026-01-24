/**
 * =============================================================================
 * TODO: CUSTOMIZE OR REMOVE THIS 3D HERO COMPONENT
 * =============================================================================
 * This is an optional 3D animated background for the landing page hero section.
 * It uses React Three Fiber (@react-three/fiber) and Drei (@react-three/drei).
 *
 * Options:
 * 1. KEEP IT: Customize colors, shapes, animation speed below
 * 2. SIMPLIFY: Replace with a static gradient or image background
 * 3. REMOVE IT: Delete this file and remove <Hero3D /> from landing-page.tsx
 *
 * Customization tips:
 * - Change sphere color: modify `color` and `emissive` in MeshDistortMaterial
 * - Adjust animation: modify `distort`, `speed` values
 * - Change stars: adjust `count`, `factor` in Stars component
 *
 * Note: This adds ~200KB to your bundle. Remove if not needed.
 * =============================================================================
 */
"use client";

import {
  Sphere,
  MeshDistortMaterial,
  Float,
  Stars,
  PerspectiveCamera,
} from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type * as THREE from "three";

function AnimatedSphere() {
  const sphereRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (sphereRef.current) {
      sphereRef.current.rotation.z = t * 0.1;
      sphereRef.current.rotation.x = t * 0.15;
    }
  });

  return (
    <Sphere visible args={[1, 64, 64]} scale={2.0} ref={sphereRef}>
      <MeshDistortMaterial
        color="#D946EF" // Fuchsia - primary theme color
        attach="material"
        distort={0.4}
        speed={2}
        roughness={0.4}
        metalness={0.2}
        emissive="#D946EF" // Fuchsia glow
        emissiveIntensity={0.8}
        wireframe={true}
      />
    </Sphere>
  );
}

export function Hero3D() {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10 h-full w-full opacity-40 dark:opacity-80">
      <Canvas>
        <PerspectiveCamera makeDefault position={[0, 0, 6]} />
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={1.5} />
        <pointLight position={[-10, -10, -10]} color="#22D3EE" intensity={1} />

        <Stars
          radius={100}
          depth={50}
          count={3000}
          factor={4}
          saturation={0}
          fade
          speed={1}
        />

        <Float speed={2} rotationIntensity={1} floatIntensity={1}>
          <AnimatedSphere />
          {/* <InnerCore /> */}
        </Float>
      </Canvas>
    </div>
  );
}
