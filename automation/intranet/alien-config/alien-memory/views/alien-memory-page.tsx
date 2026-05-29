"use client";

// AlienMemoryPage -- 27명 외계 에이전트의 메모리 4파일을 트리 + 편집기로 노출.
//
// 데이터 흐름: /api/alien-memory/{agents,agents/<name>/<file>} (Caddy → memory-api sidecar)
// 자립 컴포넌트 -- multica core 의존성 0. 강한 strict tsconfig (noUncheckedIndexedAccess
// 포함) 통과를 위해 화이트리스트 lookup 은 switch 로, 인덱스 접근 안 함.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

type FileMeta = {
  name: string;
  exists: boolean;
  size: number;
  modified: number;
};

type Agent = {
  name: string;
  korean_name?: string;
  role?: string;
  files: FileMeta[];
};

type AgentsResponse = {
  count: number;
  agents: Agent[];
};

type Selection = {
  agent: string;
  file: string;
};

const API_BASE = "/api/alien-memory";

function fileLabel(name: string): string {
  switch (name) {
    case "work.md":
      return "작업";
    case "learnings.md":
      return "배움";
    case "decisions.md":
      return "결정";
    case "mistakes.md":
      return "실수";
    default:
      return name;
  }
}

function fileIcon(name: string): string {
  switch (name) {
    case "work.md":
      return "🛠";
    case "learnings.md":
      return "💡";
    case "decisions.md":
      return "🧭";
    case "mistakes.md":
      return "⚠️";
    default:
      return "📄";
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

async function fetchAgents(): Promise<AgentsResponse> {
  const r = await fetch(`${API_BASE}/agents`, { cache: "no-store" });
  if (!r.ok) {
    throw new Error(`agents 로드 실패: ${r.status} ${r.statusText}`);
  }
  return (await r.json()) as AgentsResponse;
}

async function fetchFile(agent: string, file: string): Promise<string> {
  const r = await fetch(
    `${API_BASE}/agents/${encodeURIComponent(agent)}/${encodeURIComponent(file)}`,
    { cache: "no-store" },
  );
  if (!r.ok) {
    throw new Error(`파일 로드 실패: ${r.status} ${r.statusText}`);
  }
  return r.text();
}

async function saveFile(agent: string, file: string, content: string): Promise<void> {
  const r = await fetch(
    `${API_BASE}/agents/${encodeURIComponent(agent)}/${encodeURIComponent(file)}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    },
  );
  if (!r.ok) {
    const detail = await r.text().catch(() => "");
    throw new Error(`저장 실패: ${r.status} ${detail}`);
  }
}

export function AlienMemoryPage(): ReactNode {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selected, setSelected] = useState<Selection | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const [content, setContent] = useState("");
  const [original, setOriginal] = useState("");
  const [editing, setEditing] = useState(false);
  const [fileLoading, setFileLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const dirty = useMemo(() => content !== original, [content, original]);

  const loadAgents = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const r = await fetchAgents();
      setAgents(r.agents);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAgents();
  }, [loadAgents]);

  // 파일 선택 시 내용 로드
  useEffect(() => {
    if (!selected) {
      setContent("");
      setOriginal("");
      setEditing(false);
      return;
    }
    let cancelled = false;
    setFileLoading(true);
    fetchFile(selected.agent, selected.file)
      .then((text) => {
        if (cancelled) return;
        setContent(text);
        setOriginal(text);
        setEditing(false);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (cancelled) return;
        setFileLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selected]);

  const handleToggle = useCallback((name: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }, []);

  const handleSelect = useCallback(
    (agent: string, file: string) => {
      if (dirty) {
        const ok = window.confirm("저장 안 한 변경이 있어요. 버리고 이동할까요?");
        if (!ok) return;
      }
      setSelected({ agent, file });
      // 선택한 에이전트는 자동 펼침
      setExpanded((prev) => {
        if (prev.has(agent)) return prev;
        const next = new Set(prev);
        next.add(agent);
        return next;
      });
    },
    [dirty],
  );

  const handleSave = useCallback(async () => {
    if (!selected) return;
    setSaving(true);
    setError(null);
    try {
      await saveFile(selected.agent, selected.file, content);
      setOriginal(content);
      setSavedAt(Date.now());
      setEditing(false);
      void loadAgents();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }, [selected, content, loadAgents]);

  const handleDiscard = useCallback(() => {
    setContent(original);
    setEditing(false);
  }, [original]);

  // Cmd/Ctrl+S
  const handleSaveRef = useRef(handleSave);
  useEffect(() => {
    handleSaveRef.current = handleSave;
  }, [handleSave]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isSave = (e.metaKey || e.ctrlKey) && e.key === "s";
      if (isSave && editing && dirty) {
        e.preventDefault();
        void handleSaveRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editing, dirty]);

  // ── 렌더링 ──────────────────────────────────────────────────
  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div style={styles.title}>
          <span style={styles.titleEmoji}>🧠</span>
          <span>외계인 메모리</span>
        </div>
        <div style={styles.subtitle}>
          27명 외계 에이전트의 4파일 — work · learnings · decisions · mistakes
        </div>
      </header>

      <div style={styles.body}>
        <aside style={styles.sidebar}>
          {loading && <div style={styles.muted}>로딩...</div>}
          {!loading && agents.length === 0 && (
            <div style={styles.muted}>
              에이전트 디렉토리가 비어 있어요.
              <br />
              <code>shared-memory/agents/</code> 마운트 확인.
            </div>
          )}
          {agents.map((agent) => {
            const isOpen = expanded.has(agent.name);
            const filledCount = agent.files.filter((f) => f.exists).length;
            return (
              <div key={agent.name} style={styles.agentBlock}>
                <button
                  type="button"
                  onClick={() => handleToggle(agent.name)}
                  style={styles.agentRow}
                >
                  <span style={styles.agentCaret}>{isOpen ? "▾" : "▸"}</span>
                  <span style={styles.agentNameBox}>
                    {agent.korean_name ? (
                      <>
                        <span style={styles.agentNameTopRow}>
                          <span style={styles.agentNameKo}>{agent.korean_name}</span>
                          {agent.role && (
                            <span style={styles.agentRole}>[{agent.role}]</span>
                          )}
                        </span>
                        <span style={styles.agentNameEn}>{agent.name}</span>
                      </>
                    ) : (
                      <span style={styles.agentNameEn}>{agent.name}</span>
                    )}
                  </span>
                  <span style={styles.agentMeta}>{filledCount}/4</span>
                </button>
                {isOpen && (
                  <ul style={styles.fileList}>
                    {agent.files.map((file) => {
                      const isSelected =
                        selected?.agent === agent.name && selected.file === file.name;
                      const rowStyle: CSSProperties = {
                        ...styles.fileRow,
                        ...(isSelected ? styles.fileRowSelected : {}),
                        ...(file.exists ? {} : styles.fileRowMissing),
                      };
                      return (
                        <li key={file.name}>
                          <button
                            type="button"
                            onClick={() => handleSelect(agent.name, file.name)}
                            style={rowStyle}
                          >
                            <span>
                              {fileIcon(file.name)} {fileLabel(file.name)}
                            </span>
                            <span style={styles.fileMeta}>
                              {file.exists ? formatSize(file.size) : "—"}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </aside>

        <main style={styles.main}>
          {!selected && (
            <div style={styles.placeholder}>왼쪽에서 에이전트의 메모리 파일을 선택하세요.</div>
          )}
          {selected && (
            <>
              <div style={styles.editorHeader}>
                <div style={styles.breadcrumb}>
                  {(() => {
                    const a = agents.find((x) => x.name === selected.agent);
                    return (
                      <span style={styles.breadcrumbAgent}>
                        {a?.korean_name ? `${a.korean_name} · ${selected.agent}` : selected.agent}
                      </span>
                    );
                  })()}
                  <span style={styles.breadcrumbSep}>/</span>
                  <span>
                    {fileIcon(selected.file)} {selected.file}
                  </span>
                  {dirty && <span style={styles.dirtyBadge}>변경됨</span>}
                  {!dirty && savedAt && Date.now() - savedAt < 3000 && (
                    <span style={styles.savedBadge}>저장됨</span>
                  )}
                </div>
                <div style={styles.editorActions}>
                  {!editing && (
                    <button
                      type="button"
                      onClick={() => setEditing(true)}
                      style={styles.btn}
                    >
                      ✏️ 편집
                    </button>
                  )}
                  {editing && (
                    <>
                      <button
                        type="button"
                        onClick={handleDiscard}
                        disabled={!dirty || saving}
                        style={{ ...styles.btn, ...styles.btnGhost }}
                      >
                        취소
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          void handleSave();
                        }}
                        disabled={!dirty || saving}
                        style={{ ...styles.btn, ...styles.btnPrimary }}
                      >
                        {saving ? "저장 중..." : "저장 (⌘S)"}
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div style={styles.editorBody}>
                {fileLoading && <div style={styles.muted}>파일 로드 중...</div>}
                {!fileLoading && !editing && content.length === 0 && (
                  <div style={styles.muted}>
                    빈 파일이에요. <strong>편집</strong> 으로 새로 작성.
                  </div>
                )}
                {!fileLoading && !editing && content.length > 0 && (
                  <pre style={styles.viewer}>{content}</pre>
                )}
                {!fileLoading && editing && (
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    style={styles.editor}
                    autoFocus
                    spellCheck={false}
                  />
                )}
              </div>
            </>
          )}
        </main>
      </div>

      {error && (
        <div style={styles.errorBar}>
          <span>오류: {error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            style={styles.errorClose}
            aria-label="닫기"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

export default AlienMemoryPage;

// ── 인라인 스타일 ─────────────────────────────────────────────
const styles: Record<string, CSSProperties> = {
  container: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    minHeight: "calc(100vh - 56px)",
    background: "var(--background, #fafafa)",
    color: "var(--foreground, #1a1a1a)",
    fontFamily:
      "Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
  },
  header: {
    padding: "24px 32px 16px",
    borderBottom: "1px solid var(--border, #e5e5e5)",
  },
  title: {
    fontSize: 22,
    fontWeight: 700,
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 6,
  },
  titleEmoji: { fontSize: 24 },
  subtitle: {
    fontSize: 13,
    color: "var(--muted-foreground, #707070)",
  },
  body: {
    display: "flex",
    flex: 1,
    minHeight: 0,
  },
  sidebar: {
    width: 280,
    flexShrink: 0,
    borderRight: "1px solid var(--border, #e5e5e5)",
    overflowY: "auto",
    padding: "12px 8px",
  },
  main: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
  },
  muted: {
    color: "var(--muted-foreground, #909090)",
    fontSize: 13,
    padding: "12px 16px",
    lineHeight: 1.6,
  },
  agentBlock: {
    marginBottom: 2,
  },
  agentRow: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 12px",
    background: "transparent",
    border: 0,
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 500,
    color: "var(--foreground, #1a1a1a)",
    textAlign: "left",
    borderRadius: 6,
  },
  agentCaret: {
    fontSize: 10,
    width: 12,
    color: "var(--muted-foreground, #909090)",
  },
  agentNameBox: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: 1,
    minWidth: 0,
  },
  agentNameTopRow: {
    display: "flex",
    alignItems: "baseline",
    gap: 6,
    lineHeight: 1.2,
  },
  agentNameKo: {
    fontSize: 13,
    fontWeight: 600,
    color: "var(--foreground, #1a1a1a)",
  },
  agentRole: {
    fontSize: 10,
    fontWeight: 500,
    color: "var(--muted-foreground, #707070)",
  },
  agentNameEn: {
    fontSize: 10.5,
    color: "var(--muted-foreground, #909090)",
    fontFamily:
      "'JetBrains Mono', ui-monospace, 'Cascadia Code', Menlo, monospace",
    fontWeight: 400,
    lineHeight: 1.2,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    maxWidth: "100%",
  },
  agentMeta: {
    fontSize: 11,
    color: "var(--muted-foreground, #909090)",
    fontVariantNumeric: "tabular-nums",
  },
  fileList: {
    listStyle: "none",
    padding: 0,
    margin: "2px 0 6px",
  },
  fileRow: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "6px 12px 6px 32px",
    background: "transparent",
    border: 0,
    cursor: "pointer",
    fontSize: 13,
    color: "var(--foreground, #1a1a1a)",
    textAlign: "left",
    borderRadius: 6,
  },
  fileRowSelected: {
    background: "var(--accent, #f0eee8)",
    fontWeight: 600,
  },
  fileRowMissing: {
    color: "var(--muted-foreground, #b0b0b0)",
  },
  fileMeta: {
    fontSize: 11,
    color: "var(--muted-foreground, #909090)",
    fontVariantNumeric: "tabular-nums",
  },
  placeholder: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "var(--muted-foreground, #909090)",
    fontSize: 14,
  },
  editorHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 24px",
    borderBottom: "1px solid var(--border, #e5e5e5)",
    background: "var(--background, #fafafa)",
    flexWrap: "wrap",
    gap: 12,
  },
  breadcrumb: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 14,
    fontWeight: 500,
  },
  breadcrumbAgent: {
    color: "var(--muted-foreground, #707070)",
  },
  breadcrumbSep: {
    color: "var(--muted-foreground, #c0c0c0)",
  },
  dirtyBadge: {
    fontSize: 11,
    padding: "2px 8px",
    background: "var(--warning, #fff4e0)",
    color: "var(--warning-foreground, #aa6500)",
    borderRadius: 999,
    marginLeft: 8,
    fontWeight: 500,
  },
  savedBadge: {
    fontSize: 11,
    padding: "2px 8px",
    background: "var(--success, #e6f4e0)",
    color: "var(--success-foreground, #2a6f0a)",
    borderRadius: 999,
    marginLeft: 8,
    fontWeight: 500,
  },
  editorActions: {
    display: "flex",
    gap: 8,
  },
  btn: {
    padding: "6px 14px",
    fontSize: 13,
    borderRadius: 6,
    border: "1px solid var(--border, #d4d4d4)",
    background: "var(--background, #fff)",
    color: "var(--foreground, #1a1a1a)",
    cursor: "pointer",
    fontWeight: 500,
  },
  btnPrimary: {
    background: "var(--primary, #1a1a1a)",
    color: "var(--primary-foreground, #ffffff)",
    borderColor: "transparent",
  },
  btnGhost: {
    background: "transparent",
    borderColor: "transparent",
    color: "var(--muted-foreground, #707070)",
  },
  editorBody: {
    flex: 1,
    overflow: "auto",
    padding: "20px 24px",
  },
  viewer: {
    fontFamily:
      "'JetBrains Mono', ui-monospace, 'Cascadia Code', Menlo, monospace",
    fontSize: 13,
    lineHeight: 1.65,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    color: "var(--foreground, #1a1a1a)",
    margin: 0,
  },
  editor: {
    width: "100%",
    minHeight: 400,
    height: "calc(100vh - 240px)",
    fontFamily:
      "'JetBrains Mono', ui-monospace, 'Cascadia Code', Menlo, monospace",
    fontSize: 13,
    lineHeight: 1.65,
    padding: "12px 14px",
    border: "1px solid var(--border, #e5e5e5)",
    borderRadius: 8,
    resize: "vertical",
    outline: "none",
    background: "var(--background, #ffffff)",
    color: "var(--foreground, #1a1a1a)",
  },
  errorBar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "10px 16px",
    background: "var(--error, #fee5e0)",
    color: "var(--error-foreground, #a01408)",
    fontSize: 13,
    borderTop: "1px solid var(--error-border, #f8b8b0)",
  },
  errorClose: {
    background: "transparent",
    border: 0,
    cursor: "pointer",
    fontSize: 14,
    color: "inherit",
  },
};
