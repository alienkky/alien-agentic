# shared-memory/

Alien Agentic의 공유 메모리. 모든 에이전트와 세션이 이 폴더를 통해서만 협업한다. **에이전트 간 직접 통신 금지.**

## 폴더 구조

| 폴더 | 용도 |
|---|---|
| `daily-logs/` | 매일 일지. 파일명 `YYYY-MM-DD.md`. 매일 저녁 마스터 오케스트레이터가 자동 업데이트. |
| `clients/{client-name}/` | 클라이언트별 진단·산출물의 *익명화 메타 사본*. 실제 작업물은 루트의 `clients/`. |
| `clients/_self-*` | 자기 자신을 진단한 케이스(Alien Agentic 자체 진단 등). 외부 클라이언트와 구별하기 위해 언더스코어 prefix. |
| `meta/` | 회사 자체 메타 데이터 — 의사결정 / 실패 케이스 / 호출 통계. 1년 후의 진입장벽. |
| `insights/` | 주간·월간 인사이트 + 기술 사고 케이스 스터디. `case-curator`가 매주 일요일 작성. 파일명: `weekly-{YYYY-Www}.md` (주간) / `{YYYY-MM-DD}-{slug}.md` (케이스). |
| `agents/` | 27명 각자의 4파일 메모리 (work / learnings / decisions / mistakes) — 호출 종료 시 자동 append |
| `messages/` | 에이전트 간 대화 — *직접 통신 X*, 모두 이 폴더 경유 |
| `tasks/` | 진행 중 업무 목록 (Kanban 패턴, `_backlog/_in-progress/_done/_blocked.md` 인덱스) |
| `interventions/` | 기영님의 중간 개입 — 다음 세션 시작 시 *최우선* 처리 |
| `dashboard.md` | 오늘의 한 줄 + 진행 클라이언트 + 이번 주 KPI + 위험 깃발 |

## 원칙
1. **모든 에이전트 협업은 이 폴더 경유.** 직접 호출 결과는 여기에 산출물로 떨어진다.
2. **익명화 의무.** 외부 클라이언트 진단은 `clients/{client-name}/` 아래 익명화된 메타 사본으로 보관. 식별 정보 분리.
3. **실패 케이스 보존.** `meta/failures/`에 실패와 그 이유를 누적. 가장 비싼 자산.
4. **로그는 끝까지 지우지 않는다.** 회사의 진화 화석.
5. **GitHub Private Repo 백업.** 일요일마다 백업 상태 점검.
