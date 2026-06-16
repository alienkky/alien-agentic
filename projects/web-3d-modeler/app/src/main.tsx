import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { useAppStore } from "./store/useAppStore";
import "./styles/index.css";

const container = document.getElementById("root");
if (!container) {
  throw new Error("root 엘리먼트를 찾을 수 없습니다");
}

// dev 모드에서만 store 를 window 에 노출 — playwright e2e 가 캔버스 3D 드래그를 시뮬레이트하기
// 어려워서, 도형 그리기·치수 입력 시나리오를 결정론적으로 구동하기 위한 통로.
if (import.meta.env.DEV) {
  (window as unknown as { __alienStore?: typeof useAppStore }).__alienStore = useAppStore;
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
