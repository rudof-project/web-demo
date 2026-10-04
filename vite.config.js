import { defineConfig } from "vite";

export default defineConfig({
  // Relative paths, so the page works wherever it is published
  base: "./",
  build: {
    outDir: "dist",
    // demo.js waits for rudof at the top level of the module
    target: "es2022",
  },
});
