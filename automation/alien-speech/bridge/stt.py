"""STT 라우터 — primary = OpenAI Whisper API, fallback = faster-whisper 로컬."""

from __future__ import annotations

import io
import logging
import tempfile
from dataclasses import dataclass
from pathlib import Path

log = logging.getLogger(__name__)


@dataclass
class TranscribeResult:
    text: str
    engine: str
    duration_s: float | None = None


class STTError(RuntimeError):
    pass


def transcribe_openai(
    wav_bytes: bytes,
    *,
    api_key: str,
    model: str = "whisper-1",
    language: str = "ko",
    timeout: float = 60.0,
) -> TranscribeResult:
    """OpenAI Whisper API — 1.2~2.5초/10초 메모, $0.006/분."""
    if not api_key:
        raise STTError("OPENAI_API_KEY 가 비어있음")
    try:
        from openai import OpenAI
    except ImportError as e:
        raise STTError("openai 패키지 미설치 — pip install openai") from e

    client = OpenAI(api_key=api_key, timeout=timeout)
    # OpenAI SDK 는 *파일 객체*를 받음. WAV bytes 를 BytesIO 로 감싸고 name 부여.
    buf = io.BytesIO(wav_bytes)
    buf.name = "memo.wav"
    try:
        resp = client.audio.transcriptions.create(
            model=model,
            file=buf,
            language=language,
            response_format="text",
        )
    except Exception as e:  # openai 의 다양한 에러 — 모두 STTError 로 정규화
        raise STTError(f"openai whisper 실패: {e}") from e
    text = resp if isinstance(resp, str) else getattr(resp, "text", str(resp))
    return TranscribeResult(text=text.strip(), engine="openai-whisper")


def transcribe_local(
    wav_bytes: bytes,
    *,
    model_name: str = "large-v3",
    device: str = "cuda",
    compute_type: str = "float16",
    language: str = "ko",
) -> TranscribeResult:
    """faster-whisper 로컬 — RTX 4090 fp16. ComfyUI 와 GPU 공유 주의."""
    try:
        from faster_whisper import WhisperModel
    except ImportError as e:
        raise STTError(
            "faster-whisper 미설치 — pip install faster-whisper"
        ) from e

    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tf:
        tf.write(wav_bytes)
        tf_path = Path(tf.name)
    try:
        model = WhisperModel(model_name, device=device, compute_type=compute_type)
        segments, _info = model.transcribe(str(tf_path), language=language)
        text = " ".join(seg.text.strip() for seg in segments).strip()
    finally:
        tf_path.unlink(missing_ok=True)

    if not text:
        raise STTError("faster-whisper: 빈 결과 (무음?)")
    return TranscribeResult(text=text, engine="faster-whisper-local")


def transcribe(wav_bytes: bytes, *, config) -> TranscribeResult:
    """모드 분기. openai-api 가 5xx/타임아웃 3회 연속이면 호출측에서 force_local."""
    if config.stt_mode == "faster-whisper-local":
        return transcribe_local(
            wav_bytes,
            model_name=config.whisper_local_model,
            device=config.whisper_local_device,
            compute_type=config.whisper_local_compute_type,
            language=config.whisper_language,
        )
    # default: openai-api
    return transcribe_openai(
        wav_bytes,
        api_key=config.openai_api_key,
        model=config.whisper_model,
        language=config.whisper_language,
    )
