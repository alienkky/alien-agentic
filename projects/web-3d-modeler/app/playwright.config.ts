import { defineConfig, devices } from "@playwright/test";

/**
 * E2E — dev 서버를 띄워 실제 렌더를 검증.
 * 디바이스 매트릭스(iPad/Galaxy Tab/Fold)는 실기 또는 아래 프로젝트 에뮬레이션으로 확장.
 * 헤드리스 컨테이너에서 처음 돌릴 때는 `npx playwright install` 로 브라우저를 받는다.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  webServer: {
    command: "npm run dev",
    url: "http://localhost:5173",
    reuseExistingServer: true,
    timeout: 120_000,
  },
  use: {
    baseURL: "http://localhost:5173",
  },
  projects: [
    { name: "desktop-chrome", use: { ...devices["Desktop Chrome"] } },
    { name: "ipad", use: { ...devices["iPad (gen 7)"] } },
    { name: "galaxy-tab", use: { ...devices["Galaxy Tab S4"] } },
  ],
});
