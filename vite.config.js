import { defineConfig } from "vite";
import { lezer } from "@lezer/generator/rollup";

export default defineConfig({
  // Relative paths, so the page works wherever it is published
  base: "./",
  // The grammars of languages/ (.grammar files) are compiled to parsers
  plugins: [lezer()],
  build: {
    outDir: "dist",
    // demo.js waits for rudof at the top level of the module
    target: "es2022",
  },
});
