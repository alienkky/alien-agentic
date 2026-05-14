# 이미지 생성 가이드 — `aa` 직원들이 이미지를 도출하게

> 목적: `aa call` 이 *이미지 생성* 요청을 알아채 Codex CLI 의 내장 이미지 생성(`$imagegen`)으로
> 넘긴다. 27명 외계 동료 누구든 — content-scout, ui-ux-designer 등 — 이미지를 도출할 수 있다.

`aa call` 은 매 호출마다 **모달리티**(text / image)를 로컬 키워드로 판정한다. 텍스트는 [난이도 라우터](../../automation/cli/README.md)가, 이미지는 이 문서가 다룬다.

---

## 한눈에

| 모달리티 | 공급자 | API 키 | 상태 |
|---|---|---|---|
| **이미지** | ChatGPT(Codex `$imagegen`, gpt-image-2) | ❌ 불필요 | ✅ 바로 사용 |
| **텍스트** | Claude / ChatGPT (난이도 라우터) | ❌ 불필요 | ✅ |

핵심: **이미지는 별도 도구·API 키 없이, ChatGPT Pro 구독만으로 끝난다.** 동영상은 깔끔한 무(無)-API-키 CLI 경로가 없어 `aa` 범위에서 제외했다.

---

## 사전 조건 — Codex CLI 하나면 끝

별도 설치가 **없다.** [Codex CLI 셋업](codex-cli-setup.md)이 끝나 있으면 이미지 생성이 딸려온다. Codex CLI 에는 `$imagegen` 스킬이 내장돼 있고, `gpt-image-2` 모델로 아이콘·배너·일러스트·목업을 만든다 — ChatGPT Pro 구독 사용량으로, API 키 없이.

확인:

```powershell
codex exec "$imagegen 간단한 테스트 아이콘 하나"
```

이미지가 생성·저장되면 연동 성공.

---

## 사용 — 키워드 자동 감지 + 수동 오버라이드

`aa` 는 프롬프트를 로컬 키워드로 본다 (토큰 0). 이미지 의도가 보이면 자동으로 Codex `$imagegen` 으로 라우팅한다.

```bash
# 자동 감지 — "로고", "배너", "이미지 만들" 같은 키워드를 보면 이미지로 라우팅
aa call content-scout "쓰레드 게시물용 외계인 로고 이미지 만들어줘"

# 모달리티 강제 — 키워드가 안 걸릴 때
aa call ui-ux-designer "대시보드 히어로 일러스트" --modality image

# 라우팅 미리보기 (생성 안 함)
aa call ui-ux-designer "배너 시안" --dry-run
```

`aa` 는 내부적으로 Codex 에 `$imagegen` 프롬프트를 넘기고, 생성된 이미지를 작업 폴더에 저장하도록 지시한다. 응답 패널에 저장 경로가 표시되고, 호출 기록은 에이전트 메모리 `work.md` 에 누적된다.

### 이미지 키워드 (자동 감지)

로고, 배너, 썸네일, 일러스트, 삽화, 포스터, 목업, 그려줘, 이미지 생성/만들, 그림 생성/그려, 아이콘 만들, 이미지로 만들 …

이 중 하나도 안 걸리면 **text** 로 보고 난이도 라우터로 넘긴다. 오판이 나면 `--modality text|image` 로 덮어쓴다.

> `--provider claude` 를 이미지에 줘도 Claude 는 이미지 생성을 못 하므로 자동으로 chatgpt(Codex)로 대체된다.

---

## 동영상은?

`aa` 범위 밖이다. Codex CLI 는 동영상을 만들지 못하고, 다른 경로(Gemini Veo 등)는 API 키·프로젝트 인증이 필요해 "구독만으로" 원칙과 맞지 않는다. 동영상이 필요하면 각 서비스의 웹 UI 를 직접 쓴다.

---

## 트러블슈팅

| 증상 | 해결 |
|---|---|
| 이미지 요청인데 text 로 라우팅됨 | 키워드 미포함. `--modality image` 로 강제하거나 프롬프트에 "이미지 만들어줘" 추가 |
| `codex CLI 를 찾지 못했습니다` | Codex CLI 미설치 — [codex-cli-setup.md](codex-cli-setup.md) 참조 |
| Codex 이미지가 저장 안 됨 | `codex exec "$imagegen 테스트 이미지"` 직접 실행해서 작동 확인 |
| 이미지 대신 텍스트 설명만 나옴 | Codex 버전이 `$imagegen` 스킬을 지원하는지 확인 — `codex --version` 후 최신으로 업데이트 |

---

## 다음 자리 (Phase 2)

- 이미지 생성 결과(저장 경로·해상도)를 에이전트 메모리 `work.md` 에 구조화 누적
- `finance-tracker` 가 이미지 생성 호출 수를 ChatGPT Pro 사용량과 함께 추적
