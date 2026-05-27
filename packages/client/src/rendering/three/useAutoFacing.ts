import type { Side } from "@pwnd/core";
import { useFrame, useThree } from "@react-three/fiber";
import { type RefObject, useRef } from "react";
import * as THREE from "three";

const TWO_PI = Math.PI * 2;
const DAMP = 5;
/** How long to keep pulling the camera back to default after a turn change. */
const RESET_DURATION_MS = 1500;

/** Default camera position; mirrors the value passed to <Canvas camera> in ThreeBoardScene. */
const DEFAULT_CAMERA_POSITION = new THREE.Vector3(0, 11, 9);
const DEFAULT_CAMERA_TARGET = new THREE.Vector3(0, 0, 0);

/** Structural subset of three-stdlib's OrbitControls API that we depend on. */
interface OrbitControlsLike {
  target: THREE.Vector3;
  update(): void;
}

interface UseAutoFacingOptions {
  boardGroupRef: RefObject<THREE.Group | null>;
  controlsRef: RefObject<OrbitControlsLike | null>;
  facePlayer: Side;
}

/** Unwraps angle so it always takes the short rotation path to target. */
function shortestAngle(current: number, target: number): number {
  const diff = ((target - current + Math.PI) % TWO_PI) - Math.PI;
  return current + diff;
}

/**
 * On every frame, damps the board group's Y rotation toward the orientation
 * facing the current player.  When facePlayer changes (turn switch), also
 * damps the camera back to its default position/target for ~1.5 s — so a
 * turn switch resets BOTH the board orientation and any free-orbit framing
 * the previous player applied to "initial position from the new player's
 * viewpoint", rather than carrying their orbit offset over.
 *
 * Outside the post-turn-change reset window, OrbitControls owns the camera
 * fully and the user may freely orbit until the next turn.
 */
export function useAutoFacing({
  boardGroupRef,
  controlsRef,
  facePlayer,
}: UseAutoFacingOptions): void {
  const { camera } = useThree();
  const resetUntil = useRef(0);
  const prevFacePlayer = useRef<Side | null>(null);

  useFrame((_, dt) => {
    // Detect turn change and (re)open a reset window for the camera.
    if (prevFacePlayer.current !== facePlayer) {
      prevFacePlayer.current = facePlayer;
      resetUntil.current = performance.now() + RESET_DURATION_MS;
    }

    // 1) Always damp the board group to its target orientation.
    const group = boardGroupRef.current;
    if (group !== null) {
      const targetY = facePlayer === "white" ? 0 : Math.PI;
      const unwrapped = shortestAngle(group.rotation.y, targetY);
      group.rotation.y = THREE.MathUtils.damp(group.rotation.y, unwrapped, DAMP, dt);
    }

    // 2) Within the reset window, damp the camera back to its default
    //    offset/target.  Outside the window, OrbitControls owns the camera.
    if (performance.now() < resetUntil.current) {
      const k = 1 - Math.exp(-DAMP * dt);
      camera.position.lerp(DEFAULT_CAMERA_POSITION, k);
      const controls = controlsRef.current;
      if (controls !== null) {
        controls.target.lerp(DEFAULT_CAMERA_TARGET, k);
        controls.update();
      }
    }
  });
}
