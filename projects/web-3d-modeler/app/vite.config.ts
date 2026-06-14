/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// opencascade.js 는 런타임에 거대한 .wasm 을 fetch 한다.
// optimizeDeps 에서 제외해 dev 사전번들이 wasm 을 건드리지 않게 한다.
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ["opencascade.js"],
  },
  worker: {
    format: "es",
  },
  build: {
    target: "es2022",
  },
  test: {
    environment: "jsdom",
    globals: true,
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    setupFiles: [],
  },
});
