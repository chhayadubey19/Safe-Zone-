# SafeZone — Bhopal Community Safety Registry

A public-safety registry for Bhopal: citizens check how safe a public place is
before they enter, report issues with a photo + description (AI-assisted), and
government officers triage, act and close the loop — every step visible.

Next.js (App Router) · TypeScript strict · Tailwind CSS · Leaflet map ·
Supabase (Postgres + Storage) · Gemini Flash (AI classify + photo vision + cert OCR)

## Features

- **Registry home** — 120 venues across 18 Bhopal wards, risk-tier map markers
  (lucide tier icons on URGENT / HIGH / NEEDS VERIFICATION / INSUFFICIENT DATA
  colours), search + tier and type filters, venue passport with an explainable
  risk breakdown.
- **Citizen report flow (`/report`)** — camera photo (or camera-app fallback),
  automatic geolocation, Hindi/English/mixed description, Gemini AI analysis
  (text classify + photo checklist vision) with every verdict correctable by
  the citizen before filing, duplicate-incident matching, receipt page.
- **Government dashboard (`/gov`)** — department-routed incident queue
  (Fire / Health / Municipal), case files with evidence photos, inspector
  audit flow (checklist → certificate verification → after-action photo),
  resolution + closure, notifications.
- **My reports (`/my-reports`)** — report cards with lifecycle status,
  delete-while-pending, live impact on the venue score.
- **Phase 5** — certificates/NOC tracking with Gemini OCR extraction, monsoon
  waterlogging seasonal indicator.
- **First-visit welcome** — a fullscreen takeover (once per browser,
  `localStorage`-flagged): "Know the place before you go." + a purely coded
  SVG city-map illustration — no image assets, no animation libraries.
- **About / How it works (`/about`)** — editorial product page: the 5-step
  workflow (Discover → Inspect → Analyze → Understand → Decide), the four
  roles (citizens / inspectors / officers / the AI system), and AI +
  risk-score explainer dialogs.
- **Design system** — three semantic colour ladders (trust tiers, risk
  tiers, feature categories) powering reusable `SemanticIcon` /
  `VenueTypeTile` / `InfoDialog` components; desktop modal / mobile
  bottom-sheet popups; every motion cue respects `prefers-reduced-motion`.
- Bilingual UI (English / हिंदी), mobile-first (375 px).

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | yes (live mode) | Supabase project URL (client + server reads) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes (live mode) | Supabase anon key — public reads through RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | yes (live writes) | Secret server key — all writes + photo uploads (no login screen, writes bypass RLS via admin client) |
| `GEMINI_API_KEY` | yes (AI) | Gemini API key — classify / photo analysis / certificate OCR |
| `GEMINI_MODEL` | optional | Defaults to `gemini-3.6-flash` |
| `AI_PROVIDER` | optional | `gemini` (default) or `zai` (z.ai-hosted environments) |

There is **no map key**: tiles are the keyless ESRI ArcGIS Online Light
Gray Canvas service — nothing to configure, no watermark possible.

Without the Supabase variables the app runs in **demo mode** (seeded snapshot,
in-memory writes) — every flow still works, data is temporary. Without
`GEMINI_API_KEY` the AI steps degrade to manual checklist selection. A revoked
service key also degrades writes to the in-memory overlay (the server log
records the reason); rotate it in the Supabase dashboard to restore persistence.

The real values live in **`.env`** (committed and shipped in the deploy zip —
the owner's choice; keep the zip/repo private). `next dev` loads it
automatically. `AI_PROVIDER` selects the AI backend explicitly — `gemini`
(the default, for Vercel/standard hosts) or `zai` (only for hosts that
provide the z.ai SDK, e.g. the z.ai sandbox where Gemini is region-blocked).
There is no silent switching. Restart the dev server / rebuild after
changing any variable (Next inlines `NEXT_PUBLIC_*` at build time).

## Quick start

```bash
bun install            # or npm install
bun run dev            # http://localhost:3000
bun test src/          # unit tests
bun run build          # production build
```

Optional — seed the live Supabase project:

```bash
# after setting the env vars and running the migrations
bun run seed
```

## Database

Apply the SQL migrations in `supabase/` in this order (once, e.g. via the
Supabase SQL editor):

1. `migration.sql` — tables, indexes, RLS
2. `migration_departments.sql` — department routing
3. `migration_venue_types.sql` — canonical venue-type constraint
4. `migration_phase3.sql` — inspection/resolution loop + notifications
5. `migration_phase4.sql` — dedup, location honesty, reporter feedback
6. `migration_phase5.sql` — certificates/NOC
7. `migration_storage.sql` — `report-photos` storage bucket

## Deployment

See **VERCEL-DEPLOY.md** for the exact Vercel steps, the env checklist and the
post-deploy verification list. `scripts/make-deploy-zip.mjs` builds
`deploy/safezone-vercel.zip` — the complete deploy package (source, config,
migrations, docs, `.env`). **It contains real key values — keep it private.**

## Project layout

```
src/app/                 routes: /, /about, /report, /my-reports, /gov, /venue/[id], /api/*
src/components/safezone/ app UI — design system (design.tsx), fullscreen
                         welcome, InfoDialog popups, map, venue cards,
                         report flow, gov panels
src/lib/                 domain logic: checklist, scoring, risk, data layer,
                         about content, Gemini/z.ai AI providers
supabase/                SQL migrations (RLS included)
scripts/                 seed + icon + verification + deploy-zip utilities
```
