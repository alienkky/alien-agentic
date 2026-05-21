# alien-config/scripts — 스크립트 인덱스

> Multica · Open Design 커스터마이즈를 *fresh clone drift* 에도 복원하는 스크립트 모음.
> 본진(`multica/`, `open-design/`)은 gitignore 라 재clone 되면 우리 작업이 날아간다 → 이 스크립트들이 우리 git 소스에서 본진으로 복원한다.

## 🟢 한 줄 마스터 (이것만 기억하면 됨)

| 스크립트 | 무엇 |
|---|---|
| **`setup-multica.ps1`** | Multica 전체 복원 — 한국어+브랜딩+Alien Plan + docker rebuild 1회. fresh clone 후 이 한 줄 |
| **`install-open-design.ps1`** | Open Design 에 우리 브랜드(디자인시스템) 이식 (AA 자체 + 클라이언트별) |

## Multica 복원 (setup-multica 가 내부 호출)

| 스크립트 | 역할 |
|---|---|
| `restore-korean-locale.py` / `.ps1` | 한국어 locale 등록 + 브랜딩 복원 (F1~F10: SupportedLocale·HTML_LANG·RESOURCES·picker·탭제목) |
| `install-alien-plan.py` / `.ps1` | Alien Plan 네이티브 페이지 설치 (복사 3 + 앵커 패치 9) |
| `fix-issue-detail-inline.py` / `.ps1` | issue-detail.tsx 인라인 편집 (업스트림 drift 우회 — 유니크 앵커) |
| `fix-button-position.ps1` | '맨 아래로' 버튼 위치 미세조정 (bottom-N) |
| `apply-multica-patches.ps1` | 03/04 patch 적용 (구버전 — 인라인 편집기로 대체됨) |
| `translate_locale_ko.py` | en locale → 한국어 자동 번역 (Claude Max 경유) |

## Open Design

| 스크립트 | 역할 |
|---|---|
| `install-open-design.py` / `.ps1` | alien-config + clients/*/design-system/ 의 DESIGN.md 를 본진에 등록 |

## Autostart (Task Scheduler, 로그온 시)

| 스크립트 | 역할 |
|---|---|
| `autostart-serve.ps1` | Multica docker 가동 + Tailscale HTTPS serve (음성·secure-context) |
| `autostart-daemon.ps1` | multica daemon 시작 (27명 에이전트 작업 수행) |
| `autostart-morning.ps1` | 매일 08:00 status + daily-log 생성 |

## 검증 / 공용

| 스크립트 | 역할 |
|---|---|
| `check-tsx.sh` | Multica 컴포넌트 tsx 를 multica strict tsconfig 로 사전 타입체크 (esbuild 가 못 잡는 타입 에러 차단 — CLAUDE.md §7) |
| `daily-log-template.md` | daily-log 템플릿 |

## 원칙

- **본진 직접 수정 금지** — 우리 변경은 항상 우리 git 의 `alien-config/` 에, 복원 스크립트로 본진에 반영
- **멱등성** — 모든 install/restore 는 여러 번 실행해도 안전 (이미 적용 시 SKIP)
- **tsx 작성 시 `check-tsx.sh` 필수** (빌드 전 타입 검증)
