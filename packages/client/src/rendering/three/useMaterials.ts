import { useTexture } from "@react-three/drei";
import { useMemo } from "react";
import * as THREE from "three";

export interface ChessMaterials {
  board: THREE.MeshStandardMaterial;
  pieceWhite: THREE.MeshStandardMaterial;
  pieceBlack: THREE.MeshStandardMaterial;
}

type SevenTextures = [
  THREE.Texture,
  THREE.Texture,
  THREE.Texture,
  THREE.Texture,
  THREE.Texture,
  THREE.Texture,
  THREE.Texture,
];

export function useMaterials(): ChessMaterials {
  // Cast to tuple: useTexture is Suspense-based and only returns when all textures are ready.
  const base = import.meta.env.BASE_URL;
  const [
    boardBaseColor,
    boardNormal,
    boardOrm,
    whitePieceBaseColor,
    blackPieceBaseColor,
    pieceNormal,
    pieceOrm,
  ] = useTexture([
    `${base}textures/chess_lp/board_basecolor.webp`,
    `${base}textures/chess_lp/board_normal.webp`,
    `${base}textures/chess_lp/board_orm.webp`,
    `${base}textures/chess_lp/pieces_white_basecolor.webp`,
    `${base}textures/chess_lp/pieces_black_basecolor.webp`,
    `${base}textures/chess_lp/pieces_normal.webp`,
    `${base}textures/chess_lp/pieces_orm.webp`,
  ]) as SevenTextures;

  return useMemo(() => {
    // sRGB for base-color maps; linear stays for normal/ORM
    for (const t of [boardBaseColor, whitePieceBaseColor, blackPieceBaseColor]) {
      t.colorSpace = THREE.SRGBColorSpace;
    }

    const mkMat = (
      baseColor: THREE.Texture,
      normalMap: THREE.Texture,
      orm: THREE.Texture,
    ): THREE.MeshStandardMaterial =>
      new THREE.MeshStandardMaterial({
        map: baseColor,
        normalMap,
        roughnessMap: orm,
        metalnessMap: orm,
        aoMap: orm,
      });

    return {
      board: mkMat(boardBaseColor, boardNormal, boardOrm),
      pieceWhite: mkMat(whitePieceBaseColor, pieceNormal, pieceOrm),
      pieceBlack: mkMat(blackPieceBaseColor, pieceNormal, pieceOrm),
    };
  }, [
    boardBaseColor,
    boardNormal,
    boardOrm,
    whitePieceBaseColor,
    blackPieceBaseColor,
    pieceNormal,
    pieceOrm,
  ]);
}
