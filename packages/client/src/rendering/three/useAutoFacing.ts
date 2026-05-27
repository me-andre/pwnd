import type { Side } from "@pwnd/core";
import { useFrame } from "@react-three/fiber";
import type { RefObject } from "react";
import * as THREE from "three";

const TWO_PI = Math.PI * 2;

/** Unwraps angle so it always takes the short rotation path to target. */
function shortestAngle(current: number, target: number): number {
  const diff = ((target - current + Math.PI) % TWO_PI) - Math.PI;
  return current + diff;
}

/**
 * Smoothly rotates a group around Y toward white or black orientation.
 * Damping coefficient 5 → ~0.5-0.7 s settle time.
 */
export function useAutoFacing(ref: RefObject<THREE.Group | null>, facePlayer: Side): void {
  useFrame((_, dt) => {
    const group = ref.current;
    if (!group) return;
    const targetY = facePlayer === "white" ? 0 : Math.PI;
    const currentY = group.rotation.y;
    const unwrapped = shortestAngle(currentY, targetY);
    group.rotation.y = THREE.MathUtils.damp(currentY, unwrapped, 5, dt);
  });
}
