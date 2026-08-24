import { cpSync } from "node:fs";

const src = "src/snippets/bundled";
const dest = "dist/snippets/bundled";

cpSync(src, dest, { recursive: true });
console.log(`Copied ${src} -> ${dest}`);
