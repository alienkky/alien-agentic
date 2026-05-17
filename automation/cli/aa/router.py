"""모달리티·난이도 라우터 — 토큰 0으로 로컬 휴리스틱 판정.

두 축으로 라우팅한다:
1) 모달리티 — text / image / video
2) (text 일 때) 난이도 — T1 경량 / T2 표준 / T3 심층

정책:
- text: "Claude 우선, GPT 보조" (중립은 Claude Sonnet)
- image: 스마트 라우팅 — 텍스트/로고/아이콘 → gpt-image-2, 그 외 → Flux Dev (ComfyUI)
         ComfyUI 미응답 시 gpt-image-2 폴백 (cli.py 에서 처리)
- video: ComfyUI 단독 — 4090 로컬 GPU, 무-API-키

확장성: 새 CLI (예: gemma) 를 추가하려면 PROVIDERS 에 이름을 더하고
route() 에 분기 한 줄, cli.py 에 러너 함수 한 개만 만들면 된다.
사용량 추적(JSONL) 은 자동으로 따라잡는다.
"""

from __future__ import annotations

from dataclasses import dataclass

from aa.agents import Agent
from aa.config import CODEX_MODEL

# ── 모달리티 ────────────────────────────────────────────────────────────────
MODALITIES = ("text", "image", "video")

# 이미지 생성 의도 키워드 — 오탐을 줄이려 "생성 맥락"이 분명한 단어만
IMAGE_KEYWORDS = (
    "로고", "배너", "썸네일", "일러스트", "삽화", "포스터", "목업",
    "그려줘", "그려 줘", "이미지 생성", "이미지 만들", "그림 생성",
    "그림 그려", "그림으로", "아이콘 만들", "이미지로 만들",
)
# gpt-image-2 가 Flux 보다 나은 경우 — 텍스트 렌더링·정교한 지시 따르기
GPT_IMAGE_KEYWORDS = (
    "로고", "아이콘", "글자", "텍스트 포함", "text", "logo", "icon",
    "UI ", "버튼", "badge", "워드마크", "타이포",
)
# 동영상 생성 의도 키워드 — ComfyUI 가 들어오면서 재활성화
VIDEO_KEYWORDS = (
    "동영상", "비디오", "영상 생성", "영상으로", "영상 만들",
    "모션 그래픽", "애니메이션 만들", "movie", "video clip",
)

# ── 난이도 ──────────────────────────────────────────────────────────────────
TIERS = ("T1", "T2", "T3")

# T3(심층)로 끌어올리는 키워드 — 복잡 추론·설계·진단
T3_KEYWORDS = (
    "설계", "전략", "진단", "비전", "분석", "아키텍처", "내러티브",
    "구조", "로드맵", "시나리오", "프레임워크", "의사결정", "심층",
)
# T1(경량)로 끌어내리는 키워드 — 결정론적·포맷·정리
T1_KEYWORDS = (
    "정리", "목록", "리스트", "변환", "포맷", "요약", "나열",
    "복사", "오타", "맞춤법", "번역", "추출",
)

# 티어 → (공급자, Claude 모델). chatgpt 경로의 모델은 CODEX_MODEL 이 결정.
TIER_ROUTING: dict[str, tuple[str, str]] = {
    "T1": ("chatgpt", ""),       # 경량 → ChatGPT Pro (Codex CLI)
    "T2": ("claude", "sonnet"),  # 표준 → Claude Sonnet
    "T3": ("claude", "opus"),    # 심층 → Claude Opus
}

# 공급자 — text: claude/chatgpt · image: comfyui(기본)/chatgpt(텍스트·로고) · video: comfyui
PROVIDERS = ("claude", "chatgpt", "comfyui")
IMAGE_PROVIDERS = ("chatgpt", "comfyui")
VIDEO_PROVIDERS = ("comfyui",)


@dataclass
class Route:
    modality: str    # text | image | video
    tier: str        # T1 | T2 | T3 · 이미지/동영상은 "-"
    provider: str    # claude | chatgpt | comfyui
    model: str       # claude: sonnet/opus · chatgpt: CODEX_MODEL · comfyui: 빈값(워크플로가 결정)
    reason: str      # 판정 근거 한 줄


def classify_modality(prompt: str, override: str | None) -> tuple[str, str]:
    """모달리티와 판정 근거를 반환. override 가 있으면 그대로 사용한다."""
    if override:
        return override, f"수동 지정 (--modality {override})"

    v_hits = [k for k in VIDEO_KEYWORDS if k in prompt]
    if v_hits:
        return "video", f"동영상 키워드 {v_hits}"

    i_hits = [k for k in IMAGE_KEYWORDS if k in prompt]
    if i_hits:
        return "image", f"이미지 키워드 {i_hits}"

    return "text", "미디어 키워드 없음 → 텍스트"


def classify(agent: Agent, prompt: str, override: str | None) -> tuple[str, str]:
    """난이도 티어와 판정 근거를 반환. override 가 있으면 그대로 사용한다."""
    if override:
        return override, f"수동 지정 (--difficulty {override})"

    score = 0
    reasons: list[str] = []

    # 1) 에이전트 프론트매터 model — opus 에이전트는 본래 심층 작업용
    if agent.model == "opus":
        score += 2
        reasons.append("opus 에이전트(+2)")
    elif agent.model == "sonnet":
        score += 1
        reasons.append("sonnet 에이전트(+1)")

    # 2) 키워드 — 심층은 올리고, 경량은 내린다
    t3_hits = [k for k in T3_KEYWORDS if k in prompt]
    t1_hits = [k for k in T1_KEYWORDS if k in prompt]
    if t3_hits:
        score += len(t3_hits)
        reasons.append(f"심층 키워드 {t3_hits}(+{len(t3_hits)})")
    if t1_hits:
        score -= len(t1_hits)
        reasons.append(f"경량 키워드 {t1_hits}(-{len(t1_hits)})")

    # 3) 프롬프트 길이 — 긴 요청일수록 맥락이 무겁다
    if len(prompt) > 400:
        score += 1
        reasons.append("긴 프롬프트(+1)")
    elif len(prompt) < 60:
        score -= 1
        reasons.append("짧은 프롬프트(-1)")

    # "Claude 우선" — 중립(점수 0)은 T2로 두고, 명확히 가벼울 때만 T1로 내린다
    if score < 0:
        tier = "T1"
    elif score >= 3:
        tier = "T3"
    else:
        tier = "T2"

    detail = ", ".join(reasons) if reasons else "신호 없음"
    return tier, f"점수 {score} → {tier} ({detail})"


def route(
    agent: Agent,
    prompt: str,
    difficulty: str | None = None,
    provider: str | None = None,
    modality: str | None = None,
) -> Route:
    """모달리티·난이도·수동 오버라이드를 받아 최종 라우팅을 결정한다."""
    mod, mod_reason = classify_modality(prompt, modality)

    # 동영상 — ComfyUI 단독 (4090 로컬 GPU, 무-API-키)
    if mod == "video":
        if provider and provider != "comfyui":
            mod_reason += f" · {provider}는 동영상 미지원 → comfyui 로 대체"
        return Route(
            modality="video", tier="-", provider="comfyui", model="",
            reason=mod_reason,
        )

    # 이미지 — 스마트 라우팅: GPT 키워드 → gpt-image-2, 그 외 → Flux Dev (ComfyUI)
    if mod == "image":
        if provider == "comfyui":
            chosen = "comfyui"
            model = ""
            mod_reason += " · 공급자 수동 지정(comfyui/Flux)"
        elif provider == "chatgpt":
            chosen = "chatgpt"
            model = CODEX_MODEL
            mod_reason += " · 공급자 수동 지정(chatgpt/gpt-image-2)"
        elif provider == "claude":
            chosen = "comfyui"
            model = ""
            mod_reason += " · claude는 이미지 생성 불가 → comfyui(Flux)로 대체"
        else:
            # 스마트 라우팅: 텍스트 렌더링·로고·아이콘 → gpt-image-2 우세
            gpt_hits = [k for k in GPT_IMAGE_KEYWORDS if k in prompt]
            if gpt_hits:
                chosen = "chatgpt"
                model = CODEX_MODEL
                mod_reason += f" · 텍스트/로고 키워드 {gpt_hits} → gpt-image-2"
            else:
                chosen = "comfyui"
                model = ""
                mod_reason += " · 일반 이미지 → Flux Dev (ComfyUI)"
        return Route(
            modality="image", tier="-", provider=chosen, model=model,
            reason=mod_reason,
        )

    # 텍스트 — 난이도 라우팅
    tier, reason = classify(agent, prompt, difficulty)
    base_provider, base_model = TIER_ROUTING[tier]

    if provider == "comfyui":
        # 텍스트는 ComfyUI 미지원 (이미지·동영상 전용)
        chosen, model = "claude", "opus" if tier == "T3" else "sonnet"
        reason += " · comfyui 텍스트 미지원 → claude 대체"
    elif provider == "claude":
        chosen = "claude"
        model = "opus" if tier == "T3" else "sonnet"
        reason += " · 공급자 수동 지정(claude)"
    elif provider == "chatgpt":
        chosen = "chatgpt"
        model = CODEX_MODEL
        reason += " · 공급자 수동 지정(chatgpt)"
    else:
        chosen = base_provider
        model = CODEX_MODEL if chosen == "chatgpt" else base_model

    return Route(
        modality="text", tier=tier, provider=chosen, model=model, reason=reason,
    )
