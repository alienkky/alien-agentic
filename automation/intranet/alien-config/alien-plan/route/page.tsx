"use client";

import { AlienPlanPage } from "@multica/views/alien-plan";
import { ErrorBoundary } from "@multica/ui/components/common/error-boundary";

export default function Page() {
  return (
    <ErrorBoundary>
      <AlienPlanPage />
    </ErrorBoundary>
  );
}
