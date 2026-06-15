/** 상단 메뉴바 (Shapr3D): 파일·편집·항목·뷰·도움말 드롭다운 + 실행취소/공유. */
import { useState, type ReactNode } from "react";
import { useAppStore } from "../store/useAppStore";
import { downloadStl } from "../kernel/stlExport";
import { UndoIcon, RedoIcon } from "./icons";

type MenuId = "file" | "edit" | "items" | "view" | "help";

interface MenuItem {
  label: string;
  shortcut?: string;
  onClick?: () => void;
  disabled?: boolean;
  checked?: boolean;
  divider?: boolean; // 이 항목 위에 구분선
}

function Dropdown({ items, onClose }: { items: MenuItem[]; onClose: () => void }): JSX.Element {
  return (
    <div className="absolute left-0 top-full z-40 mt-1 w-64 rounded-lg border border-aa-border bg-aa-surface/98 p-1 shadow-xl backdrop-blur">
      {items.map((it, i) => (
        <div key={i}>
          {it.divider && <div className="my-1 h-px bg-aa-border" />}
          <button
            type="button"
            disabled={it.disabled}
            onClick={() => {
              it.onClick?.();
              onClose();
            }}
            className={[
              "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm",
              it.disabled ? "text-aa-text-dim opacity-50" : "text-aa-text aa-hoverable",
            ].join(" ")}
          >
            <span className="w-4 text-aa-accent">{it.checked ? "✓" : ""}</span>
            <span className="flex-1">{it.label}</span>
            {it.shortcut && <span className="text-[10px] text-aa-text-dim">{it.shortcut}</span>}
          </button>
        </div>
      ))}
    </div>
  );
}

function MenuButton({ id, label, open, setOpen, children }: {
  id: MenuId; label: string; open: MenuId | null; setOpen: (m: MenuId | null) => void; children: ReactNode;
}): JSX.Element {
  const isOpen = open === id;
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(isOpen ? null : id)}
        onMouseEnter={() => open && setOpen(id)}
        className={["rounded-md px-2.5 py-1 text-sm", isOpen ? "bg-aa-surface-2 text-aa-text" : "text-aa-text aa-hoverable"].join(" ")}
      >
        {label}
      </button>
      {isOpen && children}
    </div>
  );
}

export function TopMenuBar(): JSX.Element {
  const [open, setOpen] = useState<MenuId | null>(null);
  const s = useAppStore();
  const close = () => setOpen(null);
  const soon = (n: string) => s.setStatus(`${n} — 준비 중`);

  const fileItems: MenuItem[] = [
    { label: "새 프로젝트", shortcut: "Ctrl+N", onClick: () => void s.clear() },
    { label: "새 도면", onClick: () => soon("새 도면") },
    { label: "파일 가져오기...", shortcut: "Ctrl+Shift+I", divider: true, onClick: () => soon("가져오기") },
    { label: "프로젝트 가져오기...", shortcut: "Ctrl+Shift+P", onClick: () => soon("가져오기") },
    { label: "재질 가져오기...", disabled: true },
    { label: "프로젝트 닫기", shortcut: "Ctrl+W", divider: true, onClick: () => void s.clear() },
    { label: "프로젝트 이름 변경...", onClick: () => soon("이름 변경") },
    {
      label: "STL 내보내기",
      divider: true,
      disabled: s.shapes.length === 0,
      onClick: () => {
        downloadStl(s.shapes, s.transforms, "alien-space");
        s.setStatus(`STL 내보내기 — 바디 ${s.shapes.length}개`);
      },
    },
    { label: "STEP 내보내기", disabled: true },
    { label: "설정", shortcut: "Ctrl+,", divider: true, onClick: () => soon("설정") },
  ];

  const editItems: MenuItem[] = [
    { label: "실행 취소", shortcut: "Ctrl+Z", onClick: () => void s.undoLast(), disabled: s.shapes.length === 0 },
    { label: "재실행", shortcut: "Ctrl+Y", disabled: true },
    { label: "삭제", shortcut: "Delete", divider: true, disabled: s.selection.length === 0, onClick: () => soon("삭제") },
    { label: "모두 선택", shortcut: "Ctrl+A", onClick: () => soon("모두 선택") },
    { label: "모두 선택 해제", shortcut: "Ctrl+Shift+A", onClick: () => s.clearSelection() },
    { label: "관통 선택...", shortcut: "Ctrl+Shift+S", disabled: true },
  ];

  const itemsItems: MenuItem[] = [
    { label: "표시/숨기기", shortcut: "Ctrl+Shift+H", onClick: () => soon("표시/숨기기") },
    { label: "격리", disabled: true },
    { label: "확대/축소", divider: true, disabled: true },
    { label: "항목 사이드바에 표시", shortcut: "Shift+Alt+I", checked: s.panels.items, onClick: () => s.togglePanel("items") },
    { label: "숨겨진 바디 표시", shortcut: "Alt+H", onClick: () => soon("숨겨진 바디") },
    { label: "바디 표시 반전", shortcut: "Shift+Alt+H", onClick: () => soon("표시 반전") },
  ];

  const viewItems: MenuItem[] = [
    { label: "항목 표시 사이드바", shortcut: "Ctrl+Alt+S", checked: s.panels.items, onClick: () => s.togglePanel("items") },
    { label: "히스토리 사이드바 표시", shortcut: "Ctrl+Alt+H", checked: s.panels.history, onClick: () => s.togglePanel("history") },
    { label: "기본 뷰", shortcut: "Ctrl+1", divider: true, onClick: () => s.setView("iso") },
    { label: "정면도", shortcut: "Ctrl+2", onClick: () => s.setView("front") },
    { label: "평면도(위)", shortcut: "Ctrl+4", onClick: () => s.setView("top") },
    { label: "우측면도", shortcut: "Ctrl+6", onClick: () => s.setView("right") },
    { label: "와이어프레임", shortcut: "Alt+W", divider: true, checked: s.displayMode === "wireframe", onClick: () => s.setDisplayMode(s.displayMode === "wireframe" ? "shaded" : "wireframe") },
    { label: "X-Ray", shortcut: "Alt+X", checked: s.displayMode === "xray", onClick: () => s.setDisplayMode(s.displayMode === "xray" ? "shaded" : "xray") },
    { label: "음영", shortcut: "Alt+S", checked: s.displayMode === "shaded", onClick: () => s.setDisplayMode("shaded") },
  ];

  const helpItems: MenuItem[] = [
    { label: "ALIEN SPACE 정보", onClick: () => s.setStatus("ALIEN SPACE — Shapr3D-like CAD") },
    { label: "단축키", disabled: true },
  ];

  return (
    <>
      {open && <div className="fixed inset-0 z-30" onClick={close} />}
      <div className="pointer-events-auto absolute left-0 right-0 top-0 z-40 flex h-12 items-center justify-between border-b border-aa-border bg-aa-surface/95 px-2 backdrop-blur">
        <div className="flex items-center gap-1">
          <span className="px-2 text-sm font-semibold tracking-[0.18em] text-aa-accent">ALIEN SPACE</span>
          <span className="flex items-center gap-1 rounded-md px-2 py-1 text-sm text-aa-text">
            무제 프로젝트 <span className="text-aa-text-dim">▾</span>
          </span>
          <div className="mx-1 h-5 w-px bg-aa-border" />
          <MenuButton id="file" label="파일" open={open} setOpen={setOpen}><Dropdown items={fileItems} onClose={close} /></MenuButton>
          <MenuButton id="edit" label="편집" open={open} setOpen={setOpen}><Dropdown items={editItems} onClose={close} /></MenuButton>
          <MenuButton id="items" label="항목" open={open} setOpen={setOpen}><Dropdown items={itemsItems} onClose={close} /></MenuButton>
          <MenuButton id="view" label="뷰" open={open} setOpen={setOpen}><Dropdown items={viewItems} onClose={close} /></MenuButton>
          <MenuButton id="help" label="도움말" open={open} setOpen={setOpen}><Dropdown items={helpItems} onClose={close} /></MenuButton>
          <div className="mx-1 h-5 w-px bg-aa-border" />
          <button type="button" title="실행취소" onClick={() => void s.undoLast()} disabled={s.shapes.length === 0}
            className="flex h-8 w-8 items-center justify-center rounded-md text-[18px] text-aa-text aa-hoverable disabled:opacity-30"><UndoIcon /></button>
          <button type="button" title="다시실행 (준비 중)" disabled
            className="flex h-8 w-8 items-center justify-center rounded-md text-[18px] text-aa-text-dim opacity-30"><RedoIcon /></button>
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <span className="rounded-full bg-aa-bg px-3 py-1 text-xs text-aa-text-dim">제한된 액세스 버전</span>
        </div>

        <button type="button" className="rounded-lg bg-aa-accent px-3 py-1.5 text-sm font-semibold text-aa-bg">공유</button>
      </div>
    </>
  );
}
