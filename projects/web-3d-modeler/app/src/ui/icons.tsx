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

export function CloseIcon(): JSX.Element {
  return (<svg {...base}><path d="M6 6l12 12M18 6L6 18" /></svg>);
}
export function LineIcon(): JSX.Element {
  return (<svg {...base}><path d="M4 20 20 4" /><circle cx="4" cy="20" r="1.3" /><circle cx="20" cy="4" r="1.3" /></svg>);
}
export function ArcIcon(): JSX.Element {
  return (<svg {...base}><path d="M4 18a14 14 0 0 1 16 0" /></svg>);
}
export function SplineIcon(): JSX.Element {
  return (<svg {...base}><path d="M3 17c4 0 4-10 9-10s5 10 9 10" /></svg>);
}
export function RectIcon(): JSX.Element {
  return (<svg {...base}><rect x="4" y="6" width="16" height="12" rx="1" /></svg>);
}
export function Circle2DIcon(): JSX.Element {
  return (<svg {...base}><circle cx="12" cy="12" r="8" /></svg>);
}
export function EllipseIcon(): JSX.Element {
  return (<svg {...base}><ellipse cx="12" cy="12" rx="9" ry="6" /></svg>);
}
export function PolygonIcon(): JSX.Element {
  return (<svg {...base}><path d="M12 3l8 6-3 9H7L4 9z" /></svg>);
}
export function OffsetIcon(): JSX.Element {
  return (<svg {...base}><rect x="5" y="5" width="14" height="14" rx="1" /><rect x="8" y="8" width="8" height="8" rx="1" strokeDasharray="2 2" /></svg>);
}
export function MirrorIcon(): JSX.Element {
  return (<svg {...base}><path d="M12 3v18" strokeDasharray="2 2" /><path d="M9 7 4 12l5 5zM15 7l5 5-5 5z" /></svg>);
}
export function PatternIcon(): JSX.Element {
  return (<svg {...base}><rect x="3" y="3" width="6" height="6" /><rect x="15" y="3" width="6" height="6" /><rect x="3" y="15" width="6" height="6" /><rect x="15" y="15" width="6" height="6" /></svg>);
}
export function ProjectIcon(): JSX.Element {
  return (<svg {...base}><path d="M4 6h16M4 6v12M4 18h16" /><path d="M8 10l4 4 4-4" /></svg>);
}
export function TextIcon(): JSX.Element {
  return (<svg {...base}><path d="M5 6h14M12 6v13M9 19h6" /></svg>);
}
export function TrimIcon(): JSX.Element {
  return (<svg {...base}><circle cx="6" cy="7" r="2.5" /><circle cx="6" cy="17" r="2.5" /><path d="M8 8l12 9M8 16l12-9" /></svg>);
}
export function GearIcon(): JSX.Element {
  return (<svg {...base}><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" /></svg>);
}

export function EyeIcon(): JSX.Element {
  return (
    <svg {...base}>
      <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="2.6" />
    </svg>
  );
}
