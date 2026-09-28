"use client";

/** Venue passport route boundary — a broken venue page offers retry + home. */

import { ErrorPanel } from "@/components/safezone/error-panel";

export default function VenueError({
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
      title="This venue's page could not load"
      hint="The venue details hit a problem. Retry, or go back to the registry and pick the venue again."
    />
  );
}
