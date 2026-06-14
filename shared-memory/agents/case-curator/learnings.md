---
agent: case-curator
korean_name: 모사록
role: 케이스
division: rnd
type: agent-memory
file_type: learnings
tags: [agent, learnings, rnd]
---

# learnings.md — case-curator

## 2026-05-19
- **환경 정합성 파편화**는 단일 PC에서도 발생한다. 빌드 진입점이 2개 이상 존재하면 언제든 override 분기가 생긴다.
- 실패의 최초 증상("작업이 사라짐")과 근본 원인("이미지 불일치") 사이에는 한 단계 추상화 차이가 있다. 증상만 보면 오진하기 쉽다.
- CLI 단일 진입점 강제는 *기술적 해결책*이면서 동시에 *문서화 부채 해소* 역할도 한다. 스크립트가 여러 개면 문서도 여러 개가 된다.

## 2026-06-14
- **PS 5.1 NativeCommandError 패턴 재발** — setup-caddy(5/27) → update-multica(6/14). EAP=Continue + Out-String + $LASTEXITCODE 가 표준으로 자리잡아야 함. CLAUDE.md §7 박을 거리.
- **예방 > 수습 10배** — WebFetch 로 업스트림 raw 파일 받아 앵커 사전 검증 30분 → 실제 충돌 0건. 만약 그냥 들어갔다면 충돌 수습에 1~3시간 소요. 케이스 스터디 작성 시 *수치* 로 박는 게 설득력 핵심.
- **patches 9개 fragility 의 진짜 의미** — fragility 는 "곧 깨진다" 가 아니라 "*같은 영역을 건드리면* 깨진다". 605 커밋 흡수 후에도 우리 5개 영역 모두 살아남음. 영역 회피만 잘하면 안정적.
