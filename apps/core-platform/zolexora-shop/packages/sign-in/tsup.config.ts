import { defineConfig } from "tsup";

export default defineConfig({
  entry: { index: "src/index.ts" },
  format: ["esm"],
  dts: true,
  target: "es2020",
  outDir: "dist",
  clean: true,
  banner: { js: '"use client";' },
  external: ["react", "react-dom", "firebase", "firebase/app", "firebase/auth", /^@zolexora\/auth-client/],
});
