# data-strategist decisions.md

데이터 전략 에이전트가 내린 구조적 결정과 이유를 append한다.

---

### 2026-06-06 20:20 KST - OpenViking path-first classification

**결정**: OpenViking L0-L2 분류의 1차 기준은 파일 본문이 아니라 경로 정규식으로 둔다.

**대안**: 모든 markdown front matter를 먼저 열어 `layer` 값을 읽는 방식.

**선택 이유**: 현재 문제는 마크다운 폭증으로 인한 토큰 폭주다. 본문이나 front matter를 열기 전에 경로만으로 탐색 폭을 줄여야 S6 자동화와 에이전트 검색 비용이 안정된다.

**기각 이유**: front matter 우선 방식은 누락/오염된 파일을 찾으려면 결국 대량 파일 open이 필요하고, `_private`/raw 파일을 실수로 넓게 읽을 위험이 있다.

**되돌림 조건**: 파일 경로만으로는 10% 이상이 지속적으로 오분류되고, front matter 품질 검증 자동화가 먼저 안정화될 때.

### 2026-06-06 20:25 KST - index.md regenerated, log.md append-only

**결정**: `index.md`는 S6가 재생성 가능한 현재 상태 지도, `log.md`는 append-only 변경 이벤트 스트림으로 분리한다.

**대안**: 단일 `index.md` 안에 변경 이력까지 누적하는 방식.

**선택 이유**: 색인은 최신 탐색 속도를 위한 파일이고, 로그는 감사와 핸드오프를 위한 파일이다. 두 목적을 섞으면 색인이 계속 커져 첫 로딩 비용이 다시 증가한다.

**기각 이유**: 단일 파일 방식은 단순하지만, 장기적으로 모든 폴더의 `index.md`가 changelog가 되어 OpenViking의 검색 비용 절감 목적과 충돌한다.

**되돌림 조건**: 자동화 구현 후 `log.md` append가 운영 부담을 만들고, git history만으로 충분한 감사 추적이 검증될 때.
