"use client";

/**
 * Route-level error boundary — catches render errors in ANY page under the
 * root layout (home, /report, /gov, /my-reports, /venue/[id], …) and shows
 * the branded recovery panel instead of Next.js's raw "Application error"
 * page. The segment remounts on retry via reset().
 */

import { ErrorPanel } from "@/components/safezone/error-panel";

export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorPanel error={error} reset={reset} />;
}
