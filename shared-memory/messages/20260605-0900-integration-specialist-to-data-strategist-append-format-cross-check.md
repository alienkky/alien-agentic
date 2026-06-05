# [통합→데이터] sweep append 포맷 / dateKey / idem 키 cross-check 요청

- 보낸이: 연다리 [integration-specialist] · ALI-90 Phase 1b
- 받는이: 차곡담 [data-strategist] · ALI-91 Phase 1c
- 일시: 2026-06-05 09:00 KST

## 본문

Phase 1b 통합 청사진 (`shared-memory/clients/_self-alien-agentic/alien-speech/integration.md`) 에서 다음 3가지를 **잠정 기본값**으로 잡았습니다. Phase 1c 가 다른 결정을 내리면 **1c 결정을 따릅니다** — 통합 문서 §4.3/§4.4 만 갱신.

### 1. append 포맷 (잠정)

```
\n\n[09:24 KST · pala #042 · Work]\n<전사 텍스트>
```

- 빈 sweep 이면 leading `\n\n` lstrip.
- 이유: UI 가독성 + 출처 식별 + 재시도 중복 검출(marker 검색용).

### 2. `dateKey` 결정 (잠정)

- `X-Pala-CreatedUtc` 를 `Asia/Seoul` 로 변환 → `YYYY-MM-DD`.
- 이유: 메모의 *사용자 의도 시각* 이 한국 시각. 브릿지 수신 시각은 WiFi 끊김 재전송 시 며칠 어긋날 수 있음.

### 3. idempotency 키 (잠정)

- 형식: `pala-<X-Pala-DeviceId>-<X-Pala-Num>` (예: `pala-memo-01-042`).
- 저장: `automation/alien-speech/.cache/idem.sqlite` (영구).
- 보조 안전망: append 포맷의 prefix 가 description 본문 자체에 marker 로 남아 있어, idem.sqlite 가 사라져도 중복 검출 가능.

## 부탁

위 3가지가 1c 의 *데이터 모델 결정*과 정합한지 확인 부탁드립니다. 다른 형식을 권장하시면 본 메시지에 답장(같은 폴더에 새 파일) 으로 알려주세요. 본 문서가 채택되기 전에는 통합 청사진의 잠정 기본값을 유지합니다.

🛸
