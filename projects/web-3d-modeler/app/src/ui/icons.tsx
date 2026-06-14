/** 인라인 라인 아이콘 (Shapr3D 풍의 미니멀 톤). 24×24, currentColor stroke. */
import type { SVGProps } from "react";

// 크기는 1em — 부모의 font-size 로 제어한다.
const base: SVGProps<SVGSVGElement> = {
  width: "1em",
  height: "1em",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

export function BoxIcon(): JSX.Element {
  return (
    <svg {...base}>
      <path d="M12 3 4 7v10l8 4 8-4V7z" />
      <path d="M4 7l8 4 8-4M12 11v10" />
    </svg>
  );
}

export function CylinderIcon(): JSX.Element {
  return (
    <svg {...base}>
      <ellipse cx="12" cy="6" rx="6" ry="2.6" />
      <path d="M6 6v12M18 6v12" />
      <ellipse cx="12" cy="18" rx="6" ry="2.6" />
    </svg>
  );
}

export function SphereIcon(): JSX.Element {
  return (
    <svg {...base}>
      <circle cx="12" cy="12" r="8.5" />
      <ellipse cx="12" cy="12" rx="8.5" ry="3.4" />
    </svg>
  );
}

export function SubtractIcon(): JSX.Element {
  return (
    <svg {...base}>
      <circle cx="9" cy="12" r="6" />
      <circle cx="15" cy="12" r="6" strokeDasharray="2 2" />
    </svg>
  );
}

export function UnionIcon(): JSX.Element {
  return (
    <svg {...base}>
      <circle cx="9" cy="12" r="6" />
      <circle cx="15" cy="12" r="6" />
    </svg>
  );
}

export function IntersectIcon(): JSX.Element {
  return (
    <svg {...base}>
      <circle cx="9" cy="12" r="6" opacity="0.4" />
      <circle cx="15" cy="12" r="6" opacity="0.4" />
      <path d="M12 7a6 6 0 0 0 0 10 6 6 0 0 0 0-10z" />
    </svg>
  );
}

export function UndoIcon(): JSX.Element {
  return (
    <svg {...base}>
      <path d="M9 7 4 12l5 5" />
      <path d="M4 12h11a5 5 0 0 1 0 10" />
    </svg>
  );
}

export function TrashIcon(): JSX.Element {
  return (
    <svg {...base}>
      <path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" />
    </svg>
  );
}

export function SketchIcon(): JSX.Element {
  return (
    <svg {...base}>
      <path d="M4 20l4-1L19 8a2 2 0 0 0-3-3L5 16z" />
      <path d="M14 7l3 3" />
    </svg>
  );
}

export function ExtrudeIcon(): JSX.Element {
  return (
    <svg {...base}>
      <rect x="5" y="13" width="9" height="6" />
      <path d="M5 13l4-4h9v6M14 13l4-4M14 19l4-4v-6" />
    </svg>
  );
}

export function SearchIcon(): JSX.Element {
  return (
    <svg {...base}>
      <circle cx="11" cy="11" r="6" />
      <path d="M20 20l-4-4" />
    </svg>
  );
}

export function InsertIcon(): JSX.Element {
  return (
    <svg {...base}>
      <path d="M12 3 4 7v10l8 4 8-4V7z" />
      <path d="M9 11h6M12 8v6" />
    </svg>
  );
}

export function ConstructIcon(): JSX.Element {
  return (
    <svg {...base}>
      <path d="M3 17l9-5 9 5-9 5z" />
      <path d="M12 3v9" />
    </svg>
  );
}

export function TransformIcon(): JSX.Element {
  return (
    <svg {...base}>
      <path d="M12 3v18M3 12h18" />
      <path d="M12 3l-2 2M12 3l2 2M12 21l-2-2M12 21l2-2M3 12l2-2M3 12l2 2M21 12l-2-2M21 12l-2 2" />
    </svg>
  );
}

export function ToolsIcon(): JSX.Element {
  return (
    <svg {...base}>
      <path d="M14 7a3 3 0 1 1 3 3l-7 7-3 1 1-3z" />
      <path d="M5 19l3-3" />
    </svg>
  );
}

export function LayersIcon(): JSX.Element {
  return (
    <svg {...base}>
      <path d="M12 3l9 5-9 5-9-5z" />
      <path d="M3 13l9 5 9-5" />
    </svg>
  );
}

export function SectionIcon(): JSX.Element {
  return (
    <svg {...base}>
      <rect x="4" y="4" width="16" height="16" rx="1" />
      <path d="M4 12h16M12 4v16" strokeDasharray="2 2" />
    </svg>
  );
}

export function MeasureIcon(): JSX.Element {
  return (
    <svg {...base}>
      <path d="M3 17 17 3l4 4L7 21z" />
      <path d="M7 13l2 2M10 10l2 2M13 7l2 2" />
    </svg>
  );
}

export function RedoIcon(): JSX.Element {
  return (
    <svg {...base}>
      <path d="M15 7l5 5-5 5" />
      <path d="M20 12H9a5 5 0 0 0 0 10" />
    </svg>
  );
}

export function CameraIcon(): JSX.Element {
  return (
    <svg {...base}>
      <path d="M3 8h4l2-2h6l2 2h4v11H3z" />
      <circle cx="12" cy="13" r="3.2" />
    </svg>
  );
}

export function EyeIcon(): JSX.Element {
  return (
    <svg {...base}>
      <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="2.6" />
    </svg>
  );
}
