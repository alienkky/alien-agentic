/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// opencascade.js 는 런타임에 거대한 .wasm 을 fetch 한다.
// optimizeDeps 에서 제외해 dev 사전번들이 wasm 을 건드리지 않게 한다.
export default defineConfig({
  plugins: [react()],
  // 태블릿 실기 검증: 같은 네트워크의 iPad/Galaxy Tab/Z Fold 6 에서 열 수 있게
  // dev/preview 를 LAN 에 노출한다. 콘솔의 Network: 주소를 태블릿에서 연다.
  server: {
    host: true,
    port: 5173,
  },
  preview: {
    host: true,
    port: 4173,
  },
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
