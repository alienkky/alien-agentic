# Nebula — 웹 3D 모델러 (app)

> ⚠️ **이 폴더(`projects/web-3d-modeler/app/`) 안에서** 명령을 실행한다.
> 레포 루트(`E:\AlienAgentic\alien-agentic`)에는 package.json 이 없어서 `npm install` 이 ENOENT 로 깨진다.

## 실행 (Windows PowerShell)

```powershell
# 0. 최신 머지본 받기 (앱 폴더가 로컬에 없으면 필수)
git checkout main
git pull origin main

# 1. 앱 폴더로 이동 (여기가 핵심)
cd projects\web-3d-modeler\app

# 2. 의존성 설치 (최초 1회, opencascade.js 포함 ~수십 MB)
npm install

# 3. dev 서버 — LAN 노출됨(vite.config 의 server.host=true)
npm run dev
```

`npm run dev` 가 출력하는 두 주소 중 **Network: http://192.168.x.x:5173** 를
같은 와이파이의 **iPad / Galaxy Tab / Z Fold 6** 사파리·크롬에서 연다.
(Local: 주소는 PC 자신용. 태블릿에선 Network: 주소를 써야 한다.)

## 디바이스에서 확인할 것 (Phase 0 게이트)

1. 박스가 화면에 뜨는가 — 상단 **＋ Box**
2. 손가락으로 **궤도**(빈 곳 한 손가락 드래그) · **핀치 줌** · **두 손가락 팬**
3. 펜(Apple Pencil / S Pen)으로도 궤도가 되는가
4. 면을 탭 → **청록색 하이라이트** (메타데이터 픽킹이 살아있다는 증거)
5. 폴드 6 **접고 펼 때** 레이아웃이 안 깨지는가 (상태바에 "폴더블" 표시)
6. 상단 **OCCT** 토글 → 진짜 B-rep 박스도 뜨는가 (최초 65MB wasm 다운로드)
   - 여기서 에러가 나면 브라우저 콘솔(F12) 메시지를 캡처해 공유 → occtModule.ts 보정

## 검증 명령

```powershell
npm run typecheck   # tsc strict
npm test            # vitest (23개)
npm run build       # 프로덕션 빌드
npm run test:e2e    # Playwright (최초 npx playwright install 필요)
```

## 백엔드

- **결정론적**(기본): OCCT 없이 전 디바이스 즉시 동작. 박스 테셀레이션을 직접 계산.
- **OCCT**: opencascade.js(B-rep). 지연 로드(65MB). 디바이스 런타임 검증 대상.
