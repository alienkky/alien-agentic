"use client";

/* ─────────────────────────────────────────────────────────
   Alien Plan — Multica 네이티브 페이지 (1차: 자립 / localStorage)
   © Alien Agentic

   "지구 전체를 외계인의 시선으로 한 걸음 떨어져서 바라보는"

   1차 원칙: Multica 의존성 0 (빌드 리스크 최소). 색은 shadcn/ui
   semantic 토큰(bg-background/text-foreground/bg-card/border-border)
   + Tailwind 팔레트(강조 태그)로 light/dark 자동 대응.
   2차에서 사이드바/라우트/i18n 등록, 3차에서 이슈/에이전트 연동.
   ───────────────────────────────────────────────────────── */

import { useState, useEffect, useCallback, useRef, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useCreateIssue, useUpdateIssue } from "@multica/core/issues/mutations";
import { agentListOptions } from "@multica/core/workspace/queries";
import { issueListOptions, issueDetailOptions } from "@multica/core/issues/queries";
import { useWorkspaceId } from "@multica/core/hooks";

// ── Types ───────────────────────────────────────────────
type Priority = "Must Do" | "Should Do" | "Could Do";

interface DayLog {
  sweep: string;
  theOne: { text: string; done: boolean };
  tinyMove: { text: string; done: boolean };
}

interface Task {
  id: string;
  title: string;
  status: string;
  priority: Priority;
  sprint: string;
  estimatedMin: number;
  dueDate: string;
  completed: boolean;
  completedAt: string | null;
  createdAt: string;
  assigneeAgentId?: string | null; // 담당 에이전트 (Multica agent UUID) — 옵션
  issueId?: string | null;         // Multica 이슈로 등록되면 그 id
}

// Alien Plan 의 가벼운 에이전트 모양 (Multica Agent 에서 필요한 필드만)
interface PlanAgent {
  id: string;
  name: string;
  archived_at?: string | null;
}

interface PlanState {
  logs: Record<string, DayLog>;
  tasks: Task[];
}

type PageId = "today" | "tasks" | "reflect" | "trace";

// ── Constants ───────────────────────────────────────────
// 1차 자립 저장. 이제는 서버(전용 이슈)로 옮기는 *마이그레이션 소스*로만 읽는다.
const STORE_KEY = "alien-plan:v1";
// 전용 이슈를 서버 KV 로 사용 — 이 title 이슈의 description 에 {logs,tasks} JSON 을
// 통째로 저장. Multica 백엔드 무수정(fresh clone drift 안전)으로 기기 간 동기화.
const STATE_ISSUE_TITLE = "🛸 Alien Plan 저장소 (자동 — 수정·삭제 금지)";

// 제목용 폰트 — Pretendard(한글 고딕). serif(Cormorant)는 한글이 어색해서
// 카테고리/카드 제목은 Pretendard 로 통일. CDN 은 마운트 시 1회 주입.
const TITLE_FONT =
  '"Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont, system-ui, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
const PRETENDARD_CDN = "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css";

function ensurePretendard() {
  if (typeof document === "undefined") return;
  const id = "pretendard-cdn";
  if (document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = PRETENDARD_CDN;
  document.head.appendChild(link);
}

const PRIORITIES: Priority[] = ["Must Do", "Should Do", "Could Do"];

// 모달/태그 표시용 한글 라벨 (value 는 영문 유지 — 내부 로직·이슈 매핑 보존)
const PRIORITY_KO: Record<Priority, string> = {
  "Must Do": "필수",
  "Should Do": "중요",
  "Could Do": "선택",
};

// Sprint → Multica 이슈 priority 직접 매핑 (사용자 결정: Alien 우선순위 흡수)
type IssuePriorityValue = "urgent" | "high" | "medium" | "low" | "none";
const SPRINT_TO_PRIORITY: Record<string, IssuePriorityValue> = {
  "Sprint 1": "urgent",
  "Sprint 2": "high",
  "Sprint 3": "medium",
  "Sprint 4": "low",
  "No Sprint": "none",
};

const SPRINTS = [
  { id: "Sprint 1", ko: "긴급", cls: "sprint-1" },
  { id: "Sprint 2", ko: "마감", cls: "sprint-2" },
  { id: "Sprint 3", ko: "운영", cls: "sprint-3" },
  { id: "Sprint 4", ko: "창작", cls: "sprint-4" },
  { id: "No Sprint", ko: "미분류", cls: "no-sprint" },
] as const;

// Sprint 좌측 바 + 레인 배경 (semantic 토큰 부족분은 팔레트 + dark variant)
const SPRINT_STYLE: Record<(typeof SPRINTS)[number]["cls"], { bar: string; lane: string }> = {
  "sprint-1": { bar: "bg-red-500", lane: "border-red-300/50 bg-red-50/60 dark:border-red-900/40 dark:bg-red-950/20" },
  "sprint-2": { bar: "bg-amber-500", lane: "border-amber-300/50 bg-amber-50/60 dark:border-amber-900/40 dark:bg-amber-950/20" },
  "sprint-3": { bar: "bg-slate-400", lane: "border-border bg-muted/40" },
  "sprint-4": { bar: "bg-emerald-500", lane: "border-emerald-300/50 bg-emerald-50/60 dark:border-emerald-900/40 dark:bg-emerald-950/20" },
  "no-sprint": { bar: "bg-muted-foreground/40", lane: "border-border bg-muted/30" },
};

const PRIORITY_TAG: Record<Priority, string> = {
  "Must Do": "bg-red-100 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900/50",
  "Should Do": "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/50",
  "Could Do": "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/50",
};

// ── Date utils ──────────────────────────────────────────
const pad = (n: number) => String(n).padStart(2, "0");
const dateKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayKey = () => dateKey(new Date());
const addDays = (d: Date, n: number) => {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
};
function startOfWeek(d = new Date()) {
  const r = new Date(d);
  const day = r.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  r.setDate(r.getDate() + diff);
  r.setHours(0, 0, 0, 0);
  return r;
}

// ── Domain logic ────────────────────────────────────────
const isQuick = (t: Task) => (t.estimatedMin ?? 0) <= 15;

function getUrgency(task: Task) {
  if (!task.dueDate) return null;
  const today = new Date(todayKey());
  const due = new Date(task.dueDate);
  const diff = Math.floor((due.getTime() - today.getTime()) / 86400000);
  if (diff < 0) return { ko: "지남", cls: "bg-red-100 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900/50" };
  if (diff === 0) return { ko: "오늘", cls: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/50" };
  if (diff === 1) return { ko: "내일", cls: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900/50" };
  return null;
}

function weeklyBreakdown(tasks: Task[], weekStart: Date) {
  const weekEnd = addDays(weekStart, 7);
  const done = tasks.filter((t) => {
    if (!t.completed || !t.completedAt) return false;
    const c = new Date(t.completedAt);
    return c >= weekStart && c < weekEnd;
  });
  const totalMin = done.reduce((s, t) => s + (t.estimatedMin || 0), 0) || 1;
  const sum = (p: Priority) => done.filter((t) => t.priority === p).reduce((s, t) => s + (t.estimatedMin || 0), 0);
  return {
    must: Math.round((sum("Must Do") / totalMin) * 100),
    should: Math.round((sum("Should Do") / totalMin) * 100),
    could: Math.round((sum("Could Do") / totalMin) * 100),
    count: done.length,
  };
}

function generateFeedback({ must, should, could }: { must: number; should: number; could: number }) {
  if (must + should + could === 0) return "이번 주는 완료 기록이 없어요. 천천히, 한 걸음부터.";
  if (must >= 70) return `지난주 시간의 ${must}%가 긴급(Must Do)에 갔습니다. 반응형(reactive) 모드네요 — 다음 주는 미리 계획하는 블록을 한 시간이라도 잡아보세요.`;
  if (should >= 60) return `Should Do 중심(${should}%)으로 흘렀습니다. 균형이 좋아요 — 이 흐름을 유지하면 됩니다.`;
  if (could >= 50) return `Could Do가 ${could}%였습니다. 탐색 모드입니다 — 의도였다면 OK, 아니라면 다음 주 우선순위를 다시 잡아보세요.`;
  return "우선순위가 골고루 분포됐어요. 한 영역에 집중해보면 진전이 더 분명해질 거예요.";
}

function calcStreak(logs: Record<string, DayLog>, kind: "theOne" | "tinyMove") {
  let s = 0;
  for (let i = 0; i < 90; i++) {
    const k = dateKey(addDays(new Date(), -i));
    const done = logs[k]?.[kind]?.done;
    if (done) s++;
    else if (i > 0) break;
  }
  return s;
}

function weekCount(logs: Record<string, DayLog>, kind: "theOne" | "tinyMove", weekStart: Date) {
  let n = 0;
  for (let i = 0; i < 7; i++) {
    const k = dateKey(addDays(weekStart, i));
    if (logs[k]?.[kind]?.done) n++;
  }
  return n;
}

function emptyLog(): DayLog {
  return { sweep: "", theOne: { text: "", done: false }, tinyMove: { text: "", done: false } };
}

// crypto.randomUUID 는 secure context(HTTPS/localhost)에서만 동작한다.
// Tailscale IP + HTTP 같은 비보안 접속에서도 ID 가 필요하므로 fallback.
function genId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {
    /* secure context 아님 — fallback 으로 */
  }
  return "ap-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
}

// ── Icons (inline SVG, currentColor) ────────────────────
const Icon = {
  sun: "M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41",
  check: "M5 12l5 5L20 7",
  plus: "M12 5v14M5 12h14",
  close: "M18 6L6 18M6 6l12 12",
  trash: "M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6",
  clock: "M12 6v6l4 2",
  list: "M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11",
  refresh: "M3 12a9 9 0 1 0 9-9 9.74 9.74 0 0 0-6.74 2.74L3 8M3 3v5h5",
  chart: "M3 3v18h18M7 16l4-4 4 4 5-5",
};

// ── Main component ──────────────────────────────────────
export function AlienPlanPage() {
  const [page, setPage] = useState<PageId>("today");
  const [state, setState] = useState<PlanState>({ logs: {}, tasks: [] });
  const [loaded, setLoaded] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  // ── 서버 저장 레이어 (Multica 전용 이슈를 KV 로) ──
  // 이중 저장 전략: 서버(Multica 이슈 description) + localStorage 동시.
  // 어느 한 쪽이 실패해도 다른 쪽에서 복구 가능. 로드 시 richer (logs+tasks 합계 큰 쪽)
  // 자동 채택 → 데이터 손실 거의 불가능.
  //
  // useWorkspaceId 는 워크스페이스 라우트 안에서만 유효 — Alien Plan 은
  // [workspaceSlug]/(dashboard)/alien-plan 라우트라 항상 컨텍스트가 있다.
  const wsId = useWorkspaceId();
  const { data: issueList } = useQuery(issueListOptions(wsId));
  const stateIssue = (issueList ?? []).find((i) => i.title === STATE_ISSUE_TITLE);
  const stateIssueId = stateIssue?.id ?? null;
  const { data: stateIssueDetail } = useQuery({
    ...issueDetailOptions(wsId, stateIssueId ?? ""),
    enabled: !!stateIssueId,
  });
  const createIssue = useCreateIssue();
  const updateIssue = useUpdateIssue();

  // 저장 상태 UI (사용자가 데이터 손실 위험을 바로 알 수 있게)
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const { data: agentsRaw } = useQuery(agentListOptions(wsId));
  const agents: PlanAgent[] = ((agentsRaw ?? []) as PlanAgent[]).filter((a) => !a.archived_at);

  // 저장 제어용 ref — create 는 최초 1회, 이후엔 update.
  const ensuredIssueIdRef = useRef<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savingRef = useRef(false);

  useEffect(() => {
    ensurePretendard();
  }, []);

  // 로드 — 서버 + localStorage 둘 다 시도, richer (logs+tasks 합계 큰 쪽) 채택.
  // 한쪽이 비어있거나 깨졌어도 다른 쪽이 살아있으면 복구된다.
  useEffect(() => {
    if (loaded) return;
    if (issueList === undefined) return; // 이슈 목록 로딩 중 — 대기
    if (stateIssueId && stateIssueDetail === undefined) return; // 전용 이슈 상세 로딩 중

    // 서버 데이터 파싱
    let serverData: PlanState | null = null;
    if (stateIssueId && stateIssueDetail) {
      try {
        const raw = stateIssueDetail.description;
        if (raw) {
          const parsed = JSON.parse(raw) as Partial<PlanState>;
          if (parsed.logs || parsed.tasks) {
            serverData = { logs: parsed.logs ?? {}, tasks: parsed.tasks ?? [] };
          }
        }
      } catch (e) {
        console.warn("Alien Plan server load parse failed", e);
      }
    }

    // localStorage 백업 데이터 파싱
    let lsData: PlanState | null = null;
    try {
      const lsRaw = localStorage.getItem(STORE_KEY);
      if (lsRaw) {
        const parsed = JSON.parse(lsRaw) as Partial<PlanState>;
        if (parsed.logs || parsed.tasks) {
          lsData = { logs: parsed.logs ?? {}, tasks: parsed.tasks ?? [] };
        }
      }
    } catch (e) {
      console.warn("Alien Plan localStorage load parse failed", e);
    }

    // 둘 중 richer 채택 (의도적 전체 삭제로 빈 상태가 정답인 경우는 매우 드물고,
    // 데이터 손실 방지가 더 중요)
    const richness = (d: PlanState | null) =>
      d ? Object.keys(d.logs).length + d.tasks.length : -1;
    const chosen = richness(serverData) >= richness(lsData) ? serverData : lsData;
    if (chosen) {
      setState(chosen);
      if (serverData && lsData && richness(lsData) > richness(serverData)) {
        // localStorage 가 더 풍부 → 서버로 곧 동기화될 것 (save effect 가 처리)
        console.info("Alien Plan: localStorage 가 서버보다 풍부 — 곧 서버로 sync");
      }
    }
    setLoaded(true);
  }, [loaded, issueList, stateIssueId, stateIssueDetail]);

  // 저장 — localStorage 즉시 + 서버 비동기 (이중 저장).
  // 서버 실패해도 localStorage 는 살아남아 다음 로드에서 복구된다.
  useEffect(() => {
    if (!loaded) return;
    const payload = JSON.stringify({ logs: state.logs, tasks: state.tasks });

    // 1) localStorage 즉시 백업 — 동기, 빠름, 실패 거의 없음
    try {
      localStorage.setItem(STORE_KEY, payload);
    } catch (e) {
      console.warn("Alien Plan localStorage save failed", e);
    }

    // 2) 서버는 debounce 후 비동기 저장
    // 빈 전용 이슈는 만들지 않음 (신규 사용자) — 단, 한 번이라도 데이터가 있었으면
    // 이슈가 이미 만들어졌으니 그 이슈는 계속 업데이트.
    const isEmpty = Object.keys(state.logs).length === 0 && state.tasks.length === 0;
    const targetId = stateIssueId ?? ensuredIssueIdRef.current;
    if (isEmpty && !targetId) return;

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      if (savingRef.current) return;
      savingRef.current = true;
      setSaveStatus("saving");
      const done = (ok: boolean, errMsg?: string) => {
        savingRef.current = false;
        if (ok) {
          setSaveStatus("saved");
          setSaveError(null);
          setTimeout(() => setSaveStatus((s) => (s === "saved" ? "idle" : s)), 2000);
        } else {
          setSaveStatus("error");
          setSaveError(errMsg ?? "서버 저장 실패 — 로컬 백업은 안전합니다");
        }
      };
      if (targetId) {
        updateIssue
          .mutateAsync({ id: targetId, description: payload })
          .then(() => done(true))
          .catch((e: unknown) => {
            console.warn("Alien Plan server save failed", e);
            done(false, e instanceof Error ? e.message : String(e));
          });
      } else {
        createIssue
          .mutateAsync({ title: STATE_ISSUE_TITLE, status: "todo", description: payload })
          .then((created) => {
            ensuredIssueIdRef.current = (created as { id: string }).id;
            done(true);
          })
          .catch((e: unknown) => {
            console.warn("Alien Plan server create failed", e);
            done(false, e instanceof Error ? e.message : String(e));
          });
      }
    }, 1500);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [state, loaded, stateIssueId, createIssue, updateIssue]);

  // ── Mutators ──
  const getTodayLog = useCallback((): DayLog => state.logs[todayKey()] ?? emptyLog(), [state.logs]);

  const patchTodayLog = useCallback((patch: Partial<DayLog>) => {
    setState((s) => {
      const k = todayKey();
      const cur = s.logs[k] ?? emptyLog();
      return { ...s, logs: { ...s.logs, [k]: { ...cur, ...patch } } };
    });
  }, []);

  const addTask = useCallback((task: Task) => {
    setState((s) => ({ ...s, tasks: [...s.tasks, task] }));
  }, []);

  const updateTask = useCallback((id: string, fn: (t: Task) => Task) => {
    setState((s) => ({ ...s, tasks: s.tasks.map((t) => (t.id === id ? fn(t) : t)) }));
  }, []);

  const deleteTask = useCallback((id: string) => {
    setState((s) => ({ ...s, tasks: s.tasks.filter((t) => t.id !== id) }));
  }, []);

  // ── Multica 연동 (이슈 등록 + 에이전트 배정/실행) ──
  // wsId·agents·createIssue·updateIssue 는 위 "서버 저장 레이어" 에서 이미 선언.

  // 태스크를 Multica 이슈로 등록. assigneeAgentId 가 있으면 그 에이전트에
  // 배정 → 서버가 자동 enqueue/실행 (status "todo", backlog 아님).
  const sendToIssue = useCallback(
    async (task: Task) => {
      if (task.issueId) {
        alert("이미 이슈로 등록된 태스크입니다.");
        return;
      }
      try {
        const issue = await createIssue.mutateAsync({
          title: task.title,
          status: "todo",
          priority: SPRINT_TO_PRIORITY[task.sprint] ?? "none",
          ...(task.assigneeAgentId
            ? { assignee_type: "agent" as const, assignee_id: task.assigneeAgentId }
            : {}),
          ...(task.dueDate ? { due_date: task.dueDate } : {}),
        });
        const newId = (issue as { id: string }).id;
        setState((s) => ({
          ...s,
          tasks: s.tasks.map((t) => (t.id === task.id ? { ...t, issueId: newId } : t)),
        }));
        alert(
          task.assigneeAgentId
            ? "이슈 등록 완료 — 배정된 에이전트가 작업을 시작합니다."
            : "이슈 등록 완료 (담당 에이전트 미지정 — Multica 에서 배정하세요).",
        );
      } catch (e) {
        alert("이슈 등록 실패: " + (e as Error).message);
      }
    },
    [createIssue],
  );

  const exportData = useCallback(() => {
    const data = JSON.stringify({ logs: state.logs, tasks: state.tasks }, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `alien-plan-backup-${todayKey()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [state]);

  const importData = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.addEventListener("change", async (ev) => {
      const file = (ev.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const data = JSON.parse(await file.text());
        if (data.logs && data.tasks) {
          if (confirm("현재 데이터를 덮어쓰고 백업을 복원할까요?")) {
            setState({ logs: data.logs, tasks: data.tasks });
          }
        } else alert("백업 파일 형식이 올바르지 않습니다.");
      } catch (err) {
        alert("파일을 읽을 수 없습니다: " + (err as Error).message);
      }
    });
    input.click();
  }, []);

  const clearData = useCallback(() => {
    if (confirm("모든 데이터를 지웁니다. 정말 진행할까요?")) {
      setState({ logs: {}, tasks: [] });
    }
  }, []);

  if (!loaded) {
    return <div className="p-8 text-sm text-muted-foreground">Alien Plan 불러오는 중…</div>;
  }

  const navItems: { id: PageId; label: string; sub: string; d: string; fillSun?: boolean }[] = [
    { id: "today", label: "Today", sub: "오늘의 한 걸음", d: "M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" },
    { id: "tasks", label: "Tasks", sub: "Sprint Board", d: Icon.list },
    { id: "reflect", label: "Reflect", sub: "주간 회고", d: Icon.refresh },
    { id: "trace", label: "Trace", sub: "자취 추적", d: Icon.chart },
  ];

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-background text-foreground">
      {/* ── 상단 바: 브랜드 + 가로 탭 (반응형 — 모바일/패드 친화) ── */}
      <header className="shrink-0 border-b border-border px-4 md:px-6 py-3 flex items-center gap-3 flex-wrap">
        <div className="flex items-baseline gap-2 mr-1 shrink-0">
          <span className="font-mono text-[9px] tracking-[0.25em] text-muted-foreground hidden sm:inline">ALIEN AGENTIC</span>
          <h1 className="text-xl font-bold leading-none tracking-tight" style={{ fontFamily: TITLE_FONT }}>Alien Plan</h1>
        </div>
        <nav className="flex gap-1 overflow-x-auto -mx-1 px-1">
          {navItems.map((n) => {
            const active = page === n.id;
            return (
              <button
                key={n.id}
                onClick={() => setPage(n.id)}
                className={[
                  "flex items-center gap-2 px-3 py-2 rounded-lg whitespace-nowrap transition-colors shrink-0",
                  active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                ].join(" ")}
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
                  {n.d.split("M").filter(Boolean).map((seg, i) => (
                    <path key={i} d={"M" + seg} />
                  ))}
                </svg>
                <span className="text-sm font-medium">{n.label}</span>
                <span className={["text-[10px] tracking-wide hidden md:inline", active ? "text-primary-foreground/60" : "text-muted-foreground"].join(" ")}>{n.sub}</span>
              </button>
            );
          })}
        </nav>
      </header>

      {/* ── Main ── */}
      <main className="flex-1 min-w-0 overflow-y-auto p-4 md:p-8">
        <div className="mx-auto w-full max-w-4xl">
          {page === "today" && (
            <TodayPage state={state} getTodayLog={getTodayLog} patchTodayLog={patchTodayLog} updateTask={updateTask} />
          )}
          {page === "tasks" && (
            <TasksPage
              state={state}
              updateTask={updateTask}
              deleteTask={deleteTask}
              onAdd={() => setModalOpen(true)}
              agents={agents}
              onSendToIssue={sendToIssue}
              creatingIssue={createIssue.isPending}
            />
          )}
          {page === "reflect" && <ReflectPage state={state} updateTask={updateTask} />}
          {page === "trace" && <TracePage state={state} />}

          {/* Footer */}
          <div className="mt-16 pt-5 border-t border-border flex justify-between items-center text-xs text-muted-foreground">
            <div className="font-serif italic text-sm text-muted-foreground">Alien Agentic · Alien Plan</div>
            <div className="flex gap-3">
              <button onClick={exportData} className="hover:text-foreground transition-colors">백업 내보내기</button>
              <button onClick={importData} className="hover:text-foreground transition-colors">백업 가져오기</button>
              <button onClick={clearData} className="hover:text-destructive transition-colors">전체 초기화</button>
            </div>
          </div>
        </div>
      </main>

      {modalOpen && <AddTaskModal onClose={() => setModalOpen(false)} onSubmit={addTask} agents={agents} />}

      {/* 저장 상태 배지 — 우하단 고정. 사용자가 데이터 손실 위험을 즉시 알 수 있게. */}
      {saveStatus !== "idle" && (
        <div
          style={{
            position: "fixed",
            right: 16,
            bottom: 16,
            zIndex: 9999,
            padding: "8px 14px",
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 500,
            boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
            background:
              saveStatus === "error"
                ? "var(--error, #fee5e0)"
                : saveStatus === "saved"
                  ? "var(--success, #e6f4e0)"
                  : "var(--muted, #f4f4f5)",
            color:
              saveStatus === "error"
                ? "var(--error-foreground, #a01408)"
                : saveStatus === "saved"
                  ? "var(--success-foreground, #2a6f0a)"
                  : "var(--muted-foreground, #707070)",
            maxWidth: 320,
          }}
        >
          {saveStatus === "saving" && "저장 중..."}
          {saveStatus === "saved" && "✓ 저장됨"}
          {saveStatus === "error" && (
            <>
              ⚠ {saveError ?? "서버 저장 실패"}
              <div style={{ fontSize: 11, marginTop: 4, opacity: 0.85 }}>
                로컬 백업은 안전 — 다음 변경 시 재시도됨
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Shared bits ─────────────────────────────────────────
function Header({ eyebrow, title, desc, right }: { eyebrow: string; title: string; desc: string; right?: ReactNode }) {
  return (
    <div className="flex items-end justify-between pb-6 border-b border-border mb-8">
      <div>
        <div className="font-mono text-[10px] tracking-[0.3em] text-muted-foreground">{eyebrow}</div>
        <h2 className="text-4xl font-bold leading-tight mt-2.5 tracking-tight" style={{ fontFamily: TITLE_FONT }}>{title}</h2>
        <div className="text-[13px] text-muted-foreground mt-2.5 max-w-md leading-relaxed">{desc}</div>
      </div>
      {right}
    </div>
  );
}

function Card({ accent, children }: { accent?: string; children: ReactNode }) {
  return (
    <section className="relative bg-card border border-border rounded-2xl p-6 pl-7 mb-5">
      <span className={["absolute left-0 top-6 bottom-6 w-[3px] rounded-r", accent ?? "bg-border"].join(" ")} />
      {children}
    </section>
  );
}

function CardHead({ d, fill, title, ko, sub, right }: { d: string; fill?: boolean; title: string; ko?: string; sub: string; right?: ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 mb-3.5">
      <svg className="w-[18px] h-[18px] text-muted-foreground shrink-0 mt-0.5" viewBox="0 0 24 24" fill={fill ? "currentColor" : "none"} stroke={fill ? "none" : "currentColor"} strokeWidth={1.6}>
        {d.split("M").filter(Boolean).map((seg, i) => (
          <path key={i} d={"M" + seg} />
        ))}
      </svg>
      <div className="flex-1 min-w-0">
        <h3 className="text-[19px] font-semibold leading-tight tracking-tight" style={{ fontFamily: TITLE_FONT }}>
          {title}
          {ko && <span className="text-[11px] font-normal text-muted-foreground ml-2 tracking-wide" style={{ fontFamily: TITLE_FONT }}>{ko}</span>}
        </h3>
        <div className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{sub}</div>
      </div>
      {right}
    </div>
  );
}

function Checkbox({ checked, small, onClick }: { checked: boolean; small?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={[
        "border-2 rounded-md flex items-center justify-center shrink-0 transition-colors",
        small ? "w-4 h-4 rounded" : "w-[22px] h-[22px] mt-px",
        checked ? "bg-primary border-primary text-primary-foreground" : "border-border hover:border-muted-foreground bg-transparent",
      ].join(" ")}
    >
      {checked && (
        <svg className={small ? "w-2.5 h-2.5" : "w-3 h-3"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3.5}>
          <path d={Icon.check} />
        </svg>
      )}
    </button>
  );
}

// ── Today ───────────────────────────────────────────────
function TodayPage({
  state,
  getTodayLog,
  patchTodayLog,
  updateTask,
}: {
  state: PlanState;
  getTodayLog: () => DayLog;
  patchTodayLog: (p: Partial<DayLog>) => void;
  updateTask: (id: string, fn: (t: Task) => Task) => void;
}) {
  const log = getTodayLog();
  const dateLabel = new Date().toLocaleDateString("ko-KR", { weekday: "long", month: "long", day: "numeric" });
  const hStreak = calcStreak(state.logs, "theOne");
  const mStreak = calcStreak(state.logs, "tinyMove");
  const todayTasks = state.tasks.filter((t) => !t.completed && t.status !== "Skipped" && t.dueDate === todayKey());

  // ── Sweep 음성 입력 (Web Speech API) ──
  const [listening, setListening] = useState(false);
  // SpeechRecognition 은 lib.dom 에 타입이 없어 any 로 받는다 (브라우저 전역).
  const recognitionRef = useRef<any>(null);

  const toggleVoice = () => {
    if (typeof window !== "undefined" && !window.isSecureContext) {
      alert(
        "음성 입력은 보안 연결(HTTPS) 또는 localhost 에서만 작동합니다.\n" +
          "지금은 http:// + IP 주소로 접속 중이라 브라우저가 마이크를 막습니다.\n\n" +
          "해결:\n" +
          "① 같은 PC면 http://localhost:3000 으로 접속\n" +
          "② 다른 기기(폰/패드)면 Tailscale HTTPS 설정 (가이드 제공)",
      );
      return;
    }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      alert("이 브라우저는 음성 입력을 지원하지 않습니다. (Chrome/Edge 권장)");
      return;
    }
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const rec = new SR();
    rec.lang = "ko-KR";
    rec.continuous = true;
    rec.interimResults = false;
    rec.onresult = (e: any) => {
      let txt = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        txt += e.results[i][0].transcript;
      }
      if (txt) {
        const cur = getTodayLog().sweep;
        patchTodayLog({ sweep: cur ? cur + " " + txt : txt });
      }
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recognitionRef.current = rec;
    rec.start();
    setListening(true);
  };

  const badges = (
    <div className="flex gap-2.5">
      {[{ label: "THE ONE", v: hStreak }, { label: "TINY MOVE", v: mStreak }].map((b) => (
        <div key={b.label} className="bg-primary text-primary-foreground px-3.5 py-2 rounded-[10px] flex items-center gap-2">
          <svg className="w-[11px] h-[11px] text-amber-400" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 23c4.97 0 9-3.94 9-8.94 0-1.65-.43-3.27-1.24-4.7-.84 1.07-1.99 1.64-3.26 1.64-1.55-3.5-2.5-7-2.5-7s-3 4-3 7c0 1.66 1.34 3 3 3s3-1.34 3-3" />
          </svg>
          <div>
            <div className="font-mono text-[9px] tracking-[0.2em] opacity-60">{b.label}</div>
            <div className="font-serif text-[22px] leading-none">
              {b.v}
              <span className="text-[10px] opacity-60 ml-0.5">day{b.v !== 1 ? "s" : ""}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <>
      <Header eyebrow={`TODAY · ${dateLabel}`} title="Today's Practice" desc="한 걸음 떨어져서 보세요. Sweep → The One → Tiny Move. 그게 전부예요." right={badges} />

      <Card accent="bg-slate-300 dark:bg-slate-600">
        <CardHead
          d={"M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM12 6v6l4 2"}
          title="Sweep"
          ko="쓸어담기"
          sub="머릿속에 떠도는 것을 다 쏟아냅니다. 정리는 그 다음입니다."
          right={
            <button
              onClick={toggleVoice}
              title={listening ? "음성 입력 중지" : "음성으로 입력"}
              className={[
                "shrink-0 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                listening
                  ? "bg-red-500 text-white animate-pulse"
                  : "bg-muted text-muted-foreground hover:bg-primary hover:text-primary-foreground",
              ].join(" ")}
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3" />
              </svg>
              {listening ? "녹음 중…" : "음성 입력"}
            </button>
          }
        />
        <textarea
          className="w-full min-h-[120px] bg-transparent text-sm leading-relaxed pt-1 outline-none resize-none placeholder:text-muted-foreground placeholder:italic"
          placeholder="떠오르는 것들… 태스크, 걱정, 아이디어, 두려움. 그냥 다 적으세요. (마이크 버튼으로 말해도 됩니다)"
          value={log.sweep}
          onChange={(e) => patchTodayLog({ sweep: e.target.value })}
        />
      </Card>

      <Card accent="bg-rose-500">
        <CardHead d={"M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM12 6a6 6 0 1 0 0 12 6 6 0 0 0 0-12zM12 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"} title="The One" ko="오늘의 한 가지" sub="딱 하나. 오늘 이것만 끝내도 '잘했다'고 느낄 한 가지." />
        <div className="text-[11px] text-muted-foreground leading-relaxed mb-3">
          선택 기준: <strong className="text-foreground/70 font-medium">Urgency</strong>(마감) · <strong className="text-foreground/70 font-medium">Satisfaction</strong>(의미) · <strong className="text-foreground/70 font-medium">Resistance</strong>(미루던 것) · <strong className="text-foreground/70 font-medium">Momentum</strong>(흐름)
        </div>
        <div className="flex items-start gap-3 pt-1">
          <Checkbox checked={log.theOne.done} onClick={() => patchTodayLog({ theOne: { ...log.theOne, done: !log.theOne.done } })} />
          <input
            className={["flex-1 bg-transparent py-1.5 border-b border-border text-[15px] outline-none focus:border-foreground transition-colors", log.theOne.done ? "line-through text-muted-foreground" : ""].join(" ")}
            placeholder="오늘의 가장 중요한 한 가지…"
            value={log.theOne.text}
            onChange={(e) => patchTodayLog({ theOne: { ...log.theOne, text: e.target.value } })}
          />
        </div>
      </Card>

      <Card accent="bg-emerald-500">
        <CardHead d={"M12 2l3 7h7l-5.5 4 2 7L12 16l-6.5 4 2-7L2 9h7z"} title="Tiny Move" ko="2분의 움직임" sub="저항 없이 시작할 수 있는 2분 행동. 작게, 작게." />
        <div className="text-[11px] text-muted-foreground leading-relaxed mb-3">
          예시: 운동복 입기 · 책 5페이지 · 에디터 열기 · 첫 문장 쓰기 · 한 명에게 이메일
        </div>
        <div className="flex items-start gap-3 pt-1">
          <Checkbox checked={log.tinyMove.done} onClick={() => patchTodayLog({ tinyMove: { ...log.tinyMove, done: !log.tinyMove.done } })} />
          <input
            className={["flex-1 bg-transparent py-1.5 border-b border-border text-[15px] outline-none focus:border-foreground transition-colors", log.tinyMove.done ? "line-through text-muted-foreground" : ""].join(" ")}
            placeholder="2분이면 할 수 있는 한 가지…"
            value={log.tinyMove.text}
            onChange={(e) => patchTodayLog({ tinyMove: { ...log.tinyMove, text: e.target.value } })}
          />
        </div>
      </Card>

      <Card>
        <CardHead d={Icon.list} title="Today's Tasks" ko="오늘의 할 일" sub="The One 외에 오늘 마감인 것들" />
        {todayTasks.length === 0 ? (
          <div className="text-[11px] text-muted-foreground italic py-3">오늘 마감인 태스크가 없어요. ✨</div>
        ) : (
          <ul>
            {todayTasks.map((t) => (
              <TaskCard key={t.id} t={t} compact onToggle={() => updateTask(t.id, toggleTaskFn)} onDelete={() => {}} />
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

function toggleTaskFn(t: Task): Task {
  const completed = !t.completed;
  return { ...t, completed, status: completed ? "Done" : "Not started", completedAt: completed ? new Date().toISOString() : null };
}

// ── Task card ───────────────────────────────────────────
function TaskCard({
  t,
  compact,
  onToggle,
  onDelete,
  agents,
  creatingIssue,
  onAssignAgent,
  onSendToIssue,
}: {
  t: Task;
  compact?: boolean;
  onToggle: () => void;
  onDelete: () => void;
  agents?: PlanAgent[];
  creatingIssue?: boolean;
  onAssignAgent?: (agentId: string | null) => void;
  onSendToIssue?: () => void;
}) {
  const u = getUrgency(t);
  const q = isQuick(t);
  const showIssueControls = !compact && !!agents && !t.issueId;
  return (
    <li className={["group bg-background border rounded-[10px] p-3 mb-2 transition-colors hover:border-muted-foreground", q ? "border-amber-400/70 dark:border-amber-600/50" : "border-border"].join(" ")}>
      <div className="flex items-start gap-2.5">
        <Checkbox small checked={t.completed} onClick={onToggle} />
        <div className="flex-1 min-w-0">
          <div className={["text-[13px] leading-snug", t.completed ? "line-through text-muted-foreground" : ""].join(" ")}>{t.title}</div>
          {!compact && (
            <div className="flex flex-wrap gap-1.5 mt-2 items-center">
              <span className={["text-[9.5px] px-1.5 py-0.5 rounded border", PRIORITY_TAG[t.priority]].join(" ")}>{PRIORITY_KO[t.priority]}</span>
              {u && <span className={["text-[9.5px] px-1.5 py-0.5 rounded border", u.cls].join(" ")}>{u.ko}</span>}
              {q && <span className="text-[9.5px] px-1.5 py-0.5 rounded border bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/50">⚡ Quick</span>}
              <span className="text-[9.5px] text-muted-foreground">⏱ {t.estimatedMin}m</span>
              {t.issueId && <span className="text-[9.5px] px-1.5 py-0.5 rounded border bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/50">✓ 이슈 등록됨</span>}
            </div>
          )}
          {showIssueControls && (
            <div className="flex items-center gap-1.5 mt-2">
              <select
                value={t.assigneeAgentId ?? ""}
                onChange={(e) => onAssignAgent?.(e.target.value || null)}
                className="flex-1 min-w-0 bg-background border border-border rounded px-1.5 py-1 text-[11px] outline-none focus:border-muted-foreground"
              >
                <option value="">담당 에이전트 없음</option>
                {agents!.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
              <button
                onClick={onSendToIssue}
                disabled={creatingIssue}
                title="Multica 이슈로 등록 — 담당 에이전트가 있으면 실행까지"
                className="shrink-0 flex items-center gap-1 rounded bg-primary text-primary-foreground px-2 py-1 text-[11px] font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" />
                </svg>
                {creatingIssue ? "등록 중…" : "이슈 등록"}
              </button>
            </div>
          )}
        </div>
        {!compact && (
          <button onClick={onDelete} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity shrink-0">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
              <path d={Icon.trash} />
            </svg>
          </button>
        )}
      </div>
    </li>
  );
}

// ── Tasks (Sprint Board) ────────────────────────────────
function TasksPage({
  state,
  updateTask,
  deleteTask,
  onAdd,
  agents,
  onSendToIssue,
  creatingIssue,
}: {
  state: PlanState;
  updateTask: (id: string, fn: (t: Task) => Task) => void;
  deleteTask: (id: string) => void;
  onAdd: () => void;
  agents: PlanAgent[];
  onSendToIssue: (task: Task) => void;
  creatingIssue: boolean;
}) {
  const active = state.tasks.filter((t) => !t.completed && t.status !== "Skipped");
  const quickCount = active.filter(isQuick).length;

  return (
    <>
      <Header
        eyebrow="TASKS"
        title="Sprint Board"
        desc="4개 Sprint로 분류 · 15분 이하는 자동 Quick (테두리 주황) · 마감 자동 표시"
        right={
          <button onClick={onAdd} className="bg-primary text-primary-foreground px-4 py-2.5 rounded-lg text-[13px] inline-flex items-center gap-1.5 hover:opacity-90 transition-opacity">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d={Icon.plus} /></svg>
            새 태스크
          </button>
        }
      />

      {quickCount > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-[10px] p-3.5 mb-4.5 flex gap-3 items-start">
          <svg className="w-[18px] h-[18px] text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" /></svg>
          <div>
            <div className="text-[13px] font-medium text-amber-800 dark:text-amber-300">Quick Tasks ({quickCount})</div>
            <div className="text-[11px] text-amber-700/80 dark:text-amber-400/70 mt-0.5">15분 이하 태스크 — 압도되지 않으려면 이것부터 끝내세요.</div>
          </div>
        </div>
      )}

      <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
        {SPRINTS.map((s) => {
          const items = active.filter((t) => t.sprint === s.id);
          const style = SPRINT_STYLE[s.cls];
          return (
            <div key={s.id} className={["border-2 rounded-2xl p-3.5 min-h-[200px]", style.lane].join(" ")}>
              <div className="flex justify-between items-center mb-3">
                <div className="text-[10px] font-semibold tracking-[0.18em] uppercase">{s.id} · {s.ko}</div>
                <div className="bg-background/70 rounded-full text-[11px] px-2 py-0.5 min-w-[22px] text-center">{items.length}</div>
              </div>
              <ul>
                {items.map((t) => (
                  <TaskCard
                    key={t.id}
                    t={t}
                    agents={agents}
                    creatingIssue={creatingIssue}
                    onToggle={() => updateTask(t.id, toggleTaskFn)}
                    onDelete={() => { if (confirm("이 태스크를 삭제할까요?")) deleteTask(t.id); }}
                    onAssignAgent={(agentId) => updateTask(t.id, (x) => ({ ...x, assigneeAgentId: agentId }))}
                    onSendToIssue={() => onSendToIssue(t)}
                  />
                ))}
                {items.length === 0 && <div className="text-[11px] text-muted-foreground italic py-2">비어있음</div>}
              </ul>
            </div>
          );
        })}
      </div>
    </>
  );
}

// ── Reflect ─────────────────────────────────────────────
function ReflectPage({ state, updateTask }: { state: PlanState; updateTask: (id: string, fn: (t: Task) => Task) => void }) {
  const thisWeekStart = startOfWeek();
  const lastWeekStart = addDays(thisWeekStart, -7);
  const lastWeek = weeklyBreakdown(state.tasks, lastWeekStart);
  const feedback = generateFeedback(lastWeek);
  const missed = state.tasks.filter((t) => !t.completed && t.status !== "Skipped" && t.dueDate && new Date(t.dueDate) < new Date(todayKey()));

  const hThis = weekCount(state.logs, "theOne", thisWeekStart);
  const hLast = weekCount(state.logs, "theOne", lastWeekStart);
  const mThis = weekCount(state.logs, "tinyMove", thisWeekStart);
  const mLast = weekCount(state.logs, "tinyMove", lastWeekStart);

  const bars = [
    { label: "Must Do · 긴급", v: lastWeek.must, bar: "bg-red-500" },
    { label: "Should Do · 중요", v: lastWeek.should, bar: "bg-emerald-500" },
    { label: "Could Do · 탐색", v: lastWeek.could, bar: "bg-amber-500" },
  ];

  return (
    <>
      <Header eyebrow="WEEKLY REFLECT · 15 MIN" title="Reset & Realign" desc="바쁘면 건너뛰어도 OK. 그래도 잘하고 있어요." />

      <Card accent="bg-rose-500">
        <CardHead d={"M3 3v18h18M7 16l4-4 4 4 5-5"} title="Step 1 · Priority Analysis" ko="우선순위 분석 (1분)" sub="지난 주에 실제로 쓴 시간의 우선순위 분포" />
        {bars.map((b) => (
          <div key={b.label} className="mb-3 last:mb-0">
            <div className="flex justify-between text-[11.5px] mb-1.5">
              <span>{b.label}</span>
              <span className="font-mono text-muted-foreground">{b.v}%</span>
            </div>
            <div className="h-[7px] bg-muted rounded-full overflow-hidden">
              <div className={["h-full rounded-full transition-all duration-500", b.bar].join(" ")} style={{ width: `${b.v}%` }} />
            </div>
          </div>
        ))}
        <div className="mt-4.5 p-4 bg-primary text-primary-foreground rounded-[10px] text-[13px] leading-relaxed italic">{feedback}</div>
      </Card>

      <Card accent="bg-amber-500">
        <CardHead d={Icon.trash} title="Step 2 · Task Cleanup" ko="정리 (5분)" sub="놓친 태스크를 재배치하거나 흘려보내세요" />
        {missed.length === 0 ? (
          <div className="text-[11px] text-muted-foreground italic py-1">놓친 태스크 없음 — 깔끔해요.</div>
        ) : (
          <ul>
            {missed.slice(0, 10).map((t) => (
              <li key={t.id} className="bg-background border border-border rounded-[10px] p-3 mb-2">
                <div className="flex items-start gap-2.5">
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] leading-snug">{t.title}</div>
                    <div className="text-[9.5px] text-muted-foreground mt-1">{t.dueDate} · {t.priority}</div>
                  </div>
                  <button onClick={() => updateTask(t.id, (x) => ({ ...x, dueDate: todayKey() }))} className="text-[10.5px] px-2 py-1 rounded font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 hover:opacity-80 transition-opacity shrink-0">오늘로 재배치</button>
                  <button onClick={() => updateTask(t.id, (x) => ({ ...x, status: "Skipped" }))} className="text-[10.5px] px-2 py-1 rounded font-medium bg-muted text-muted-foreground hover:opacity-80 transition-opacity shrink-0">Skip</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card accent="bg-emerald-500">
        <CardHead d={"M12 23c4.97 0 9-3.94 9-8.94 0-1.65-.43-3.27-1.24-4.7-.84 1.07-1.99 1.64-3.26 1.64-1.55-3.5-2.5-7-2.5-7s-3 4-3 7c0 1.66 1.34 3 3 3s3-1.34 3-3"} fill title="Step 3 · Streak Review" ko="일관성 점검 (5분)" sub="이번 주 The One · Tiny Move 완료율" />
        <div className="grid grid-cols-2 gap-3.5">
          <StatBlock label="THE ONE · 오늘의 한 가지" thisWeek={hThis} lastWeek={hLast} streak={calcStreak(state.logs, "theOne")} />
          <StatBlock label="TINY MOVE · 2분의 움직임" thisWeek={mThis} lastWeek={mLast} streak={calcStreak(state.logs, "tinyMove")} />
        </div>
      </Card>
    </>
  );
}

function StatBlock({ label, thisWeek, lastWeek, streak }: { label: string; thisWeek: number; lastWeek: number; streak: number }) {
  const change = thisWeek - lastWeek;
  const cls = change > 0 ? "text-emerald-600 dark:text-emerald-400" : change < 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground";
  const arrow = change > 0 ? "↑" : change < 0 ? "↓" : "→";
  return (
    <div className="bg-background border border-border rounded-[10px] p-4">
      <div className="font-mono text-[9px] tracking-[0.2em] text-muted-foreground mb-2.5">{label}</div>
      <div className="flex items-baseline gap-1.5">
        <span className="font-serif text-3xl leading-none">{thisWeek}</span>
        <span className="text-[10px] text-muted-foreground">/ 7일</span>
      </div>
      <div className="text-[11px] text-muted-foreground mt-2 leading-relaxed">
        <div>지난 주: {lastWeek}일</div>
        <div className={cls}>변화: {change > 0 ? "+" : ""}{change} {arrow}</div>
        <div className="text-amber-600 dark:text-amber-400">🔥 {streak}일 연속</div>
      </div>
    </div>
  );
}

// ── Trace ───────────────────────────────────────────────
function TracePage({ state }: { state: PlanState }) {
  const now = new Date();
  const monthLabel = `${now.getFullYear()}년 ${now.getMonth() + 1}월`;
  const days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const first = new Date(now.getFullYear(), now.getMonth(), 1).getDay();
  const offset = first === 0 ? 6 : first - 1;

  const cells: { empty?: boolean; day?: number; key?: string; today?: boolean }[] = [];
  for (let i = 0; i < offset; i++) cells.push({ empty: true });
  for (let d = 1; d <= days; d++) {
    const k = dateKey(new Date(now.getFullYear(), now.getMonth(), d));
    cells.push({ day: d, key: k, today: k === todayKey() });
  }

  function CalCard({ title, kind, color, ko }: { title: string; kind: "theOne" | "tinyMove"; color: string; ko: string }) {
    return (
      <div className="bg-card border border-border rounded-2xl p-5">
        <h3 className="text-lg font-semibold mb-3.5 tracking-tight" style={{ fontFamily: TITLE_FONT }}>
          {title}
          <span className="text-[11px] text-muted-foreground font-normal ml-1.5">{ko}</span>
        </h3>
        <div className="grid grid-cols-7 gap-1.5">
          {["월", "화", "수", "목", "금", "토", "일"].map((d) => (
            <div key={d} className="font-mono text-[9px] tracking-wider text-muted-foreground text-center pb-1">{d}</div>
          ))}
          {cells.map((c, i) => {
            if (c.empty) return <div key={i} className="aspect-square" />;
            const done = c.key ? state.logs[c.key]?.[kind]?.done : false;
            return (
              <div
                key={i}
                className={[
                  "aspect-square rounded flex items-center justify-center text-[11px]",
                  done ? `${color} text-white` : "bg-muted text-muted-foreground",
                  c.today ? "ring-2 ring-foreground" : "",
                ].join(" ")}
              >
                {c.day}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <>
      <Header eyebrow="PROGRESS TRACE" title={monthLabel} desc="느낌은 없어도 진척은 쌓이고 있습니다. 작은 승리를 봅니다, 판단 없이." />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4.5">
        <CalCard title="The One" kind="theOne" color="bg-rose-500" ko="오늘의 한 가지" />
        <CalCard title="Tiny Move" kind="tinyMove" color="bg-emerald-500" ko="2분의 움직임" />
      </div>

      <Card>
        <CardHead d={"M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM12 6v6l4 2"} title="Why This Works" sub="왜 이 시스템이 작동하는지" />
        <div className="text-[13px] leading-relaxed text-muted-foreground">
          <p className="mb-2.5">진척은 바쁠 때 가장 놓치기 쉽습니다. 이 페이지는 — 느낌은 없어도 실제로 쌓이고 있는 노력을 보여줍니다.</p>
          <ul className="pl-5 list-disc space-y-1">
            <li>작은 승리를 축하하기</li>
            <li>벗어났을 때 방향 조정</li>
            <li>판단 없이 회고하기</li>
          </ul>
        </div>
      </Card>
    </>
  );
}

// ── Add Task Modal ──────────────────────────────────────
function AddTaskModal({ onClose, onSubmit, agents }: { onClose: () => void; onSubmit: (t: Task) => void; agents: PlanAgent[] }) {
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<Priority>("Should Do");
  const [sprint, setSprint] = useState("No Sprint");
  const [est, setEst] = useState(30);
  const [due, setDue] = useState(todayKey());
  const [agentId, setAgentId] = useState("");
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  const submit = () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    onSubmit({
      id: genId(),
      title: trimmed,
      status: "Not started",
      priority,
      sprint,
      estimatedMin: est || 0,
      dueDate: due || todayKey(),
      completed: false,
      completedAt: null,
      createdAt: new Date().toISOString(),
      assigneeAgentId: agentId || null,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-[100]" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl p-7 max-w-md w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-5">
          <h3 className="text-2xl font-bold tracking-tight" style={{ fontFamily: TITLE_FONT }}>새 태스크</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d={Icon.close} /></svg>
          </button>
        </div>
        <div className="flex flex-col gap-3.5">
          <input
            ref={titleRef}
            className="w-full bg-transparent py-1.5 border-b-2 border-border text-[17px] outline-none focus:border-foreground transition-colors"
            placeholder="태스크 이름…"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
          />
          <div className="grid grid-cols-2 gap-3">
            <Field label="우선순위">
              <select className="w-full bg-background border border-border rounded-md px-2.5 py-1.5 text-[13px] outline-none focus:border-muted-foreground" value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
                {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_KO[p]}</option>)}
              </select>
            </Field>
            <Field label="스프린트">
              <select className="w-full bg-background border border-border rounded-md px-2.5 py-1.5 text-[13px] outline-none focus:border-muted-foreground" value={sprint} onChange={(e) => setSprint(e.target.value)}>
                {SPRINTS.map((s) => <option key={s.id} value={s.id}>{s.id === "No Sprint" ? "미분류" : `${s.ko} (${s.id})`}</option>)}
              </select>
            </Field>
            <Field label="예상 시간 (분)">
              <input type="number" min={0} className="w-full bg-background border border-border rounded-md px-2.5 py-1.5 text-[13px] outline-none focus:border-muted-foreground" value={est} onChange={(e) => setEst(parseInt(e.target.value) || 0)} />
            </Field>
            <Field label="마감일">
              <input type="date" className="w-full bg-background border border-border rounded-md px-2.5 py-1.5 text-[13px] outline-none focus:border-muted-foreground" value={due} onChange={(e) => setDue(e.target.value)} />
            </Field>
          </div>
          <Field label="담당 에이전트 (선택 — 지정 후 '이슈 등록'하면 실행)">
            <select className="w-full bg-background border border-border rounded-md px-2.5 py-1.5 text-[13px] outline-none focus:border-muted-foreground" value={agentId} onChange={(e) => setAgentId(e.target.value)}>
              <option value="">담당 없음 (개인 메모로 보관)</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </Field>
          {est <= 15 && (
            <div className="text-[11px] text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-md px-2.5 py-2 flex gap-1.5 items-center">
              ⚡ <span>15분 이하 → 자동으로 빠른 작업(Quick)으로 분류됩니다.</span>
            </div>
          )}
          <button onClick={submit} className="w-full justify-center bg-primary text-primary-foreground py-3 rounded-lg text-[13px] inline-flex items-center gap-1.5 hover:opacity-90 transition-opacity">태스크 추가</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="font-mono text-[9px] tracking-[0.2em] text-muted-foreground mb-1 block">{label}</label>
      {children}
    </div>
  );
}

export default AlienPlanPage;
