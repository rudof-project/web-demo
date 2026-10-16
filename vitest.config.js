import { defineConfig } from "vitest/config";
import { lezer } from "@lezer/generator/rollup";

export default defineConfig({
  // The grammars of languages/, as in vite.config.js
  plugins: [lezer()],
  test: {
    include: ["tests/unit/**/*.test.js"],
    setupFiles: ["tests/unit/setup-jsdom.js"],
  },
});
