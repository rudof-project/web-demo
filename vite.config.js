import { execSync } from "node:child_process";
import { defineConfig } from "vite";
import { lezer } from "@lezer/generator/rollup";

// The commit of the demo, for About (header.js): the one GitHub Actions
// builds, or the one of the repository
function commit() {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 7);
  try {
    return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return "";
  }
}

export default defineConfig({
  // Relative paths, so the page works wherever it is published
  base: "./",
  // The grammars of languages/ (.grammar files) are compiled to parsers
  plugins: [lezer()],
  define: { __DEMO_COMMIT__: JSON.stringify(commit()) },
  build: {
    outDir: "dist",
    // The demo, and its help page
    rollupOptions: {
      input: { main: "index.html", help: "help.html" },
    },
    // demo.js waits for rudof at the top level of the module
    target: "es2022",
  },
});
