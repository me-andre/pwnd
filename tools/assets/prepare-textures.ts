import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
/**
 * One-shot script: downscale LP textures to WebP and copy FBX model.
 * Run via: pnpm prepare-assets
 */
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");

const PIECES_SRC = path.join(ROOT, "assets/chess_3d/textures/For LP");
const BOARD_SRC = path.join(ROOT, "assets/chess_3d/textures/Chess Board LP");
const OUT_TEXTURES = path.join(ROOT, "packages/client/public/textures/chess_lp");
const OUT_MODELS = path.join(ROOT, "packages/client/public/models");
const FBX_SRC = path.join(ROOT, "assets/chess_3d/Chess_LP.fbx");

const MAX_DIM = 2048;

interface TextureJob {
  src: string;
  dest: string;
  lossless: boolean;
}

const jobs: TextureJob[] = [
  // Pieces
  {
    src: path.join(PIECES_SRC, "Chess_White_BaseColor_LP.png"),
    dest: path.join(OUT_TEXTURES, "pieces_white_basecolor.webp"),
    lossless: false,
  },
  {
    src: path.join(PIECES_SRC, "Chess_Black_BaseColor_LP.png"),
    dest: path.join(OUT_TEXTURES, "pieces_black_basecolor.webp"),
    lossless: false,
  },
  {
    src: path.join(PIECES_SRC, "Chess_NormalGL_LP.png"),
    dest: path.join(OUT_TEXTURES, "pieces_normal.webp"),
    lossless: true,
  },
  {
    src: path.join(PIECES_SRC, "Chess_OcclusionRoughnessMetallic_LP.png"),
    dest: path.join(OUT_TEXTURES, "pieces_orm.webp"),
    lossless: true,
  },
  // Board
  {
    src: path.join(BOARD_SRC, "Material Chess board_LP_BaseColor.png"),
    dest: path.join(OUT_TEXTURES, "board_basecolor.webp"),
    lossless: false,
  },
  {
    src: path.join(BOARD_SRC, "Material Chess board_LP_NormalGL.png"),
    dest: path.join(OUT_TEXTURES, "board_normal.webp"),
    lossless: true,
  },
  {
    src: path.join(BOARD_SRC, "Material Chess board_LP_OcclusionRoughnessMetallic.png"),
    dest: path.join(OUT_TEXTURES, "board_orm.webp"),
    lossless: true,
  },
];

async function processTexture(job: TextureJob): Promise<void> {
  console.log(`Processing: ${path.basename(job.src)} → ${path.basename(job.dest)}`);
  const img = sharp(job.src).resize(MAX_DIM, MAX_DIM, {
    fit: "inside",
    withoutEnlargement: true,
  });

  if (job.lossless) {
    await img.webp({ lossless: true }).toFile(job.dest);
  } else {
    await img.webp({ quality: 85 }).toFile(job.dest);
  }
  const stats = fs.statSync(job.dest);
  console.log(`  → ${(stats.size / 1024).toFixed(0)} KB`);
}

async function main(): Promise<void> {
  fs.mkdirSync(OUT_TEXTURES, { recursive: true });
  fs.mkdirSync(OUT_MODELS, { recursive: true });

  for (const job of jobs) {
    await processTexture(job);
  }

  // Copy FBX verbatim
  const fbxDest = path.join(OUT_MODELS, "chess_lp.fbx");
  console.log(`Copying FBX: ${path.basename(FBX_SRC)} → ${path.basename(fbxDest)}`);
  fs.copyFileSync(FBX_SRC, fbxDest);
  const fbxStats = fs.statSync(fbxDest);
  console.log(`  → ${(fbxStats.size / 1024).toFixed(0)} KB`);

  console.log("\nDone! Assets written to packages/client/public/");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
