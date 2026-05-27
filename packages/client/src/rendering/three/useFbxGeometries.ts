import type { Side } from "@pwnd/core";
import { useFBX } from "@react-three/drei";
import { useMemo } from "react";
import * as THREE from "three";

/** Piece kind letters that have 3D models */
export type PieceKind = "P" | "R" | "N" | "B" | "Q" | "K";

/**
 * FBX model names after THREE.PropertyBinding.sanitizeNodeName processing:
 *   spaces → underscores, reserved chars stripped.
 * Raw FBX names discovered by binary inspection; sanitized names used at runtime.
 * Knight = "Horse", Bishop = "Elephant" (Blender model naming).
 */
const PIECE_FBX_NAMES: Record<PieceKind, Record<Side, string>> = {
  P: { white: "Pawn_Chess_Piece_White_1_LP", black: "Pawn_Chess_Piece_1_Black_LP" },
  R: { white: "Chess_piece_Rook_1_White_LP", black: "Chess_piece_Rook_1_Black_LP" },
  N: { white: "Chess_piece_Horse_1_White_LP", black: "Chess_piece_Horse_1_Black_LP" },
  B: { white: "Elephant_Chess_Piece_1_White_LP", black: "Elephant_Chess_Piece_1_Black_LP" },
  Q: { white: "Queen_Chess_Piece_White_LP", black: "Queen_Chess_Piece_Black_LP" },
  K: { white: "Chess_piece_King_White_LP", black: "Chess_piece_King_Black_LP" },
};

const BOARD_FBX_NAME = "Chess_board_LP";

export interface FbxGeometries {
  boardGeo: THREE.BufferGeometry;
  /** Normalized piece geometries keyed by `${kind}_${side}` e.g. "K_white" */
  pieceGeos: Record<string, THREE.BufferGeometry>;
  /** Uniform scale factor applied to all geometries (FBX units → 8-unit board). */
  scaleFactor: number;
}

function findMesh(root: THREE.Object3D, name: string): THREE.Mesh | null {
  const obj = root.getObjectByName(name);
  if (!obj) {
    if (import.meta.env.DEV) {
      const allNames: string[] = [];
      root.traverse((o) => {
        if (o.name) allNames.push(o.name);
      });
      console.warn(`[useFbxGeometries] "${name}" not found. Available names:`, allNames);
    }
    return null;
  }
  if (obj instanceof THREE.Mesh) return obj;
  // FBX groups sometimes wrap geometry — try first Mesh child
  for (const child of obj.children) {
    if (child instanceof THREE.Mesh) return child;
  }
  return null;
}

/** Extracts a geometry from a mesh, applies its world matrix, scales, and centers at origin. */
function extractNormalizedGeo(
  mesh: THREE.Mesh,
  scaleFactor: number,
  /** If true: translate so top surface is at Y=0. If false: translate so bottom is at Y=0. */
  topAtZero = false,
): THREE.BufferGeometry {
  const geo = mesh.geometry.clone();

  // Apply the mesh's world matrix to bring geometry into FBX root space
  geo.applyMatrix4(mesh.matrixWorld);
  // Apply scale
  geo.scale(scaleFactor, scaleFactor, scaleFactor);

  geo.computeBoundingBox();
  const bbox = geo.boundingBox;
  if (!bbox) return geo;

  const cx = (bbox.min.x + bbox.max.x) / 2;
  const cy = topAtZero ? bbox.max.y : bbox.min.y;
  const cz = (bbox.min.z + bbox.max.z) / 2;
  geo.translate(-cx, -cy, -cz);

  // Copy uv to uv1 for aoMap support (aoMap requires second UV set)
  const uvAttr = geo.attributes.uv;
  if (uvAttr && !geo.attributes.uv1) {
    geo.setAttribute("uv1", uvAttr.clone());
  }

  return geo;
}

export function useFbxGeometries(): FbxGeometries {
  const fbx = useFBX("/models/chess_lp.fbx");

  return useMemo(() => {
    // Ensure all world matrices are current
    fbx.updateWorldMatrix(true, true);

    // ── Board ──────────────────────────────────────────────────────────────────
    const boardMesh = findMesh(fbx, BOARD_FBX_NAME);
    if (!boardMesh) {
      // findMesh already logs available names in DEV; surface them in prod too
      const allNames: string[] = [];
      fbx.traverse((o) => {
        if (o.name) allNames.push(o.name);
      });
      throw new Error(
        `FBX: board mesh "${BOARD_FBX_NAME}" not found. Available: ${allNames.join(", ")}`,
      );
    }

    // Compute board bounding box in world space
    const tmpBoardGeo = boardMesh.geometry.clone();
    tmpBoardGeo.applyMatrix4(boardMesh.matrixWorld);
    tmpBoardGeo.computeBoundingBox();
    const boardBbox = tmpBoardGeo.boundingBox;
    if (!boardBbox) throw new Error("FBX: board bounding box could not be computed");
    const boardSize = boardBbox.getSize(new THREE.Vector3());

    // Scale so the board's X span = 8 (one unit per square).
    // Bug-3 note: scaleFactor is intentionally based on the total board width
    // (including frame) here; the border adjustment is applied separately below.
    const scaleFactor = 8 / boardSize.x;

    // Normalize board: top surface at Y=0, then rotate 90 ° CCW around Y.
    //
    // Blender exports the board with files (a–h) along the local Z axis and
    // ranks (1–8) along the local X axis.  Three.js's FBXLoader preserves that
    // orientation so, without rotation, the camera (at z = +9) looks at the
    // rank-1 edge, which carries rank-number labels instead of file letters.
    // Rotating 90 ° CCW maps:
    //   original z+ (file-a side) → world x− (left of camera)   ✓
    //   original x+ (rank-0 side) → world z+ (front of camera)
    // The front edge of the board now shows the file-letter label strip, and
    // the left/right edges show rank numbers — standard chess orientation.
    // Square colours work out correctly because the Blender board colours
    // squares by (rank + file) % 2 in original local space, which round-trips
    // through the rotation to (file + rank) % 2 in world space.
    const boardGeo = extractNormalizedGeo(boardMesh, scaleFactor, true);
    boardGeo.applyMatrix4(new THREE.Matrix4().makeRotationY(Math.PI / 2));

    // ── Pieces ─────────────────────────────────────────────────────────────────
    const pieceGeos: Record<string, THREE.BufferGeometry> = {};
    const sides: Side[] = ["white", "black"];
    const kinds: PieceKind[] = ["P", "R", "N", "B", "Q", "K"];

    for (const kind of kinds) {
      for (const side of sides) {
        const meshName = PIECE_FBX_NAMES[kind][side];
        const mesh = findMesh(fbx, meshName);
        if (mesh) {
          pieceGeos[`${kind}_${side}`] = extractNormalizedGeo(mesh, scaleFactor, false);
        }
      }
    }

    return { boardGeo, pieceGeos, scaleFactor };
  }, [fbx]);
}
