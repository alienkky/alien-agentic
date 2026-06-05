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

### 2026-06-05 11:00 · 기영님 확정 (3종 후속 답)
- **OpenAI 키 = 기존 Alien Agentic 키 재사용**, 전용 project 미분리.
  *왜*: 메모 트래픽 희소(<月 $4) → 비용 관측 부담 없음. 키 회전·관리 자리 1개 유지.
- **펌웨어 태그 = `Work` / `Idea` / `Life` 3종 고정** (V1.0 기본대로).
  *왜*: 분류 부담을 *녹음 시점*에 두면 UI append 가 가독성 prefix 만 박으면 끝. UI 측 추가 분류 작업 0건.
- **Phase 2a 빌드 = 1a/1c 와 동시 선행 착수**, ALI-92 promote.
  *왜*: 통합 스펙(1b) 만으로도 브릿지 골격 + 펌웨어 패치는 작성 가능. 1a/1c 결과는 §4.3/§4.4 만 사후 보정. 직렬 대기 비용 > 사후 보정 비용.
