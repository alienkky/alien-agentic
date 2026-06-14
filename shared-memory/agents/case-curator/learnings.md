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
