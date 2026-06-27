# integration-specialist · decisions

> Append-only. 결정만. 토론·진행은 `work.md` 로.

---

## 2026-06-06 · ALI-102 · `_private/` 분리 정책 채택

### 결정

1. `shared-memory/_private/` 골격 생성. README.md 만 git 추적, 내부 다른 모든 파일은 `.gitignore` 격리.
2. `.gitignore` 패턴: `shared-memory/_private/*`, `**/_private/*` (디렉토리 패턴이 아닌 *내용물 패턴* — 자식 파일 negation 가능하도록).
3. 공개 정책 문서 `shared-memory/context/private-domain-policy.md` — 6 도메인 (가족·심리·연애·건강·법무·미공개 재정) 분리 기준 명시.
4. 후보 파일 `shared-memory/context/private-domain-candidates.md` — 첫 스캔 결과 *후보 0건*, watchlist 등록.
5. 에이전트 행동 강령 5 금지 (READ / WRITE / 외부 싱크 / 메타데이터 노출 / 클라이언트 산출물 오염) — 본 결정으로 채택. S5 (agent.md) 에 흡수 요청.

### 이유

- 헌법 §VIII "가족 시간 신성화" 는 *시간 경계*. 데이터 레이어가 빠지면 24시간 작동하는 AI 가 시간 경계를 뚫는다.
- 다섯 시대 중 4·5단계(AGI→인간 / AGI↔AGI) 에서 *무엇을 보지 않을지 정하는 자리*가 인프라가 된다. 첫 줄을 지금 박는다.
- 마음 십계 §4 *수심(守心)*, §7 *적정중생혜(寂靜衆生慧)* 의 데이터 표현.

### 핸드오프

- **S5 (agent.md)** → 본 5 금지 강령을 모든 에이전트 시스템 프롬프트에 박아넣기
- **S4 (PR pipeline)** → `_private/` 경로 변경 PR 은 자동 거부 룰 추가
- **`brand-keeper`** → 본 정책 문서 톤 검수 요청 (분기 갱신 시점에)
- **`data-strategist`** → 외부 싱크 대상에서 `_private/` 제외 검증

### 위반 시 행동

- 본인 위반 발견 → `mistakes.md` 즉시 기록 + 기영님 호출
- 동료 위반 발견 → `messages/` 에 알림 + 기영님 호출. 동료 단독 처벌 X (개선이 처벌보다 비싸지 않다)

---
