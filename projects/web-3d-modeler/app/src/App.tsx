import { useEffect } from "react";
import { Viewport } from "./viewport/Viewport";
import { TopMenuBar } from "./ui/TopMenuBar";
import { LeftToolbar } from "./ui/LeftToolbar";
import { ItemsPanel } from "./ui/ItemsPanel";
import { HistoryPanel } from "./ui/HistoryPanel";
import { ViewportControls } from "./ui/ViewportControls";
import { ContextBar } from "./ui/ContextBar";
import { SketchConstraintsPanel } from "./ui/SketchConstraintsPanel";
import { SketchContextMenu } from "./ui/SketchContextMenu";
import { NormalContextMenu } from "./ui/NormalContextMenu";
import { ExtrudeDialog } from "./ui/ExtrudeDialog";
import { RevolveDialog } from "./ui/RevolveDialog";
import { PatternDialog } from "./ui/PatternDialog";
import { TransformDialog } from "./ui/TransformDialog";
import { StatusPill } from "./ui/StatusPill";
import { useAppStore } from "./store/useAppStore";
import { useResponsiveShell } from "./device/useResponsiveShell";
import { useKeyboardShortcuts } from "./input/keyboardShortcuts";

export function App(): JSX.Element {
  const initKernel = useAppStore((s) => s.initKernel);
  const layout = useResponsiveShell();
  useKeyboardShortcuts();

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
      <SketchContextMenu />
      <NormalContextMenu />
      <ExtrudeDialog />
      <RevolveDialog />
      <PatternDialog />
      <TransformDialog />
      <StatusPill layout={layout} />
    </div>
  );
}
