import { useEffect } from "react";
import { Viewport } from "./viewport/Viewport";
import { TopBar } from "./ui/TopBar";
import { ToolRail } from "./ui/ToolRail";
import { ItemsPanel } from "./ui/ItemsPanel";
import { ContextBar } from "./ui/ContextBar";
import { SketchBar } from "./ui/SketchBar";
import { StatusPill } from "./ui/StatusPill";
import { useAppStore } from "./store/useAppStore";
import { useResponsiveShell } from "./device/useResponsiveShell";

export function App(): JSX.Element {
  const initKernel = useAppStore((s) => s.initKernel);
  const layout = useResponsiveShell();

  useEffect(() => {
    void initKernel();
  }, [initKernel]);

  return (
    <div className="relative h-full w-full overflow-hidden bg-aa-bg">
      <Viewport />
      <TopBar />
      <ToolRail />
      <ItemsPanel />
      <ContextBar />
      <SketchBar />
      <StatusPill layout={layout} />
    </div>
  );
}
