"use client";

/**
 * Global error boundary — the LAST RESORT, catching errors thrown by the
 * root layout itself (context providers, global CSS crashes). This is the
 * boundary that replaces Next.js's default "Application error: a client-side
 * exception has occurred" screen, so it must render its own <html>/<body>.
 */

import { ShieldAlert, RotateCw } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Server-side visible diagnostic (digest only — never a stack trace in UI).
  console.error("[safezone] global error:", error?.message, error?.digest ?? "");

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
          background: "#f6f7f4",
          color: "#1f2937",
        }}
      >
        <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: 32, textAlign: "center" }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: "#fee2e2", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ShieldAlert size={28} color="#dc2626" aria-hidden />
          </div>
          <div style={{ maxWidth: 420 }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Something went wrong</h2>
            <p style={{ margin: "6px 0 0", fontSize: 14, color: "#6b7280" }}>
              SafeZone hit an unexpected problem. Trying again usually fixes it — your reports are safe.
            </p>
          </div>
          <button
            type="button"
            onClick={reset}
            style={{
              height: 44,
              padding: "0 20px",
              borderRadius: 12,
              border: "none",
              background: "#1e3a5f",
              color: "#fff",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <RotateCw size={16} aria-hidden />
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
