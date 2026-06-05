from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from bridge.stt import STTError, transcribe_openai


def test_transcribe_openai_requires_key():
    with pytest.raises(STTError, match="OPENAI_API_KEY"):
        transcribe_openai(b"RIFF", api_key="")


def test_transcribe_openai_returns_text():
    fake_client = MagicMock()
    fake_client.audio.transcriptions.create.return_value = "안녕 외계인"
    with patch("openai.OpenAI", return_value=fake_client):
        result = transcribe_openai(b"RIFF", api_key="sk-test")
    assert result.text == "안녕 외계인"
    assert result.engine == "openai-whisper"
