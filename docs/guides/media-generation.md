# 미디어 생성 가이드 — 이미지·동영상을 `aa` 에 붙이기

> 목적: `aa call` 이 *이미지 생성* 요청을 알아채 ChatGPT(Codex) 또는 Gemini 로 넘기고,
> *동영상* 요청은 — 깔끔한 무(無)-API-키 CLI 경로가 아직 없으므로 — 자동 생성 대신 안내한다.

`aa call` 은 매 호출마다 **모달리티**(text / image / video)를 로컬 키워드로 판정한다. 텍스트는 [난이도 라우터](../../automation/cli/README.md)가, 이미지·동영상은 이 문서가 다룬다.

---

## 한눈에 — 무엇이 되고 무엇이 안 되나

| 모달리티 | 공급자 | API 키 | 상태 |
|---|---|---|---|
| **이미지** | ChatGPT(Codex `$imagegen`) | ❌ 불필요 | ✅ 바로 사용 — *권장* |
| **이미지** | Gemini CLI | ⚠️ **필요** (`GEMINI_API_KEY`) | ✅ 사용 가능, 단 API 키 |
| **동영상** | — | — | ⏸ 보류 — 자동 생성 안 함, 안내만 |

핵심: **이미지는 Codex 로 가면 API 키 없이 ChatGPT Pro 구독만으로 끝난다.** Gemini 이미지·모든 동영상은 사정이 다르다 (아래 참조).

---

## 1. 이미지 — ChatGPT(Codex `$imagegen`) · 권장

별도 설치가 **없다.** [Codex CLI 셋업](codex-cli-setup.md)만 끝나 있으면 이미지 생성이 딸려온다. Codex CLI 에는 `$imagegen` 스킬이 내장돼 있고, `gpt-image-2` 모델로 아이콘·배너·일러스트·목업을 만든다 — **ChatGPT Pro 구독 사용량으로, API 키 없이.**

```bash
# 자동 감지 — "로고", "배너", "이미지 만들" 같은 키워드를 보면 이미지로 라우팅
aa call content-scout "쓰레드 게시물용 외계인 로고 이미지 만들어줘"

# 모달리티 강제
aa call ui-ux-designer "대시보드 히어로 일러스트" --modality image
```

`aa` 는 내부적으로 Codex 에 `$imagegen` 프롬프트를 넘기고, 생성된 이미지를 작업 폴더에 저장하도록 지시한다. 응답 패널에 저장 경로가 표시된다.

---

## 2. 이미지 — Gemini CLI · ⚠️ API 키 필요

Gemini 도 이미지 생성을 하지만 (`gemini-2.5-flash-image` 등), **구독 로그인(`gemini login`)만으로는 이미지 생성이 풀리지 않는다.** Gemini CLI 의 무료/Pro 로그인은 텍스트·코딩 에이전트 기능만 열어주고, 이미지 생성은 **`GEMINI_API_KEY`** 또는 Vertex AI 프로젝트 인증을 거쳐야 한다.

> 이 부분은 우리의 "API 키 없이 구독으로" 원칙과 어긋난다. **무-API-키로 가려면 위 1번(Codex)을 쓰면 된다.** Gemini 는 *선택지로만* 열어둔다.

### 설치

```powershell
npm install -g @google/gemini-cli
gemini   # 첫 실행 시 Google 계정 로그인 (텍스트 기능용)
```

### API 키 발급 + .env 등록

1. https://aistudio.google.com/apikey 에서 API 키 발급 (무료 tier 존재)
2. `automation/cli/.env` 에 추가 — **git 추적 금지** (`.env` 는 `.gitignore` 처리됨):

```
GEMINI_API_KEY=AIza...여기에_발급받은_키
GEMINI_IMAGE_MODEL=gemini-2.5-flash-image
```

`GEMINI_IMAGE_MODEL` 은 비워두면 Gemini CLI 기본값을 쓴다.

### 사용

```bash
aa call content-scout "링크드인 배너 이미지" --provider gemini
```

`GEMINI_API_KEY` 가 `.env` 에 없으면 `aa` 는 호출을 막고 Codex 로 가도록 안내한다.

---

## 3. 동영상 — ⏸ 현재 보류

동영상 생성은 **API 키 없이 구독만으로 굴러가는 CLI 경로가 현재 없다.**

- **Codex CLI** 는 동영상을 만들지 못한다.
- **Gemini** 는 Veo 로 동영상을 만들지만, Gemini CLI 에서 쓰려면 `gcloud` + Vertex AI 프로젝트 인증이 필요하다 — 사실상 API/프로젝트 기반.

그래서 `aa call` 은 동영상 요청("동영상", "비디오", "영상 만들" 등 키워드)을 감지하면 **자동 생성하지 않고 안내 패널만 띄운다.** 지금 동영상이 필요하면:

> **Gemini 앱 웹 UI** → https://gemini.google.com → Veo 동영상 생성

향후 Gemini + Vertex AI 셋업 방침이 정해지면 `aa` 자동화 대상에 넣을 예정이다.

---

## 모달리티 감지 — 키워드 자동 + 수동 오버라이드

`router.py` 가 프롬프트를 로컬 키워드로 본다 (토큰 0):

- **이미지 키워드**: 로고, 배너, 썸네일, 일러스트, 삽화, 포스터, 목업, 그려줘, 이미지 생성/만들, 그림 생성/그려, 아이콘 만들 …
- **동영상 키워드**: 동영상, 비디오, 영상 생성/만들, 모션 그래픽, 애니메이션 만들 …
- 둘 다 안 걸리면 **text** → 난이도 라우터로

오판이 나면 `--modality text|image|video` 로 덮어쓴다. 공급자도 `--provider chatgpt|gemini` 로 강제할 수 있다 (이미지에서 `--provider claude` 는 이미지 생성 불가라 자동으로 chatgpt 로 대체된다).

---

## 트러블슈팅

| 증상 | 해결 |
|---|---|
| 이미지 요청인데 text 로 라우팅됨 | 키워드 미포함. `--modality image` 로 강제하거나 프롬프트에 "이미지 만들어줘" 추가 |
| `gemini CLI 를 찾지 못했습니다` | `npm install -g @google/gemini-cli` 후 PowerShell 재시작. 안 되면 `.env` 에 `GEMINI_BIN=절대경로` |
| `GEMINI_API_KEY 가 .env 에 없습니다` | 위 2번 참조 — 키 발급 후 `.env` 등록. 또는 `--provider chatgpt` 로 Codex 사용 |
| Codex 이미지가 저장 안 됨 | `codex exec "$imagegen 테스트 이미지"` 직접 실행해서 작동 확인 |
| 동영상을 자동 생성하고 싶음 | 현재 미지원 — 위 3번. 웹 UI 사용 또는 Vertex 셋업 방침 결정 필요 |

---

## 다음 자리 (Phase 2)

- 동영상 — Gemini + Vertex AI 셋업 방침 확정 시 `aa video` 명령으로 자동화
- 이미지 생성 결과(저장 경로·해상도)를 에이전트 메모리 `work.md` 에 구조화 누적
- `finance-tracker` 가 이미지 생성 호출 수를 ChatGPT Pro 사용량과 함께 추적
