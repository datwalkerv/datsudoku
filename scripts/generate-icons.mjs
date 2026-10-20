// Renders public/icons/icon.svg (full-bleed; iOS and Android round the corners)
// into the PNG sizes used by the manifest and iOS. The browser favicon is
// app/icon.svg. Run: pnpm icons
import sharp from "sharp";
import { readFile } from "node:fs/promises";

const svg = await readFile(new URL("../public/icons/icon.svg", import.meta.url));
const out = (name) => new URL(`../public/icons/${name}`, import.meta.url).pathname;

for (const [name, size] of [
  ["icon-192.png", 192],
  ["icon-512.png", 512],
  ["maskable-512.png", 512],
]) {
  await sharp(svg, { density: 384 }).resize(size, size).png().toFile(out(name));
  console.log("wrote", name);
}

// iOS picks up app/apple-icon.png through Next's file conventions.
await sharp(svg, { density: 384 }).resize(180, 180).png().toFile(new URL("../app/apple-icon.png", import.meta.url).pathname);
console.log("wrote app/apple-icon.png");
