# integration-specialist · learnings.md

이 에이전트가 *발견한 새 패턴/통찰*을 호출별로 append.

### 2026-06-05 09:00 · alien-speech 통합 설계
- Alien Plan 의 *모든* 영속 상태는 1개 Multica 이슈 description JSON 에 산다 (`alien-plan-page.tsx:65` 의 `STATE_ISSUE_TITLE`). 외부 시스템 통합 시 *이 한 이슈의 description 만 read-modify-write* 하면 끝. 추가 테이블·웹훅 불필요. → 외부 IoT 가 Multica 와 연결되는 가장 가벼운 패턴.
- 기존 `automation/cli/aa/voice.py` 는 *마이크 직접 입력 → STT* 용. 브릿지의 *WAV 파일 → STT* 와 시그니처가 달라 그대로 재사용하지 못함. 단, faster-whisper 모델 캐시(`~/.cache/huggingface`)는 공유 가능 → 폴백 호환.
- 외부 IoT (ESP32) 가 Tailscale 클라이언트 없을 때, *브릿지 = LAN 0.0.0.0 listen + 토큰 인증* 패턴이 가장 깔끔. Tailscale 은 운영자 채널로만.
- ETag 없는 REST 에서 동시 쓰기 안전은 *본문 자체에 idempotency marker 박기* + 짧은 backoff 재시도로 충분. UI debounce 1.5s 와도 1초 미만 윈도우만 위험.
