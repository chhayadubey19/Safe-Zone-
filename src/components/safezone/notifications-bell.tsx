"use client";

/**
 * Citizen notifications — bell icon with unread badge, dropdown fed by
 * /api/notifications, mark-as-read on open/click. Polls lightly so freshly
 * created inspection/resolution updates appear while demoing.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import type { Notification } from "@/lib/types";

const relTime = (iso: string) => {
  try {
    const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.round(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.round(hours / 24)}d ago`;
  } catch {
    return "";
  }
};

export function NotificationBell({
  recipientId,
  className,
}: {
  recipientId: string | null;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const recipientRef = useRef(recipientId);
  recipientRef.current = recipientId;

  const load = useCallback(async () => {
    const id = recipientRef.current;
    if (!id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/notifications?recipientId=${encodeURIComponent(id)}`);
      if (!res.ok) return;
      const data = (await res.json()) as { notifications: Notification[] };
      setItems(data.notifications ?? []);
    } catch {
      // bell is non-critical — stay silent
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load + light polling (demo shows freshly created notifications).
  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 20_000);
    return () => clearInterval(t);
  }, [load, recipientId]);

  const unread = items.filter((n) => n.readAt === null).length;

  const markAllRead = useCallback(async () => {
    const id = recipientRef.current;
    if (!id || unread === 0) return;
    setItems((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
    try {
      await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientId: id, ids: "all" }),
      });
    } catch {
      // optimistic mark is enough for the demo
    }
  }, [unread]);

  if (!recipientId) return null;

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o) void markAllRead(); }}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          aria-label={unread > 0 ? `Notifications — ${unread} unread` : "Notifications"}
          className={cn("relative h-11 w-11 rounded-xl border-edge bg-surface p-0 shadow-card", className)}
        >
          <Bell className="h-5 w-5 text-navy" aria-hidden />
          {unread > 0 && (
            <span
              className="tnums absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-risk-urgent px-1 text-[10px] font-bold text-white shadow-card"
              aria-hidden
            >
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-80 rounded-xl border-edge bg-surface p-0 shadow-card-hover"
      >
        <div className="flex items-center justify-between border-b border-edge px-4 py-3">
          <span className="text-sm font-semibold text-ink">Notifications</span>
          {unread > 0 && (
            <span className="tnums rounded-full bg-risk-urgent-soft px-2 py-0.5 text-[11px] font-semibold text-risk-urgent">
              {unread} new
            </span>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto scrollbar-subtle">
          {loading && items.length === 0 && (
            <div className="flex items-center justify-center gap-2 p-6 text-sm text-ink-muted">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading…
            </div>
          )}
          {!loading && items.length === 0 && (
            <p className="p-6 text-center text-sm text-ink-muted">
              Nothing yet — you will be notified here when a venue you reported on is
              inspected, acted on, or fixed.
            </p>
          )}
          {items.length > 0 && (
            <ul className="divide-y divide-edge">
              {items.map((n) => (
                <li key={n.id} className={cn("px-4 py-3", !n.readAt && "bg-navy-soft/50")}>
                  <div className="flex items-start gap-2">
                    {!n.readAt && (
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-risk-urgent" aria-hidden />
                    )}
                    <div className="min-w-0">
                      <div className="text-sm font-medium leading-snug text-ink">{n.title}</div>
                      {n.body && (
                        <div className="mt-0.5 text-xs leading-relaxed text-ink-muted">{n.body}</div>
                      )}
                      <div className="mt-1 text-[11px] uppercase tracking-wide text-ink-muted">
                        {relTime(n.createdAt)}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
