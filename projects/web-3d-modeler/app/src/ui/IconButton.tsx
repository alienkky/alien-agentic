/** 아이콘 버튼 — 넉넉한 터치 타깃(44px) + 라벨 툴팁(title/aria-label). */
import type { ReactNode } from "react";

export function IconButton({
  label,
  onClick,
  disabled,
  active,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  children: ReactNode;
}): JSX.Element {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={[
        "flex h-11 w-11 items-center justify-center rounded-lg text-[22px] transition-colors",
        active ? "bg-aa-accent text-aa-bg" : "text-aa-text aa-hoverable",
        disabled ? "opacity-30" : "active:bg-aa-surface-2",
      ].join(" ")}
    >
      {children}
    </button>
  );
}
