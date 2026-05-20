# Open Design 셋업 가이드 — AA 디자인 생성 워크스테이션

> [`nexu-io/open-design`](https://github.com/nexu-io/open-design) — 오픈소스 "Claude Design" 대안. agent-native 디자인 생성 도구. **Apache-2.0**.
>
> 목적: 우리 27명 에이전트(Claude Code 기반)가 *고품질 디자인 결과물*(웹 프로토타입·대시보드·덱·문서)을 뽑게 한다. anti-AI-slop 가드 + 72개 디자인 시스템이 품질을 끌어올린다.

---

## 0. 왜 우리한테 맞는가

| 항목 | Open Design | 우리 궁합 |
|---|---|---|
| 구조 | Node 데몬 + Next.js 16 프론트 | Multica 와 판박이 — 운영 노하우 재사용 |
| 에이전트 | PATH 의 16개 CLI 자동 감지 | **Claude Code 지원** → 우리 에이전트 그대로, Claude Max 로 |
| 디자인 시스템 | 72개 (Linear·Stripe·Vercel·Apple…) | 우리 *Alien Agentic 브랜드* DESIGN.md 추가 가능 |
| 품질 가드 | discovery form · OKLch 결정론 팔레트 · 5차원 self-review · P0/P1/P2 | 에이전트 결과물 *AI 슬롭* 방지 |
| 미디어 | gpt-image-2 · Seedance 2.0 · HTML→MP4 | 우리 ComfyUI 경로와 병행 |

---

## 1. 설치 (Node 24 분리 필수)

Open Design 은 **Node ~24 + pnpm 10.33.x**. 우리 Multica 는 Node 22 라 **nvm 으로 버전 분리**한다 (충돌 방지).

```powershell
# nvm-windows 설치 (없으면): https://github.com/coreybutler/nvm-windows/releases
nvm install 24
nvm use 24
node --version   # v24.x 확인

# Open Design clone — Multica 옆에 (drift 분리 원칙: §4)
cd E:\AlienAgentic\alien-agentic\automation\intranet
git clone https://github.com/nexu-io/open-design.git
cd open-design
corepack enable
corepack pnpm --version   # 10.33.2+ 확인
pnpm install
```

> ⚠️ `automation/intranet/open-design/` 는 `.gitignore` 처리한다 (Multica 와 동일). 본진은 업스트림 그대로, 우리 커스터마이즈는 `alien-config/open-design/` 에 (§4).

---

## 2. 실행 + 접속

```powershell
nvm use 24
cd E:\AlienAgentic\alien-agentic\automation\intranet\open-design
pnpm tools-dev run web
```

`tools-dev` 가 출력하는 URL 로 접속. 포트 충돌 시 (Multica 가 3000 점유):

```powershell
pnpm tools-dev run web --web-port 3100 --daemon-port 3101
```

→ `http://localhost:3100`. **음성·secure-context 기능은 Multica 와 동일하게 localhost 또는 Tailscale HTTPS 에서만** (→ `tailscale-setup.md` §3.5).

---

## 3. Claude Code 연동 (설정 0)

데몬이 부팅 시 **PATH 를 스캔해 `claude` 바이너리를 자동 감지**한다. 별도 설정 없음.

```powershell
where.exe claude   # claude.exe 경로가 나오면 OK
```

UI 의 모델 피커에서 클릭 한 번으로 에이전트 전환. Claude Max 구독으로 디자인 생성 → 토큰 비용은 Max 에 포함.

---

## 4. drift 대응 — 우리 커스터마이즈는 alien-config 에

Open Design 도 Multica 와 똑같은 함정이 있다: **fresh clone 되면 우리가 추가한 게 다 사라진다**. (오늘 한국어·Alien Plan 이 그래서 날아갔다 — `shared-memory/insights/2026-05-19-docker-compose-override-drift.md`)

그래서 **우리 커스텀 디자인 시스템·스킬은 우리 git 의 `alien-config/open-design/` 에 두고, 복원 스크립트로 open-design 에 복사**한다.

| 자리 | 위치 | git 추적 |
|---|---|---|
| **Open Design 본진** | `automation/intranet/open-design/` | ❌ (`.gitignore`) |
| **우리 커스텀** (브랜드 디자인시스템·스킬) | `automation/intranet/alien-config/open-design/` | ✅ |
| **런타임 데이터** (`.od/`) | open-design 루트 | ❌ (로컬) |

복원 흐름 (향후 `install-open-design.py` 로 자동화 예정):
```
alien-config/open-design/design-systems/alien-agentic/DESIGN.md
   → open-design/design-systems/alien-agentic/DESIGN.md
alien-config/open-design/skills/<우리스킬>/
   → open-design/skills/<우리스킬>/
→ 데몬 재시작 → 피커에 우리 브랜드 시스템·스킬 등장
```

---

## 5. 우리 브랜드 디자인 시스템 추가

`design-systems/<brand>/DESIGN.md` 9섹션 스키마: **color · typography · spacing · layout · components · motion · voice · brand · anti-patterns**.

"Alien Agentic" 브랜드 DESIGN.md 를 만들면 — 에이전트가 *우리 톤*(따뜻한 종이 + 외계 효율, Pretendard, AA 팔레트)으로 디자인을 뽑는다. 자리: `alien-config/open-design/design-systems/alien-agentic/DESIGN.md` (다음 단계에서 작성).

스킬·디자인시스템 추가는 **폴더 하나 + 데몬 재시작**이면 끝. 상세: open-design 의 `docs/skills-protocol.md`.

---

## 6. 다음 단계

- [ ] `.gitignore` 에 `automation/intranet/open-design/` 추가
- [ ] `alien-config/open-design/design-systems/alien-agentic/DESIGN.md` 작성 (AA 브랜드)
- [ ] `install-open-design.py` — 우리 커스텀 복사 + 데몬 재시작 (Multica 패턴)
- [ ] Multica 사이드바에 "Design" 링크 (open-design 포트로) — 선택
- [ ] `aa design "<프롬프트>"` CLI — open-design API 호출 (선택)

---

## 트러블슈팅

| 증상 | 해결 |
|---|---|
| `pnpm` 버전 낮음 | `corepack enable` 후 `corepack pnpm` 사용 (10.33.x) |
| Node 버전 충돌 | `nvm use 24` (open-design) / `nvm use 22` (Multica) 분리 |
| 포트 충돌 (3000) | `--web-port 3100 --daemon-port 3101` |
| `claude` 감지 안 됨 | `where.exe claude` 로 PATH 확인, 없으면 claude CLI 재설치 |
| 음성·마이크 안 됨 | secure context — localhost 또는 Tailscale HTTPS (`tailscale-setup.md` §3.5) |
| 우리 커스텀이 사라짐 | fresh clone drift — `install-open-design.py` 재실행 (§4) |
