"""음성 입력 — 마이크 → 텍스트 (STT)."""

from __future__ import annotations

import io
import tempfile
from pathlib import Path

import numpy as np
import sounddevice as sd
import soundfile as sf
from rich.console import Console

console = Console(legacy_windows=False)


def record_audio(sample_rate: int = 16000, channels: int = 1) -> bytes:
    """마이크에서 녹음 — Enter 로 시작, Enter 로 중지. WAV bytes 반환."""
    frames: list[np.ndarray] = []

    console.print("[dim]Enter 를 누르면 녹음이 시작됩니다...[/dim]")
    input()

    console.print("[bold red]● 녹음 중...[/bold red] [dim](Enter 로 중지)[/dim]")

    def callback(indata, _frame_count, _time_info, status):
        if status:
            console.print(f"[yellow]오디오 경고: {status}[/yellow]")
        frames.append(indata.copy())

    stream = sd.InputStream(
        samplerate=sample_rate,
        channels=channels,
        dtype="int16",
        callback=callback,
    )
    stream.start()
    input()
    stream.stop()
    stream.close()

    if not frames:
        return b""

    audio_data = np.concatenate(frames, axis=0)

    buf = io.BytesIO()
    sf.write(buf, audio_data, sample_rate, format="WAV", subtype="PCM_16")
    return buf.getvalue()


def record_audio_auto(
    sample_rate: int = 16000,
    channels: int = 1,
    stop_event_check=None,
    poll_interval: float = 0.05,
    min_duration: float = 0.3,
) -> bytes:
    """핫키용 녹음 — stop_event_check() 가 True 를 반환하면 중지.

    Enter 가 아닌 외부 조건(핫키 릴리스)으로 녹음을 멈춘다.
    min_duration 초 미만이면 빈 bytes 반환 (오발 방지).
    """
    import time as _time

    frames: list[np.ndarray] = []
    start_time = _time.monotonic()

    def callback(indata, _frame_count, _time_info, status):
        frames.append(indata.copy())

    stream = sd.InputStream(
        samplerate=sample_rate,
        channels=channels,
        dtype="int16",
        callback=callback,
    )
    stream.start()

    try:
        while True:
            _time.sleep(poll_interval)
            if stop_event_check and stop_event_check():
                break
    finally:
        stream.stop()
        stream.close()

    elapsed = _time.monotonic() - start_time
    if elapsed < min_duration or not frames:
        return b""

    audio_data = np.concatenate(frames, axis=0)

    buf = io.BytesIO()
    sf.write(buf, audio_data, sample_rate, format="WAV", subtype="PCM_16")
    return buf.getvalue()


def transcribe_google(audio_wav: bytes, language: str = "ko-KR") -> str:
    """Google Free STT — API 키 불필요, 인터넷 필요."""
    import speech_recognition as sr

    recognizer = sr.Recognizer()
    audio_file = io.BytesIO(audio_wav)

    with sr.AudioFile(audio_file) as source:
        audio = recognizer.record(source)

    try:
        return recognizer.recognize_google(audio, language=language)
    except sr.UnknownValueError:
        raise ValueError("음성을 인식하지 못했습니다. 다시 시도해 주세요.")
    except sr.RequestError as e:
        raise ConnectionError(
            f"Google STT 서버에 연결할 수 없습니다: {e}\n"
            "인터넷 연결을 확인하세요."
        )


def transcribe_offline(audio_wav: bytes, language: str = "ko") -> str:
    """faster-whisper 오프라인 STT — 모델 첫 실행 시 다운로드."""
    try:
        from faster_whisper import WhisperModel
    except ImportError:
        raise ImportError(
            "오프라인 STT 에는 faster-whisper 가 필요합니다.\n"
            "  pip install faster-whisper"
        )

    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tf:
        tf.write(audio_wav)
        tf_path = Path(tf.name)

    try:
        model = WhisperModel("base", device="cpu", compute_type="int8")
        segments, _info = model.transcribe(str(tf_path), language=language)
        text = " ".join(seg.text.strip() for seg in segments)
    finally:
        tf_path.unlink(missing_ok=True)

    if not text.strip():
        raise ValueError("음성을 인식하지 못했습니다. 다시 시도해 주세요.")

    return text


def transcribe(audio_wav: bytes, language: str = "ko-KR", offline: bool = False) -> str:
    """STT 라우터 — online/offline 모드 분기."""
    if offline:
        lang_short = language.split("-")[0]
        return transcribe_offline(audio_wav, lang_short)
    return transcribe_google(audio_wav, language)
