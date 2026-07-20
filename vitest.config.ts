import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Override Vite's auto-discovery of postcss.config.mjs (Tailwind v4 / Next),
  // which Vite cannot parse. Tests do not need CSS processing.
  css: {
    postcss: {
      plugins: [],
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    // Migra la base de integración (si TEST_DATABASE_URL está definida) antes de
    // los tests, de forma determinista. Ver src/test/global-setup.ts (B2.4).
    globalSetup: ["./src/test/global-setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    // Los tests de integración comparten UNA sola base de datos y hacen TRUNCATE
    // entre tests; correr archivos en paralelo hace que se pisen (deadlocks y
    // violaciones de FK). Por eso los archivos se ejecutan en serie. Los tests
    // dentro de cada archivo ya corren secuencialmente. Ver B2.4/db-harness.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
