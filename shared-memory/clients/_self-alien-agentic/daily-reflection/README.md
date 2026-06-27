---
type: Daily Self-Reflection — 루틴 명세
client: Alien Agentic 자체
owner: origin-reader (설계) · workflow-engineer (자동화 트리거)
created: 2026-06-27
origin: ALI-12 — 기영님 "우리 회사도 매일 한 걸음 떨어져서 평가해 달라"
lens: WHY/origin-diagnosis-4layer.md (층 4 검증됨 2026-06-27)
---

# 매일 자기평가 — 외계인의 하루 (Daily Self-Reflection)

> 4층 진단서의 **매듭**을 푸는 루틴이다.
> 매듭: *"다른 회사의 자기 진단은 돕지만, 자기 회사를 매일 떨어져서 보는 루틴은 안 박혀 있다. 한 명이 27명을 굴리는 구조 자체가 자기 시선을 빠뜨린다."*
> 2026-06-27 기영님이 이 매듭을 "맞다"로 확정하고 해소를 요청 → 이 루틴이 그 해소책.

## 핵심 설계 원칙 (절대)

1. **사람이 매일 쓰는 게 아니다.** 기영님이 매일 손으로 쓰면 매듭이 안 풀린다 — 단일 장애점이 *그 사람*에서 *그 사람의 매일 시간*으로 이동할 뿐. 그래서 **자동 실행**이 전제다 (항복자심: 단일 장애점은 외부가 아니라 우리 자신).
2. **짧다.** 4칸, 각 1~3줄. 길면 안 돌아간다 (당하즉시).
3. **판단이 아니라 시선.** origin-reader 의 절대 금지대로 — 평가가 아니라 *"한 걸음 떨어진 시선"* 을 빌려준다. 질문은 던지되 답은 강요하지 않는다.
4. **증거 기반.** 추측 금지. 어제 daily-log + 최근 git 커밋 + open issue 에서 실제 단서를 끌어온다.

## 무엇을 보는가 (4칸)

| 칸 | 본다 | 출처 단서 |
|---|---|---|
| 1. 말과 행동의 어긋남 | 회사가 "이런 회사다"라 말한 것 vs 실제로 한 일 사이 어긋남 1개 | 헌법/소개 문구 ↔ daily-log·커밋 |
| 2. 매듭 신호 | 층 4 매듭("자기 시선 빠뜨림")이 오늘 드러난 자리. 없으면 "신호 없음" | open issue·미머지 브랜치·정체된 결정 |
| 3. 한 걸음 떨어진 질문 | 외계인이 오늘 회사에 던지는 질문 1개. *답은 안 단다.* | 위 1·2 의 종합 |
| 4. 깃발 (있을 때만) | 위험/주의 신호 — CLAUDE.md §5 자동 보호 트리거와 연결 | 토큰·매출집중·과로·머지지연 등 |

## 어떻게 도는가

- **주기**: 매일 1회 (아침 보고 루틴 §9 에 합류).
- **실행 주체**: `origin-reader` 자동 호출 (`aa call origin-reader "daily self-reflection"` 또는 Multica 예약/autopilot).
- **입력**: 직전 `daily-logs/{어제}.md` + `git log --since=어제` + open issue 목록.
- **산출**: `daily-reflection/{YYYY-MM-DD}.md` (템플릿 `_TEMPLATE.md` 복제).
- **주간 롤업**: 매주 일요일 `case-curator` 가 7일치를 1개 인사이트로 압축 → `shared-memory/insights/`.
- **가설 보정**: 칸이 틀리면 기영님 1줄 → `shared-memory/meta/origin-reader-corrections/` 누적 (이게 origin-reader 진화 데이터).

## 자동화 상태 (2026-06-27)

- ✅ 루틴 명세 + 템플릿 + 첫 시드(2026-06-27) — origin-reader.
- ⏳ **예약 트리거(매일 자동 실행)는 미구현.** 기영님 승인 후 `workflow-engineer`/`automation-coder` 가 Multica autopilot 또는 aa cron 으로 박는다. 핸드오프: `shared-memory/messages/` 참조.
- 그 전까지는 호출 시 수동 생성으로 시드를 이어간다.
