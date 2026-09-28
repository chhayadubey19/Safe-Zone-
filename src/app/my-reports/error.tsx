"use client";

/** My-reports boundary (covers /my-reports and /my-reports/[id]). */

import { ErrorPanel } from "@/components/safezone/error-panel";

export default function MyReportsError({
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
      title="Your reports could not be loaded"
      hint="Something broke while loading this page. Your filed reports are not affected — retry or go back home."
    />
  );
}
