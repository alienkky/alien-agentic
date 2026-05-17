# ComfyUI 워크플로 템플릿 자리

> `aa call ... --provider comfyui` 또는 `--modality video` 호출 시 여기에 있는 JSON 워크플로를 읽어 4090 PC의 ComfyUI 서버에 큐잉한다.

## 형식 — 두 가지 약속만

1. **API 포맷 JSON** — ComfyUI UI 에서 워크플로를 **Save (API Format)** 으로 내보낸 결과 그대로.
2. **프롬프트 자리 = `{PROMPT}`** — 워크플로 안 CLIPTextEncode 노드 등의 텍스트 필드에서, *사용자가 매번 바꿀 프롬프트* 자리를 `{PROMPT}` 로 바꿔 저장한다. `aa` 가 호출할 때마다 그 자리에 실제 프롬프트를 안전하게 (`json.dumps` 이스케이프) 치환한다.

## 권장 파일명 (디폴트 라우팅)

| 모달리티 | 파일명 | `aa` 가 자동으로 찾음 |
|---|---|---|
| 이미지 | `text-to-image.json` | `aa call ... --provider comfyui` |
| 동영상 | `text-to-video.json` | `aa call ... --modality video` (자동 라우팅) |

다른 이름의 워크플로는 `--workflow <파일명-확장자제외>` 로 지정. 예:
```bash
aa call ui-ux-designer "사이버펑크 도시" --provider comfyui --workflow sdxl-cinematic
```

## 워크플로 만드는 법

1. ComfyUI UI (http://localhost:8188) 에서 원하는 workflow 를 구성
2. 한 번 실행해서 실제로 결과가 나오는지 확인
3. 메뉴 **Save (API Format)** → JSON 파일 다운로드
4. 텍스트 에디터로 열어 프롬프트 텍스트(예: `"사이버펑크 도시"`)를 `"{PROMPT}"` 로 교체
5. 이 폴더(`comfyui_workflows/`)에 위 권장 파일명으로 저장

## 추천 워크플로 (4090 환경)

- **이미지**: Flux dev/schnell, SDXL Lightning, SD3.5
- **동영상**: Hunyuan Video, LTX Video, Wan 2.1, Mochi 1, CogVideoX-5B
  - 4090 24GB VRAM → Hunyuan / LTX / Wan 다 돌아감 (해상도·길이는 워크플로에서 조정)

## 모델·LoRA·해상도 변경은?

워크플로 JSON 안에서 직접 — 노드의 `inputs` 값을 바꾸면 된다. `aa` 는 `{PROMPT}` 자리만 치환하고 나머지는 그대로 큐잉한다. 워크플로별로 다른 모델·세팅 → 다른 파일명으로 저장해 `--workflow` 로 선택.

## 트러블슈팅

| 증상 | 해결 |
|---|---|
| `워크플로 템플릿 없음` | 위 권장 파일명으로 저장됐는지 확인 |
| `워크플로 JSON 파싱 실패` | `{PROMPT}` 치환 후 JSON 깨짐 — 프롬프트에 백슬래시·이스케이프 문자가 너무 많을 때. 단순화 |
| `ComfyUI 가 응답하지 않습니다` | 4090 PC 에서 ComfyUI 가 떠 있는지(`http://localhost:8188`), 포트가 다르면 `.env` 에 `COMFYUI_URL` 박기 |
| 큐잉은 됐는데 출력 파일 없음 | ComfyUI UI 에서 같은 워크플로를 *수동으로* 한 번 돌려 보세요. 모델 로드 실패 / VRAM 부족 등 ComfyUI 측 에러일 가능성 |
| 동영상이 너무 오래 걸려 timeout | `.env` 에 `COMFYUI_OUTPUT_TIMEOUT=1800` (30분 등) 박기 — 기본 600초 |

## 보안 / 권리

- 결과 파일은 `clients/<client>/WHAT/{images,videos}/` 또는 `content/{images,videos}/` 에 자동 저장
- 사용 모델의 라이선스(상업 사용 가능 여부) 는 워크플로 작성 시 직접 확인
