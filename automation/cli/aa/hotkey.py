"""글로벌 핫키 — Ctrl+Shift+V 로 어디서든 음성 입력.

Push-to-talk:
  Ctrl+Shift+V  →  누르면 녹음, 떼면 STT → 클립보드 복사 + 토스트
  Ctrl+Shift+A  →  위와 같지만 기본 에이전트에게 전달 (aa call)

백그라운드 데몬: `aa hotkey` 로 시작, Ctrl+C 로 종료.
"""

from __future__ import annotations

import subprocess
import sys
import threading
import time
from pathlib import Path

import keyboard
from rich.console import Console

from aa.voice import record_audio_auto, transcribe

console = Console(legacy_windows=False)

_recording = False
_recording_lock = threading.Lock()


def _copy_to_clipboard(text: str) -> None:
    """클립보드에 텍스트 복사 — Windows ctypes (한국어 안전)."""
    import ctypes
    CF_UNICODETEXT = 13
    kernel32 = ctypes.windll.kernel32
    user32 = ctypes.windll.user32

    user32.OpenClipboard(0)
    user32.EmptyClipboard()
    data = text.encode("utf-16le") + b"\x00\x00"
    h = kernel32.GlobalAlloc(0x0042, len(data))
    ptr = kernel32.GlobalLock(h)
    ctypes.memmove(ptr, data, len(data))
    kernel32.GlobalUnlock(h)
    user32.SetClipboardData(CF_UNICODETEXT, h)
    user32.CloseClipboard()


def _toast(title: str, message: str) -> None:
    """Windows 토스트 알림 — PowerShell 경유."""
    ps_script = (
        "[Windows.UI.Notifications.ToastNotificationManager,"
        "Windows.UI.Notifications,ContentType=WindowsRuntime] | Out-Null; "
        "$xml = [Windows.UI.Notifications.ToastNotificationManager]"
        "::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02); "
        "$texts = $xml.GetElementsByTagName('text'); "
        f"$texts[0].AppendChild($xml.CreateTextNode('{title}')) | Out-Null; "
        f"$texts[1].AppendChild($xml.CreateTextNode('{message}')) | Out-Null; "
        "$notifier = [Windows.UI.Notifications.ToastNotificationManager]"
        "::CreateToastNotifier('aa-voice'); "
        "$notifier.Show([Windows.UI.Notifications.ToastNotification]::new($xml))"
    )
    try:
        subprocess.Popen(
            ["powershell", "-NoProfile", "-Command", ps_script],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
    except OSError:
        pass


def _beep(freq: int = 800, duration_ms: int = 150) -> None:
    """짧은 비프음 — 녹음 시작/종료 피드백."""
    try:
        import winsound
        winsound.Beep(freq, duration_ms)
    except Exception:
        pass


def _on_voice_hotkey(
    language: str,
    offline: bool,
    agent: str | None,
) -> None:
    """핫키 콜백 — 녹음 → STT → 클립보드 (+ 에이전트 호출)."""
    global _recording
    with _recording_lock:
        if _recording:
            return
        _recording = True

    try:
        _beep(800, 100)
        console.print("[bold red]● 녹음 중...[/bold red] [dim](핫키 떼면 중지)[/dim]")

        time.sleep(0.3)

        audio_wav = record_audio_auto(
            stop_event_check=lambda: not keyboard.is_pressed("ctrl+shift+v")
            and not keyboard.is_pressed("ctrl+shift+a"),
        )

        if not audio_wav:
            console.print("[yellow]녹음된 오디오가 없습니다.[/yellow]")
            _beep(400, 200)
            return

        _beep(1000, 100)
        console.print("[dim]음성 인식 중...[/dim]")

        try:
            text = transcribe(audio_wav, language=language, offline=offline)
        except (ValueError, ConnectionError, ImportError) as e:
            console.print(f"[red]{e}[/red]")
            _toast("aa voice", f"인식 실패: {e}")
            return

        _copy_to_clipboard(text)
        console.print(f"[green]✓ 클립보드 복사:[/green] {text}")
        _toast("🎙 aa voice", text[:100])

        if agent:
            console.print(f"[dim]에이전트 '{agent}' 호출 중...[/dim]")
            subprocess.Popen(
                [sys.executable, "-m", "aa", "call", agent, text],
                creationflags=subprocess.CREATE_NEW_CONSOLE,
            )

    except Exception as e:
        console.print(f"[red]오류: {e}[/red]")
    finally:
        with _recording_lock:
            _recording = False


def run_listener(
    language: str = "ko-KR",
    offline: bool = False,
    agent: str | None = None,
) -> None:
    """글로벌 핫키 리스너 — 블로킹, Ctrl+C 로 종료."""
    console.print(
        "\n[bold]🎙 aa hotkey — 글로벌 음성 입력 대기 중[/bold]\n"
        "\n"
        "  [cyan]Ctrl+Shift+V[/cyan]  녹음 → 텍스트 → 클립보드 복사\n"
    )
    if agent:
        console.print(
            f"  [cyan]Ctrl+Shift+A[/cyan]  녹음 → 텍스트 → [bold]{agent}[/bold] 에이전트 호출\n"
        )
    console.print("  [dim]Ctrl+C 로 종료[/dim]\n")

    keyboard.add_hotkey(
        "ctrl+shift+v",
        lambda: threading.Thread(
            target=_on_voice_hotkey,
            args=(language, offline, None),
            daemon=True,
        ).start(),
        suppress=True,
        trigger_on_release=False,
    )

    if agent:
        keyboard.add_hotkey(
            "ctrl+shift+a",
            lambda: threading.Thread(
                target=_on_voice_hotkey,
                args=(language, offline, agent),
                daemon=True,
            ).start(),
            suppress=True,
            trigger_on_release=False,
        )

    try:
        keyboard.wait()
    except KeyboardInterrupt:
        console.print("\n[dim]핫키 리스너 종료.[/dim]")
    finally:
        keyboard.unhook_all()
