"use client";

/**
 * InfoDialog — SafeZone's single polished popup pattern.
 *
 * Desktop: centred modal card (Radix Dialog, zoom-in).
 * Mobile (below sm): full-width bottom sheet that slides up — the natural
 * reach-friendly pattern on small viewports.
 *
 * Guarantees: Escape closes it, visible close control, focus is trapped by
 * Radix, labelled by its title, never stacks (only one instance renders at
 * a time via controlled state in the parent), and the page behind cannot
 * scroll while open (Radix locks it).
 */

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";
import { SemanticIcon, type CategoryVariant } from "./design";
import type { LucideIcon } from "lucide-react";

export function InfoDialog({
  open,
  onOpenChange,
  icon,
  variant = "neutral",
  eyebrow,
  title,
  children,
  footer,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  icon?: LucideIcon;
  variant?: CategoryVariant;
  eyebrow?: string;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            "fixed inset-0 z-[1100] bg-navy/35 backdrop-blur-[2px]",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
            "duration-200",
          )}
        />
        <DialogPrimitive.Content
          aria-label={title}
          className={cn(
            // Shared card language — same border/surface/shadow as everything.
            "fixed z-[1100] flex max-h-[85dvh] w-full flex-col overflow-hidden border border-edge bg-surface shadow-card-hover",
            // Desktop: centred modal card.
            "left-1/2 top-1/2 max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
            // Mobile: pinned bottom sheet with its own slide physics.
            "max-sm:inset-x-0 max-sm:bottom-0 max-sm:top-auto max-sm:max-h-[88dvh] max-sm:translate-x-0 max-sm:translate-y-0",
            "max-sm:rounded-b-none max-sm:rounded-t-2xl max-sm:border-x-0 max-sm:border-b-0",
            "max-sm:data-[state=open]:animate-in max-sm:data-[state=open]:slide-in-from-bottom",
            "max-sm:data-[state=closed]:animate-out max-sm:data-[state=closed]:slide-out-to-bottom",
            "duration-200",
            className,
          )}
        >
          {/* Grab handle — the affordance that says "bottom sheet" on mobile. */}
          <div className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-edge max-sm:block sm:hidden" aria-hidden />

          <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">
            <div className="flex items-start gap-4">
              {icon && <SemanticIcon icon={icon} variant={variant} />}
              <div className="min-w-0 flex-1">
                {eyebrow && (
                  <DialogPrimitive.Description asChild>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-muted">
                      {eyebrow}
                    </div>
                  </DialogPrimitive.Description>
                )}
                <DialogPrimitive.Title asChild>
                  <h2 className="text-lg font-semibold leading-snug text-ink">{title}</h2>
                </DialogPrimitive.Title>
              </div>
              <DialogPrimitive.Close
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-canvas hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy/40"
                aria-label="Close"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </DialogPrimitive.Close>
            </div>
            <div className="mt-4 text-sm leading-relaxed text-ink-muted">{children}</div>
            {footer && <div className="mt-5 border-t border-edge pt-4">{footer}</div>}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
