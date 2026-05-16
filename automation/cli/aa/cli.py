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
    SQUADS_DIR,
    USAGE_DIR,
    USER_NAME,
)
from aa.router import MODALITIES, PROVIDERS, TIERS, Route, route
from aa.squads import VALID_STATUSES, load_all_squads, load_squad, scaffold_squad

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
# 공용 — 하단 네비게이션 푸터
# ──────────────────────────────────────────────────────────────────────────
def _nav_footer() -> None:
    """결과물 하단에 받은함·이슈·대시보드 바로가기 표시."""
    open_msgs = _count_open(MESSAGES)
    open_issues = _count_open(INTERVENTIONS)

    msg_badge = f"[bold yellow]{open_msgs}[/bold yellow]" if open_msgs else "[dim]0[/dim]"
    issue_badge = f"[bold red]{open_issues}[/bold red]" if open_issues else "[dim]0[/dim]"

    console.print()
    console.print(
        f"[dim]───[/dim] "
        f"📨 받은함 {msg_badge} [dim]aa inbox[/dim]  │  "
        f"⚠ 이슈 {issue_badge} [dim]aa issues[/dim]  │  "
        f"📊 [dim]aa status[/dim]"
    )


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

    _nav_footer()


# ──────────────────────────────────────────────────────────────────────────
# aa inbox / aa issues — 받은함·이슈 바로 확인
# ──────────────────────────────────────────────────────────────────────────
def _list_open_items(folder, title: str, emoji: str) -> None:
    """폴더 안의 status:open 항목을 테이블로 표시."""
    items = []
    if folder.exists():
        for p in sorted(folder.glob("*.md"), reverse=True):
            if p.name == "README.md":
                continue
            try:
                text = p.read_text(encoding="utf-8", errors="ignore")
            except OSError:
                continue
            if "status: open" in text:
                lines = text.splitlines()
                summary = ""
                for ln in lines:
                    if ln.strip() and not ln.startswith("---") and not ln.startswith("#") and "status:" not in ln:
                        summary = ln.strip()[:80]
                        break
                items.append((p.name, summary))

    console.rule(f"{emoji} {title} ({len(items)}건 열림)")

    if not items:
        console.print(f"[green]열린 항목 없음[/green] — 깨끗합니다!")
        console.print(f"[dim]폴더: {folder}[/dim]")
        return

    tbl = Table(show_header=True, header_style="bold")
    tbl.add_column("#", width=3)
    tbl.add_column("파일", style="cyan")
    tbl.add_column("요약")

    for idx, (name, summary) in enumerate(items, 1):
        tbl.add_row(str(idx), name, summary)

    console.print(tbl)
    console.print(f"\n[dim]폴더: {folder}[/dim]")


@app.command()
def inbox() -> None:
    """받은함 — 에이전트 간 미응답 메시지 확인."""
    _list_open_items(MESSAGES, "받은함 (에이전트 메시지)", "📨")
    _nav_footer()


@app.command()
def issues() -> None:
    """이슈 — 미해결 개입(interventions) 확인."""
    _list_open_items(INTERVENTIONS, "이슈 (기영님 개입)", "⚠")
    _nav_footer()


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

    _nav_footer()


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


def _group_rows(rows: list[dict], key_fn) -> dict:
    g: dict[str, dict] = defaultdict(
        lambda: {
            "calls": 0, "prompt_chars": 0, "response_chars": 0,
            "duration_ms": 0, "errors": 0,
        }
    )
    for r in rows:
        k = key_fn(r)
        gv = g[k]
        gv["calls"] += 1
        gv["prompt_chars"] += r.get("prompt_chars", 0)
        gv["response_chars"] += r.get("response_chars", 0)
        gv["duration_ms"] += r.get("duration_ms", 0)
        if r.get("exit_code", 0) != 0:
            gv["errors"] += 1
    return g


def _write_usage_markdown(
    rows: list[dict], dates: list[dt.date], period_label: str
) -> Path:
    """`aa usage` 결과를 Obsidian 에서 볼 수 있는 마크다운 페이지로 저장.

    기영님이 shared-memory/ 를 Obsidian Vault 로 열어두면 그대로 보임.
    파일명은 안정적(`summary-today.md` 등) — 호출할 때마다 덮어쓴다.
    """
    USAGE_DIR.mkdir(parents=True, exist_ok=True)

    period_str = (
        str(dates[0])
        if len(dates) == 1
        else f"{dates[-1]} ~ {dates[0]} ({len(dates)}일)"
    )
    lines: list[str] = []
    lines.append(f"# 🛸 사용량 리포트 — {period_label}")
    lines.append("")
    lines.append(f"> 자동 생성. `aa usage {period_label}` 호출 시마다 갱신.")
    lines.append(f"> 기간: **{period_str}** · 전체 호출: **{len(rows)}회**")
    lines.append(f"> 마지막 갱신: {dt.datetime.now().isoformat(timespec='seconds')}")
    lines.append("")

    if not rows:
        lines.append("## (이 기간에 기록된 호출이 없습니다)")
        lines.append("")
        lines.append("`aa call` 을 한 번 실행하면 표가 채워집니다:")
        lines.append("")
        lines.append("```bash")
        lines.append("aa call story-weaver \"Alien Agentic 마스터 내러티브 30초\"")
        lines.append("aa call case-curator \"지난주 케이스 목록 정리\"")
        lines.append("aa usage  # 다시 보기")
        lines.append("```")
        lines.append("")
        lines.append("---")
        lines.append(
            f"*Generated by `aa usage` at "
            f"{dt.datetime.now().isoformat(timespec='seconds')}*"
        )
        lines.append("")
        safe = re.sub(r"[^A-Za-z0-9가-힣\-_.]", "_", period_label)
        fpath = USAGE_DIR / f"summary-{safe}.md"
        fpath.write_text("\n".join(lines), encoding="utf-8")
        return fpath

    # 1) CLI · 모달리티 — 가장 중요한 단면
    cli_g = _group_rows(rows, lambda r: f"{r.get('cli', '?')} ({r.get('modality', '?')})")
    lines.append("## CLI · 모달리티 별")
    lines.append("")
    lines.append("| CLI | 호출 | 평균 응답 | 평균 시간 | 에러 |")
    lines.append("|---|---:|---:|---:|---:|")
    for k in sorted(cli_g.keys(), key=lambda x: -cli_g[x]["calls"]):
        g = cli_g[k]
        avg_resp = (g["response_chars"] // g["calls"]) if g["calls"] else 0
        avg_time = (g["duration_ms"] / 1000 / g["calls"]) if g["calls"] else 0
        err = f"**{g['errors']}**" if g["errors"] else "0"
        lines.append(
            f"| {k} | {g['calls']} | {avg_resp} chars | {avg_time:.1f}s | {err} |"
        )
    lines.append("")

    # 2) 에이전트별 상위 10
    agent_g = _group_rows(rows, lambda r: r.get("agent", "?"))
    div_lookup = {r["agent"]: r.get("division", "?") for r in rows if "agent" in r}
    lines.append("## 에이전트별 (상위 10)")
    lines.append("")
    lines.append("| Agent | Division | 호출 | 평균 응답 |")
    lines.append("|---|---|---:|---:|")
    for k in sorted(agent_g.keys(), key=lambda x: -agent_g[x]["calls"])[:10]:
        g = agent_g[k]
        avg_resp = (g["response_chars"] // g["calls"]) if g["calls"] else 0
        lines.append(
            f"| {k} | {div_lookup.get(k, '?')} | {g['calls']} | {avg_resp} chars |"
        )
    lines.append("")

    # 3) CLI · 모델 별
    model_g = _group_rows(rows, lambda r: f"{r.get('cli', '?')} · {r.get('model', '?')}")
    lines.append("## CLI · 모델 별")
    lines.append("")
    lines.append("| CLI · 모델 | 호출 |")
    lines.append("|---|---:|")
    for k in sorted(model_g.keys(), key=lambda x: -model_g[x]["calls"]):
        lines.append(f"| {k} | {model_g[k]['calls']} |")
    lines.append("")

    # 4) 모달리티 별
    mod_g = _group_rows(rows, lambda r: r.get("modality", "?"))
    lines.append("## 모달리티별")
    lines.append("")
    lines.append("| Modality | 호출 |")
    lines.append("|---|---:|")
    for k in sorted(mod_g.keys(), key=lambda x: -mod_g[x]["calls"]):
        lines.append(f"| {k} | {mod_g[k]['calls']} |")
    lines.append("")

    # 5) 마지막 10개 호출 — narrative 흐름
    last = sorted(rows, key=lambda x: x.get("ts", ""), reverse=True)[:10]
    if last:
        lines.append("## 마지막 10개 호출")
        lines.append("")
        lines.append("| 시간 | Agent | CLI | Modality | 응답 (chars) | 시간(s) | 상태 |")
        lines.append("|---|---|---|---|---:|---:|:-:|")
        for r in last:
            t = r.get("ts", "").split("T")[-1].split("+")[0]
            secs = (r.get("duration_ms", 0) / 1000)
            status = "⚠️" if r.get("exit_code", 0) != 0 else "✓"
            lines.append(
                f"| {t} | {r.get('agent', '?')} | {r.get('cli', '?')} | "
                f"{r.get('modality', '?')} | {r.get('response_chars', 0)} | "
                f"{secs:.1f} | {status} |"
            )
        lines.append("")

    lines.append("---")
    lines.append(
        f"*Generated by `aa usage` at "
        f"{dt.datetime.now().isoformat(timespec='seconds')}*"
    )
    lines.append("")

    # 안정적 파일명 — 매 호출마다 덮어쓰기
    safe = re.sub(r"[^A-Za-z0-9가-힣\-_.]", "_", period_label)
    fpath = USAGE_DIR / f"summary-{safe}.md"
    fpath.write_text("\n".join(lines), encoding="utf-8")
    return fpath


@app.command()
def usage(
    when: str = typer.Argument("today", help="today | yesterday | YYYY-MM-DD | week"),
    by: str = typer.Option(
        "cli", "--by",
        help="집계 기준: cli (기본, 모달리티 분리) | agent | model | modality",
    ),
    no_page: bool = typer.Option(
        False, "--no-page", help="마크다운 페이지 생성 생략 (콘솔만)"
    ),
) -> None:
    """`aa call` 호출의 CLI·모델·에이전트별 사용량 보기 + 마크다운 페이지 생성."""
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
        # 빈 페이지라도 항상 갱신 — 사용자가 페이지를 *최신 상태* 라고 신뢰할 수 있게
        if not no_page:
            try:
                page_path = _write_usage_markdown(rows, dates, when)
                rel = (
                    page_path.relative_to(ROOT)
                    if page_path.is_relative_to(ROOT) else page_path
                )
                console.print(
                    f"[green]📄 페이지 갱신:[/green] [cyan]{rel}[/cyan]"
                    " [dim](빈 상태)[/dim]"
                )
            except Exception as e:
                console.print(f"[yellow]⚠ 페이지 생성 실패: {e}[/yellow]")
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

    # 마크다운 페이지 자동 생성 — Obsidian Vault 로 열려 있으면 그대로 보임
    if not no_page:
        try:
            page_path = _write_usage_markdown(rows, dates, when)
            rel = page_path.relative_to(ROOT) if page_path.is_relative_to(ROOT) else page_path
            console.print(
                f"\n[green]📄 페이지 생성:[/green] [cyan]{rel}[/cyan]\n"
                "[dim]Obsidian / VS Code / 임의의 마크다운 뷰어에서 열어보세요.[/dim]"
            )
        except Exception as e:
            console.print(f"[yellow]⚠ 페이지 생성 실패: {e}[/yellow]")


# ──────────────────────────────────────────────────────────────────────────
# aa voice — 음성 명령 (4090 GPU + Whisper, 무-API-키)
# ──────────────────────────────────────────────────────────────────────────
def _guess_agent_from_text(text: str) -> str | None:
    """전사 텍스트에서 27명 중 하나를 자동 감지.

    한국어 발음(스토리위버, 콘텐트스카웃 …) 과 영어 슬러그 둘 다 매칭.
    """
    text_norm = text.lower().replace(" ", "").replace("-", "").replace("_", "")
    all_agents = [p.stem for p in AGENTS_DIR.glob("*.md")]

    # 영어 슬러그 직접 매칭 (가장 신뢰)
    for name in all_agents:
        norm = name.replace("-", "").replace("_", "")
        if norm in text_norm:
            return name

    # 한국어 발음 매핑 — 자주 호명될 직원만, 나머지는 영어 슬러그로
    KR_MAP = {
        "스토리위버": "story-weaver", "스토리": "story-weaver",
        "콘텐트스카웃": "content-scout", "컨텐트스카웃": "content-scout",
        "콘텐츠스카웃": "content-scout", "콘텐트스카우트": "content-scout",
        "케이스큐레이터": "case-curator", "케이스": "case-curator",
        "유아이": "ui-ux-designer", "유엑스": "ui-ux-designer", "디자이너": "ui-ux-designer",
        "브랜드키퍼": "brand-keeper", "브랜드": "brand-keeper",
        "오리진리더": "origin-reader", "오리진": "origin-reader",
        "비전아키텍트": "vision-architect", "비전": "vision-architect",
        "페인": "pain-interpreter", "페인인터프리터": "pain-interpreter",
        "컬쳐": "culture-linguist", "컬처": "culture-linguist",
        "에이전트아키텍트": "agent-architect", "에이전트설계": "agent-architect",
        "프로세스": "process-cartographer",
        "워크플로": "workflow-engineer", "워크플로우": "workflow-engineer",
        "데이터": "data-strategist",
        "케이피아이": "kpi-translator", "KPI": "kpi-translator",
        "조직": "org-designer",
        "통합": "integration-specialist", "인테그레이션": "integration-specialist",
        "프롬프트": "prompt-engineer",
        "서브에이전트": "subagent-builder", "에이전트빌더": "subagent-builder",
        "엠씨피": "mcp-connector", "MCP": "mcp-connector",
        "오토메이션": "automation-coder", "자동화": "automation-coder",
        "지식": "knowledge-architect", "옵시디언": "knowledge-architect",
        "테스터": "qa-tester", "큐에이": "qa-tester", "QA": "qa-tester",
        "세일즈": "sales-closer", "영업": "sales-closer",
        "컨시어지": "client-concierge", "클라이언트": "client-concierge",
        "파이낸스": "finance-tracker", "재무": "finance-tracker",
        "트렌드": "trend-hunter",
        "퓨처": "future-forecaster", "예측": "future-forecaster",
    }
    for kr, en in KR_MAP.items():
        if kr.lower().replace(" ", "") in text_norm:
            return en
    return None


@app.command()
def voice(
    agent: str = typer.Option(
        None, "--agent", "-a", help="에이전트 미리 지정 (없으면 음성에서 자동 감지 + 묻기)"
    ),
    seconds: int = typer.Option(
        0, "--seconds", "-s",
        help="녹음 시간(초). 0 = Enter 키로 직접 종료 (권장)",
    ),
    language: str = typer.Option(
        "ko", "--language", help="음성 언어 (ko / en / auto)"
    ),
    model: str = typer.Option(
        "base", "--model",
        help="Whisper 모델: tiny / base / small / medium / large / large-v3",
    ),
    no_execute: bool = typer.Option(
        False, "--no-execute", help="전사만 — aa call 실행 생략"
    ),
    client: str = typer.Option(
        "_self", "--client", "-c", help="클라이언트 (자동 실행 시 aa call 에 전달)"
    ),
) -> None:
    """🎤 음성으로 27명 외계 동료에게 명령 (Whisper 로컬 STT, 무-API-키)."""
    # Lazy import — voice 안 쓰는 사용자에게 의존성 강요 X
    try:
        import sounddevice as sd
        import numpy as np
        import whisper
    except ImportError as e:
        missing = getattr(e, "name", "(unknown)")
        console.print(
            f"[red]음성 의존성 미설치: {missing}[/red]\n"
            "[dim]설치: .\\.venv\\Scripts\\pip.exe install -e .[voice][/dim]\n"
            "[dim](첫 설치 시 PyTorch + Whisper 모델로 ~3GB)[/dim]\n"
            "[dim]상세: docs/guides/voice-commands.md[/dim]"
        )
        raise typer.Exit(1)

    console.rule("🎤 음성 명령")
    sample_rate = 16000  # Whisper 권장값

    # ── 1) 녹음 ─────────────────────────────────────────────────────────
    if seconds > 0:
        console.print(f"[cyan]🎤 {seconds}초 녹음 중...[/cyan]")
        rec = sd.rec(int(seconds * sample_rate), samplerate=sample_rate,
                     channels=1, dtype="int16")
        sd.wait()
        audio = rec.flatten()
    else:
        import queue as _queue
        q: "_queue.Queue" = _queue.Queue()

        def _cb(indata, frames, time_info, status):
            q.put(indata.copy())

        try:
            with sd.InputStream(
                samplerate=sample_rate, channels=1,
                callback=_cb, dtype="int16",
            ):
                input("⏺ 녹음 중... [Enter 키로 종료] ")
        except sd.PortAudioError as e:
            console.print(f"[red]마이크 접근 실패: {e}[/red]")
            console.print(
                "[dim]Windows 설정 → 개인정보 → 마이크 → 앱 액세스 허용 필요[/dim]"
            )
            raise typer.Exit(1)
        chunks = []
        while not q.empty():
            chunks.append(q.get())
        if not chunks:
            console.print("[red]녹음된 데이터가 없습니다.[/red]")
            raise typer.Exit(1)
        audio = np.concatenate(chunks).flatten()

    duration = len(audio) / sample_rate
    console.print(f"[dim]녹음 완료 — {duration:.1f}초[/dim]")

    # ── 2) WAV 저장 (stdlib wave 사용, 추가 dep 없음) ────────────────────
    import wave
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tf:
        wav_path = Path(tf.name)
    try:
        with wave.open(str(wav_path), "wb") as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)  # int16
            wf.setframerate(sample_rate)
            wf.writeframes(audio.tobytes())

        # ── 3) STT — Whisper ────────────────────────────────────────────
        console.print(f"[cyan]🔍 음성 인식 중 (Whisper {model})...[/cyan]")
        try:
            w = whisper.load_model(model)
        except Exception as e:
            console.print(f"[red]Whisper 모델 로드 실패: {e}[/red]")
            raise typer.Exit(1)
        kwargs: dict = {}
        if language and language != "auto":
            kwargs["language"] = language
        try:
            result = w.transcribe(str(wav_path), **kwargs)
        except Exception as e:
            console.print(f"[red]전사 실패: {e}[/red]")
            raise typer.Exit(1)
        text = (result.get("text") or "").strip()
    finally:
        wav_path.unlink(missing_ok=True)

    if not text:
        console.print("[yellow]인식된 텍스트가 비어 있습니다. 다시 시도해주세요.[/yellow]")
        return

    console.print(Panel(text, title="✓ 인식 결과", border_style="green"))

    # ── 4) 에이전트 선택 ────────────────────────────────────────────────
    if not agent:
        guess = _guess_agent_from_text(text)
        if guess:
            console.print(f"[dim]자동 감지된 에이전트:[/dim] [bold cyan]{guess}[/bold cyan]")
            agent = typer.prompt("어느 에이전트?", default=guess)
        else:
            console.print(
                "[dim]자동 감지 실패 — `aa list` 로 명단 확인 가능[/dim]"
            )
            agent = typer.prompt("어느 에이전트?")

    # ── 5) aa call 실행 ─────────────────────────────────────────────────
    if no_execute:
        console.print(
            f"\n[yellow]--no-execute: aa call 실행 생략[/yellow]\n"
            f"[dim]직접 실행하려면:[/dim] [cyan]aa call {agent} \"{text}\" -c {client}[/cyan]"
        )
        return

    if not typer.confirm(f"\naa call {agent} 호출할까요?", default=True):
        console.print(
            f"[dim]취소됨. 직접 실행:[/dim] "
            f"[cyan]aa call {agent} \"{text}\" -c {client}[/cyan]"
        )
        return

    # 같은 Python 으로 self-call — 격리·안정성 우선 (typer 컨텍스트 재진입 회피)
    console.print(f"\n[dim]aa call {agent} 호출 중...[/dim]\n")
    result = subprocess.run(
        [sys.executable, "-m", "aa.cli", "call", agent, text, "-c", client],
        cwd=str(ROOT),
    )
    raise typer.Exit(result.returncode)


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
        # multica 데몬도 같이 띄움 — 죽으면 27명이 오프라인 되니까
        console.print()
        _ensure_multica_daemon()
    else:
        console.print(
            "[red]가동 실패 — `aa serve --logs` 로 진단[/red]"
        )


def _multica_daemon_status(multica_bin: str) -> str:
    """multica 데몬 상태를 'running' | 'stopped' | 'unknown' 으로 정규화."""
    try:
        r = subprocess.run(
            [multica_bin, "daemon", "status"],
            capture_output=True, text=True,
            encoding="utf-8", errors="replace", timeout=10,
        )
    except (subprocess.TimeoutExpired, FileNotFoundError, OSError):
        return "unknown"
    out = (r.stdout + " " + r.stderr).lower()
    if "running" in out or "active" in out or "online" in out:
        return "running"
    if "stopped" in out or "not running" in out or "inactive" in out:
        return "stopped"
    return "unknown"


def _ensure_multica_daemon() -> None:
    """multica 데몬 상태 확인 + 죽어 있으면 띄움.

    multica CLI 가 없으면 안내만 하고 패스 (필수 의존이 아니라 enhancement).
    `aa serve` 가 끝날 때마다 호출돼서 — Multica docker 가 살아 있는 동안
    데몬도 자동으로 따라 살아 있게 한다.
    """
    from shutil import which

    multica_bin = which("multica")
    if not multica_bin:
        console.print(
            "[dim]multica CLI 없음 — 데몬 자동 시작 건너뜀. "
            "(27명 실행을 원하면 multica CLI 설치 후 `multica daemon start`)[/dim]"
        )
        return

    status = _multica_daemon_status(multica_bin)
    if status == "running":
        console.print(
            "[green]✓ multica 데몬 이미 실행 중 — 27명 online[/green]"
        )
        return

    console.print("[dim]multica 데몬 시작 중...[/dim]")
    try:
        r = subprocess.run(
            [multica_bin, "daemon", "start"],
            capture_output=True, text=True,
            encoding="utf-8", errors="replace", timeout=30,
        )
    except (subprocess.TimeoutExpired, OSError) as e:
        console.print(f"[yellow]⚠ multica daemon start 호출 실패: {e}[/yellow]")
        return
    if r.returncode != 0:
        console.print(
            f"[yellow]⚠ multica daemon start (exit {r.returncode}):[/yellow]\n"
            f"{(r.stderr or r.stdout or '').strip()}"
        )
        return

    time.sleep(2)
    if _multica_daemon_status(multica_bin) == "running":
        console.print(
            "[green]✓ multica 데몬 가동 완료 — 27명 곧 online[/green]"
        )
    else:
        console.print(
            "[yellow]⚠ multica 데몬 상태 확인 안 됨 — "
            "`multica daemon status` 직접 확인 권장[/yellow]"
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


# ── aa design — open-design 으로 디자인 생성 ──────────────
def _deep_find(obj, key: str):
    """중첩 dict/list 에서 key 의 첫 비어있지 않은 문자열 값을 찾는다.
    open-design SSE 의 wire format 세부에 의존하지 않고 artifactId 를 잡기 위함."""
    if isinstance(obj, dict):
        val = obj.get(key)
        if isinstance(val, str) and val:
            return val
        for v in obj.values():
            found = _deep_find(v, key)
            if found:
                return found
    elif isinstance(obj, list):
        for item in obj:
            found = _deep_find(item, key)
            if found:
                return found
    return None


def _od_post(base: str, path: str, body: dict, timeout: int = 30) -> dict:
    """open-design 데몬에 JSON POST → JSON 응답."""
    data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(
        f"{base}{path}", data=data,
        headers={"Content-Type": "application/json"}, method="POST",
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


@app.command()
def design(
    prompt: str = typer.Argument(..., help="디자인 요청 (예: '주간 대시보드')"),
    system: str = typer.Option(
        "alien-agentic", "--system", "-s",
        help="디자인 시스템 ID (open-design design-systems/ — 프로젝트별 톤)",
    ),
    client: str = typer.Option("_self", "--client", "-c", help="클라이언트 (산출물 경로)"),
    out: str = typer.Option(None, "--out", help="저장 폴더 (없으면 자동)"),
    daemon_url: str = typer.Option(
        None, "--daemon-url", help="open-design 데몬 URL (없으면 OD_DAEMON_URL → 7456)"
    ),
    agent: str = typer.Option("claude", "--agent", help="에이전트 CLI id (데몬 /api/agents 의 id — claude·codex·gemini…)"),
    dry_run: bool = typer.Option(False, "--dry-run", help="호출 없이 계획만 출력"),
    debug: bool = typer.Option(False, "--debug", help="project 응답 + SSE raw 출력/저장 (진단)"),
) -> None:
    """open-design 으로 디자인 생성 — 프로젝트 톤(design system) 적용 → HTML 저장.

    흐름: POST /api/projects (design system 주입) → POST /api/chat (SSE) →
    live_artifact 의 artifactId 수집 → GET /api/live-artifacts/:id/preview (HTML).
    """
    base = (
        daemon_url or os.environ.get("OD_DAEMON_URL") or "http://127.0.0.1:7456"
    ).rstrip("/")

    if out:
        out_dir = Path(out)
    elif client and not client.startswith("_self"):
        out_dir = ROOT / "clients" / client / "WHAT" / "designs"
    else:
        out_dir = ROOT / "content" / "designs"

    if dry_run:
        console.print("[cyan]aa design (dry-run)[/cyan]")
        console.print(f"  데몬: {base}")
        console.print(f"  디자인 시스템: {system}")
        console.print(f"  에이전트: {agent}")
        console.print(f"  저장 폴더: {out_dir}")
        console.print(f"  프롬프트: {prompt}")
        return

    # 0) 헬스체크
    try:
        with urllib.request.urlopen(f"{base}/api/health", timeout=5) as resp:
            if resp.status != 200:
                raise OSError(f"health status {resp.status}")
    except (urllib.error.URLError, urllib.error.HTTPError, OSError) as e:
        console.print(f"[red]open-design 데몬 연결 실패: {base}[/red]")
        console.print(
            "[dim]데몬 가동: cd automation/intranet/open-design && pnpm tools-dev run web[/dim]"
        )
        console.print(
            f"[dim]포트가 다르면 --daemon-url 또는 OD_DAEMON_URL 지정. ({e})[/dim]"
        )
        raise typer.Exit(1)

    # 0.5) agent id 사전 검증 — 데몬 getAgentDef 는 strict === 매칭(별칭 X).
    # id 가 안 맞으면 조용히 전역 활성 에이전트로 fallback → "결과물 못 찾음" 으로 끝난다.
    # 그 조용한 실패를 여기서 미리 드러낸다 (목록 조회 실패는 치명적 아님 → 통과).
    try:
        with urllib.request.urlopen(f"{base}/api/agents", timeout=5) as resp:
            agents_raw = resp.read().decode("utf-8", "replace")
        if f'"{agent}"' not in agents_raw:
            console.print(
                f"[yellow]⚠ 데몬이 감지한 에이전트 목록에 '{agent}' 가 없습니다.[/yellow]"
            )
            console.print(
                "[yellow]  → agentId 가 무시되고 다른 에이전트로 fallback 될 수 있어요. "
                "--agent 로 정확한 id 를 지정하세요.[/yellow]"
            )
            console.print(f"[dim]/api/agents: {agents_raw[:300]}[/dim]")
    except (urllib.error.URLError, urllib.error.HTTPError, OSError):
        pass

    # 1) project 생성 (design system 주입)
    proj_id = f"aa-{dt.datetime.now().strftime('%Y%m%d-%H%M%S')}"
    try:
        proj = _od_post(base, "/api/projects", {
            "id": proj_id,
            "name": prompt[:60],
            "designSystemId": system,
        })
    except (urllib.error.HTTPError, urllib.error.URLError, OSError, json.JSONDecodeError) as e:
        console.print(f"[red]project 생성 실패: {e}[/red]")
        console.print(f"[dim]design system '{system}' 이 등록됐는지 확인 (install-open-design).[/dim]")
        raise typer.Exit(1)
    project_id = _deep_find(proj, "id") or proj_id
    conversation_id = _deep_find(proj, "conversationId")
    if debug:
        console.print(f"[dim]project 응답: {json.dumps(proj, ensure_ascii=False)[:400]}[/dim]")
        console.print(f"[dim]project_id={project_id} conversation_id={conversation_id}[/dim]")

    console.print(f"[cyan]🎨 디자인 생성 중[/cyan] (system={system}, agent={agent})…")

    # 2) chat (SSE) → artifactId 수집
    # 데몬 startChatRun 은 body 의 `message`(단수 문자열)·`designSystemId`·
    # `conversationId`·`systemPrompt` 를 읽는다(server.ts). messages(복수 배열)는
    # 무시돼 "message required" BAD_REQUEST 로 실패한다.
    # systemPrompt: 단발 CLI 호출에선 agent 가 "만들어둘까요?" 하고 되묻고 끝나
    # artifact 를 등록하지 않는다. 데몬 내부 unattended 경로(Orbit/Routine)와
    # 동일하게 "질문 금지 + Live Artifact 반드시 등록" 을 강제한다.
    chat_body = {
        "message": prompt,
        "projectId": project_id,
        "agentId": agent,
        "designSystemId": system,
        "systemPrompt": (
            "You are generating a design deliverable in a single, unattended run. "
            "Do not ask follow-up questions, do not emit <question-form>, and do not "
            "wait for user input. Pick reasonable defaults and complete the work now. "
            "You must create and register a Live Artifact as the final deliverable — "
            "do not merely describe or propose what you would do."
        ),
    }
    if conversation_id:
        chat_body["conversationId"] = conversation_id
    req = urllib.request.Request(
        f"{base}/api/chat",
        data=json.dumps(chat_body).encode("utf-8"),
        headers={"Content-Type": "application/json", "Accept": "text/event-stream"},
        method="POST",
    )
    start_ts = time.time()
    artifact_id = None
    sse_lines: list[str] = []
    try:
        with urllib.request.urlopen(req, timeout=600) as resp:
            for raw in resp:
                line = raw.decode("utf-8", "replace").rstrip("\r\n")
                if debug:
                    sse_lines.append(line)
                s = line.strip()
                if not s or "artifactId" not in s:
                    continue
                payload = s.split("data:", 1)[-1].strip() if "data:" in s else s
                try:
                    obj = json.loads(payload)
                except json.JSONDecodeError:
                    continue
                aid = _deep_find(obj, "artifactId")
                if aid:
                    artifact_id = aid
    except (urllib.error.HTTPError, urllib.error.URLError, OSError) as e:
        console.print(f"[red]디자인 생성(chat) 실패: {e}[/red]")
        if debug and sse_lines:
            console.print(f"[dim]받은 SSE {len(sse_lines)}줄 (마지막 일부):[/dim]")
            for dl in sse_lines[-15:]:
                console.print(f"[dim]│ {dl[:200]}[/dim]")
        raise typer.Exit(1)

    if debug:
        out_dir.mkdir(parents=True, exist_ok=True)
        dbg = out_dir / "_debug-sse.txt"
        dbg.write_text("\n".join(sse_lines), encoding="utf-8")
        console.print(f"[dim]SSE {len(sse_lines)}줄 저장 → {dbg}[/dim]")
        console.print("[dim]── SSE 처음 20줄 ──[/dim]")
        for dl in sse_lines[:20]:
            console.print(f"[dim]│ {dl[:180]}[/dim]")
        console.print("[dim]── SSE 마지막 10줄 ──[/dim]")
        for dl in sse_lines[-10:]:
            console.print(f"[dim]│ {dl[:180]}[/dim]")

    # 3) HTML 확보 — 우선순위: SSE artifactId → project 의 live-artifacts 조회
    #    → .od 디스크 fallback. 데몬은 artifact 를 listLiveArtifacts({projectId})
    #    로 관리하므로(server.ts), SSE wire format 에 의존하지 않고 이 project 의
    #    최신 artifact 를 직접 조회하는 게 정석이다.
    def _fetch_preview(aid: str):
        try:
            with urllib.request.urlopen(
                f"{base}/api/live-artifacts/{urllib.parse.quote(aid)}/preview",
                timeout=60,
            ) as resp:
                return resp.read().decode("utf-8", "replace")
        except (urllib.error.HTTPError, urllib.error.URLError, OSError) as e:
            console.print(f"[yellow]preview 회수 실패({e}).[/yellow]")
            return None

    html = _fetch_preview(artifact_id) if artifact_id else None

    if html is None:
        try:
            with urllib.request.urlopen(
                f"{base}/api/live-artifacts?projectId={urllib.parse.quote(project_id)}",
                timeout=30,
            ) as resp:
                listing = json.loads(resp.read().decode("utf-8"))
            arts = listing.get("artifacts") if isinstance(listing, dict) else listing
            if isinstance(arts, list) and arts:
                latest = max(
                    arts,
                    key=lambda a: (a.get("updatedAt") or a.get("createdAt") or 0)
                    if isinstance(a, dict) else 0,
                )
                aid = latest.get("id") if isinstance(latest, dict) else None
                if debug:
                    console.print(f"[dim]live-artifacts {len(arts)}개, 최신 id={aid}[/dim]")
                if aid:
                    html = _fetch_preview(aid)
        except (urllib.error.HTTPError, urllib.error.URLError, OSError, json.JSONDecodeError) as e:
            if debug:
                console.print(f"[dim]live-artifacts 조회 실패: {e}[/dim]")

    od_data = Path(
        os.environ.get("OD_DATA_DIR")
        or (ROOT / "automation" / "intranet" / "open-design" / ".od")
    )
    if html is None:
        # 최후: open-design 의 .od 에서 chat 시작 이후 생성/수정된 HTML 중
        # 가장 최근·큰 것을 회수 (artifact 등록 실패 등 예외 상황 대비).
        cands = []
        if od_data.exists():
            for hf in od_data.rglob("*.html"):
                try:
                    if hf.stat().st_mtime >= start_ts - 5:
                        cands.append(hf)
                except OSError:
                    continue
        if cands:
            best = max(cands, key=lambda f: (f.stat().st_mtime, f.stat().st_size))
            html = best.read_text(encoding="utf-8", errors="replace")
            console.print(f"[dim]디스크에서 회수: {best}[/dim]")

    if not html:
        console.print("[yellow]디자인 결과물을 찾지 못했습니다.[/yellow]")
        console.print(f"[dim].od 경로: {od_data} (존재={od_data.exists()})[/dim]")
        console.print("[dim]웹 UI 에서 직접 확인하거나 --debug 로 SSE 점검.[/dim]")
        raise typer.Exit(1)

    # 4) 저장
    out_dir.mkdir(parents=True, exist_ok=True)
    slug = re.sub(r"[^a-zA-Z0-9가-힣]+", "-", prompt[:30]).strip("-") or "design"
    out_path = out_dir / f"{proj_id}-{slug}.html"
    out_path.write_text(html, encoding="utf-8")
    console.print(f"[green]✓ 디자인 저장:[/green] {out_path}")
    console.print("[dim]브라우저로 열어 확인.[/dim]")


# ──────────────────────────────────────────────────────────────────────────
# aa squad — 미션 단위 스쿼드 등록 · 조회
# ──────────────────────────────────────────────────────────────────────────
squad_app = typer.Typer(
    name="squad",
    help="스쿼드 — 27명 카탈로그에서 미션 단위로 추려낸 협업 단위 (등록 · 조회 · 신규).",
    no_args_is_help=True,
)
app.add_typer(squad_app, name="squad")


_STATUS_STYLE = {
    "DRAFT":     "dim",
    "FORMED":    "cyan",
    "ACTIVE":    "bold green",
    "DORMANT":   "yellow",
    "DISBANDED": "red",
}


@squad_app.command("list")
def squad_list_cmd(
    status: str = typer.Option(
        None, "--status", "-s",
        help=f"상태 필터: {' | '.join(VALID_STATUSES)}",
    ),
) -> None:
    """등록된 모든 스쿼드 명단."""
    squads = load_all_squads()
    if status:
        wanted = status.upper()
        if wanted not in VALID_STATUSES:
            console.print(
                f"[red]잘못된 상태: {status}[/red] "
                f"[dim](가능: {', '.join(VALID_STATUSES)})[/dim]"
            )
            raise typer.Exit(1)
        squads = [s for s in squads if s.status == wanted]

    if not squads:
        console.print(
            f"[yellow]등록된 스쿼드가 없습니다.[/yellow]\n"
            f"[dim](경로: {SQUADS_DIR})[/dim]\n"
            f"[dim]`aa squad register <slug> --name ... --lead ...` 로 첫 스쿼드 등록.[/dim]"
        )
        return

    table = Table(
        title=f"🛸 등록된 스쿼드 ({len(squads)}개)",
        show_lines=False,
        title_style="bold cyan",
    )
    table.add_column("Slug", style="bold cyan", no_wrap=True)
    table.add_column("Name")
    table.add_column("Status", no_wrap=True)
    table.add_column("Lead", no_wrap=True)
    table.add_column("Cells", justify="right")
    table.add_column("Members", justify="right")
    table.add_column("HQ Issue", no_wrap=True)

    for s in squads:
        style = _STATUS_STYLE.get(s.status, "")
        status_cell = f"[{style}]{s.status}[/{style}]" if style else s.status
        table.add_row(
            s.slug,
            s.name,
            status_cell,
            s.lead or "-",
            str(len(s.cells)),
            str(s.member_count),
            s.hq_issue or "-",
        )

    console.print(table)


@squad_app.command("show")
def squad_show_cmd(
    slug: str = typer.Argument(..., help="스쿼드 슬러그 (예: brand-system)"),
) -> None:
    """스쿼드 상세 — 미션 · 로스터 · 본부 이슈."""
    try:
        s = load_squad(slug)
    except FileNotFoundError as e:
        console.print(f"[red]{e}[/red]")
        console.print("[dim]`aa squad list` 로 등록 목록 확인.[/dim]")
        raise typer.Exit(1)

    style = _STATUS_STYLE.get(s.status, "")
    status_line = f"[{style}]{s.status}[/{style}]" if style else s.status

    header = (
        f"[bold cyan]🛸 {s.name}[/bold cyan]\n\n"
        f"[dim]Slug:[/dim]        {s.slug}\n"
        f"[dim]Status:[/dim]      {status_line}\n"
        f"[dim]Lead:[/dim]        {s.lead or '-'}\n"
        f"[dim]Formed on:[/dim]   {s.formed_on or '-'}\n"
        f"[dim]Label:[/dim]       {s.label or '-'}\n"
        f"[dim]HQ Issue:[/dim]    {s.hq_issue or '-'}"
    )
    if s.hq_issue_uuid:
        header += f"  [dim]({s.hq_issue_uuid})[/dim]"
    console.print(Panel.fit(header, border_style="cyan", title=f"aa squad show {slug}"))

    if s.mission:
        console.print("\n[bold cyan]Mission[/bold cyan]")
        console.print(Panel(s.mission, border_style="dim"))

    if not s.cells:
        console.print(
            "\n[yellow]Cell 이 비어 있습니다.[/yellow] "
            f"[dim]({s.path} 의 [[cells]] 블록을 채워주세요.)[/dim]"
        )
        return

    for i, cell in enumerate(s.cells, start=1):
        console.print(f"\n[bold]Cell {i} — {cell.name}[/bold]")
        if cell.lead:
            console.print(f"  [dim]Lead:[/dim] {cell.lead}")
        if not cell.members:
            console.print("  [dim](멤버 없음)[/dim]")
            continue
        t = Table(show_header=True, header_style="dim")
        t.add_column("Agent", style="cyan", no_wrap=True)
        t.add_column("Division", style="dim", no_wrap=True)
        t.add_column("Role")
        for m in cell.members:
            t.add_row(m.agent, division_of(m.agent), m.role or "-")
        console.print(t)

    console.print(
        f"\n[dim]총 멤버 (중복 제외):[/dim] {s.member_count}명"
        f"\n[dim]등록부 파일:[/dim] {s.path}"
    )


@squad_app.command("register")
def squad_register_cmd(
    slug: str = typer.Argument(..., help="스쿼드 슬러그 (kebab-case, 예: brand-system)"),
    name: str = typer.Option(..., "--name", help="스쿼드 표시 이름"),
    lead: str = typer.Option(..., "--lead", help="Squad Lead 의 agent name (27명 중 하나)"),
) -> None:
    """신규 스쿼드 폴더 스캐폴딩 — squad.toml + README.md 를 DRAFT 상태로 생성.

    멤버는 squad.toml 의 [[cells]] / [[cells.members]] 블록을 직접 편집해 채운다.
    채운 뒤 status 를 FORMED 로 올리면 `aa squad list` 에 상태가 반영된다.
    """
    if not slug or any(c.isspace() for c in slug) or slug != slug.lower():
        console.print(
            f"[red]잘못된 slug: '{slug}'[/red] "
            "[dim](소문자 kebab-case 권장, 공백 금지)[/dim]"
        )
        raise typer.Exit(1)

    # lead 가 실제 27명 중 하나인지 확인 (오타 방지)
    try:
        load_one(lead)
    except FileNotFoundError:
        console.print(
            f"[red]Lead 에이전트 '{lead}' 가 27명 카탈로그에 없습니다.[/red]\n"
            "[dim]`aa list` 로 정확한 이름을 확인하세요.[/dim]"
        )
        raise typer.Exit(1)

    formed_on = dt.date.today().isoformat()
    try:
        folder = scaffold_squad(slug, name, lead, formed_on)
    except FileExistsError:
        console.print(
            f"[red]이미 등록된 스쿼드: {slug}[/red]\n"
            f"[dim]경로: {SQUADS_DIR / slug}[/dim]\n"
            f"[dim]`aa squad show {slug}` 로 현재 상태 확인.[/dim]"
        )
        raise typer.Exit(1)

    console.print(
        Panel.fit(
            f"[green]✓ 스쿼드 등록[/green]\n\n"
            f"[dim]Slug:[/dim]    {slug}\n"
            f"[dim]Name:[/dim]    {name}\n"
            f"[dim]Lead:[/dim]    {lead}\n"
            f"[dim]Status:[/dim]  DRAFT\n\n"
            f"[bold]다음 단계:[/bold]\n"
            f"  1. {folder / 'squad.toml'} 편집 — [[cells]] 블록에 멤버 채우기\n"
            f"  2. {folder / 'README.md'} 편집 — 사람용 헌장 작성\n"
            f"  3. squad.toml 의 status 를 [bold cyan]FORMED[/bold cyan] 로 변경\n"
            f"  4. 워크스페이스에 라벨 생성 + 본부 이슈 지정 (Multica)\n"
            f"  5. [dim]aa squad show {slug}[/dim] 로 검증",
            border_style="cyan",
            title=f"aa squad register {slug}",
        )
    )


if __name__ == "__main__":
    app()