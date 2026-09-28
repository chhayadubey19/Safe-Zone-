# Deploying SafeZone to Vercel

## 1. What's in this zip

Complete source (`src/`, `public/`, `supabase/`), configs (`package.json`,
`package-lock.json`, `next.config.ts`, `tsconfig.json`, `tailwind.config.ts`,
`postcss.config.mjs`, `eslint.config.mjs`, `components.json`), docs
(`README.md`, `.env.example`). The zip also ships **`.env` with the real
values** — the owner's explicit choice. **Keep the zip private.** Note: Vercel
ignores `.env` files in the repo for security — you still set the same names
in the dashboard (below), which is why the names-only `.env.example` stays
useful as reference.

## 2. Environment variables (Vercel → Project → Settings → Environment Variables)

Set these for Production **and** Preview:

| Variable | Value source | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase dashboard → Settings → API → Project URL | |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase dashboard → Settings → API → anon/public key | |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase dashboard → Settings → API → service_role key | **Rotate first if it was ever exposed/revoked** — a 401 "Unregistered API key" silently degrades writes to memory |
| `GEMINI_API_KEY` | https://aistudio.google.com/apikey | Server-only |
| `GEMINI_MODEL` | *(optional)* | Defaults to `gemini-3.6-flash` (current model, verified 2026-09); set only if Google renames the model |
| `AI_PROVIDER` | *(optional)* | **Leave unset on Vercel** (default `gemini`). `zai` is only for platforms that provide the z.ai SDK credentials — selected explicitly, never auto-fallback |
| `GLM_VISION_MODEL` | *(optional)* | Only used when `AI_PROVIDER=zai`; defaults to `glm-5v-turbo` |

**Do NOT add `NEXT_PUBLIC_CARTO_KEY`** — it is retired and read nowhere. The
map uses keyless ESRI ArcGIS Online Light Gray Canvas tiles (no key, no
watermark). The old Carto/CartoDB basemap was removed because Carto now
returns watermarked "API KEY REQUIRED" placeholder tiles for unkeyed
requests.

⚠️ Changing a `NEXT_PUBLIC_*` variable requires a **redeploy** (values are
inlined at build time).

## 3. Pre-flight: database

Run the 7 SQL migrations from `supabase/` in order (see README.md) against your
Supabase project if not already applied. Then optionally seed:

```bash
bun install
bun run seed        # needs SUPABASE_SERVICE_ROLE_KEY in your local env
```

## 4. Deploy

1. Vercel → Add New Project → import the repo (or upload this zip's contents).
2. Framework preset: **Next.js** (auto-detected; no `vercel.json` needed —
   default build command `next build`, output handled by Next).
3. Add the environment variables from step 2.
4. Deploy. First build installs from `package-lock.json` via npm.

## 5. Post-deploy verification checklist

| # | Check | Expected |
|---|---|---|
| 1 | `/` loads | 120 venues, tier chips, no error banner |
| 2 | Map tiles | Basemap renders (keyless ESRI Light Gray Canvas), **no watermark**, markers are tier-coloured icon badges (siren / warning-triangle / clipboard-check / dashed-circle) |
| 3 | Map geography | Upper Lake / Lower Lake / Bairagarh areas visible on the basemap at default zoom |
| 4 | Mobile venue tap | On a phone: tap a venue card → detail sheet opens, **no "Application error" crash**; tap a map marker → same |
| 5 | `/report` flow | Camera (or camera-app fallback) + description works; big photos (10 MB+) are auto-compressed before upload (outgoing request ≈ 1.3 MB) |
| 6 | AI analysis | Text → category/issue suggestions; photo → checklist verdicts (needs valid `GEMINI_API_KEY`; on failure it degrades to manual selection with a toast — a structured 502/503 JSON, never a crash) |
| 7 | File report | Submit → receipt page → appears in `/my-reports` |
| 8 | Persistence | After the report, the row exists in Supabase → `reports` table (dashboard → Table Editor); if it only appears in the running server's memory, `SUPABASE_SERVICE_ROLE_KEY` is invalid/revoked — check the deploy logs for `live report write failed` |
| 9 | Photo evidence | Evidence photo visible on the receipt and in the officer case file (Supabase → Storage → `report-photos`) |
| 10 | `/gov` queue | Department-routed incidents; case file opens; verify → action → resolve works |
| 11 | First visit | Welcome overlay appears once; "Get started" dismisses it; reload → it stays gone |

## 6. Sandbox vs Vercel notes

- **AI provider selection is explicit** (`AI_PROVIDER`, default `gemini`). A
  failing provider surfaces a structured error and the UI degrades to manual
  checklist selection — providers are NEVER silently swapped mid-request.
  **Deploying via the z.ai platform instead of Vercel?** Set
  `AI_PROVIDER=zai` in that platform's environment settings — the SDK only
  has its credentials there. Local dev and Vercel keep the default
  (`gemini`) and need nothing.
- Gemini calls from some regions are blocked by Google geo-policy
  (HTTP 400 `FAILED_PRECONDITION "User location is not supported"`). The API
  key itself is valid; deploying to a supported region (default Vercel US
  regions work) resolves it.
- **Request bodies are capped for serverless**: every photo is compressed
  client-side (EXIF-oriented, ≤1600 px, JPEG quality ladder, ~1.8 MB data-URL
  budget — the shared `src/lib/image-prepare.ts` pipeline) and every photo
  route re-validates size server-side with a clean 413. A modern phone's
  10–15 MB camera photo becomes ≈1.3 MB on the wire.
- **Error boundaries** wrap every route (`error.tsx` at app, venue, report,
  gov and my-reports levels + `global-error.tsx`): a component crash shows
  a branded recovery panel with retry — never the raw Next.js
  "Application error" page.
- The demo fallback exists by design: no/invalid config never breaks the UX,
  it just makes writes temporary. Watch the deploy logs to know which mode
  you are in.

## 7. Updating an existing deployment

Replace the sources, keep the env vars, redeploy. Regenerate the zip any time:

```bash
node scripts/make-deploy-zip.mjs
```
