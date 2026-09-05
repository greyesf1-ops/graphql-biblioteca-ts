import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Solo las fuentes: sin esto tambien se ejecutaria la copia compilada en dist/.
    include: ["test/**/*.test.ts"],
    exclude: ["node_modules/**", "dist/**"],
  },
});
