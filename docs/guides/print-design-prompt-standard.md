# Print Design Prompt Standard — 인쇄용 디자인 표준 prompt

> 포스터·전단·명함·브로셔·책자 같은 *인쇄용* 디자인을 `aa design` (또는 OpenDesign 웹 UI) 으로 만들 때 화면 미리보기와 인쇄 출력 *둘 다* 잘 보이게 하는 표준 prompt.
>
> 교훈: 2026-05-27 — Neora Memory Formula A1 포스터를 생성했으나 OpenDesign 미리보기 패널에서 *빈 화면*만 보였다. 다운로드해 열어도 화면이 비어보임. 진단 결과 HTML 자체는 완벽했고 OpenDesign 기본 출력 패턴이 *디자이너 워크보드 톤*(dark background + JS auto-scale to fit viewport) 으로 가 인쇄용 큰 사이즈(A1=594×841mm)와 만나면 *극도로 작은 미니어처*가 되어 화면에선 거의 안 보이는 함정.

---

## 한 줄 요약

인쇄용 디자인 prompt 에 *반드시* 박을 표준 구절:

> **인쇄용 — 미리보기 친화 모드. body background: white(또는 인쇄 톤). overflow: visible. JavaScript transform:scale() auto-fit 금지. 화면에서도 1:1 크기로 보여야 함. 스크롤 OK.**

이 한 줄이 있으면 OpenDesign 의 자동 워크보드 톤이 *인쇄 톤*으로 바뀌어 화면 미리보기에서도 그대로 보인다.

---

## 함정 — OpenDesign 의 기본 출력 패턴

OpenDesign 이 인쇄 사이즈(A1·A2·A4 등)를 인지하면 자동으로 다음을 박는다:

```css
body {
  background: #15191b;   /* 어두운 디자이너 워크보드 톤 */
  overflow: hidden;       /* 스크롤 차단 */
}

.viewport {
  position: fixed;
  inset: 0;
  display: grid;
  place-items: center;
  overflow: hidden;
}
```

```javascript
function fit() {
  /* poster 를 viewport 에 맞춰 transform:scale() 로 축소 */
  var s = Math.min(viewportW / posterW, viewportH / posterH);
  poster.style.transform = 'scale(' + s + ')';
}
```

**의도된 동작**: 디자이너가 OpenDesign UI 안에서 큰 인쇄물의 *전체 모양*을 한눈에 보게 함. 진짜 결과물은 *PDF 변환*.

**함정**: OpenDesign 미리보기 *iframe*은 모니터 일부 공간만 차지 → A1 (594×841mm = ~2,245×3,178px) 을 그 안에 맞추면 *scale 0.1 이하* → 거의 점 → 다크 배경에 검정 점 → 빈 화면처럼 보임.

**다운로드 후 열어도** body background 가 다크 + JS 가 viewport 크기에 맞춰 자동 축소 → 보통 모니터(1920×1080)에선 그래도 보이긴 하나 *어두운 회색 캔버스 + 가운데 작은 포스터* 의 *디자이너 워크보드 톤* 그대로.

---

## 표준 prompt 템플릿

### 인쇄용 (포스터·전단·명함·브로셔·책자)

```
[디자인 설명]

인쇄 사양:
  - 사이즈: A1 / A2 / A3 / A4 / 명함 (90×54mm) / 등 명시
  - 색공간: CMYK 변환은 InDesign/Acrobat 에서 (HTML 은 sRGB)
  - 마진/블리드: 명시 (예: 3mm bleed)

미리보기 친화 모드 (필수):
  - body background: white (또는 디자인 컨셉에 맞는 인쇄 톤 — cream/paper)
  - overflow: visible (auto-fit 금지)
  - JavaScript transform:scale() 또는 비슷한 자동 축소 금지
  - 화면에서도 1:1 크기로 그대로 보여야 함
  - 스크롤로 큰 인쇄물 탐색 OK

폰트:
  - Pretendard Variable + 시리프 1종 (Cormorant Garamond 등)
  - system-ui fallback 반드시
  - 가능하면 inline 또는 CDN 자체 fallback

이미지:
  - inline SVG 또는 base64 data URI 우선
  - 외부 URL 사용 시 (CDN) 반드시 alt 텍스트 + 대체 색 background

PDF 변환:
  - Chrome → Ctrl+P → 사용자 정의 사이즈 → 배경 그래픽 켜기
  - 또는 Acrobat 으로 1:1 변환 후 CMYK 변환

첫 줄: <!doctype html>
HTML 외 어떤 텍스트/markdown 도 출력 금지.
```

### 화면용 (대시보드·웹페이지·앱 화면 — 인쇄 안 함)

화면용은 기본 OpenDesign 출력 그대로 OK. 별도 prompt 구절 불필요.

---

## `aa design` 사용 예

### 인쇄용 (표준 prompt 동봉)

```powershell
aa design @"
Neora Memory Formula 한국어 A1 포스터.
혈행·기억·항산화 3 benefit, 가격 ₩189,000, QR 포함.

인쇄 사양:
  - 사이즈: A1 (594×841mm), 인쇄 톤 cream/paper
  - 색공간: sRGB → 인쇄 시 CMYK 변환은 Acrobat 에서
  - 마진: 16mm 안전 영역

미리보기 친화 모드:
  - body background: cream (#f4f1eb) 또는 white
  - overflow: visible
  - JavaScript transform:scale() auto-fit 금지
  - 화면에서도 1:1 크기로 보임

폰트: Pretendard Variable + Cormorant Garamond
첫 줄: <!doctype html>
HTML 외 출력 금지.
"@ --system alien-agentic --client _self
```

### 화면용 (기본)

```powershell
aa design "환영 카드 — 모바일 친화" --system alien-agentic --client _self
```

---

## 응급 fix — 이미 생성된 인쇄용 HTML 의 미리보기 살리기

다운로드한 HTML 의 CSS 2 곳만 수정:

**Before**:
```css
html, body {
  background: #15191b;
  overflow: hidden;
}

.viewport {
  position: fixed;
  inset: 0;
  overflow: hidden;
}
```

**After**:
```css
html, body {
  background: white;        /* 또는 인쇄 톤 cream */
  overflow: auto;
}

.viewport {
  position: static;          /* fixed → static */
  overflow: visible;
  padding: 24px;
}
```

그리고 `<script>` 안의 `fit()` 함수 호출 부분을 주석 처리:

```javascript
// window.addEventListener('resize', fit);
// window.addEventListener('load', fit);
// fit();
```

이러면 화면에서도 *원래 사이즈* 그대로 + 스크롤로 탐색 가능. 인쇄 (Ctrl+P) 는 변함없이 정상.

---

## brand-keeper 체크리스트 (인쇄용)

`brand-keeper` 가 인쇄용 디자인 검수할 때 확인:

- [ ] body background 가 인쇄 톤 (white/cream/paper) — *워크보드 톤 아님*
- [ ] overflow: visible — *hidden 아님*
- [ ] JavaScript auto-scale 없음
- [ ] 폰트 fallback (system-ui) 박혀있음
- [ ] 외부 리소스(CDN) 가 fail 해도 디자인이 살아남는가
- [ ] Ctrl+P 인쇄 미리보기에서 의도된 사이즈 1:1 로 떨어지는가
- [ ] 마진/블리드 명시
- [ ] CMYK 변환 후 톤 차이 큰 색 (형광·네온) 회피

---

## 함정 재발 시그널

다음 신호 보이면 인쇄용 prompt 표준이 또 빠진 것:

- "다운받았는데 빈 화면" / "미리보기 안 보임"
- 다운로드한 HTML 의 첫 부분에 `background: #15191b` 또는 비슷한 다크 톤
- `<script>` 안에 `fit()`·`scale()`·`transform: scale` 자동 함수
- `overflow: hidden` 이 body·viewport 양쪽에

→ 응급 fix 또는 *prompt 다시 보내 재생성*.

---

*케이스 등록: 2026-05-27 | 작성: master-orchestrator | CLAUDE.md §8 표준화 반영*
