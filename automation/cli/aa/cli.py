"""Alien Agentic CLI — `aa` 진입점."""

from __future__ import annotations

import datetime as dt
import os
import re
import subprocess

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
    COMPANY,
    DAILY_LOGS,
    DASHBOARD,
    ENV_FILE,
    INTERVENTIONS,
    MESSAGES,
    MODEL_MAP,
    ROOT,
    USER_NAME,
)

app = typer.Typer(
    name="aa",
    help=f"🛸 {COMPANY} — 마스터 오케스트레이터 CLI",
    no_args_is_help=True,
    add_completion=False,
)
console = Console()

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
@app.command()
def call(
    agent: str = typer.Argument(..., help="에이전트 이름 (예: origin-reader)"),
    prompt: str = typer.Argument(..., help="요청 한 줄"),
    client: str = typer.Option(
        "_self", "--client", "-c", help="클라이언트 이름 (없으면 _self)"
    ),
    dry_run: bool = typer.Option(
        False, "--dry-run", help="API 호출 없이 컨텍스트만 출력"
    ),
) -> None:
    """단일 에이전트 호출 (Anthropic API)."""
    try:
        a = load_one(agent)
    except FileNotFoundError:
        console.print(f"[red]에이전트 없음: {agent}[/red]")
        console.print("[dim]`aa list` 로 명단 확인.[/dim]")
        raise typer.Exit(1)

    console.rule(f"🛸 Call · {a.name} ({a.model})")
    console.print(f"[dim]Division:[/dim] {division_of(a.name)}")
    console.print(f"[dim]Client:[/dim] {client}")
    console.print(f"[bold]요청:[/bold] {prompt}\n")

    if dry_run:
        console.print("[yellow]--dry-run: API 호출 생략[/yellow]")
        console.print(f"[dim]시스템 프롬프트 위치:[/dim] {a.path}")
        return

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        console.print(
            "[red]ANTHROPIC_API_KEY 가 .env 에 없습니다.[/red]\n"
            f"[dim]{ENV_FILE} 에 박아주세요.[/dim]\n"
            "[dim]발급: https://console.anthropic.com[/dim]"
        )
        raise typer.Exit(1)

    try:
        from anthropic import Anthropic
    except ImportError:
        console.print(
            "[red]anthropic 패키지 미설치.[/red] "
            f"[dim]cd {ENV_FILE.parent} && pip install -r requirements.txt[/dim]"
        )
        raise typer.Exit(1)

    client_obj = Anthropic(api_key=api_key)
    model = MODEL_MAP.get(
        a.model, os.environ.get("ANTHROPIC_DEFAULT_MODEL", "claude-sonnet-4-5")
    )

    with console.status(f"[cyan]{a.name} 호출 중 ({model})...[/cyan]"):
        msg = client_obj.messages.create(
            model=model,
            max_tokens=4096,
            system=a.body,
            messages=[{"role": "user", "content": prompt}],
        )
    response = "".join(b.text for b in msg.content if hasattr(b, "text"))

    console.print(
        Panel(response, title=f"{a.name} 응답", border_style="cyan")
    )

    _append_memory(a.name, response, prompt)
    console.print(
        f"\n[green]✓ 메모리 4파일 갱신:[/green] "
        f"shared-memory/agents/{a.name}/"
    )


def _append_memory(agent_name: str, response: str, prompt: str) -> None:
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


if __name__ == "__main__":
    app()
