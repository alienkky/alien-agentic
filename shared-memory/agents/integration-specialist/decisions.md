# integration-specialist · decisions.md

이 에이전트가 *내린 결정*과 *이유*를 호출별로 append.

### 2026-06-05 09:00 · alien-speech 통합 설계
- **STT primary = OpenAI Whisper API**, fallback = faster-whisper large-v3 로컬.
  *왜*: 메모 트래픽 희소(<月 $4) + 4090 VRAM 이 ComfyUI 와 경합 → API 가 지연·가용성·코드 모두 우위.
- **GPT 구조화 호출 = MVP 0건**.
  *왜*: 펌웨어 `tag` 헤더가 이미 분류 역할. Phase 1c 가 task 승격을 선택하면 v2 에서만 `gpt-4o-mini` 호출.
- **펌웨어 키 = OpenAI 키 제거, 브릿지 토큰 1개만**.
  *왜*: 헌법 §7 보안 — 평문 키 노출 금지. 브릿지가 단일 키 보관 자리.
- **펌웨어 통신 경로 = 가정 LAN 직접, Tailscale 미사용**.
  *왜*: ESP32-S3 가 Tailscale 클라이언트 미지원. 토큰 인증으로 LAN 내부 보안 충분.
- **Multica 쓰기 = 낙관적 read-modify-write 3회 재시도 + marker 기반 중복 검출**.
  *왜*: Multica REST 가 If-Match/ETag 미보장. UI debounce 1.5s 와의 충돌은 0.3/0.6/0.9s backoff 로 거의 모두 회수. 마지막 안전망은 description 본문 marker.
- **`transcribeOnce` 는 rename(`uploadToBridge`)로 교체**, 신규 함수 추가 아님.
  *왜*: Whisper 직접 호출은 더 이상 어떤 경로에서도 사용 안 함 → dead code 잔존 방지.
