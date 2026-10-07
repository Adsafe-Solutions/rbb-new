/* Vercel's entry for this project (Vercel project root: apps/api). Every
   path is rewritten here (vercel.json); the handlers come from the bundled
   build (`pnpm run build` → dist/vercel.js), so production runs plain
   compiled JavaScript — never TypeScript source. */
export { GET, POST, PUT, PATCH, DELETE, OPTIONS } from "../dist/vercel.js";
