"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { List, Map as MapIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Header, type Persona } from "@/components/safezone/header";
import { Filters, type TypeFilter } from "@/components/safezone/filters";
import { VenueList } from "@/components/safezone/venue-list";
import { MapView } from "@/components/safezone/map-view";
import { VenueDetail } from "@/components/safezone/venue-detail";
import { VENUE_TYPE_LABELS } from "@/components/safezone/tokens";
import { ShieldMark } from "@/components/safezone/logo";
import type { VenueSummary } from "@/lib/data";
import type { RiskTier } from "@/lib/types";

const ALL_TIERS: RiskTier[] = ["URGENT", "HIGH", "NEEDS_VERIFICATION", "INSUFFICIENT_DATA"];

export default function SafeZonePage() {
  const router = useRouter();
  const [venues, setVenues] = useState<VenueSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [activePersonaId, setActivePersonaId] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [tiers, setTiers] = useState<Set<RiskTier>>(new Set());
  const [type, setType] = useState<TypeFilter>("all");

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "map">("list");
  const [refreshKey, setRefreshKey] = useState(0);

  const loadVenues = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/venues");
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const data = (await res.json()) as {
        source: "demo" | "supabase";
        venues: VenueSummary[];
      };
      if (!Array.isArray(data.venues)) throw new Error("Unexpected response shape");
      setVenues(data.venues);
    } catch (err) {
      console.error("[page] failed to load venues", err);
      setVenues([]);
      setLoadError("The venue registry could not be loaded. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadVenues();
    fetch("/api/personas")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`Request failed (${r.status})`))))
      .then((data: { personas: Persona[] }) => {
        if (!Array.isArray(data?.personas)) throw new Error("Unexpected response shape");
        setPersonas(data.personas);
        const citizen = data.personas.find((p) => p.role === "citizen");
        if (citizen) setActivePersonaId(citizen.id);
      })
      .catch(() => undefined); // persona switcher stays empty; reporting falls back
  }, [loadVenues]);

  const tierCounts = useMemo(() => {
    const counts = { URGENT: 0, HIGH: 0, NEEDS_VERIFICATION: 0, INSUFFICIENT_DATA: 0 } as Record<RiskTier, number>;
    for (const v of venues) counts[v.risk.tier] += 1;
    return counts;
  }, [venues]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return venues
      .filter((v) => (tiers.size === 0 || tiers.has(v.risk.tier)))
      .filter((v) => type === "all" || v.type === type)
      .filter(
        (v) =>
          q === "" ||
          v.name.toLowerCase().includes(q) ||
          v.ward.toLowerCase().includes(q) ||
          (VENUE_TYPE_LABELS[v.type] ?? "").toLowerCase().includes(q),
      )
      .sort((a, b) => b.risk.score - a.risk.score || a.name.localeCompare(b.name));
  }, [venues, query, tiers, type]);

  const toggleTier = (tier: RiskTier) => {
    setTiers((prev) => {
      const next = new Set(prev);
      if (next.has(tier)) next.delete(tier);
      else next.add(tier);
      return next;
    });
  };

  const selectVenue = (id: string) => {
    setSelectedId(id);
    setDetailOpen(true);
    setViewMode((m) => (m === "list" ? "map" : m)); // mobile: jump to the map
  };

  return (
    <div className="flex min-h-dvh flex-col bg-canvas lg:h-dvh lg:overflow-hidden">
      <Header
        personas={personas}
        activePersonaId={activePersonaId}
        onPersonaChange={setActivePersonaId}
        onReport={() => {
          // The full camera + AI report flow lives at /report — the header
          // action goes straight there (preselecting the open venue if any).
          router.push(selectedId ? `/report?v=${selectedId}` : "/report");
        }}
      />

      {/* Mobile view switch — tap targets ≥ 48px. z-[1000]: the nav stays
          above the isolated map (z-0) so the tab bar is never covered. */}
      <div className="relative z-[1000] flex gap-1 border-b border-edge bg-surface p-2 lg:hidden" role="tablist" aria-label="View">
        {(["list", "map"] as const).map((mode) => (
          <button
            key={mode}
            role="tab"
            aria-selected={viewMode === mode}
            onClick={() => setViewMode(mode)}
            className={cn(
              "flex h-11 flex-1 items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors",
              viewMode === mode ? "bg-navy text-white" : "text-ink-muted hover:bg-canvas",
            )}
          >
            {mode === "list" ? <List className="h-4 w-4" aria-hidden /> : <MapIcon className="h-4 w-4" aria-hidden />}
            {mode === "list" ? "Venue list" : "Map"}
          </button>
        ))}
      </div>

      <main className="flex-1 lg:min-h-0">
        <div className="mx-auto max-w-[1600px] lg:grid lg:h-full lg:grid-cols-[minmax(360px,410px)_1fr]">
          {/* List column — z-[1000]: the list (cards, tier chips, filters)
              stays above the isolated map (z-0) in the stacking order; the
              columns never overlap geometrically, but this guarantees the
              chips and cards can never be painted over by map panes. */}
          <aside
            className={cn(
              "relative z-[1000] space-y-4 p-4 sm:p-6 lg:h-full lg:overflow-y-auto lg:border-r lg:border-edge scrollbar-subtle",
              viewMode === "map" && "hidden lg:block",
            )}
          >
            {loadError && (
              <div className="rounded-xl border border-risk-urgent/30 bg-risk-urgent-soft p-4 text-sm text-ink" role="alert">
                <p className="font-semibold">{loadError}</p>
                <Button
                  variant="outline"
                  onClick={() => void loadVenues()}
                  className="mt-2 h-11 rounded-xl border-edge"
                >
                  Retry
                </Button>
              </div>
            )}
            <Filters
              query={query}
              onQueryChange={setQuery}
              tiers={tiers}
              onTierToggle={toggleTier}
              tierCounts={tierCounts}
              type={type}
              onTypeChange={setType}
              resultCount={filtered.length}
            />
            <VenueList
              venues={filtered}
              selectedId={selectedId}
              onSelect={selectVenue}
              loading={loading}
            />
          </aside>

          {/* Map column — the MapView wrapper carries relative z-0 isolate
              overflow-hidden: a sealed stacking context so Leaflet's
              z-400–1000 panes stay inside this column. */}
          <div
            className={cn(
              "p-4 pb-6 sm:p-6 lg:h-full",
              viewMode === "list" && "hidden lg:block",
            )}
          >
            <MapView
              venues={filtered}
              selectedId={selectedId}
              onSelect={selectVenue}
              className="h-[calc(100dvh-17rem)] min-h-80 lg:h-full"
            />
          </div>
        </div>
      </main>

      <footer className="mt-auto border-t border-edge bg-surface">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-3 text-[11px] text-ink-muted sm:px-6">
          <span className="inline-flex items-center gap-1.5 font-semibold text-navy">
            <ShieldMark className="h-4 w-4" /> SafeZone
          </span>
          <span className="font-medium text-ink-muted">Safer Places. Stronger Communities.</span>
          {/* Informational pages — the mobile path to About lives here. */}
          <Link
            href="/about"
            className="rounded font-semibold text-navy underline-offset-2 transition-colors hover:text-navy-hover hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy/40"
          >
            About
          </Link>
          <Link
            href="/about#how-it-works"
            className="rounded font-medium text-ink-muted underline-offset-2 transition-colors hover:text-navy hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy/40"
          >
            How it works
          </Link>
          <span className="hidden sm:inline">
            Severity ≠ trust: chips show <span className="font-medium text-green-700">who verified</span>, badges show{" "}
            <span className="font-medium text-risk-urgent">priority</span>.
          </span>
          <span className="ml-auto hidden md:inline">Map data © OpenStreetMap contributors · Tiles © Esri</span>
        </div>
      </footer>

      <VenueDetail
        key={`${selectedId ?? "none"}-${refreshKey}`}
        venueId={selectedId}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        onReportHere={(id) => {
          // "Report an issue here" from the venue passport → the full flow,
          // venue preselected via ?v=.
          router.push(`/report?v=${id}`);
        }}
        refreshKey={refreshKey}
      />
    </div>
  );
}
