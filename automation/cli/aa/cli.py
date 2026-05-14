"""Alien Agentic CLI — `aa` 진입점."""

from __future__ import annotations

import datetime as dt
import os
import re
import subprocess
import sys
import tempfile
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
    COMPANY,
    DAILY_LOGS,
    DASHBOARD,
    ENV_FILE,
    INTERVENTIONS,
    MESSAGES,
    ROOT,
    USER_NAME,
)
from aa.router import MODALITIES, PROVIDERS, TIERS, route

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
        None, "--provider", help="공급자 강제 지정: claude | chatgpt"
    ),
    modality: str = typer.Option(
        None, "--modality", help="모달리티 수동 지정: text | image"
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

    # 공급자별 사전 점검 — 이미지는 항상 Codex(chatgpt) 경로
    if r.provider == "chatgpt":
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

    with console.status(
        f"[cyan]{a.name} 호출 중 ({provider_label} · {model_label})...[/cyan]"
    ):
        if r.modality == "image":
            returncode, response, stderr = _run_codex_image(a, prompt, r.model)
        elif r.provider == "chatgpt":
            returncode, response, stderr = _run_codex(
                _codex_text_prompt(a, client, prompt), r.model
            )
        else:
            returncode, response, stderr = _run_claude(agent, prompt, r.model)

    if returncode != 0:
        cli_name = "codex" if r.provider == "chatgpt" else "claude"
        console.print(f"[red]{cli_name} CLI 에러 (exit {returncode}):[/red]")
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


if __name__ == "__main__":
    app()
