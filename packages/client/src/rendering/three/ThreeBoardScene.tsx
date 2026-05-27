import type { Cell } from "@pwnd/core";
import { effectiveCandidates } from "@pwnd/core";
import { ContactShadows, Environment, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useCallback, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { RenderOptions } from "../RenderingEngine.js";
import { squareIdxToPos } from "./coords.js";
import { useAutoFacing } from "./useAutoFacing.js";
import { type PieceKind, useFbxGeometries } from "./useFbxGeometries.js";
import { useMaterials } from "./useMaterials.js";

// ── Piece rendering ────────────────────────────────────────────────────────────

interface PieceMeshProps {
  kind: PieceKind;
  side: "white" | "black";
  opacity?: number;
  squareIdx: number;
  isAnimating?: boolean;
  emissiveBoost?: number;
}

function PieceMesh({ kind, side, opacity = 1, squareIdx, emissiveBoost = 0 }: PieceMeshProps) {
  const { pieceGeos } = useFbxGeometries();
  const materials = useMaterials();
  const [x, , z] = squareIdxToPos(squareIdx);

  const geo = pieceGeos[`${kind}_${side}`];
  if (!geo) return null;

  const baseMat = side === "white" ? materials.pieceWhite : materials.pieceBlack;
  const mat = useMemo(() => {
    const m = baseMat.clone();
    m.transparent = opacity < 1;
    m.opacity = opacity;
    m.depthWrite = opacity >= 1;
    if (emissiveBoost > 0) {
      m.emissive = new THREE.Color(0.4, 0.3, 0.1);
      m.emissiveIntensity = emissiveBoost;
    }
    return m;
  }, [baseMat, opacity, emissiveBoost]);

  return <mesh geometry={geo} material={mat} position={[x, 0, z]} castShadow receiveShadow />;
}

// ── Dude stack ────────────────────────────────────────────────────────────────

interface DudeStackProps {
  cell: Extract<Cell, { kind: "dude" }>;
  squareIdx: number;
  board: readonly Cell[];
}

const _DUDE_KINDS: PieceKind[] = ["R", "N", "B", "Q", "K"];

function DudeStack({ cell, squareIdx, board }: DudeStackProps) {
  const eff = useMemo(
    () => effectiveCandidates(cell.localCandidates, board, cell.owner),
    [cell.localCandidates, board, cell.owner],
  );

  const n = eff.length;
  if (n === 0) return null;
  const opacity = Math.max(0.1, 1 / n);

  return (
    <>
      {eff.map((k) => (
        <PieceMesh
          key={k}
          kind={k as PieceKind}
          side={cell.owner}
          squareIdx={squareIdx}
          opacity={opacity}
        />
      ))}
    </>
  );
}

// ── Square highlights ─────────────────────────────────────────────────────────

interface HighlightProps {
  squareIdx: number;
  color: string;
  opacity: number;
  yOffset?: number;
}

function SquareHighlight({ squareIdx, color, opacity, yOffset = 0.01 }: HighlightProps) {
  const [x, , z] = squareIdxToPos(squareIdx);
  return (
    <mesh position={[x, yOffset, z]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial color={color} transparent opacity={opacity} depthWrite={false} />
    </mesh>
  );
}

function LegalDestDot({ squareIdx, hasOccupant }: { squareIdx: number; hasOccupant: boolean }) {
  const [x, , z] = squareIdxToPos(squareIdx);
  return hasOccupant ? (
    // Ring for captures
    <mesh position={[x, 0.015, z]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.35, 0.47, 32]} />
      <meshBasicMaterial color="#14551e" transparent opacity={0.75} depthWrite={false} />
    </mesh>
  ) : (
    // Filled dot for empty square
    <mesh position={[x, 0.015, z]} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[0.15, 32]} />
      <meshBasicMaterial color="#14551e" transparent opacity={0.55} depthWrite={false} />
    </mesh>
  );
}

// ── Rejection shake animation ──────────────────────────────────────────────────

function ShakePiece({ squareIdx, cell }: { squareIdx: number; cell: Cell }) {
  const ref = useRef<THREE.Group>(null);
  const startTime = useRef(performance.now());

  useFrame(() => {
    const group = ref.current;
    if (!group) return;
    const elapsed = (performance.now() - startTime.current) / 1000;
    if (elapsed > 0.3) {
      group.position.x = 0;
      return;
    }
    // 3 cycles over 0.3s, amplitude 0.1 units
    group.position.x = Math.sin(elapsed * Math.PI * 20) * 0.12 * (1 - elapsed / 0.3);
  });

  if (!cell) return null;
  const kind = cell.kind === "materialized" ? (cell.piece as PieceKind) : null;
  if (!kind) return null;

  return (
    <group ref={ref}>
      <PieceMesh kind={kind} side={cell.owner} squareIdx={squareIdx} />
    </group>
  );
}

// ── Invisible square pickers ──────────────────────────────────────────────────

function SquarePicker({
  squareIdx,
  onSquareClick,
}: {
  squareIdx: number;
  onSquareClick: (idx: number) => void;
}) {
  const [x, , z] = squareIdxToPos(squareIdx);
  const handleClick = useCallback(() => onSquareClick(squareIdx), [squareIdx, onSquareClick]);
  return (
    <mesh position={[x, 0.02, z]} rotation={[-Math.PI / 2, 0, 0]} onPointerDown={handleClick}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  );
}

// ── Materialization flash ─────────────────────────────────────────────────────

function MaterializeFlash({ squareIdx }: { squareIdx: number }) {
  const ref = useRef<THREE.Mesh>(null);
  const startTime = useRef(performance.now());

  useFrame(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const elapsed = (performance.now() - startTime.current) / 1000;
    if (elapsed > 0.5) {
      (mesh.material as THREE.MeshBasicMaterial).opacity = 0;
      return;
    }
    // Flash in then fade out
    const t = elapsed / 0.5;
    const opacity = t < 0.2 ? t / 0.2 : 1 - (t - 0.2) / 0.8;
    (mesh.material as THREE.MeshBasicMaterial).opacity = opacity * 0.6;
  });

  const [x, , z] = squareIdxToPos(squareIdx);
  return (
    <mesh ref={ref} position={[x, 0.025, z]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial color="#ffffff" transparent opacity={0.6} depthWrite={false} />
    </mesh>
  );
}

// ── Move animation ─────────────────────────────────────────────────────────────

function MovingPiece({
  kind,
  side,
  fromIdx,
  toIdx,
}: {
  kind: PieceKind;
  side: "white" | "black";
  fromIdx: number;
  toIdx: number;
}) {
  const ref = useRef<THREE.Group>(null);
  const startTime = useRef(performance.now());
  const [fx, , fz] = squareIdxToPos(fromIdx);
  const [tx, , tz] = squareIdxToPos(toIdx);
  const DURATION = 0.35;

  useFrame(() => {
    const group = ref.current;
    if (!group) return;
    const t = Math.min((performance.now() - startTime.current) / 1000 / DURATION, 1);
    const ease = 1 - (1 - t) * (1 - t);
    group.position.x = fx + (tx - fx) * ease;
    group.position.z = fz + (tz - fz) * ease;
    // Knight arc
    const isKnight = kind === "N";
    if (isKnight) {
      group.position.y = Math.sin(t * Math.PI) * 1.5;
    }
  });

  return (
    <group ref={ref} position={[fx, 0, fz]}>
      <PieceMesh kind={kind} side={side} squareIdx={fromIdx} />
    </group>
  );
}

// ── Readiness signal ──────────────────────────────────────────────────────────
// Fires after Suspense resolves (FBX + textures loaded) so Playwright can wait
// for canvas[data-canvas-ready="true"] and know real geometry is present.
function ReadinessSignal() {
  const { gl } = useThree();
  useEffect(() => {
    gl.domElement.setAttribute("data-canvas-ready", "true");
  }, [gl]);
  return null;
}

// ── Board model ────────────────────────────────────────────────────────────────

function BoardModel({ material }: { material: THREE.MeshStandardMaterial }) {
  const { boardGeo } = useFbxGeometries();
  return <mesh geometry={boardGeo} material={material} receiveShadow castShadow />;
}

// ── Main scene content (inside Canvas, after Suspense) ────────────────────────

function BoardSceneContent({
  gameState,
  replayedMove,
  facePlayer,
  selectedSquare,
  legalDestinations,
  onSquareClick,
}: RenderOptions) {
  const materials = useMaterials();
  const boardGroupRef = useRef<THREE.Group>(null);
  useAutoFacing(boardGroupRef, facePlayer);

  const { board } = gameState;
  const lastMove = replayedMove?.move ?? null;

  // Squares animated this frame
  const rejectedFrom = replayedMove?.status === "rejected" && lastMove ? lastMove.from : null;
  const materializedSquares = replayedMove?.materializedSquares ?? [];
  const acceptedFrom = replayedMove?.status === "accepted" && lastMove ? lastMove.from : null;
  const acceptedTo = replayedMove?.status === "accepted" && lastMove ? lastMove.to : null;

  // Determine if a move animation should play
  const showMoveAnim =
    replayedMove?.status === "accepted" &&
    lastMove !== null &&
    acceptedFrom !== null &&
    acceptedTo !== null;

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.5} />
      <directionalLight
        position={[6, 14, 6]}
        intensity={1.6}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0001}
      />

      {/* Environment */}
      <Environment preset="city" />

      {/* Ground shadow */}
      <ContactShadows position={[0, -0.5, 0]} opacity={0.5} scale={12} blur={2} far={4} />

      {/* Orbit controls */}
      <OrbitControls
        enablePan={false}
        minDistance={7}
        maxDistance={22}
        minPolarAngle={0.15}
        maxPolarAngle={Math.PI / 2 - 0.05}
        enableDamping
        dampingFactor={0.08}
      />

      {/* Auto-rotating board group */}
      <group ref={boardGroupRef}>
        {/* Board mesh */}
        <BoardModel material={materials.board} />

        {/* Selection highlight */}
        {selectedSquare !== null && (
          <SquareHighlight squareIdx={selectedSquare} color="#145520" opacity={0.65} />
        )}

        {/* Last-move highlights */}
        {acceptedFrom !== null && (
          <SquareHighlight squareIdx={acceptedFrom} color="#9bc700" opacity={0.38} />
        )}
        {acceptedTo !== null && (
          <SquareHighlight squareIdx={acceptedTo} color="#9bc700" opacity={0.38} />
        )}
        {lastMove?.rookTo !== undefined && replayedMove?.status === "accepted" && (
          <SquareHighlight squareIdx={lastMove.rookTo} color="#9bc700" opacity={0.38} />
        )}

        {/* Legal destination indicators */}
        {legalDestinations.map((idx) => (
          <LegalDestDot key={idx} squareIdx={idx} hasOccupant={board[idx] !== null} />
        ))}

        {/* Materialization flashes */}
        {materializedSquares.map((idx) => (
          <MaterializeFlash key={idx} squareIdx={idx} />
        ))}

        {/* Pieces — key is the square index (stable semantic identity) */}
        {board.map((cell, idx) => {
          if (!cell) return null;
          const isRejectedPiece = rejectedFrom === idx;

          if (isRejectedPiece && cell.kind === "materialized") {
            return <ShakePiece key={idx} squareIdx={idx} cell={cell} />;
          }

          if (
            showMoveAnim &&
            acceptedFrom === idx &&
            acceptedTo !== null &&
            cell.kind === "materialized"
          ) {
            return (
              <MovingPiece
                key={idx}
                kind={cell.piece as PieceKind}
                side={cell.owner}
                fromIdx={acceptedFrom}
                toIdx={acceptedTo}
              />
            );
          }

          if (cell.kind === "materialized") {
            const isMatFlash = materializedSquares.includes(idx);
            return (
              <PieceMesh
                key={idx}
                kind={cell.piece as PieceKind}
                side={cell.owner}
                squareIdx={idx}
                emissiveBoost={isMatFlash ? 1.5 : 0}
              />
            );
          }

          return <DudeStack key={idx} cell={cell} squareIdx={idx} board={board} />;
        })}

        {/* 64 invisible square pickers (idx IS the square index, not a list position) */}
        {Array.from({ length: 64 }, (_, idx) => (
          <SquarePicker key={idx} squareIdx={idx} onSquareClick={onSquareClick} />
        ))}
      </group>

      {/* Fires after Suspense resolves so Playwright can wait for actual geometry */}
      <ReadinessSignal />
    </>
  );
}

// ── Public component ──────────────────────────────────────────────────────────

export function ThreeBoardScene(props: RenderOptions) {
  return (
    <div style={{ width: "100%", height: "100%", minHeight: 480 }}>
      <Canvas
        camera={{ position: [0, 11, 9], fov: 45 }}
        shadows
        gl={{ antialias: true, alpha: false }}
      >
        <color attach="background" args={["#2a2a2c"]} />
        <Suspense fallback={null}>
          <BoardSceneContent {...props} />
        </Suspense>
      </Canvas>
    </div>
  );
}
