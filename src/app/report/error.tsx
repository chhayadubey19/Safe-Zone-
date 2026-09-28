"use client";

/** Report flow boundary — never lose the citizen's context silently. */

import { ErrorPanel } from "@/components/safezone/error-panel";

export default function ReportError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorPanel
      error={error}
      reset={reset}
      title="The report flow hit a problem"
      hint="Something broke while preparing this page. Retry — nothing was submitted yet, so no report was lost."
    />
  );
}
