# ComfyUI 연동 가이드 — 4090 로컬 GPU 로 이미지·동영상

> 목적: 4090 PC에 이미 떠 있는 ComfyUI 를 `aa` 시스템의 **세 번째 공급자** 로 연결한다. 이미지는 Codex 와 양자택일, **동영상은 ComfyUI 단독 경로**.

## 한눈에

| 모달리티 | 공급자 | API 키 | 비용 |
|---|---|---|---|
| 이미지 | `chatgpt` (Codex `$imagegen`, 기본) | ❌ | ChatGPT Pro 구독 |
| 이미지 | `comfyui` (`--provider comfyui`) | ❌ | 4090 전기료만 |
| **동영상** | `comfyui` (단독) | ❌ | 4090 전기료만 |
| 텍스트 | claude / chatgpt | ❌ | 구독 |

ComfyUI 는 자체가 HTTP API 서버(`http://localhost:8188`) 라 별도 CLI 가 필요 없다. `aa` 가 직접 POST 한다.

## 사전 조건 (4090 PC)

1. **ComfyUI 가 실행 중** — 기영님은 이미 깔려 있다고 하셨음. 보통:
   ```powershell
   # ComfyUI 폴더에서
   python main.py
   ```
   → http://localhost:8188 접속 가능해야 함
2. **하나 이상의 워크플로가 정상 작동** — 모델 다운로드 + 노드 그래프 구성이 끝나고, ComfyUI UI 에서 *수동으로* 한 번 결과가 나와야 함
3. **포트 충돌이 있으면** `.env` 에 `COMFYUI_URL=http://localhost:XXXX` 박기

## 워크플로 템플릿 만들기 (필수, 한 번)

`aa` 는 워크플로 JSON 안의 `{PROMPT}` 자리에 매번 다른 프롬프트를 치환한다. 그래서 **API 포맷 JSON + `{PROMPT}` 약속** 만 지키면 어떤 모델·노드 그래프도 사용 가능.

### 만드는 법

1. ComfyUI UI 에서 원하는 workflow 구성 (예: Flux text-to-image)
2. 한 번 돌려서 결과 확인
3. 메뉴 → **Save (API Format)** → JSON 다운로드
4. 텍스트 에디터로 열어 프롬프트 텍스트(예: `"a cat in space"`)를 `"{PROMPT}"` 로 교체
5. 다음 위치에 저장:
   - 이미지: `automation/cli/aa/comfyui_workflows/text-to-image.json`
   - 동영상: `automation/cli/aa/comfyui_workflows/text-to-video.json`

## 사용

### 이미지 — `comfyui` 강제 (Codex 대신)
```bash
aa call ui-ux-designer "사이버펑크 도시 야경, 35mm 영화 톤" --provider comfyui
```
키워드 자동 감지로 이미지 모달리티 → `--provider comfyui` 로 Codex 대신 ComfyUI.

### 동영상 — 자동으로 ComfyUI
```bash
aa call content-scout "외계인 동료가 손 흔드는 짧은 영상 3초"
```
"영상" 키워드 → modality=video → 자동으로 ComfyUI 라우팅 (다른 공급자 없음).

### 다른 워크플로 쓰기 — `--workflow`
같은 모달리티에 모델·해상도가 다른 여러 워크플로를 둬도 됨:
```bash
aa call ui-ux-designer "..." --provider comfyui --workflow flux-dev-1024
aa call ui-ux-designer "..." --provider comfyui --workflow sdxl-lightning
```

## 결과 파일 위치

- 클라이언트 작업 (`-c <client>` 지정) → `clients/<client>/WHAT/{images,videos}/`
- 자체용 (`_self`) → `content/{images,videos}/`

`aa` 응답 패널에 정확한 저장 경로가 표시된다. 사용량 로그(`shared-memory/usage/<date>.jsonl`) 에는 `cli: "comfyui"`, `modality: "video"` 등으로 자동 누적 — `aa usage --by cli` 표에 잡힘.

## 27명 외계 동료의 자율 호출 (Multica 데몬 경로)

Multica 데몬이 에이전트를 실행할 때 CLAUDE.md §8.7 을 자동 상속한다. 거기에 ComfyUI 능력이 명시돼 있으므로 — 이미지·동영상이 필요한 작업을 받으면 에이전트가 다음 중 하나를 자율로 선택:

- **빠른 이미지**: Bash 로 `codex exec "$imagegen ..."` (구독 토큰)
- **고품질 이미지·동영상**: Bash 로 `aa call <self> "..." --provider comfyui` 또는 `--modality video` (로컬 GPU)

상황에 맞게 자율 선택. 별도 에이전트 정의 변경 없이.

## 트러블슈팅

| 증상 | 해결 |
|---|---|
| `ComfyUI 가 응답하지 않습니다` | http://localhost:8188 가 브라우저에서 열리는지 먼저 확인. 다른 포트라면 `.env` 에 `COMFYUI_URL` |
| `워크플로 템플릿 없음` | `comfyui_workflows/text-to-image.json` (또는 video) 가 있는지 확인. 위 "워크플로 템플릿 만들기" 참조 |
| 동영상이 timeout | `.env` 에 `COMFYUI_OUTPUT_TIMEOUT=1800` 같이 늘리기 (초 단위, 기본 600) |
| 출력 파일이 없다고 함 | ComfyUI UI 에서 같은 워크플로를 수동으로 한 번 더 돌려서 모델·VRAM 문제 없는지 확인 |
| JSON 파싱 실패 | 프롬프트에 백슬래시·줄바꿈이 너무 많을 때. 단순한 텍스트로 시도 |

## 모델 추천 (4090 24GB)

- **이미지 (빠름)**: SDXL Lightning, Flux schnell
- **이미지 (퀄리티)**: Flux dev, SD 3.5
- **동영상 (짧음)**: LTX Video (2-5초), Mochi 1 (저해상도)
- **동영상 (퀄리티)**: Hunyuan Video, Wan 2.1 (분 단위 소요)

각 모델의 ComfyUI 워크플로 예제는 [ComfyUI examples](https://github.com/comfyanonymous/ComfyUI_examples) 에 풍부함.

## 다음 자리 (Phase 2 이후)

- 워크플로 선택을 라우터가 자동화 (프롬프트 길이/도메인으로 빠른 vs 퀄리티 자동 선택)
- 큐잉 진행률을 `aa` 콘솔에 실시간 표시 (WebSocket)
- 결과를 클라이언트 메모리(`shared-memory/agents/<name>/work.md`)에 썸네일까지 포함
