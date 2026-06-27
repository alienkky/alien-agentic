# Private Domain — Migration Candidates

> **공개 문서.** 분리 정책: [private-domain-policy.md](./private-domain-policy.md).
> 이 파일은 *경로 후보*만 남긴다. 본문 발췌·요약 X.
> 실제 `git mv` 는 **기영님이 수행**. 에이전트는 절대 직접 옮기지 않는다.

---

## 0. 스캔 메타

- **스캔 일시**: 2026-06-06 (ALI-102 / S3 첫 스캔)
- **스캔 에이전트**: integration-specialist
- **스캔 범위**: 리포 전체 (`.git/`, `node_modules/`, `automation/intranet/multica/`, `automation/intranet/open-design/` 제외 — .gitignore 처리 대상)
- **제외**: `shared-memory/_private/` 내부는 정의상 *스캔 금지*
- **모드**: 보수 모드 — 후보 *제안만*, 본문 인용 X, 실제 이동 X

### 사용한 신호 패턴

| 카테고리 | 검색어 |
|---|---|
| 가족 (D1) | `한혜성`, `용훈`, `진아`, `담향산방`, `가족`, `아내`, `아들`, `딸`, `와이프`, `혜성` |
| 심리·번아웃 (D2) | `번아웃`, `지쳤`, `난 안 돼`, `포기했`, `탈진`, `무너졌` |
| 의료 (D4) | `처방`, `진단명`, `증상`, `검사 결과`, `약물명` |
| 법무 (D5) | `소송`, `고소`, `합의서`, `NDA 위반 의심` |
| 재정 사적 (D6) | `상속`, `증여`, `세무조사`, `개인 부채` |

---

## 1. 첫 스캔 결과 — **이주 후보 없음**

현재 리포의 모든 매치는 *정책 메타 / 개념 차원* 이다:

| 카테고리 | 매치 파일 (예) | 판정 사유 |
|---|---|---|
| 가족 (D1) | `CONSTITUTION.md`, `CLAUDE.md`, `shared-memory/daily-logs/2026-05-13.md`, `shared-memory/clients/_self-alien-agentic/WHY/*.md`, `shared-memory/_private/README.md`, `shared-memory/context/private-domain-policy.md` | "가족 시간 신성화" 등 *원칙 인용*만. 실제 가족 멤버의 개인 정보 0건 |
| 심리·번아웃 (D2) | `CONSTITUTION.md`, `CLAUDE.md`, `shared-memory/clients/_self-alien-agentic/WHY/pain-interpretation.md`, `automation/intranet/alien-config/alien-plan/README-Alien-Plan.md` | 자동 보호 트리거의 *어휘 정의*만. 개인 자책 일기 0건 |
| 의료 (D4) | `docs/guides/comfyui-integration.md`, `.claude/agents/pain-interpreter.md`, `.claude/agents/case-curator.md`, `shared-memory/clients/_self-alien-agentic/WHY/*` | "처방 vs 진단" 은 *컨설팅 메타포*로 사용. 실제 의료 기록 0건 |
| 법무 (D5) | `shared-memory/context/private-domain-policy.md` 만 | 본 정책 자체의 자기언급 |
| 재정 사적 (D6) | `shared-memory/context/private-domain-policy.md` 만 | 본 정책 자체의 자기언급 |

**결론**: 현 시점 리포에는 `_private/` 로 옮겨야 할 *실재 개인 데이터*가 없다.
이는 회사가 *기존 디스크 데이터로부터 깨끗한 상태로 출발했다*는 뜻 — 미래 유입을 막는 게 본 정책의 진짜 가치.

---

## 2. 미래 유입 감시 경로 (Watchlist)

다음 경로에 *개인 정보가 흘러들기 쉬우므로* 정기 재스캔 대상으로 등록:

### 🟡 중간 위험
- `shared-memory/daily-logs/` — 매일 회고. 무심코 가족 일정·심리 상태 메모 가능
- `shared-memory/clients/_self-alien-agentic/` — 자기 진단. 4층 진단이 개인 영역으로 침범 가능
- `shared-memory/agents/<*>/learnings.md`, `<*>/mistakes.md` — 에이전트가 기영님 발언 인용하다 사적 영역 포함 가능
- `shared-memory/insights/` — 주간 회고. 회사 운영과 개인 회고가 섞일 수 있음

### 🔴 고위험
- `shared-memory/interventions/` — 기영님 중간 개입. 감정·심리 상태 직접 노출 가능성 높음
- 신규 폴더 `shared-memory/messages/` 의 *기영님 ↔ 에이전트* 직접 대화 로그 (현재 비어 있음)

### 🟢 저위험 (스캔만 유지)
- `clients/{외부-클라이언트}/` — 클라이언트 자체 정보. 별도 NDA·익명화 정책 적용
- `content/` — 외부 발행 콘텐츠. `brand-keeper` 사전 검수 의무
- `automation/` — 코드. 우연 노출 가능성 낮음
- `docs/` — 가이드. 우연 노출 가능성 낮음

---

## 3. 재스캔 주기

- **주간**: 일요일 `case-curator` 가 daily-logs · interventions 만 빠른 스캔
- **분기**: `integration-specialist` 가 본 정책 갱신과 동시에 전체 재스캔
- **트리거 기반**: 새 폴더 / 새 에이전트 / 새 클라이언트 첫 진입 시점 (옵션)

---

## 4. 발견 시 절차 (반복)

미래 스캔에서 *실재 후보*가 발견되면:

1. 본 파일 §1 표에 *경로*만 추가 (한 줄 사유, 본문 인용 X)
2. 기영님 호출 — `interventions/{date}-private-domain-migration-proposal.md` 생성
3. 기영님 승인 후 *기영님이 직접* `git mv <경로> shared-memory/_private/<적절한 위치>/`
4. 옮긴 후 git history 의 흔적 처리는 별건 (BFG / filter-repo) — 본 정책 범위 밖

---

## 5. 변경 이력

| 일시 | 작업 | 작성자 |
|---|---|---|
| 2026-06-06 | 초안 + 첫 스캔(후보 0건) | integration-specialist (ALI-102) |

🛸
