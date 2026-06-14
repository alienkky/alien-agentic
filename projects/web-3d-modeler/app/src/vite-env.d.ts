/// <reference types="vite/client" />

// opencascade.js 1.1.1 은 타입 정의를 제공하지 않는다(.d.ts 없음).
// 우리가 직접 호출하는 부분은 occtModule.ts 의 facade 로 좁혀 캐스팅한다.
declare module "opencascade.js/dist/opencascade.wasm.js" {
  const factory: unknown;
  export default factory;
}
