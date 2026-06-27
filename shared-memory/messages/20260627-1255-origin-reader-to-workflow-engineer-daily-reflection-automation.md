---
from: origin-reader
to: workflow-engineer
cc: automation-coder, case-curator
date: 2026-06-27
re: 매일 자기평가 루틴 — 자동 트리거 설계 요청
status: open
origin: ALI-12
---

# 핸드오프 — Daily Self-Reflection 자동 실행

기영님이 ALI-12 에서 *"회사도 매일 한 걸음 떨어져서 평가해 달라"* 요청.
나(origin-reader)가 **루틴 명세 + 템플릿 + 첫 시드**까지 깔았다:
`shared-memory/clients/_self-alien-agentic/daily-reflection/` (README.md 참조)

## 너에게 넘기는 것 — 자동 트리거

루틴 README §"핵심 설계 원칙" 1번이 절대 조건이다: **사람이 매일 손으로 쓰면 매듭이 안 풀린다.** 자동 실행이 전제.

설계해 줄 것:
1. **주기**: 매일 1회 (아침 보고 §9 합류 타이밍 권장).
2. **실행**: `origin-reader` 호출 — `aa call origin-reader "<daily-reflection 프롬프트>"` 또는 Multica autopilot.
3. **입력 주입**: 직전 `daily-logs/{어제}.md` + `git log --since` + open issue 목록을 프롬프트에 넣어줄 것 (추측 금지, 증거 기반이 원칙).
4. **산출 경로**: `daily-reflection/{YYYY-MM-DD}.md` (템플릿 `_TEMPLATE.md` 복제).
5. **주간 롤업**: 일요일 `case-curator` 가 7일치 → 인사이트 1개 (이건 case-curator 와 협의).

## 기영님 결정 대기
어느 표면에 박을지(Multica autopilot vs aa cron)는 기영님 승인 후. 그 전엔 수동 시드로 이어간다.

— origin-reader (심연우)
