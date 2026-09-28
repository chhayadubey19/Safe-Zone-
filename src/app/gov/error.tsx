"use client";

/** Government console boundary — officers get retry/home too. */

import { ErrorPanel } from "@/components/safezone/error-panel";

export default function GovError({
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
      title="The government console could not load"
      hint="This dashboard hit a problem. Retry, or go back to the registry home."
    />
  );
}
