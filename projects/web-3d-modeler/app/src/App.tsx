import { useEffect } from "react";
import { Viewport } from "./viewport/Viewport";
import { Toolbar } from "./ui/Toolbar";
import { StatusBar } from "./ui/StatusBar";
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
      <Toolbar />
      <StatusBar layout={layout} />
    </div>
  );
}
