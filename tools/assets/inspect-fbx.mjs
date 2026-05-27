import fs from "node:fs";
/**
 * Dumps the scene graph of Chess_LP.fbx to identify mesh names and transforms.
 * Run: node tools/assets/inspect-fbx.mjs
 */
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FBX_PATH = path.resolve(__dirname, "../../packages/client/public/models/chess_lp.fbx");

// three-stdlib FBXLoader requires a browser-like environment.
// We use a minimal mock for the file-loading path.
const _require = createRequire(import.meta.url);

// Polyfill minimal globals that three / three-stdlib expect in Node
global.window = global;
global.document = {
  createElement: () => ({ style: {} }),
  createElementNS: () => ({}),
};
try {
  Object.defineProperty(global, "navigator", { value: { userAgent: "node" }, writable: true });
} catch (_) {}

// three-stdlib's FBXLoader needs a TextDecoder - available in Node 18+
// Load three & FBXLoader
const THREE = await import("three");
const { FBXLoader } = await import("three-stdlib");

const loader = new FBXLoader();

// Read FBX as ArrayBuffer
const buffer = fs.readFileSync(FBX_PATH);
const ab = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

let group;
try {
  group = loader.parse(ab, "");
} catch (e) {
  console.error("FBXLoader.parse failed:", e.message);
  process.exit(1);
}

function walk(obj, depth = 0) {
  const indent = "  ".repeat(depth);
  const type = obj.type ?? obj.constructor?.name ?? "?";
  const geo = obj.geometry ? ` [geo verts=${obj.geometry.attributes?.position?.count ?? "?"}]` : "";
  console.log(`${indent}${type} name="${obj.name}"${geo}`);
  if (obj.children) {
    for (const child of obj.children) walk(child, depth + 1);
  }
}

console.log("=== FBX Scene Graph ===");
walk(group);
console.log("\n=== Bounding Box ===");
const box = new THREE.Box3().setFromObject(group);
console.log("min:", box.min.toArray());
console.log("max:", box.max.toArray());
console.log("size:", box.getSize(new THREE.Vector3()).toArray());
