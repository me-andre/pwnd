import type { Side } from "@pwnd/core";
import { useFBX } from "@react-three/drei";
import { useMemo } from "react";
import * as THREE from "three";

/** Piece kind letters that have 3D models */
export type PieceKind = "P" | "R" | "N" | "B" | "Q" | "K";

/**
 * FBX model names for each piece kind × side.
 * Discovered by inspecting Chess_LP.fbx binary (Knight = "Horse", Bishop = "Elephant").
 */
const PIECE_FBX_NAMES: Record<PieceKind, Record<Side, string>> = {
  P: { white: "Pawn Chess Piece_White 1_LP", black: "Pawn Chess Piece 1_Black_LP" },
  R: { white: "Chess piece Rook 1_White_LP", black: "Chess piece Rook 1_Black_LP" },
  N: { white: "Chess piece Horse 1_White_LP", black: "Chess piece Horse 1_Black_LP" },
  B: { white: "Elephant Chess Piece 1_White_LP", black: "Elephant Chess Piece 1_Black_LP" },
  Q: { white: "Queen Chess Piece_White_LP", black: "Queen Chess Piece_Black_LP" },
  K: { white: "Chess piece King_White_LP", black: "Chess piece King_Black_LP" },
};

const BOARD_FBX_NAME = "Chess board_LP";

export interface FbxGeometries {
  boardGeo: THREE.BufferGeometry;
  /** Normalized piece geometries keyed by `${kind}_${side}` e.g. "K_white" */
  pieceGeos: Record<string, THREE.BufferGeometry>;
  /** Uniform scale factor applied to all geometries (FBX units → 8-unit board). */
  scaleFactor: number;
}

function findMesh(root: THREE.Object3D, name: string): THREE.Mesh | null {
  const obj = root.getObjectByName(name);
  if (!obj) return null;
  if (obj instanceof THREE.Mesh) return obj;
  // Try first child that is a Mesh (FBX groups sometimes wrap geometry)
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
      throw new Error(`FBX: board mesh "${BOARD_FBX_NAME}" not found`);
    }

    // Compute board bounding box in world space
    const tmpBoardGeo = boardMesh.geometry.clone();
    tmpBoardGeo.applyMatrix4(boardMesh.matrixWorld);
    tmpBoardGeo.computeBoundingBox();
    const boardBbox = tmpBoardGeo.boundingBox;
    if (!boardBbox) throw new Error("FBX: board bounding box could not be computed");
    const boardSize = boardBbox.getSize(new THREE.Vector3());

    // Scale so the board's X span = 8 (one unit per square)
    const scaleFactor = 8 / boardSize.x;

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
