"""Alien Agentic CLI — `aa` 진입점."""

from __future__ import annotations

import datetime as dt
import json
import os
import re
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import defaultdict
from pathlib import Path

# Windows 콘솔 UTF-8 보장 — cp949 (한국 Windows 기본) 이모지 인코딩 에러 방지
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, OSError):
        pass

import typer
from dotenv import load_dotenv
from rich.console import Console
from rich.markdown import Markdown
from rich.panel import Panel
from rich.table import Table

from aa.agents import DIVISIONS, division_of, load_all, load_one
from aa.config import (
    AGENT_MEMORY,
    AGENTS_DIR,
    CLAUDE_BIN,
    CODEX_BIN,
    CODEX_MODEL,
    COMFYUI_OUTPUT_TIMEOUT,
    COMFYUI_URL,
    COMFYUI_WORKFLOWS_DIR,
    COMPANY,
    DAILY_LOGS,
    DASHBOARD,
    ENV_FILE,
    INTERVENTIONS,
    MESSAGES,
    ROOT,
    USAGE_DIR,
    USER_NAME,
)
from aa.router import MODALITIES, PROVIDERS, TIERS, Route, route

app = typer.Typer(
    name="aa",
    help=f"🛸 {COMPANY} — 마스터 오케스트레이터 CLI",
    no_args_is_help=True,
    add_completion=False,
)
console = Console(legacy_windows=False)

# .env 자동 로드 (CLI 진입 시점)
if ENV_FILE.exists():
    load_dotenv(ENV_FILE)


# ──────────────────────────────────────────────────────────────────────────
# aa hello
# ──────────────────────────────────────────────────────────────────────────
@app.command()
def hello() -> None:
    """마스터 오케스트레이터 부팅 확인."""
    today = dt.date.today().strftime("%Y-%m-%d (%a)")
    agent_count = len(list(AGENTS_DIR.glob("*.md")))
    panel = Panel.fit(
        f"[bold cyan]🛸 {COMPANY} 마스터 오케스트레이터[/bold cyan]\n\n"
        f"오늘은 [cyan]{today}[/cyan]\n"
        f"{USER_NAME}, 첫 출근을 환영합니다.\n\n"
        f"[dim]프로젝트 루트:[/dim] {ROOT}\n"
        f"[dim]동료 명단:[/dim] {agent_count}명\n\n"
        f'[italic]"이 행동이 {USER_NAME}에게 시간·평화·존엄을 돌려주는가?"[/italic]',
        border_style="cyan",
        title="aa hello",
    )
    console.print(panel)


# ──────────────────────────────────────────────────────────────────────────
# aa list
# ──────────────────────────────────────────────────────────────────────────
@app.command(name="list")
def list_cmd(
    division: str = typer.Option(
        None, "--division", "-d", help="WHY / HOW / WHAT / CTRL / R&D"
    ),
) -> None:
    """27명 외계 동료 명단."""
    agents = load_all()
    if division:
        wanted = division.upper()
        agents = [a for a in agents if division_of(a.name) == wanted]
        if not agents:
            console.print(
                f"[yellow]Division '{wanted}' 에 해당하는 동료가 없습니다.[/yellow]"
            )
            console.print(f"[dim]가능한 값: {', '.join(DIVISIONS.keys())}[/dim]")
            return

    table = Table(
        title=f"🛸 외계 동료 명단 ({len(agents)}명)",
        show_lines=False,
        title_style="bold cyan",
    )
    table.add_column("Division", style="dim", width=6)
    table.add_column("Name", style="bold cyan", width=22)
    table.add_column("Model", style="magenta", width=8)
    table.add_column("Description")

    for a in agents:
        desc = a.description
        if len(desc) > 70:
            desc = desc[:67] + "..."
        table.add_row(division_of(a.name), a.name, a.model, desc)

    console.print(table)


# ──────────────────────────────────────────────────────────────────────────
# aa status
# ──────────────────────────────────────────────────────────────────────────
@app.command()
def status() -> None:
    """오늘 일지 + 진행 클라이언트 + 미해결 자리."""
    today = dt.date.today().strftime("%Y-%m-%d")
    log_path = DAILY_LOGS / f"{today}.md"

    console.rule(f"🛸 Alien Agentic Status · {today}")

    # 오늘 일지
    if log_path.exists():
        console.print("\n[bold cyan]오늘 일지[/bold cyan]")
        snippet = "\n".join(log_path.read_text(encoding="utf-8").splitlines()[:30])
        console.print(Markdown(snippet))
    else:
        console.print(f"\n[yellow]오늘 일지 없음 ({log_path.name})[/yellow]")
        console.print(f"[dim]`aa daily-log today --edit` 로 새로 만들기[/dim]")

    # Dashboard
    if DASHBOARD.exists():
        console.print("\n[bold cyan]Dashboard[/bold cyan]")
        console.print(Markdown(DASHBOARD.read_text(encoding="utf-8")))

    # 미해결 interventions
    open_interventions = _count_open(INTERVENTIONS)
    console.print(f"\n[bold]미해결 개입:[/bold] {open_interventions}건")

    # 미응답 messages
    open_messages = _count_open(MESSAGES)
    console.print(f"[bold]미응답 메시지:[/bold] {open_messages}건")


def _count_open(folder) -> int:
    """folder 안의 *.md 중 'status: open' 포함된 자리 수."""
    if not folder.exists():
        return 0
    count = 0
    for p in folder.glob("*.md"):
        if p.name == "README.md":
            continue
        try:
            text = p.read_text(encoding="utf-8", errors="ignore")
        except OSError:
            continue
        if "status: open" in text:
            count += 1
    return count


# ──────────────────────────────────────────────────────────────────────────
# aa call
# ──────────────────────────────────────────────────────────────────────────
_PROVIDER_LABELS = {
    "claude": "Claude Max",
    "chatgpt": "ChatGPT Pro",
    "comfyui": "ComfyUI (4090 로컬)",
}


@app.command()
def call(
    agent: str = typer.Argument(..., help="에이전트 이름 (예: origin-reader)"),
    prompt: str = typer.Argument(..., help="요청 한 줄"),
    client: str = typer.Option(
        "_self", "--client", "-c", help="클라이언트 이름 (없으면 _self)"
    ),
    difficulty: str = typer.Option(
        None, "--difficulty", help="난이도 수동 지정: T1 | T2 | T3"
    ),
    provider: str = typer.Option(
        None, "--provider", help="공급자 강제 지정: claude | chatgpt | comfyui"
    ),
    modality: str = typer.Option(
        None, "--modality", help="모달리티 수동 지정: text | image | video"
    ),
    workflow: str = typer.Option(
        None, "--workflow",
        help="ComfyUI 워크플로 파일명 (확장자 없이, comfyui_workflows/ 안)",
    ),
    dry_run: bool = typer.Option(
        False, "--dry-run", help="AI 호출 없이 라우팅 결과만 출력"
    ),
) -> None:
    """단일 에이전트 호출 — 모달리티·난이도에 따라 자동 라우팅."""
    try:
        a = load_one(agent)
    except FileNotFoundError:
        console.print(f"[red]에이전트 없음: {agent}[/red]")
        console.print("[dim]`aa list` 로 명단 확인.[/dim]")
        raise typer.Exit(1)

    # 수동 오버라이드 값 검증
    if difficulty is not None:
        difficulty = difficulty.upper()
        if difficulty not in TIERS:
            console.print(
                f"[red]잘못된 난이도: {difficulty}[/red] "
                f"[dim](가능: {', '.join(TIERS)})[/dim]"
            )
            raise typer.Exit(1)
    if provider is not None:
        provider = provider.lower()
        if provider not in PROVIDERS:
            console.print(
                f"[red]잘못된 공급자: {provider}[/red] "
                f"[dim](가능: {', '.join(PROVIDERS)})[/dim]"
            )
            raise typer.Exit(1)
    if modality is not None:
        modality = modality.lower()
        if modality not in MODALITIES:
            console.print(
                f"[red]잘못된 모달리티: {modality}[/red] "
                f"[dim](가능: {', '.join(MODALITIES)})[/dim]"
            )
            raise typer.Exit(1)

    r = route(a, prompt, difficulty, provider, modality)
    model_label = r.model or "계정 기본"
    provider_label = _PROVIDER_LABELS.get(r.provider, r.provider)

    console.rule(f"🛸 Call · {a.name}")
    console.print(f"[dim]Division:[/dim] {division_of(a.name)}")
    console.print(f"[dim]Client:[/dim] {client}")
    console.print(
        f"[dim]Route:[/dim] [bold]{r.modality}[/bold] · {r.tier} · "
        f"{provider_label} · {model_label}"
    )
    console.print(f"[dim]판정 근거:[/dim] {r.reason}")
    console.print(f"[bold]요청:[/bold] {prompt}\n")

    if dry_run:
        console.print("[yellow]--dry-run: AI 호출 생략[/yellow]")
        console.print(f"[dim]시스템 프롬프트 위치:[/dim] {a.path}")
        return

    # 공급자별 사전 점검
    if r.provider == "comfyui":
        if not _comfyui_alive(COMFYUI_URL):
            if r.modality == "image":
                console.print(
                    f"[yellow]ComfyUI 미응답 ({COMFYUI_URL}) → gpt-image-2 로 폴백[/yellow]\n"
                )
                r = Route(
                    modality=r.modality, tier=r.tier, provider="chatgpt",
                    model=CODEX_MODEL, reason=r.reason + " · ComfyUI 미응답 → gpt-image-2 폴백",
                )
            else:
                console.print(
                    f"[red]ComfyUI 가 응답하지 않습니다 ({COMFYUI_URL}).[/red]\n"
                    "[dim]4090 PC 에서 ComfyUI 가 실행 중이어야 합니다.[/dim]\n"
                    "[dim]포트가 다르면 `.env` 에 COMFYUI_URL=http://localhost:XXXX 박기.[/dim]\n"
                    "[dim]설치·연동 가이드: docs/guides/comfyui-integration.md[/dim]"
                )
                raise typer.Exit(1)
    elif r.provider == "chatgpt":
        if CODEX_BIN is None:
            console.print(
                "[red]codex CLI 를 찾지 못했습니다.[/red]\n"
                "[dim]ChatGPT Pro 연동은 OpenAI Codex CLI 가 필요합니다.[/dim]\n"
                "[dim]설치 가이드: docs/guides/codex-cli-setup.md[/dim]\n"
                "[dim]다른 위치라면 `.env` 에 CODEX_BIN=절대경로 박기.[/dim]"
            )
            raise typer.Exit(1)
    elif CLAUDE_BIN is None:
        console.print(
            "[red]claude CLI 를 찾지 못했습니다.[/red]\n"
            "[dim]Claude Code 가 설치되어 있어야 합니다 (Max 구독 활용).[/dim]\n"
            "[dim]일반 위치: ~/.local/bin/claude.exe[/dim]\n"
            "[dim]다른 위치라면 `.env` 에 CLAUDE_BIN=절대경로 박기.[/dim]"
        )
        raise typer.Exit(1)

    # 출력 폴더 결정 — 클라이언트 작업이면 그쪽, 아니면 content/
    output_dir = _media_output_dir(client, r.modality)

    _t0 = time.time()
    with console.status(
        f"[cyan]{a.name} 호출 중 ({provider_label} · {model_label})...[/cyan]"
    ):
        if r.provider == "comfyui":
            wf_name = workflow or ("text-to-video" if r.modality == "video" else "text-to-image")
            returncode, response, stderr = _run_comfyui(
                prompt, wf_name, output_dir, r.modality,
            )
        elif r.modality == "image":
            returncode, response, stderr = _run_codex_image(a, prompt, r.model)
        elif r.provider == "chatgpt":
            returncode, response, stderr = _run_codex(
                _codex_text_prompt(a, client, prompt), r.model
            )
        else:
            returncode, response, stderr = _run_claude(agent, prompt, r.model)
    _duration_ms = int((time.time() - _t0) * 1000)
    _log_usage(a, r, prompt, response, returncode, _duration_ms, client)

    if returncode != 0:
        cli_name = {
            "chatgpt": "codex", "claude": "claude", "comfyui": "ComfyUI",
        }.get(r.provider, r.provider)
        console.print(f"[red]{cli_name} 에러 (exit {returncode}):[/red]")
        console.print(stderr or "(stderr 비어 있음)")
        raise typer.Exit(returncode)

    if not response:
        console.print("[yellow]응답이 비어 있습니다.[/yellow]")
        return

    console.print(
        Panel(
            response,
            title=f"{a.name} 응답 · {provider_label}",
            border_style="cyan",
        )
    )

    _append_memory(a.name, response, prompt, r)
    console.print(
        f"\n[green]✓ 메모리 4파일 갱신:[/green] "
        f"shared-memory/agents/{a.name}/"
    )


def _run_claude(agent: str, prompt: str, model: str) -> tuple[int, str, str]:
    """Claude Code CLI 호출 — Max 구독 토큰 경유, 별도 API 키 X."""
    cmd = [
        str(CLAUDE_BIN),
        "-p", prompt,
        "--agent", agent,
        "--model", model,
        "--output-format", "text",
        "--no-session-persistence",
        "--add-dir", str(ROOT),
        "--permission-mode", "bypassPermissions",
    ]
    result = subprocess.run(
        cmd,
        cwd=str(ROOT),
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    return result.returncode, (result.stdout or "").strip(), result.stderr or ""


def _codex_text_prompt(a, client: str, prompt: str) -> str:
    """Codex 는 `--agent` 개념이 없으므로 에이전트 정의를 프롬프트에 직접 주입한다."""
    return (
        f"너는 아래 정의된 '{a.name}' 외계 에이전트로서 응답한다. "
        "에이전트 정의를 시스템 프롬프트로 삼아라.\n\n"
        f"=== 에이전트 정의 ===\n{a.body.strip()}\n=== 정의 끝 ===\n\n"
        f"클라이언트: {client}\n사용자 요청: {prompt}"
    )


def _run_codex(full_prompt: str, model: str) -> tuple[int, str, str]:
    """OpenAI Codex CLI 호출 — ChatGPT Pro 구독 사용량 경유, 별도 API 키 X.

    최종 답변은 `--output-last-message` 로 파일에 받아 군더더기 로그를 걸러낸다.
    """
    with tempfile.NamedTemporaryFile(
        suffix=".txt", delete=False, encoding="utf-8", mode="w"
    ) as tf:
        out_path = Path(tf.name)
    try:
        cmd = [str(CODEX_BIN), "exec", "-C", str(ROOT), "--skip-git-repo-check"]
        if model:
            cmd += ["--model", model]
        cmd += ["--output-last-message", str(out_path), full_prompt]
        result = subprocess.run(
            cmd,
            cwd=str(ROOT),
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
        )
        response = out_path.read_text(encoding="utf-8", errors="replace").strip()
        if not response:
            # --output-last-message 가 비면 stdout 으로 폴백
            response = (result.stdout or "").strip()
        return result.returncode, response, result.stderr or ""
    finally:
        out_path.unlink(missing_ok=True)


def _run_codex_image(a, prompt: str, model: str) -> tuple[int, str, str]:
    """Codex CLI 내장 이미지 생성(`$imagegen`) — ChatGPT Pro 구독 경유, 무-API-키."""
    full_prompt = (
        "$imagegen\n"
        f"{prompt}\n\n"
        f"(맥락: '{a.name}' 에이전트의 작업 산출물용 이미지)\n"
        "생성한 이미지를 현재 작업 폴더에 저장하고, 저장 경로를 명시해줘."
    )
    return _run_codex(full_prompt, model)


# ── ComfyUI HTTP 클라이언트 — 4090 로컬 GPU, 무-API-키, 이미지·동영상 ────────
def _media_output_dir(client: str, modality: str) -> Path:
    """ComfyUI/Codex 결과 파일을 떨굴 자리.

    클라이언트 작업이면 `clients/{client}/WHAT/{images|videos}/`,
    자체용이면 `content/{images|videos}/`. 둘 다 없으면 만든다.
    """
    sub = "videos" if modality == "video" else "images"
    if client and client != "_self" and not client.startswith("_self"):
        base = ROOT / "clients" / client / "WHAT" / sub
    else:
        base = ROOT / "content" / sub
    base.mkdir(parents=True, exist_ok=True)
    return base


def _comfyui_alive(url: str) -> bool:
    """ComfyUI 서버가 응답하는지 — 2초 안에 stats 가 떠야 OK."""
    try:
        with urllib.request.urlopen(f"{url}/system_stats", timeout=2) as resp:
            return resp.status == 200
    except (urllib.error.URLError, urllib.error.HTTPError, OSError):
        return False


def _comfyui_submit(url: str, workflow: dict) -> str:
    """워크플로를 큐에 넣고 prompt_id 반환."""
    data = json.dumps({"prompt": workflow}).encode("utf-8")
    req = urllib.request.Request(
        f"{url}/prompt",
        data=data,
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        result = json.loads(resp.read())
    if "prompt_id" not in result:
        raise RuntimeError(f"ComfyUI 응답에 prompt_id 없음: {result}")
    return result["prompt_id"]


def _comfyui_wait(url: str, prompt_id: str, timeout: int) -> dict:
    """history 를 폴링해서 outputs 반환. 큰 모델·동영상은 분 단위 걸린다."""
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(
                f"{url}/history/{prompt_id}", timeout=10
            ) as resp:
                hist = json.loads(resp.read())
            if prompt_id in hist:
                return hist[prompt_id].get("outputs", {})
        except (urllib.error.URLError, urllib.error.HTTPError, OSError):
            pass
        time.sleep(2)
    raise TimeoutError(
        f"ComfyUI 작업이 {timeout}초 안에 끝나지 않음 (prompt_id: {prompt_id})"
    )


def _comfyui_download(url: str, item: dict, save_dir: Path) -> Path:
    """outputs 의 한 항목을 로컬 파일로 다운로드, 저장 경로 반환."""
    qs = urllib.parse.urlencode({
        "filename": item["filename"],
        "subfolder": item.get("subfolder", ""),
        "type": item.get("type", "output"),
    })
    target = save_dir / item["filename"]
    with urllib.request.urlopen(f"{url}/view?{qs}", timeout=60) as resp:
        target.write_bytes(resp.read())
    return target


def _run_comfyui(
    prompt: str, workflow_name: str, output_dir: Path, modality: str,
) -> tuple[int, str, str]:
    """ComfyUI 워크플로 템플릿에 프롬프트 치환 + 큐잉 + 결과 다운로드.

    워크플로 JSON 안의 `{PROMPT}` 자리에 사용자 프롬프트가 들어간다.
    템플릿은 ComfyUI UI 의 'Save (API Format)' 으로 내보낸 후
    프롬프트 텍스트만 {PROMPT} 로 바꿔서 comfyui_workflows/ 에 둔다.
    """
    wf_path = COMFYUI_WORKFLOWS_DIR / f"{workflow_name}.json"
    if not wf_path.exists():
        available = sorted(p.stem for p in COMFYUI_WORKFLOWS_DIR.glob("*.json"))
        return 1, "", (
            f"워크플로 템플릿 없음: {wf_path}\n"
            f"사용 가능: {available or '(없음)'}\n"
            "ComfyUI UI 에서 워크플로를 'Save (API Format)' 으로 내보내고\n"
            "프롬프트 텍스트를 {PROMPT} 로 바꿔서 위 경로에 저장하세요.\n"
            "상세: docs/guides/comfyui-integration.md"
        )

    # JSON 안 문자열에 안전하게 박기 위해 json.dumps 로 이스케이프 후 따옴표 제거
    safe_prompt = json.dumps(prompt, ensure_ascii=False)[1:-1]
    workflow_text = wf_path.read_text(encoding="utf-8")
    workflow_text = workflow_text.replace("{PROMPT}", safe_prompt)
    try:
        workflow = json.loads(workflow_text)
    except json.JSONDecodeError as e:
        return 1, "", f"워크플로 JSON 파싱 실패 (프롬프트 치환 후): {e}"

    try:
        prompt_id = _comfyui_submit(COMFYUI_URL, workflow)
    except Exception as e:
        return 1, "", f"ComfyUI 큐잉 실패: {e}"

    try:
        outputs = _comfyui_wait(COMFYUI_URL, prompt_id, COMFYUI_OUTPUT_TIMEOUT)
    except Exception as e:
        return 1, "", str(e)

    saved: list[str] = []
    for node_id, node_out in outputs.items():
        for key in ("images", "gifs", "videos"):
            for item in node_out.get(key, []):
                try:
                    p = _comfyui_download(COMFYUI_URL, item, output_dir)
                    saved.append(str(p))
                except Exception as e:
                    saved.append(f"[다운로드 실패] {item.get('filename', '?')} — {e}")

    if not saved:
        return 1, "", "ComfyUI 가 출력 파일을 생성하지 않았습니다 (워크플로 확인)."

    response = (
        f"ComfyUI 생성 완료 — {len(saved)} 파일 ({modality})\n"
        f"워크플로: {workflow_name}\n\n"
        + "\n".join(f"  • {p}" for p in saved)
    )
    return 0, response, ""


def _append_memory(agent_name: str, response: str, prompt: str, r) -> None:
    """응답에서 MEMORY UPDATE 섹션을 파싱해 4파일에 append."""
    folder = AGENT_MEMORY / agent_name
    folder.mkdir(parents=True, exist_ok=True)
    now = dt.datetime.now().strftime("%Y-%m-%d %H:%M")
    slug = prompt[:30].replace("/", "-").replace("\n", " ")

    # work.md 는 항상 누적
    work = folder / "work.md"
    work_entry = (
        f"\n### {now} · {slug}\n"
        f"- 입력: {prompt}\n"
        f"- 호출자: cli\n"
        f"- 라우팅: {r.tier} · {r.provider} · {r.model or '계정 기본'}\n"
        f"- 응답 길이: {len(response)} chars\n"
    )
    work.write_text(
        (work.read_text(encoding="utf-8") if work.exists() else "") + work_entry,
        encoding="utf-8",
    )

    # MEMORY UPDATE 섹션 파싱 — learnings / decisions / mistakes
    for kind in ("learnings", "decisions", "mistakes"):
        match = re.search(
            rf"###\s*{kind}\.md\s*\(append\)\s*\n(.*?)(?=\n###|\Z)",
            response,
            re.DOTALL | re.IGNORECASE,
        )
        if not match:
            continue
        content = match.group(1).strip()
        if not content or content in ("(없음)", "{내용 또는 (없음)}"):
            continue
        fpath = folder / f"{kind}.md"
        entry = f"\n### {now} · {slug}\n{content}\n"
        fpath.write_text(
            (fpath.read_text(encoding="utf-8") if fpath.exists() else "") + entry,
            encoding="utf-8",
        )


# ──────────────────────────────────────────────────────────────────────────
# aa voice
# ──────────────────────────────────────────────────────────────────────────
@app.command()
def voice(
    agent: str = typer.Argument(
        None, help="에이전트 이름 (없으면 텍스트만 출력)"
    ),
    language: str = typer.Option(
        "ko-KR", "--lang", "-l",
        help="STT 언어 코드 (기본: ko-KR, 영어: en-US)",
    ),
    client: str = typer.Option(
        "_self", "--client", "-c", help="클라이언트 이름 (에이전트 호출 시)"
    ),
    difficulty: str = typer.Option(
        None, "--difficulty", help="난이도 수동 지정: T1 | T2 | T3"
    ),
    provider: str = typer.Option(
        None, "--provider", help="공급자 강제 지정: claude | chatgpt"
    ),
    offline: bool = typer.Option(
        False, "--offline",
        help="오프라인 STT (faster-whisper, 첫 실행 시 모델 다운로드)",
    ),
) -> None:
    """음성 입력 → 텍스트 변환 (+ 에이전트 호출).

    \b
    aa voice                — 녹음 → 텍스트 출력
    aa voice origin-reader  — 녹음 → 텍스트 → 에이전트 호출
    """
    from aa.voice import record_audio, transcribe

    console.rule("🎙 aa voice")

    try:
        audio_wav = record_audio()
    except Exception as e:
        console.print(f"[red]마이크 오류:[/red] {e}")
        console.print(
            "[dim]마이크가 연결되어 있고 다른 앱이 점유하지 않는지 확인하세요.[/dim]"
        )
        raise typer.Exit(1)

    if not audio_wav:
        console.print("[yellow]녹음된 오디오가 없습니다.[/yellow]")
        raise typer.Exit(1)

    with console.status("[cyan]음성 인식 중...[/cyan]"):
        try:
            text = transcribe(audio_wav, language=language, offline=offline)
        except ValueError as e:
            console.print(f"[yellow]{e}[/yellow]")
            raise typer.Exit(1)
        except (ConnectionError, ImportError) as e:
            console.print(f"[red]{e}[/red]")
            raise typer.Exit(1)

    console.print(
        Panel(
            text,
            title="🎙 음성 → 텍스트",
            border_style="green",
        )
    )

    if agent is None:
        return

    console.print(f"\n[dim]에이전트 '{agent}' 에게 전달합니다...[/dim]\n")
    call(
        agent=agent,
        prompt=text,
        client=client,
        difficulty=difficulty,
        provider=provider,
        modality=None,
        workflow=None,
        dry_run=False,
    )


# ──────────────────────────────────────────────────────────────────────────
# aa hotkey — 글로벌 단축키 음성 입력 (백그라운드 데몬)
# ──────────────────────────────────────────────────────────────────────────
@app.command()
def hotkey(
    agent: str = typer.Argument(
        None, help="Ctrl+Shift+A 로 호출할 기본 에이전트 (없으면 클립보드만)"
    ),
    language: str = typer.Option(
        "ko-KR", "--lang", "-l",
        help="STT 언어 코드 (기본: ko-KR, 영어: en-US)",
    ),
    offline: bool = typer.Option(
        False, "--offline",
        help="오프라인 STT (faster-whisper)",
    ),
) -> None:
    """글로벌 단축키로 음성 입력 — 어디서든 Ctrl+Shift+V.

    \b
    Ctrl+Shift+V  녹음 → 텍스트 → 클립보드 복사
    Ctrl+Shift+A  녹음 → 텍스트 → 에이전트 호출 (agent 지정 시)
    """
    try:
        import keyboard as _kb  # noqa: F401
    except ImportError:
        console.print(
            "[red]keyboard 패키지가 필요합니다.[/red]\n"
            "[dim]  pip install keyboard[/dim]"
        )
        raise typer.Exit(1)

    from aa.hotkey import run_listener

    run_listener(language=language, offline=offline, agent=agent)


# ──────────────────────────────────────────────────────────────────────────
# aa usage — CLI·모델·에이전트별 사용량 집계
# ──────────────────────────────────────────────────────────────────────────
def _log_usage(
    a, r, prompt: str, response: str, returncode: int, duration_ms: int, client: str
) -> None:
    """호출 결과를 JSONL 로 누적 — CLI/모델/모달리티 분리 추적.

    각 줄은 한 호출의 메타데이터. 신규 CLI(예: gemma) 가 추가되면 그 이름이
    `cli` 필드에 자동으로 들어가므로 집계 코드는 손댈 필요가 없다.
    """
    USAGE_DIR.mkdir(parents=True, exist_ok=True)
    date_str = dt.date.today().isoformat()
    log_file = USAGE_DIR / f"{date_str}.jsonl"
    entry = {
        "ts": dt.datetime.now().isoformat(timespec="seconds"),
        "agent": a.name,
        "division": division_of(a.name),
        "client": client,
        "cli": r.provider,            # claude | chatgpt | (gemma 등 미래 CLI)
        "model": r.model or "default",
        "modality": r.modality,       # text | image
        "tier": r.tier,               # T1 | T2 | T3 | -
        "prompt_chars": len(prompt),
        "response_chars": len(response or ""),
        "exit_code": returncode,
        "duration_ms": duration_ms,
    }
    with log_file.open("a", encoding="utf-8") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")


def _parse_when(when: str) -> list[dt.date]:
    """today | yesterday | YYYY-MM-DD | week → 날짜 리스트."""
    today = dt.date.today()
    if when == "today":
        return [today]
    if when == "yesterday":
        return [today - dt.timedelta(days=1)]
    if when == "week":
        return [today - dt.timedelta(days=i) for i in range(7)]
    try:
        return [dt.date.fromisoformat(when)]
    except ValueError:
        console.print(f"[red]잘못된 날짜: {when}[/red]")
        raise typer.Exit(1)


@app.command()
def usage(
    when: str = typer.Argument("today", help="today | yesterday | YYYY-MM-DD | week"),
    by: str = typer.Option(
        "cli", "--by",
        help="집계 기준: cli (기본, 모달리티 분리) | agent | model | modality",
    ),
) -> None:
    """`aa call` 호출의 CLI·모델·에이전트별 사용량 보기."""
    dates = _parse_when(when)
    rows: list[dict] = []
    for d in dates:
        f = USAGE_DIR / f"{d.isoformat()}.jsonl"
        if not f.exists():
            continue
        for line in f.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                rows.append(json.loads(line))
            except json.JSONDecodeError:
                continue

    if not rows:
        console.print(
            f"[yellow]{when}: 사용 기록 없음[/yellow]\n"
            f"[dim](로그 위치: {USAGE_DIR})[/dim]"
        )
        return

    key_fn = {
        "cli": lambda r: f"{r['cli']} ({r['modality']})",  # 모달리티까지 분리
        "agent": lambda r: r["agent"],
        "model": lambda r: f"{r['cli']} · {r['model']}",
        "modality": lambda r: r["modality"],
    }.get(by)
    if not key_fn:
        console.print(
            f"[red]잘못된 --by 값: {by}[/red] "
            "[dim](가능: cli | agent | model | modality)[/dim]"
        )
        raise typer.Exit(1)

    grouped: dict[str, dict] = defaultdict(
        lambda: {
            "calls": 0,
            "prompt_chars": 0,
            "response_chars": 0,
            "duration_ms": 0,
            "errors": 0,
        }
    )
    for rec in rows:
        k = key_fn(rec)
        g = grouped[k]
        g["calls"] += 1
        g["prompt_chars"] += rec.get("prompt_chars", 0)
        g["response_chars"] += rec.get("response_chars", 0)
        g["duration_ms"] += rec.get("duration_ms", 0)
        if rec.get("exit_code", 0) != 0:
            g["errors"] += 1

    period = (
        f"{dates[0]}"
        if len(dates) == 1
        else f"{dates[-1]} ~ {dates[0]} ({len(dates)}일)"
    )
    console.rule(f"🛸 사용량 · {period} · by={by}")
    console.print(f"[dim]전체 호출:[/dim] {len(rows)}회\n")

    table = Table(show_header=True)
    table.add_column(by, no_wrap=True)
    table.add_column("호출", justify="right")
    table.add_column("평균 응답", justify="right")
    table.add_column("평균 시간", justify="right")
    table.add_column("에러", justify="right")

    for k in sorted(grouped.keys(), key=lambda x: -grouped[x]["calls"]):
        g = grouped[k]
        avg_resp = (g["response_chars"] // g["calls"]) if g["calls"] else 0
        avg_time = (g["duration_ms"] / 1000 / g["calls"]) if g["calls"] else 0
        err = f"[red]{g['errors']}[/red]" if g["errors"] else "0"
        table.add_row(
            k, str(g["calls"]), f"{avg_resp} chars", f"{avg_time:.1f}s", err
        )
    console.print(table)

    console.print(
        f"\n[dim]raw 로그: {USAGE_DIR}/[/dim]\n"
        "[dim]신규 CLI(예: gemma) 가 추가되면 자동으로 이 표에 잡힙니다.[/dim]"
    )


# ──────────────────────────────────────────────────────────────────────────
# aa daily-log
# ──────────────────────────────────────────────────────────────────────────
@app.command(name="daily-log")
def daily_log(
    when: str = typer.Argument("today", help="today | yesterday | YYYY-MM-DD"),
    edit: bool = typer.Option(False, "--edit", "-e", help="에디터로 열기"),
) -> None:
    """오늘 일지 보기 / 편집."""
    if when == "today":
        date = dt.date.today()
    elif when == "yesterday":
        date = dt.date.today() - dt.timedelta(days=1)
    else:
        try:
            date = dt.date.fromisoformat(when)
        except ValueError:
            console.print(f"[red]잘못된 날짜: {when}[/red]")
            raise typer.Exit(1)

    path = DAILY_LOGS / f"{date.isoformat()}.md"

    if edit:
        if not path.exists():
            weekday_kr = "월화수목금토일"[date.weekday()]
            path.write_text(
                f"---\ndate: {date.isoformat()}\nweekday: {weekday_kr}요일\n---\n\n"
                f"# {date.isoformat()} ({weekday_kr}) — Alien Agentic\n\n"
                "## 오늘 한 일\n- \n\n"
                "## 내일 첫 행보 1가지\n\n",
                encoding="utf-8",
            )
        editor = os.environ.get("EDITOR", "code")
        subprocess.run([editor, str(path)], check=False)
        return

    if not path.exists():
        console.print(f"[yellow]일지 없음: {path.name}[/yellow]")
        console.print(f"[dim]`aa daily-log {when} --edit` 로 새로 만들기[/dim]")
        return
    console.print(Markdown(path.read_text(encoding="utf-8")))


# ──────────────────────────────────────────────────────────────────────────
# aa push
# ──────────────────────────────────────────────────────────────────────────
@app.command()
def push(
    message: str = typer.Argument(
        None, help="커밋 메시지 (없으면 날짜 기반 자동 생성)"
    ),
) -> None:
    """shared-memory 변경분 → GitHub 자동 push."""
    if message is None:
        message = f"🛸 {dt.date.today().isoformat()} 진척 자동 누적"

    console.rule("🛸 push to GitHub")

    subprocess.run(["git", "add", "."], cwd=ROOT, check=False)
    result = subprocess.run(
        ["git", "diff", "--cached", "--name-only"],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    changed = [line for line in result.stdout.splitlines() if line.strip()]
    if not changed:
        console.print("[dim]변경 없음 — push 생략[/dim]")
        return

    console.print(f"[bold]변경 파일:[/bold] {len(changed)}개")
    for f in changed[:10]:
        console.print(f"  • {f}")
    if len(changed) > 10:
        console.print(f"  ... +{len(changed) - 10}개 더")

    commit_result = subprocess.run(
        [
            "git",
            "commit",
            "-m",
            message,
            "-m",
            "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>",
        ],
        cwd=ROOT,
        check=False,
    )
    if commit_result.returncode != 0:
        console.print("[red]commit 실패 — 위 메시지를 확인해주세요.[/red]")
        return

    push_result = subprocess.run(["git", "push"], cwd=ROOT, check=False)
    if push_result.returncode == 0:
        console.print("[green]✓ push 완료[/green]")
    else:
        console.print("[red]push 실패 — 네트워크 또는 인증을 확인.[/red]")


# ──────────────────────────────────────────────────────────────────────────
# aa serve
# ──────────────────────────────────────────────────────────────────────────
@app.command()
def serve(
    stop: bool = typer.Option(False, "--stop", help="실행 중인 Multica 중지"),
    logs: bool = typer.Option(False, "--logs", help="실시간 로그 (Ctrl+C 종료)"),
    pull: bool = typer.Option(True, "--pull/--no-pull", help="이미지 미리 pull"),
) -> None:
    """Multica 인트라넷 서버를 docker compose 로 띄움/내림."""
    multica_dir = ROOT / "automation" / "intranet" / "multica"
    compose_file = multica_dir / "docker-compose.selfhost.yml"

    if not multica_dir.exists():
        console.print(
            "[red]Multica 본진 폴더 없음:[/red] "
            f"{multica_dir}\n"
            "[dim]먼저 git clone — automation/intranet/alien-config/README.md 참조[/dim]"
        )
        raise typer.Exit(1)

    if not compose_file.exists():
        console.print(
            f"[red]docker-compose.selfhost.yml 없음: {compose_file}[/red]"
        )
        raise typer.Exit(1)

    if stop:
        console.print("[cyan]Multica 중지...[/cyan]")
        result = subprocess.run(
            [
                "docker",
                "compose",
                "-f",
                "docker-compose.selfhost.yml",
                "down",
            ],
            cwd=str(multica_dir),
        )
        if result.returncode == 0:
            console.print("[green]✓ 중지 완료[/green]")
        return

    if logs:
        console.print(
            "[cyan]실시간 로그 (Ctrl+C 로 종료)...[/cyan]"
        )
        subprocess.run(
            [
                "docker",
                "compose",
                "-f",
                "docker-compose.selfhost.yml",
                "logs",
                "-f",
            ],
            cwd=str(multica_dir),
        )
        return

    console.rule("🛸 aa serve — Multica 가동")
    console.print(f"[dim]대상 폴더:[/dim] {multica_dir}")

    # docker CLI 확인
    docker_check = subprocess.run(
        ["docker", "--version"], capture_output=True, text=True
    )
    if docker_check.returncode != 0:
        console.print(
            "[red]docker CLI 가 PATH에 없음.[/red] "
            "Docker Desktop 설치 필요 — https://docker.com"
        )
        raise typer.Exit(1)
    console.print(f"[dim]docker:[/dim] {docker_check.stdout.strip()}")

    if pull:
        console.print("[dim]이미지 pull (latest)...[/dim]")
        subprocess.run(
            [
                "docker",
                "compose",
                "-f",
                "docker-compose.selfhost.yml",
                "pull",
            ],
            cwd=str(multica_dir),
        )

    console.print("[dim]서비스 가동 (detached)...[/dim]")
    result = subprocess.run(
        [
            "docker",
            "compose",
            "-f",
            "docker-compose.selfhost.yml",
            "up",
            "-d",
        ],
        cwd=str(multica_dir),
    )

    if result.returncode == 0:
        console.print("[green]✓ Multica 가동 완료[/green]")
        console.print(
            "  Frontend: [cyan]http://localhost:3000[/cyan]"
        )
        console.print(
            "  Backend:  [cyan]http://localhost:8080[/cyan]"
        )
        console.print()
        console.print("[dim]로그: aa serve --logs[/dim]")
        console.print("[dim]중지: aa serve --stop[/dim]")
        console.print(
            "[dim]27명 시드: automation/intranet/alien-config/README.md[/dim]"
        )
    else:
        console.print(
            "[red]가동 실패 — `aa serve --logs` 로 진단[/red]"
        )


# ──────────────────────────────────────────────────────────────────────────
# aa seed
# ──────────────────────────────────────────────────────────────────────────
_UUID_RE = re.compile(r"^[0-9a-fA-F]{8}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{4}-?"
                      r"[0-9a-fA-F]{4}-?[0-9a-fA-F]{12}$")


def _psql(container: str, sql: str) -> tuple[int, str, str]:
    """Multica postgres 컨테이너 안에서 psql 단일 쿼리 — -tAc 로 값만 받는다."""
    result = subprocess.run(
        [
            "docker", "exec", "-e", "PGPASSWORD=multica", container,
            "psql", "-U", "multica", "-d", "multica", "-tAc", sql,
        ],
        capture_output=True, text=True, encoding="utf-8", errors="replace",
    )
    return result.returncode, result.stdout.strip(), result.stderr.strip()


@app.command()
def seed(
    slug: str = typer.Option(
        "alien-agentic", "--slug", help="대상 워크스페이스 slug"
    ),
    email: str = typer.Option(
        None, "--email", help="owner 사용자 이메일 (사용자가 여럿일 때 지정)"
    ),
    container: str = typer.Option(
        "multica-postgres-1", "--container", help="Multica postgres 컨테이너 이름"
    ),
    dry_run: bool = typer.Option(
        False, "--dry-run", help="DB 변경 없이 발견한 ID + 계획만 출력"
    ),
) -> None:
    """27명 외계 동료를 Multica DB에 시드 — ID 자동 탐색 + 런타임 자동 생성.

    수작업 psql 5단계(README 3~6단계)를 한 명령으로 압축한다. 모든 DB 작업은
    `docker exec` 로 컨테이너 안에서 처리하므로 postgres 포트 노출이 필요 없다.
    """
    console.rule("🛸 aa seed — 27명 외계 동료 시드")

    # 0) docker + 컨테이너 확인
    ps = subprocess.run(
        ["docker", "ps", "--format", "{{.Names}}"],
        capture_output=True, text=True, encoding="utf-8", errors="replace",
    )
    if ps.returncode != 0:
        console.print(
            "[red]docker 에 연결할 수 없습니다.[/red] "
            "Docker Desktop 이 켜져 있고 `aa serve` 로 Multica 가 떠 있어야 합니다."
        )
        raise typer.Exit(1)
    names = ps.stdout.split()
    if container not in names:
        console.print(
            f"[red]컨테이너 '{container}' 를 찾을 수 없습니다.[/red]\n"
            f"[dim]현재 실행 중: {', '.join(names) or '(없음)'}[/dim]\n"
            "[dim]`aa serve` 로 Multica 를 먼저 띄우세요. "
            "이름이 다르면 --container 로 지정.[/dim]"
        )
        raise typer.Exit(1)

    # 1) WORKSPACE_ID 탐색 — slug 기준
    rc, ws_id, err = _psql(
        container, f"SELECT id FROM workspace WHERE slug = '{slug}'"
    )
    if rc != 0:
        console.print(f"[red]workspace 조회 실패:[/red] {err}")
        raise typer.Exit(1)
    ws_id = ws_id.splitlines()[0].strip() if ws_id else ""
    if not ws_id:
        console.print(
            f"[red]slug '{slug}' 인 워크스페이스가 없습니다.[/red]\n"
            "[dim]http://localhost:3000 에서 회원가입 후 워크스페이스를 "
            "먼저 만드세요 (slug 가 다르면 --slug 로 지정).[/dim]"
        )
        raise typer.Exit(1)

    # 2) OWNER_ID 탐색 — 사용자가 하나면 자동, 여럿이면 --email 필요
    if email:
        rc, out, err = _psql(
            container, f'SELECT id FROM "user" WHERE email = \'{email}\''
        )
    else:
        rc, out, err = _psql(container, 'SELECT id FROM "user"')
    if rc != 0:
        console.print(f"[red]user 조회 실패:[/red] {err}")
        raise typer.Exit(1)
    user_ids = [ln.strip() for ln in out.splitlines() if ln.strip()]
    if not user_ids:
        console.print(
            "[red]사용자가 없습니다.[/red] "
            "http://localhost:3000 에서 회원가입을 먼저 하세요."
        )
        raise typer.Exit(1)
    if len(user_ids) > 1:
        console.print(
            f"[red]사용자가 {len(user_ids)}명입니다 — "
            "--email 로 owner 를 지정하세요.[/red]"
        )
        raise typer.Exit(1)
    owner_id = user_ids[0]

    # 3) RUNTIME_ID 탐색 — 살아 있는 데몬 런타임 우선, 그다음 최신
    #    가짜 런타임은 만들지 않는다 — 데몬이 없으면 27명이 죽은 런타임에
    #    영구히 묶여 오프라인이 된다 (2026-05-14 학습).
    rc, rt_id, err = _psql(
        container,
        f"SELECT id FROM agent_runtime WHERE workspace_id = '{ws_id}' "
        "ORDER BY (status = 'online') DESC, created_at DESC LIMIT 1",
    )
    if rc != 0:
        console.print(f"[red]agent_runtime 조회 실패:[/red] {err}")
        raise typer.Exit(1)
    rt_id = rt_id.splitlines()[0].strip() if rt_id else ""
    if not rt_id:
        console.print(
            "[red]agent_runtime 가 하나도 없습니다.[/red]\n"
            "[dim]Multica 데몬을 먼저 띄우세요 — 데몬이 진짜 런타임을 등록합니다:\n"
            "  multica daemon start\n"
            "  multica daemon status\n"
            "그 후 다시 `aa seed` 를 실행하면 진짜 런타임에 27명을 묶습니다.[/dim]"
        )
        raise typer.Exit(1)

    console.print(f"[dim]WORKSPACE_ID:[/dim] {ws_id}")
    console.print(f"[dim]OWNER_ID:    [/dim] {owner_id}")
    console.print(f"[dim]RUNTIME_ID:  [/dim] {rt_id}")

    agents = load_all()
    console.print(f"[dim]발견된 외계 동료:[/dim] {len(agents)}명\n")

    if dry_run:
        console.print("[yellow]--dry-run: DB 변경 없음[/yellow]")
        for a in agents:
            console.print(
                f"  + {a.name:<22} ({division_of(a.name):<5} {a.model})"
            )
        console.print(
            f"\n[dim]위 {len(agents)}건이 '{slug}' 워크스페이스에 "
            "INSERT 될 예정입니다 (이미 있는 name 은 SKIP).[/dim]"
        )
        return

    # UUID 형식 방어 — SQL 인터폴레이션 전에 검증
    for label, val in (
        ("WORKSPACE_ID", ws_id), ("OWNER_ID", owner_id), ("RUNTIME_ID", rt_id)
    ):
        if not _UUID_RE.match(val):
            console.print(
                f"[red]{label} 형식이 UUID 가 아닙니다: {val}[/red]\n"
                "[dim]스키마가 예상과 다릅니다 — 이 메시지를 알려주세요.[/dim]"
            )
            raise typer.Exit(1)

    # 4) 27명 INSERT SQL 생성 — dollar-quoting 으로 본문(따옴표·줄바꿈) 안전 처리
    tag = "AASEED"
    dollar = f"${tag}$"
    for a in agents:
        if dollar in a.body or dollar in a.description:
            console.print(
                f"[red]'{a.name}' 정의에 예약어 {dollar} 가 들어 있습니다.[/red]"
            )
            raise typer.Exit(1)

    def dq(s: str) -> str:
        return f"{dollar}{s}{dollar}"

    runtime_config_json = '{"provider": "claude_code"}'
    statements: list[str] = []
    for a in agents:
        div = division_of(a.name)
        description = f"[{div}] {a.description}"
        statements.append(
            "INSERT INTO agent ("
            "workspace_id, owner_id, runtime_id, name, description, "
            "instructions, runtime_mode, runtime_config, visibility, model, "
            "status, max_concurrent_tasks) "
            "SELECT "
            f"'{ws_id}', '{owner_id}', '{rt_id}', "
            + dq(a.name) + ", " + dq(description) + ", "
            + dq(a.body.strip()) + ", 'local', "
            + dq(runtime_config_json) + "::jsonb, 'workspace', "
            + dq(a.model) + ", 'offline', 1 "
            "WHERE NOT EXISTS (SELECT 1 FROM agent WHERE "
            f"workspace_id = '{ws_id}' AND name = " + dq(a.name) + ");"
        )

    # status 는 'offline' 로 둔다 — agent 가 실제로 online 이 되는 것은
    # 살아 있는 Multica 런타임 데몬이 붙었을 때뿐이다 (DB 컬럼을 임의로
    # 'online' 으로 박는 건 거짓 표시일 뿐 작업 실행을 만들지 못한다).
    sql_text = "BEGIN;\n" + "\n".join(statements) + "\nCOMMIT;\n"

    with console.status("[cyan]27명 시드 중...[/cyan]"):
        result = subprocess.run(
            [
                "docker", "exec", "-i", "-e", "PGPASSWORD=multica", container,
                "psql", "-U", "multica", "-d", "multica",
                "-v", "ON_ERROR_STOP=1",
            ],
            input=sql_text, capture_output=True, text=True,
            encoding="utf-8", errors="replace",
        )

    if result.returncode != 0:
        console.print("[red]시드 실패 — psql 에러:[/red]")
        console.print(result.stderr or "(stderr 비어 있음)")
        console.print(
            "[dim]스키마가 다르면 위 에러를 그대로 알려주세요 — "
            "컬럼명을 맞추겠습니다.[/dim]"
        )
        raise typer.Exit(1)

    inserted = result.stdout.count("INSERT 0 1")
    skipped = result.stdout.count("INSERT 0 0")
    console.print(
        f"[green]✓ 시드 완료:[/green] 신규 {inserted}명 / 스킵 {skipped}명"
    )
    console.print(
        "  http://localhost:3000 → Settings → Agents 에서 확인하세요."
    )
    console.print(
        "[dim]27명은 'offline' 로 들어갑니다 — 실제 작업 실행은 살아 있는 "
        "Multica 런타임 데몬이 붙어야 합니다 (Phase 2).[/dim]"
    )


if __name__ == "__main__":
    app()
