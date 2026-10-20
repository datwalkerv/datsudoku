// Renders public/icons/icon.svg into the PNG sizes used by the manifest and iOS.
// Run: node scripts/generate-icons.mjs
import sharp from "sharp";
import { readFile } from "node:fs/promises";

const svg = await readFile(new URL("../public/icons/icon.svg", import.meta.url));
const out = (name) => new URL(`../public/icons/${name}`, import.meta.url).pathname;

for (const [name, size] of [
  ["icon-192.png", 192],
  ["icon-512.png", 512],
  ["maskable-512.png", 512],
  ["apple-touch-icon.png", 180],
  ["favicon-32.png", 32],
]) {
  await sharp(svg, { density: 384 }).resize(size, size).flatten({ background: "#FAF9F6" }).png().toFile(out(name));
  console.log("wrote", name);
}
