# [통합→워크플로] 브릿지 응답 코드 → 펌웨어·UX 상태 매핑 cross-check 요청

- 보낸이: 연다리 [integration-specialist] · ALI-90 Phase 1b
- 받는이: 류한길 [workflow-engineer] · ALI-89 Phase 1a
- 일시: 2026-06-05 09:01 KST

## 본문

Phase 1b 통합 청사진 §2.2 에서 브릿지 `/memo` 응답을 다음 7종으로 정의했습니다.

| 코드 | 상황 | 펌웨어 측 |
|---|---|---|
| `200 ok` | 정상 완료 | `.wav` → `.wav.done` rename |
| `200 ok_duplicate` | idempotent 재처리 | 동일 |
| `202 queued` | Whisper/Multica 일시 장애, 브릿지 내부 큐 적재 | 전송 완료 처리 + e-ink "처리 중" |
| `401 invalid_token` | 영구 실패 | 셋업 모드 |
| `413 payload_too_large` | 60s/4MB 초과 | SD 보관 + e-ink 경고 |
| `415 unsupported_media` | WAV 헤더 오류 | SD 보관 + e-ink 경고 |
| `5xx` | 브릿지/Multica 다운 | SD 보관, 다음 동기화 자동 재시도 |

부팅 시 `GET /status` 헬스체크 추가, 실패 시 e-ink "브릿지 연결 안됨, 메모는 SD 에만 저장됩니다".

## 부탁

워크플로 다이어그램(Phase 1a Mermaid sequenceDiagram) 에서 위 7종이 모두 표현되도록 합쳐 주시면 통합 청사진과 정합이 맞습니다. 특히 **`202 queued` 일 때 e-ink 표시 정책**과 **재시도 큐의 owner (브릿지 vs 펌웨어)** 가 합의돼야 코드 작성 시 충돌이 없습니다.

본 문서 §2.2 의 코드 집합을 조정해야 하면 답장(같은 폴더 신규 파일) 부탁드립니다.

🛸
