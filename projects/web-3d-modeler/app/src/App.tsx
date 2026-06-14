import { useEffect } from "react";
import { Viewport } from "./viewport/Viewport";
import { TopMenuBar } from "./ui/TopMenuBar";
import { LeftToolbar } from "./ui/LeftToolbar";
import { ItemsPanel } from "./ui/ItemsPanel";
import { HistoryPanel } from "./ui/HistoryPanel";
import { ViewportControls } from "./ui/ViewportControls";
import { ContextBar } from "./ui/ContextBar";
import { SketchBar } from "./ui/SketchBar";
import { SketchConstraintsPanel } from "./ui/SketchConstraintsPanel";
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
      <TopMenuBar />
      <ItemsPanel />
      <LeftToolbar />
      <HistoryPanel />
      <ViewportControls />
      <SketchConstraintsPanel />
      <ContextBar />
      <SketchBar />
      <StatusPill layout={layout} />
    </div>
  );
}
