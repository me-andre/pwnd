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

/**
 * Width of the wooden frame on a single side of the board, expressed as a
 * fraction of the total board side length (frame-to-frame).  Measured from
 * the LP model: a single border is ≈ 2.8 % of the total side length.
 */
export const BOARD_BORDER_FRACTION = 0.028;

/** Fraction of the model's total side that is actual playable squares. */
const PLAYABLE_FRACTION = 1 - 2 * BOARD_BORDER_FRACTION;

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
    // Rotate the entire FBX scene 90° CW around Y once, before extracting any
    // geometry. Verified via snapshot iteration:
    //   - Original (0°)  : rank-number strip along front edge (camera at +Z),
    //                      file letters along left/right edges → wrong axis.
    //   - 90° CCW (+π/2) : file letters appear on front edge but reversed
    //                      (h–a left-to-right) → wrong direction.
    //   - 90° CW  (−π/2) : file letters a–h on front edge in standard order,
    //                      rank numbers 1–8 on side edges (1 near white camera,
    //                      8 near black), pieces facing forward across the
    //                      board.  All three constraints satisfied.
    fbx.rotation.y = -Math.PI / 2;
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

    // Scale so the playable 8×8 area (excluding wooden frame) is exactly 8 units.
    // The model has a wooden frame around the playable squares; its width on each
    // side is BOARD_BORDER_FRACTION of the total model side. The playable side is
    // therefore (1 − 2·BOARD_BORDER_FRACTION) of the total, and we set
    //   scaleFactor = 8 / (boardSize.x · (1 − 2·BOARD_BORDER_FRACTION))
    // so that 1 world unit corresponds to one square and the playable area
    // exactly spans x ∈ [−4, +4], z ∈ [−4, +4].
    const scaleFactor = 8 / (boardSize.x * PLAYABLE_FRACTION);

    // Normalize board: top surface at Y=0
    const boardGeo = extractNormalizedGeo(boardMesh, scaleFactor, true);

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
