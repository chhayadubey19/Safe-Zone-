"use client";

/**
 * Leaflet map — ESRI Light Gray Canvas tiles (base + reference labels),
 * RISK-tier coloured markers.
 * Leaflet is imported dynamically inside an effect because it touches
 * `window` at module scope (this component also renders during SSR).
 */

import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, Marker as LeafletMarker } from "leaflet";
import "leaflet/dist/leaflet.css";
import { cn } from "@/lib/utils";
import { MapPinOff } from "lucide-react";
import { TIER_DISPLAY, TierIcon } from "./tokens";
import { tr, type StringKey } from "@/lib/i18n";
import { useLang } from "@/hooks/use-lang";
import type { VenueSummary } from "@/lib/data";
import type { RiskTier } from "@/lib/types";

const TIER_Z: Record<RiskTier, number> = {
  URGENT: 1000,
  HIGH: 600,
  NEEDS_VERIFICATION: 300,
  INSUFFICIENT_DATA: 100,
};

// ESRI ArcGIS Online basemap — Light Gray Canvas (a clean minimal style, the
// closest no-key equivalent of the retired CartoDB Positron look).
// WHY NOT CARTO: since 2025 basemaps.cartocdn.com returns watermarked
// "API KEY REQUIRED" placeholder tiles for EVERY unkeyed request — the tiles
// load with HTTP 200 (so Leaflet never raises `tileerror`) but render as a
// blank map covered in watermark text. A Carto key could lift it, but keys
// rotate/expire and we refuse to make the map depend on one. ESRI's public
// ArcGIS Online tile service needs NO key, serves NO watermark, and is
// backed for production traffic. Note the tile path order: {z}/{y}/{x}.
// Native tiles stop at zoom 16 — Leaflet upscales beyond that (maxNativeZoom)
// which keeps deep zooms functional (soft, never watermarked).
const esriBaseTileUrl =
  "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}";
const esriRefTileUrl =
  "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}";
const ESRI_ATTRIBUTION =
  "Tiles &copy; Esri &mdash; data: Esri, HERE, Garmin, FAO, NOAA, USGS";
/** A Leaflet view operation (fitBounds / flyTo / setView) is only safe when
 * the map container has real pixel size. On mobile the map mounts inside a
 * `display:none` tab (0×0) until the user switches to the Map tab — running
 * view math against a zero-size map yields NaN, and flyTo's animation frame
 * then throws "Invalid LatLng object: (NaN, NaN)", which takes the whole
 * React tree down (the mobile venue-tap crash). Every view operation below
 * is guarded by this check, with a pending-view queue applied once the
 * container gains size (ResizeObserver → invalidateSize). */
function hasRealSize(map: LeafletMap): boolean {
  const size = map.getSize();
  return size.x > 0 && size.y > 0;
}

/** Lucide tier-icon SVGs (paths verbatim from lucide-react v0.525.0 — the
 *  same icons TIER_ICON_META uses in the UI) rendered inside Leaflet
 *  divIcon HTML strings. white stroke via currentColor. */
const TIER_MARKER_SVG: Record<RiskTier, string> = {
  URGENT: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 18v-6a5 5 0 1 1 10 0v6"/><path d="M5 21a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-1a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2z"/><path d="M21 12h1"/><path d="M18.5 4.5 18 5"/><path d="M2 12h1"/><path d="M12 2v1"/><path d="m4.929 4.929.707.707"/><path d="M12 12v6"/></svg>`,
  HIGH: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>`,
  NEEDS_VERIFICATION: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 14 2 2 4-4"/></svg>`,
  INSUFFICIENT_DATA: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.1 2.182a10 10 0 0 1 3.8 0"/><path d="M13.9 21.818a10 10 0 0 1-3.8 0"/><path d="M17.609 3.721a10 10 0 0 1 2.69 2.7"/><path d="M2.182 13.9a10 10 0 0 1 0-3.8"/><path d="M20.279 17.609a10 10 0 0 1-2.7 2.69"/><path d="M21.818 10.1a10 10 0 0 1 0 3.8"/><path d="M3.721 6.391a10 10 0 0 1 2.7-2.69"/><path d="M6.391 20.279a10 10 0 0 1-2.69-2.7"/></svg>`,
};

const TIER_LABEL_KEYS: Record<RiskTier, StringKey> = {
  URGENT: "tier_urgent",
  HIGH: "tier_high",
  NEEDS_VERIFICATION: "tier_verify",
  INSUFFICIENT_DATA: "tier_no_data",
};

export function MapView({
  venues,
  selectedId,
  onSelect,
  className,
}: {
  venues: VenueSummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef(new Map<string, LeafletMarker>());
  const onSelectRef = useRef(onSelect);
  /** View operation to run once the container has real size (mobile hidden-tab case). */
  const pendingViewRef = useRef<{
    kind: "fit" | "focus";
    bounds?: [number, number][];
    center?: [number, number];
    zoom?: number;
  } | null>(null);
  const [ready, setReady] = useState(false);
  const { lang } = useLang();

  onSelectRef.current = onSelect;

  /** Apply any queued view operation — called after invalidateSize so the
   *  container size is fresh. Never throws into React: Leaflet errors are
   *  logged and the pending op is dropped (the map stays usable at its
   *  default Bhopal view). */
  const applyPendingView = (map: LeafletMap) => {
    const pending = pendingViewRef.current;
    if (!pending || !hasRealSize(map)) return;
    pendingViewRef.current = null;
    try {
      if (pending.kind === "fit" && pending.bounds?.length) {
        map.fitBounds(pending.bounds, { padding: [32, 32], maxZoom: 13 });
      } else if (pending.kind === "focus" && pending.center) {
        const zoom = Number.isFinite(pending.zoom) ? pending.zoom! : 15;
        map.setView(pending.center, zoom, { animate: false });
      }
    } catch (err) {
      console.warn("[safezone] map view operation failed:", err);
    }
  };

  // Initialise the map once (attemptKey re-runs it after a failure/retry).
  const [failed, setFailed] = useState(false);
  const [attemptKey, setAttemptKey] = useState(0);
  useEffect(() => {
    let cancelled = false;
    let map: LeafletMap | null = null;
    let observer: ResizeObserver | null = null;

    (async () => {
      try {
        const L = (await import("leaflet")).default;
        if (cancelled || !containerRef.current || mapRef.current) return;

        map = L.map(containerRef.current, {
          center: [23.2419, 77.4366], // Bhopal civic centre
          zoom: 12,
          scrollWheelZoom: true,
          attributionControl: true,
        });

        // Base canvas first, then the reference overlay on top of it (street
        // + place labels — the base layer alone is label-free). Both are
        // keyless ESRI ArcGIS Online tiles (see the comment above).
        L.tileLayer(esriBaseTileUrl, {
          maxNativeZoom: 16,
          maxZoom: 19,
          attribution: ESRI_ATTRIBUTION,
        }).addTo(map);
        L.tileLayer(esriRefTileUrl, {
          maxNativeZoom: 16,
          maxZoom: 19,
        }).addTo(map);

        mapRef.current = map;

        // --- dev-vs-prod rendering fix -----------------------------------------
        // Leaflet caches the container size at init. In dev (slower hydration,
        // layout settling after fonts/data) the map can init against a stale
        // size, mis-placing tiles/markers — while the production build inits
        // after the final layout and looks fine. Re-measure right after init
        // and on EVERY container resize so both builds behave identically.
        // This is also where queued view operations (fit/focus issued while
        // the container was hidden — the mobile 0×0 case) are applied.
        requestAnimationFrame(() => {
          if (!mapRef.current) return;
          mapRef.current.invalidateSize();
          applyPendingViewRef.current?.(mapRef.current);
        });
        if (typeof ResizeObserver !== "undefined" && containerRef.current) {
          observer = new ResizeObserver(() => {
            requestAnimationFrame(() => {
              const m = mapRef.current;
              if (!m) return;
              m.invalidateSize();
              applyPendingViewRef.current?.(m);
            });
          });
          observer.observe(containerRef.current);
        }

        setFailed(false);
        setReady(true);
      } catch (err) {
        // Leaflet failed to load or initialise (module chunk error, container
        // problem, …). Show a visible error + retry instead of a blank box or
        // an eternal spinner — the mobile-blank-map lesson.
        if (!cancelled) {
          console.error("[safezone] map init failed:", err);
          setFailed(true);
        }
      }
    })();

    return () => {
      cancelled = true;
      observer?.disconnect();
      map?.remove();
      mapRef.current = null;
      markersRef.current.clear();
    };
  }, [attemptKey]);

  // applyPendingView lives in a ref so the init effect (which owns the map
  // lifecycle) can call the latest version without re-running on every render.
  const applyPendingViewRef = useRef(applyPendingView);
  applyPendingViewRef.current = applyPendingView;

  // Sync markers with the filtered venue list.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !mapRef.current) return;

      const wanted = new Set(venues.map((v) => v.id));

      // remove stale markers
      for (const [id, marker] of markersRef.current) {
        if (!wanted.has(id)) {
          marker.remove();
          markersRef.current.delete(id);
        }
      }

      // add missing markers
      const firstTime = markersRef.current.size === 0 && venues.length > 0;
      const bounds: [number, number][] = [];

      for (const venue of venues) {
        if (!markersRef.current.has(venue.id)) {
          const marker = L.marker([venue.lat, venue.lng], {
            icon: L.divIcon({
              className: "",
              html: `<div class="sz-marker tier-${venue.risk.tier}" role="button" aria-label="${venue.name} — ${venue.risk.tier}">${TIER_MARKER_SVG[venue.risk.tier]}</div>`,
              iconSize: [26, 26],
              iconAnchor: [13, 13],
            }),
            zIndexOffset: TIER_Z[venue.risk.tier],
            keyboard: true,
            title: `${venue.name} (${venue.risk.tier})`,
            alt: `${venue.name} marker`,
          });
          marker.on("click", () => onSelectRef.current(venue.id));
          marker.addTo(map);
          markersRef.current.set(venue.id, marker);
        }
        bounds.push([venue.lat, venue.lng]);
      }

      // update selection styling + z-order
      for (const [id, marker] of markersRef.current) {
        const el = marker.getElement()?.querySelector<HTMLElement>(".sz-marker");
        if (!el) continue;
        const venue = venues.find((v) => v.id === id);
        el.classList.toggle("is-selected", id === selectedId);
        marker.setZIndexOffset(
          id === selectedId ? 2000 : venue ? TIER_Z[venue.risk.tier] : 0,
        );
      }

      if (firstTime && bounds.length > 0 && !selectedId) {
        // Zero-size container (mobile: map mounts inside the hidden Map tab)
        // cannot run fitBounds — the zoom computation degenerates to NaN and
        // later view operations crash Leaflet. Queue it; the ResizeObserver
        // applies it after invalidateSize once the container has real size.
        if (hasRealSize(map)) {
          try {
            map.fitBounds(bounds, { padding: [32, 32], maxZoom: 13 });
          } catch (err) {
            console.warn("[safezone] fitBounds failed:", err);
          }
        } else {
          pendingViewRef.current = { kind: "fit", bounds };
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [venues, selectedId, ready]);

  // Fly to the selected venue.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !selectedId) return;
    const venue = venues.find((v) => v.id === selectedId);
    if (!venue || !Number.isFinite(venue.lat) || !Number.isFinite(venue.lng)) return;

    const currentZoom = map.getZoom();
    const targetZoom = Math.max(Number.isFinite(currentZoom) ? currentZoom : 12, 15);

    if (hasRealSize(map)) {
      // Visible (desktop, or mobile with the Map tab open): animate.
      // Wrapped so a Leaflet internal error can never take down the tree —
      // this exact call was the mobile venue-tap crash (flyTo's animation
      // frame unprojecting a NaN pixel on a zero-size map).
      try {
        map.flyTo([venue.lat, venue.lng], targetZoom, { duration: 0.7 });
      } catch (err) {
        console.warn("[safezone] flyTo failed:", err);
        try {
          map.setView([venue.lat, venue.lng], targetZoom, { animate: false });
        } catch {
          /* keep the map at its current view — never crash the app */
        }
      }
    } else {
      // Hidden container (mobile list tab): queue a jump; it is applied the
      // moment the Map tab opens (invalidateSize → applyPendingView).
      pendingViewRef.current = { kind: "focus", center: [venue.lat, venue.lng], zoom: targetZoom };
    }
  }, [selectedId, venues, ready]);

  /* Stacking-context containment: Leaflet's internal panes run at z-index
     400–1000. Without z-0 + isolate here those panes join the page's root
     stacking context and paint over the header/modals the moment the
     overflow clip is disturbed (stale bundle, HMR corruption). With
     position:relative + z-index:0 + isolation:isolate + overflow:hidden
     this wrapper forms a sealed stacking context: panes 400–1000 compete
     only INSIDE the map column and can never escape over the page UI. */
  return (
    <div className={cn("relative z-0 isolate overflow-hidden rounded-xl border border-edge shadow-card", className)}>
      <div ref={containerRef} className="h-full w-full" aria-label="Map of venue safety statuses" role="region" />

      {/* Loading shimmer while Leaflet boots */}
      {!ready && !failed && (
        <div className="sz-map-loading absolute inset-0 flex items-center justify-center">
          <span className="rounded-full border border-edge bg-surface/90 px-4 py-2 text-xs font-medium text-ink-muted shadow-card">
            {tr(lang, "map_loading")}
          </span>
        </div>
      )}

      {/* Visible failure — never a blank box (the mobile-blank-map lesson):
          if Leaflet cannot load or initialise, say so and offer a retry. */}
      {failed && (
        <div
          className="absolute inset-0 z-[1100] flex flex-col items-center justify-center gap-3 bg-canvas/95 p-6 text-center"
          role="alert"
        >
          <MapPinOff className="h-8 w-8 text-ink-muted" aria-hidden />
          <div>
            <p className="text-sm font-semibold text-ink">{tr(lang, "map_error")}</p>
            <p className="mt-1 text-xs text-ink-muted">{tr(lang, "map_error_hint")}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setFailed(false);
              setReady(false);
              setAttemptKey((k) => k + 1);
            }}
            className="h-11 rounded-xl border border-edge bg-surface px-5 text-sm font-medium text-navy shadow-card transition-colors hover:border-navy/40"
          >
            {tr(lang, "map_retry")}
          </button>
        </div>
      )}

      {/* Legend — calm interface, loud status */}
      <div
        className="absolute bottom-4 left-4 z-[1000] rounded-xl border border-edge bg-surface/95 p-3 shadow-card backdrop-blur"
        aria-label="Risk tier legend"
      >
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
          Risk tiers
        </div>
        <ul className="space-y-1.5">
          {(["URGENT", "HIGH", "NEEDS_VERIFICATION", "INSUFFICIENT_DATA"] as RiskTier[]).map((tier) => (
            <li key={tier} className="flex items-center gap-2 text-xs text-ink">
              <TierIcon tier={tier} className="h-3.5 w-3.5" />
              {/* Same canonical name as the list filters and cards —
                  TIER_DISPLAY in tokens.tsx is the single source of truth. */}
              {lang === "en" ? TIER_DISPLAY[tier] : tr(lang, TIER_LABEL_KEYS[tier])}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
