import type { Side } from "@pwnd/core";
import { useFrame, useThree } from "@react-three/fiber";
import { type RefObject, useRef } from "react";
import * as THREE from "three";

const TWO_PI = Math.PI * 2;
const DAMP = 5;
/** How long to keep pulling the camera back to default after a turn change. */
const RESET_DURATION_MS = 1500;
/**
 * Wait this long after a turn change before starting the rotation/camera-
 * reset animation, so the move animation (~350 ms piece lerp) can play out
 * cleanly first instead of being immediately overwritten by a 180° board
 * spin.
 */
const TURN_ANIMATION_DELAY_MS = 750;

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
 * facing the current player.  When facePlayer changes (turn switch), waits
 * TURN_ANIMATION_DELAY_MS for the move animation to finish, then begins
 * damping the camera back to its default position/target for ~1.5 s — so a
 * turn switch resets BOTH the board orientation and any free-orbit framing
 * the previous player applied to "initial position from the new player's
 * viewpoint", rather than carrying their orbit offset over.
 *
 * Outside the post-turn-change reset window, OrbitControls owns the camera
 * fully and the user may freely orbit until the next turn.
 *
 * The first observation of facePlayer (initial mount) is applied immediately
 * with no delay, so the board doesn't snap-rotate on first render.
 */
export function useAutoFacing({
  boardGroupRef,
  controlsRef,
  facePlayer,
}: UseAutoFacingOptions): void {
  const { camera } = useThree();
  /** facePlayer last observed in render — used to detect changes. */
  const observedFacePlayer = useRef<Side | null>(null);
  /** facePlayer the rotation is currently aiming at — lags observed by the delay. */
  const appliedFacePlayer = useRef<Side | null>(null);
  /** Earliest performance.now() at which we may adopt a pending facePlayer. */
  const animateAfter = useRef(0);
  /** End time of the camera-reset damping window. */
  const resetUntil = useRef(0);

  useFrame((_, dt) => {
    // Detect turn change.  First observation = initial mount → apply
    // immediately so we don't waste a 750 ms delay before the board even
    // settles into its starting orientation.
    if (observedFacePlayer.current !== facePlayer) {
      const isFirstObservation = observedFacePlayer.current === null;
      observedFacePlayer.current = facePlayer;
      if (isFirstObservation) {
        appliedFacePlayer.current = facePlayer;
      } else {
        animateAfter.current = performance.now() + TURN_ANIMATION_DELAY_MS;
      }
    }

    // Once the delay has elapsed, adopt the pending facePlayer and open the
    // camera-reset window in lockstep with the board rotation start.
    if (appliedFacePlayer.current !== facePlayer && performance.now() >= animateAfter.current) {
      appliedFacePlayer.current = facePlayer;
      resetUntil.current = performance.now() + RESET_DURATION_MS;
    }

    // 1) Damp the board group toward the *applied* face player (not the
    //    latest observed one — it may still be in the delay window).
    const target = appliedFacePlayer.current;
    const group = boardGroupRef.current;
    if (target !== null && group !== null) {
      const targetY = target === "white" ? 0 : Math.PI;
      const unwrapped = shortestAngle(group.rotation.y, targetY);
      group.rotation.y = THREE.MathUtils.damp(group.rotation.y, unwrapped, DAMP, dt);
    }

    // 2) Camera reset, only inside the reset window.
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
