"use client";

/**
 * /report — the AI-powered citizen report flow (SafeZone's core demo feature).
 *
 *   Step 1  Capture: camera photo via getUserMedia only (no gallery upload),
 *           geolocation + timestamp attached automatically, optional text in
 *           Hindi / English / mixed.
 *   Step 2  "AI analyzing…" shimmer while server-only routes run:
 *             /api/classify  (Gemini Flash, text)     — only if text given
 *             /api/analyze   (Gemini Flash vision)     — only if photo given
 *   Step 3  Confirm: merged findings, verdict + confidence per row, every
 *           row correctable by the citizen. If an AI call fails or times out,
 *           that section degrades to manual checklist selection with a toast.
 *   Step 4  Submit → existing POST /api/reports (risk recompute included) →
 *           redirect to /my-reports/[id] with the success animation.
 */

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CheckCircle2, ChevronRight, Loader2, Megaphone, PenLine, Send, ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { CHECKLIST_MAP, normalizeVenueType, type ItemKey, type VenueType } from "@/lib/checklist";
import type { VenueSummary } from "@/lib/data";
import type { Persona } from "@/components/safezone/header";
import { BackButton } from "@/components/safezone/back-button";
import { CameraCaptureCard, type GeoState } from "@/components/safezone/report-flow/camera-capture";
import { AnalyzingPanel } from "@/components/safezone/report-flow/analyzing-panel";
import {
  ConfirmFindings,
  type ConfirmDraft,
  type ExistingMatchView,
  type MatchChoice,
} from "@/components/safezone/report-flow/confirm-findings";
import type { CallState, Classification, VisionItems, VisionStatus } from "@/components/safezone/report-flow/types";

const STEPS = ["Capture", "AI analysis", "Confirm", "Filed"] as const;

function Stepper({ current }: { current: number }) {
  return (
    <ol className="flex items-center gap-1.5" aria-label="Report progress">
      {STEPS.map((step, i) => (
        <li key={step} className="flex items-center gap-1.5">
          <span
            className={cn(
              "inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-[11px] font-semibold",
              i < current
                ? "bg-trust-verified-soft text-green-800"
                : i === current
                  ? "bg-navy text-white"
                  : "bg-canvas text-ink-muted border border-dashed border-trust-unverified",
            )}
            aria-current={i === current ? "step" : undefined}
          >
            {i < current ? (
              <CheckCircle2 className="h-3 w-3" aria-hidden />
            ) : (
              <span className="tabular-nums">{i + 1}</span>
            )}
            <span className="hidden sm:inline">{step}</span>
          </span>
          {i < STEPS.length - 1 && <ChevronRight className="h-3.5 w-3.5 text-ink-muted" aria-hidden />}
        </li>
      ))}
    </ol>
  );
}

function ReportFlow() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [venues, setVenues] = useState<VenueSummary[]>([]);
  const [venuesLoading, setVenuesLoading] = useState(true);
  const [citizenId, setCitizenId] = useState<string | null>(null);
  const [venueId, setVenueId] = useState<string>("");

  const [text, setText] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [capturedAt, setCapturedAt] = useState<string | null>(null);
  const [geo, setGeo] = useState<GeoState>({ status: "pending", lat: null, lng: null });

  const [classifyState, setClassifyState] = useState<CallState>("idle");
  const [visionState, setVisionState] = useState<CallState>("idle");
  const [classify, setClassify] = useState<Classification | null>(null);
  const [visionItems, setVisionItems] = useState<VisionItems | null>(null);

  const [draft, setDraft] = useState<ConfirmDraft>({ category: "FIRE_SAFETY", issueKey: "other", severity: "minor" });
  const [visionEdits, setVisionEdits] = useState<Partial<Record<ItemKey, VisionStatus>>>({});
  const [manualFails, setManualFails] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  // Phase 4 — dedup: match against open incidents at this venue while the
  // citizen confirms their findings. Re-runs when the selected issue changes;
  // the choice resets with the match so a new incident gets a fresh answer.
  const [existingMatch, setExistingMatch] = useState<ExistingMatchView | null>(null);
  const [matchChoice, setMatchChoice] = useState<MatchChoice>("unset");
  const matchRef = useRef<ExistingMatchView | null>(null);

  const hasText = text.trim().length > 0;
  const hasPhoto = Boolean(photo);
  const selectedVenue = venues.find((v) => v.id === venueId);
  const venueType: VenueType = selectedVenue
    ? normalizeVenueType(selectedVenue.type as string)
    : "other";

  // ---- Load venues + personas; preselect venue from ?v= ---------------------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [venuesRes, personasRes] = await Promise.all([
          fetch("/api/venues"),
          fetch("/api/personas"),
        ]);
        const venuesData = (await venuesRes.json()) as { venues: VenueSummary[] };
        const personasData = (await personasRes.json()) as { personas: Persona[] };
        if (cancelled) return;
        setVenues(venuesData.venues ?? []);
        const citizen = personasData.personas?.find((p) => p.role === "citizen");
        if (citizen) setCitizenId(citizen.id);
        const preselect = searchParams.get("v");
        if (preselect && venuesData.venues?.some((v) => v.id === preselect)) {
          setVenueId(preselect);
        }
      } catch (err) {
        console.error("[report] failed to load venues", err);
      } finally {
        if (!cancelled) setVenuesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  // ---- Step 2→3 transition: check for a possible duplicate incident -------
  useEffect(() => {
    if (step !== 2 || !venueId) return;
    let cancelled = false;
    const issueKey = draft.issueKey && draft.issueKey !== "other" ? draft.issueKey : null;
    if (!issueKey && !text.trim()) return; // nothing to match on
    (async () => {
      try {
        const res = await fetch("/api/reports/match", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ venueId, issueKey, text: text.trim() || null }),
        });
        if (!res.ok) return;
        const data = (await res.json()) as { match: ExistingMatchView | null };
        if (cancelled) return;
        setExistingMatch(data.match ?? null);
        // A different incident than the one already answered → fresh choice.
        if (data.match?.incidentId !== matchRef.current?.incidentId) {
          setMatchChoice("unset");
        }
        matchRef.current = data.match ?? null;
      } catch {
        // dedup is a nicety — a failed lookup never blocks filing
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [step, venueId, draft.issueKey, text]);

  // ---- Automatic geolocation capture ----------------------------------------
  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setGeo({ status: "unsupported", lat: null, lng: null });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        setGeo({ status: "ok", lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setGeo((g) => ({ ...g, status: "denied" })),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30_000 },
    );
  }, []);

  // ---- Step 2: run the AI calls (server-only) --------------------------------
  const runAnalysis = async () => {
    if (!venueId || (!hasText && !hasPhoto)) return;
    setStep(1);

    let classifyOk = false;
    let visionOk = false;

    const classifyCall = hasText
      ? (async () => {
          setClassifyState("running");
          try {
            const res = await fetch("/api/classify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              // venueId scopes the AI's key reference to the items that
              // actually exist for this venue's type.
              body: JSON.stringify({ text: text.trim(), venueId: venueId || undefined }),
            });
            if (!res.ok) throw new Error(`classify ${res.status}`);
            const data = (await res.json()) as Classification;
            setClassify(data);
            setDraft({
              category: data.category,
              issueKey: data.issue_key,
              severity: data.severity === "CRITICAL" ? "critical" : "minor",
            });
            setClassifyState("done");
            classifyOk = true;
          } catch {
            setClassifyState("failed");
          }
        })()
      : Promise.resolve();

    const visionCall = hasPhoto
      ? (async () => {
          setVisionState("running");
          try {
            const res = await fetch("/api/analyze", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ photo, venueId: venueId || undefined }),
            });
            if (!res.ok) throw new Error(`analyze ${res.status}`);
            const data = (await res.json()) as { items: VisionItems };
            setVisionItems(data.items ?? {});
            setVisionEdits(
              Object.fromEntries(
                Object.entries(data.items ?? {}).map(([k, v]) => [k, v.status]),
              ) as Partial<Record<ItemKey, VisionStatus>>,
            );
            setVisionState("done");
            visionOk = true;
          } catch {
            setVisionState("failed");
          }
        })()
      : Promise.resolve();

    await Promise.allSettled([classifyCall, visionCall]);

    // Graceful handling: any requested modality that failed → manual selection.
    if ((hasText && !classifyOk) || (hasPhoto && !visionOk)) {
      toast({
        title: "AI unavailable — please select manually.",
        description:
          "The AI service could not be reached in time. Choose the issue yourself below — your report will be filed exactly the same.",
      });
    }
    setStep(2);
  };

  // ---- Step 4: submit via the existing report/risk pipeline ------------------
  const submit = async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      // Derive the primary issue: the (corrected) text classification wins;
      // photo-only reports fall back to the highest-confidence confirmed fail.
      const confirmedFails = [
        ...(visionItems
          ? (Object.entries(visionEdits) as [ItemKey, VisionStatus][])
              .filter(([, s]) => s === "fail")
              .map(([k]) => k)
          : [...manualFails]),
      ];

      let itemKey: string | null = null;
      let severity = draft.severity;
      let title = text.trim().slice(0, 60) || "Photo report — safety concern";

      if (hasText && draft.issueKey && draft.issueKey !== "other") {
        itemKey = draft.issueKey;
        title = classify?.issue_label ?? CHECKLIST_MAP[draft.issueKey as ItemKey]?.label ?? title;
      } else if (confirmedFails.length > 0) {
        itemKey = confirmedFails[0];
        severity = CHECKLIST_MAP[itemKey as ItemKey]?.severity === "major" ? "critical" : "minor";
        title = CHECKLIST_MAP[itemKey as ItemKey]?.label ?? title;
      }
      const extraCitizenFails = confirmedFails.filter((k) => k !== itemKey);

      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          venueId,
          itemKey,
          title,
          description: text.trim() || "Photo-only report — see attached evidence.",
          severity,
          category: draft.category,
          hasPhoto,
          reporterId: citizenId ?? "demo-citizen",
          photoDataUrl: photo,
          aiLanguage: classify,
          aiVision: visionItems ? { items: visionItems } : null,
          lat: geo.lat,
          lng: geo.lng,
          capturedAt,
          extraCitizenFails,
          // Phase 4 — the dedup choice from the confirm screen
          linkToIncidentId:
            matchChoice === "link" && existingMatch ? existingMatch.incidentId : null,
          forceNewIncident: matchChoice === "different",
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Failed to file report");
      }
      const outcome = (await res.json()) as {
        reportId: string;
        photoUpload?: "storage" | "data-url" | "skipped" | "failed";
      };
      // Evidence upload fallback: the report is filed, but the photo could
      // not be stored — tell the citizen instead of failing silently.
      if (outcome.photoUpload === "failed") {
        toast({
          title: "Photo could not be stored",
          description:
            "Your report was filed, but the evidence photo upload failed — it was submitted without it.",
        });
      }
      router.push(`/my-reports/${outcome.reportId}`);
    } catch (err) {
      toast({
        title: "Could not file the report",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
      setSubmitting(false);
      submittingRef.current = false;
    }
  };

  const canAnalyze = Boolean(venueId) && (hasText || hasPhoto);
  const canSubmit = Boolean(venueId) && (hasText || hasPhoto) && (hasText || visionState === "done" || manualFails.size > 0);

  const venueSelect = venuesLoading ? (
    <div className="space-y-2">
      <Skeleton className="h-4 w-20" />
      <Skeleton className="h-12 w-full rounded-xl" />
    </div>
  ) : (
    <div className="space-y-2">
      <Label htmlFor="report-venue" className="text-sm font-medium text-ink">
        Where did you see it?
      </Label>
      <Select value={venueId} onValueChange={setVenueId} disabled={step !== 0}>
        <SelectTrigger id="report-venue" className="h-12 rounded-xl border-edge bg-surface text-sm">
          <SelectValue placeholder="Choose a venue" />
        </SelectTrigger>
        <SelectContent className="max-h-72 rounded-xl border-edge">
          {venues.map((v) => (
            <SelectItem key={v.id} value={v.id} className="h-11">
              {v.name} · {v.ward}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <header className="sticky top-0 z-40 border-b border-edge bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/85">
        <div className="mx-auto flex h-16 max-w-3xl items-center gap-3 px-4 sm:px-6">
          {/* Phase 5 — consistent back affordance: the venue passport when a
              venue is selected (fresh-tab entry), otherwise the registry. */}
          <BackButton fallbackHref={venueId ? `/venue/${venueId}` : "/"} />
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-navy shadow-card">
              <ShieldCheck className="h-5 w-5 text-white" aria-hidden />
            </div>
            <div className="min-w-0">
              <div className="truncate text-base font-bold leading-tight text-navy">Report a safety issue</div>
              <div className="hidden truncate text-xs text-ink-muted sm:block">
                Photo + description, checked by AI, confirmed by you
              </div>
            </div>
          </div>
          <div className="ml-auto hidden md:block">
            <Stepper current={step} />
          </div>
        </div>
        <div className="border-t border-edge bg-surface px-4 py-2 md:hidden">
          <Stepper current={step} />
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 space-y-4 px-4 py-6 sm:px-6">
        {venueSelect}

        {step === 0 && (
          <>
            <CameraCaptureCard
              photo={photo}
              onPhotoChange={setPhoto}
              geo={geo}
              capturedAt={capturedAt}
              onCapturedAtChange={setCapturedAt}
            />

            <section className="rounded-xl border border-edge bg-surface shadow-card" aria-label="Description">
              <div className="flex items-center gap-2 border-b border-edge px-4 py-3 text-sm font-semibold text-ink">
                <PenLine className="h-4 w-4 text-navy" aria-hidden />
                Describe what you saw
                <span className="font-normal text-ink-muted">(optional)</span>
              </div>
              <div className="space-y-2 p-4">
                <Textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="e.g. Fire exit ke saamne chairs rakhi hain — poora raasta band hai"
                  className="min-h-24 rounded-xl border-edge bg-surface text-sm"
                  aria-label="Issue description — Hindi, English, or mixed"
                />
                <p className="text-xs text-ink-muted">
                  Write in Hindi, English, or mixed — the AI classifier understands all three.
                  A photo alone also works.
                </p>
              </div>
            </section>

            <section className="rounded-xl border border-edge bg-canvas p-4 text-xs leading-relaxed text-ink-muted">
              <p>
                <span className="font-semibold text-ink">How this works:</span> the photo and
                description are analysed on the server by Gemini Flash. Every AI verdict stays a
                suggestion — you confirm or correct each one before anything is filed. Citizen
                reports are marked{" "}
                <span className="font-semibold text-amber-700">unverified</span> until an
                inspector confirms them.
              </p>
            </section>
          </>
        )}

        {step === 1 && (
          <AnalyzingPanel
            hasText={hasText}
            hasPhoto={hasPhoto}
            classifyState={classifyState}
            visionState={visionState}
          />
        )}

        {step === 2 && (
          <>
            <ConfirmFindings
              hasText={hasText}
              hasPhoto={hasPhoto}
              text={text}
              photo={photo}
              classify={classify}
              visionItems={visionItems}
              draft={draft}
              onDraftChange={setDraft}
              visionEdits={visionEdits}
              onVisionEdit={(key, status) =>
                setVisionEdits((prev) => ({ ...prev, [key]: status }))
              }
              manualFails={manualFails}
              onManualFailToggle={(key, checked) =>
                setManualFails((prev) => {
                  const next = new Set(prev);
                  if (checked) next.add(key);
                  else next.delete(key);
                  return next;
                })
              }
              venueType={venueType}
              existingMatch={existingMatch}
              matchChoice={matchChoice}
              onChooseExisting={() => setMatchChoice("link")}
              onChooseDifferent={() => setMatchChoice("different")}
            />

            <section className="rounded-xl border border-edge bg-surface p-4 text-sm shadow-card">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <span className="font-semibold text-ink">
                  Filing against <span className="text-navy">{selectedVenue?.name ?? "—"}</span>
                </span>
                <span className="text-ink-muted">
                  {selectedVenue?.ward} · as an unverified citizen report
                </span>
              </div>
              <p className="mt-1 text-xs text-ink-muted">
                Nothing is filed until you press File report. The venue&apos;s risk score is
                recalculated immediately after.
              </p>
            </section>
          </>
        )}
      </main>

      <footer className="sticky bottom-0 border-t border-edge bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/85">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-3 sm:px-6">
          {step > 0 && (
            <Button
              variant="outline"
              onClick={() => setStep((s) => (s === 2 ? 1 : 0) as 0 | 1 | 2)}
              disabled={submitting}
              className="h-12 rounded-xl border-edge"
            >
              Back
            </Button>
          )}
          {step === 0 && (
            <Button
              onClick={() => void runAnalysis()}
              disabled={!canAnalyze}
              className="h-12 flex-1 gap-2 rounded-xl bg-navy px-5 font-semibold text-white shadow-card hover:bg-navy-hover sm:flex-none"
            >
              <Megaphone className="h-4 w-4" aria-hidden />
              {hasText || hasPhoto ? "Analyze with AI" : "Add a photo or description"}
            </Button>
          )}
          {step === 2 && (
            <Button
              onClick={() => void submit()}
              disabled={!canSubmit || submitting}
              className="h-12 flex-1 gap-2 rounded-xl bg-navy px-5 font-semibold text-white shadow-card hover:bg-navy-hover sm:flex-none"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Send className="h-4 w-4" aria-hidden />
              )}
              {submitting ? "Filing…" : "File report"}
            </Button>
          )}
          {step === 1 && (
            <span className="flex-1 text-center text-xs text-ink-muted" aria-live="polite">
              Analysing on the server — nothing is filed yet
            </span>
          )}
        </div>
      </footer>
    </div>
  );
}

export default function ReportPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center bg-canvas">
          <Loader2 className="h-6 w-6 animate-spin text-navy" aria-label="Loading" />
        </div>
      }
    >
      <ReportFlow />
    </Suspense>
  );
}
