"use client";

/**
 * Step 3 — confirm the merged AI findings.
 *
 * Both AI calls (text classification, photo vision) land here as SUGGESTIONS:
 * every row shows its verdict + confidence and can be corrected by the citizen.
 * When an AI call failed, that section degrades to manual checklist selection.
 */

import { useMemo, useState } from "react";
import {
  AlertTriangle, Camera, ChevronDown, EyeOff, Link2, PenLine, ShieldQuestion, Sparkles, XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { CATEGORIES, CHECKLIST_MAP, hasCategory, isApplicable, type ItemKey, type VenueType } from "@/lib/checklist";
import { CATEGORY_ICONS, ITEM_ICONS } from "@/components/safezone/tokens";
import { FAIL_PHRASES, type Classification, type VisionItems, type VisionStatus } from "./types";

export interface ConfirmDraft {
  category: string;
  issueKey: string;
  severity: "critical" | "minor";
}

/** Phase 4 — a dedup match found by /api/reports/match. */
export interface ExistingMatchView {
  incidentId: string;
  title: string;
  reportCount: number;
  matchedBy: "issue_key" | "text";
  similarity: number;
}

export type MatchChoice = "unset" | "link" | "different";

/**
 * The dedup banner — "Possible existing issue found — N similar reports at
 * this location." with the two choices. Shown above everything else on the
 * confirm screen; either choice is a statement of intent carried into the
 * submit (never files anything by itself).
 */
function ExistingIssueBanner({
  match,
  choice,
  onChooseExisting,
  onChooseDifferent,
}: {
  match: ExistingMatchView;
  choice: MatchChoice;
  onChooseExisting: () => void;
  onChooseDifferent: () => void;
}) {
  return (
    <div
      role="alert"
      className="sz-rise rounded-xl border-l-4 border-trust-citizen bg-trust-citizen-soft p-4 shadow-card"
    >
      <div className="flex items-start gap-3 text-sm">
        <Link2 className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden />
        <div className="min-w-0 flex-1 text-ink">
          <div className="font-semibold">
            Possible existing issue found — {match.reportCount} similar report
            {match.reportCount === 1 ? "" : "s"} at this location.
          </div>
          <div className="mt-0.5 truncate text-ink-muted">
            “{match.title}”
            {match.matchedBy === "text" && " — similar wording to your description"}
          </div>

          {choice === "unset" ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={onChooseExisting}
                className="h-11 flex-1 gap-1.5 rounded-xl bg-navy px-4 font-semibold text-white shadow-card hover:bg-navy-hover"
              >
                <Link2 className="h-4 w-4" aria-hidden />
                Add my report to this
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={onChooseDifferent}
                className="h-11 flex-1 gap-1.5 rounded-xl border-edge font-semibold text-ink hover:bg-canvas"
              >
                <XCircle className="h-4 w-4" aria-hidden />
                It&apos;s a different issue
              </Button>
            </div>
          ) : choice === "link" ? (
            <div className="mt-3 rounded-lg border border-navy/25 bg-navy-soft px-3 py-2 text-xs font-medium text-navy">
              Adding your report to the existing issue — it will count as another
              confirmation, and the risk score updates immediately.
            </div>
          ) : (
            <div className="mt-3 rounded-lg border border-edge bg-surface px-3 py-2 text-xs font-medium text-ink-muted">
              Filing as a new, separate issue at this venue.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const STATUS_ORDER: Record<VisionStatus, number> = { fail: 0, pass: 1, not_visible: 2 };

function SectionCard({
  icon: Icon,
  title,
  subtitle,
  manual,
  children,
}: {
  icon: typeof Camera;
  title: string;
  subtitle: string;
  manual?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-edge bg-surface shadow-card">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-edge px-4 py-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-navy-soft text-navy">
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-ink">{title}</div>
          <div className="truncate text-xs text-ink-muted">{subtitle}</div>
        </div>
        {manual ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-trust-citizen-soft px-2 py-0.5 text-[11px] font-medium text-amber-800">
            <PenLine className="h-3 w-3" aria-hidden /> Manual selection
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-navy-soft px-2 py-0.5 text-[11px] font-medium text-navy">
            <Sparkles className="h-3 w-3" aria-hidden /> AI suggestion
          </span>
        )}
      </div>
      <div className="space-y-3 p-4">{children}</div>
    </section>
  );
}

function SeverityToggle({
  value,
  onChange,
}: {
  value: "critical" | "minor";
  onChange: (v: "critical" | "minor") => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Severity">
      {(["minor", "critical"] as const).map((s) => (
        <button
          key={s}
          type="button"
          role="radio"
          aria-checked={value === s}
          onClick={() => onChange(s)}
          className={cn(
            "flex min-h-12 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-medium transition-colors",
            s === "minor" && value === "minor" && "border-risk-verification bg-risk-verification-soft text-amber-900",
            s === "minor" && value !== "minor" && "border-edge bg-surface text-ink-muted",
            s === "critical" && value === "critical" && "border-risk-urgent bg-risk-urgent-soft text-risk-urgent",
            s === "critical" && value !== "critical" && "border-edge bg-surface text-ink-muted",
          )}
        >
          {s === "critical" && <AlertTriangle className="h-4 w-4" aria-hidden />}
          {s === "minor" ? "Minor issue" : "Serious hazard"}
        </button>
      ))}
    </div>
  );
}

function VisionRow({
  itemKey,
  status,
  confidence,
  onChange,
}: {
  itemKey: ItemKey;
  status: VisionStatus;
  confidence: number;
  onChange: (s: VisionStatus) => void;
}) {
  const item = CHECKLIST_MAP[itemKey];
  const Icon = ITEM_ICONS[itemKey] ?? ShieldQuestion;
  const barColor =
    status === "fail" ? "bg-risk-urgent" : status === "pass" ? "bg-trust-verified" : "bg-trust-unverified";

  return (
    <div className="flex items-center gap-3 rounded-xl border border-edge bg-canvas px-3 py-2">
      <span
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
          status === "fail" ? "bg-risk-urgent-soft text-risk-urgent" : "bg-surface text-ink-muted border border-edge",
        )}
      >
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-ink">{item?.label ?? itemKey}</div>
        <div className="mt-1 flex items-center gap-2">
          <span className="h-1.5 w-16 overflow-hidden rounded-full bg-edge" aria-hidden>
            <span className={cn("block h-full rounded-full", barColor)} style={{ width: `${Math.round(confidence * 100)}%` }} />
          </span>
          <span className="text-[11px] tabular-nums text-ink-muted">
            {status === "not_visible" ? "not in frame" : `${Math.round(confidence * 100)}% confident`}
          </span>
        </div>
      </div>
      <div
        role="radiogroup"
        aria-label={`Your verdict — ${item?.label ?? itemKey}`}
        className="flex shrink-0 overflow-hidden rounded-lg border border-edge bg-surface"
      >
        {(["pass", "fail", "not_visible"] as const).map((s) => (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={status === s}
            onClick={() => onChange(s)}
            title={s === "pass" ? "Looks fine" : s === "fail" ? "There is a problem" : "Not visible in photo"}
            className={cn(
              "min-h-11 px-2.5 text-[11px] font-semibold uppercase tracking-wide transition-colors",
              status === s
                ? s === "fail"
                  ? "bg-risk-urgent text-white"
                  : s === "pass"
                    ? "bg-trust-verified text-white"
                    : "bg-slate-400 text-white"
                : "text-ink-muted hover:bg-canvas",
            )}
          >
            {s === "pass" ? "Pass" : s === "fail" ? "Fail" : "N/V"}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ConfirmFindings({
  hasText,
  hasPhoto,
  text,
  photo,
  classify,
  visionItems,
  draft,
  onDraftChange,
  visionEdits,
  onVisionEdit,
  manualFails,
  onManualFailToggle,
  venueType,
  existingMatch,
  matchChoice,
  onChooseExisting,
  onChooseDifferent,
}: {
  hasText: boolean;
  hasPhoto: boolean;
  text: string;
  photo: string | null;
  classify: Classification | null;
  visionItems: VisionItems | null;
  draft: ConfirmDraft;
  onDraftChange: (d: ConfirmDraft) => void;
  visionEdits: Partial<Record<ItemKey, VisionStatus>>;
  onVisionEdit: (key: ItemKey, status: VisionStatus) => void;
  manualFails: Set<string>;
  onManualFailToggle: (key: ItemKey, checked: boolean) => void;
  /** The venue's type — the checklist shows applicable items only. */
  venueType: VenueType;
  /** Phase 4 — dedup match against open incidents at this venue. */
  existingMatch: ExistingMatchView | null;
  /** The citizen's answer to the linking banner. */
  matchChoice: MatchChoice;
  onChooseExisting: () => void;
  onChooseDifferent: () => void;
}) {
  const [showNotVisible, setShowNotVisible] = useState(false);

  // Banner text — mirrors the spec example, e.g. "AI detected a possible
  // blocked emergency exit. Please confirm."
  const banner = useMemo(() => {
    if (visionItems) {
      const fails = (Object.entries(visionEdits) as [ItemKey, VisionStatus][])
        .filter(([, s]) => s === "fail")
        .map(([k]) => ({ key: k, confidence: visionItems[k]?.confidence ?? 0 }))
        .sort((a, b) => b.confidence - a.confidence);
      const top = fails[0];
      if (top && top.confidence >= 0.5) {
        return `AI detected a possible ${FAIL_PHRASES[top.key] ?? "safety hazard"}. Please confirm.`;
      }
    }
    if (classify?.severity === "CRITICAL") {
      return `AI classified your description as a possible critical hazard (${classify.issue_label}). Please confirm.`;
    }
    return null;
  }, [visionItems, visionEdits, classify]);

  const sortedVision = useMemo(() => {
    if (!visionItems) return [];
    return (Object.keys(visionItems) as ItemKey[])
      .sort((a, b) => {
        const sa = visionEdits[a] ?? "not_visible";
        const sb = visionEdits[b] ?? "not_visible";
        return (
          STATUS_ORDER[sa] - STATUS_ORDER[sb] ||
          (visionItems[b]?.confidence ?? 0) - (visionItems[a]?.confidence ?? 0)
        );
      });
  }, [visionItems, visionEdits]);

  const visibleRows = sortedVision.filter((k) => (visionEdits[k] ?? "not_visible") !== "not_visible");
  const notVisibleRows = sortedVision.filter((k) => (visionEdits[k] ?? "not_visible") === "not_visible");

  // Only categories that exist for this venue type; issues within the selected
  // category are likewise restricted to applicable items.
  const selectableCategories = CATEGORIES.filter((c) => hasCategory(venueType, c.key));
  const draftCategory =
    selectableCategories.find((c) => c.key === draft.category) ??
    selectableCategories.find((c) => c.items.some((i) => i.key === draft.issueKey && isApplicable(i, venueType))) ??
    selectableCategories[0] ??
    CATEGORIES[0];
  const draftItems = draftCategory.items.filter((i) => isApplicable(i, venueType));

  return (
    <div className="space-y-4">
      {/* Phase 4 — possible duplicate: link to the existing incident or file separately */}
      {existingMatch && (
        <ExistingIssueBanner
          match={existingMatch}
          choice={matchChoice}
          onChooseExisting={onChooseExisting}
          onChooseDifferent={onChooseDifferent}
        />
      )}

      {/* Loud status on the calm interface — amber row + red triangle, unconfirmed */}
      {banner && (
        <div
          role="alert"
          className="sz-rise flex items-start gap-3 rounded-xl border-l-4 border-risk-urgent bg-trust-citizen-soft p-4 text-sm"
        >
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-risk-urgent" aria-hidden />
          <div className="text-ink">
            <div className="font-semibold">{banner}</div>
            <div className="mt-0.5 text-ink-muted">
              AI findings are suggestions. Correct anything below before filing.
            </div>
          </div>
        </div>
      )}

      {/* Text findings */}
      {hasText && (
        <SectionCard
          icon={PenLine}
          title="From your description"
          subtitle={classify ? `Routed to the ${classify.department} department` : "Classify the issue yourself"}
          manual={!classify}
        >
          {text.trim() && (
            <blockquote className="rounded-xl border border-edge bg-canvas px-3 py-2 text-sm italic text-ink-muted">
              “{text.trim()}”
            </blockquote>
          )}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-ink">Category</Label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {selectableCategories.map((c) => {
                const Icon = CATEGORY_ICONS[c.icon];
                const active = draftCategory.key === c.key;
                return (
                  <button
                    key={c.key}
                    type="button"
                    aria-pressed={active}
                    onClick={() =>
                      onDraftChange({
                        category: c.key,
                        issueKey: c.items.some((i) => i.key === draft.issueKey) ? draft.issueKey : "other",
                        severity: draft.severity,
                      })
                    }
                    className={cn(
                      "flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl border px-2 py-2 text-xs font-medium transition-colors",
                      active
                        ? "border-navy bg-navy-soft text-navy"
                        : "border-edge bg-surface text-ink-muted hover:border-navy/40",
                    )}
                  >
                    {Icon && <Icon className="h-5 w-5" aria-hidden />}
                    {c.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium text-ink">Issue</Label>
            <Select
              value={draft.issueKey}
              onValueChange={(v) => onDraftChange({ ...draft, issueKey: v })}
            >
              <SelectTrigger className="h-12 rounded-xl border-edge bg-surface text-sm">
                <SelectValue placeholder="Choose the issue" />
              </SelectTrigger>
              <SelectContent className="max-h-72 rounded-xl border-edge">
                {draftItems.map((i) => (
                  <SelectItem key={i.key} value={i.key} className="h-11">
                    {i.label}
                    {i.severity === "major" && (
                      <span className="ml-1.5 rounded bg-navy-soft px-1.5 py-0.5 text-[10px] font-semibold uppercase text-navy">
                        major
                      </span>
                    )}
                  </SelectItem>
                ))}
                <SelectItem value="other" className="h-11">Something else</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium text-ink">How serious does it look?</Label>
            <SeverityToggle
              value={draft.severity}
              onChange={(severity) => onDraftChange({ ...draft, severity })}
            />
          </div>
        </SectionCard>
      )}

      {/* Photo findings */}
      {hasPhoto && (
        <SectionCard
          icon={Camera}
          title="From your photo"
          subtitle={
            visionItems
              ? `${visibleRows.length} item${visibleRows.length === 1 ? "" : "s"} assessable — tap a verdict to correct it`
              : "Select the items your photo shows problems with"
          }
          manual={!visionItems}
        >
          {photo && (
            <div className="overflow-hidden rounded-xl border border-edge">
              { }
              <img src={photo} alt="Your evidence" className="max-h-44 w-full object-cover" />
            </div>
          )}

          {visionItems ? (
            <div className="space-y-2">
              {visibleRows.map((key) => (
                <VisionRow
                  key={key}
                  itemKey={key}
                  status={visionEdits[key] ?? "not_visible"}
                  confidence={visionItems[key]?.confidence ?? 0}
                  onChange={(s) => onVisionEdit(key, s)}
                />
              ))}
              {visibleRows.length === 0 && (
                <p className="rounded-xl border border-dashed border-trust-unverified bg-canvas p-3 text-sm text-ink-muted">
                  Nothing was clearly assessable in the photo. You can still file the report
                  from your description, or retake the photo.
                </p>
              )}
              {notVisibleRows.length > 0 && (
                <div>
                  <button
                    type="button"
                    onClick={() => setShowNotVisible((v) => !v)}
                    className="flex min-h-11 w-full items-center gap-2 rounded-xl px-1 text-xs font-medium text-ink-muted hover:text-navy"
                    aria-expanded={showNotVisible}
                  >
                    <ChevronDown
                      className={cn("h-4 w-4 transition-transform", showNotVisible && "rotate-180")}
                      aria-hidden
                    />
                    <EyeOff className="h-4 w-4" aria-hidden />
                    {notVisibleRows.length} item{notVisibleRows.length === 1 ? "" : "s"} not clearly
                    visible — AI refused to guess
                  </button>
                  {showNotVisible && (
                    <div className="space-y-2 pt-2">
                      {notVisibleRows.map((key) => (
                        <VisionRow
                          key={key}
                          itemKey={key}
                          status={visionEdits[key] ?? "not_visible"}
                          confidence={visionItems[key]?.confidence ?? 0}
                          onChange={(s) => onVisionEdit(key, s)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {selectableCategories.map((c) => {
                const Icon = CATEGORY_ICONS[c.icon];
                const items = c.items.filter((i) => isApplicable(i, venueType));
                if (items.length === 0) return null;
                return (
                  <div key={c.key} className="space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                      {Icon && <Icon className="h-4 w-4" aria-hidden />}
                      {c.label}
                    </div>
                    {items.map((i) => {
                      const ItemIcon = ITEM_ICONS[i.key];
                      const checked = manualFails.has(i.key);
                      return (
                        <Label
                          key={i.key}
                          className={cn(
                            "flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border px-3 text-sm font-normal transition-colors",
                            checked
                              ? "border-risk-urgent/50 bg-risk-urgent-soft/60 text-ink"
                              : "border-edge bg-canvas text-ink hover:border-navy/40",
                          )}
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(v) => onManualFailToggle(i.key, v === true)}
                          />
                          {ItemIcon && <ItemIcon className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden />}
                          <span className="flex-1">{i.label}</span>
                          {i.severity === "major" && (
                            <span className="rounded bg-navy-soft px-1.5 py-0.5 text-[10px] font-semibold uppercase text-navy">
                              major
                            </span>
                          )}
                        </Label>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>
      )}
    </div>
  );
}
