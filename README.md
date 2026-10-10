![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white)
![Next JS](https://img.shields.io/badge/Next-black?style=for-the-badge&logo=next.js&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/tailwindcss-%2338B2AC.svg?style=for-the-badge&logo=tailwind-css&logoColor=white)

# Platform-Console

The internal admin / operations console for the Wahb platform. Operators manage content sources, moderate ingested content, tune the ranking engine, run news-discovery, review media atomization, edit transcripts (Media Studio), and watch system health — all by proxying to CMS, Aggregation, Enrichment, Media, and IAM.

It is a thin **backend-for-frontend (BFF)**: it holds **no business logic and no direct DB or queue access**. Its own `/api/*` routes attach the operator's token server-side and forward to the right backend, so the browser never holds the token and never calls the backends directly.

**Port:** 3005 · **Production:** https://wahb-console.salehspace.dev · **Stack:** Next.js 15 (App Router), React 19, TypeScript, shadcn/ui, TanStack Query, Zustand, Recharts

> Full feature + architecture reference: [`../docs/platform-console.md`](../docs/platform-console.md). System overview: [`../docs/index.md`](../docs/index.md).

## Quick Start

```bash
npm install
cp .env.example .env        # set the backend base URLs
npm run dev                 # http://localhost:3005
```

## Navigation

| Section | Route | Description |
|---------|-------|-------------|
| Dashboard | `/` | Operations overview |
| Sources | `/platform/sources` | RSS / YouTube / X / Telegram source CRUD + run |
| News / Finding | `/platform/news`, `/platform/news/finding` | News discovery + auto source-finding & tuning |
| Content | `/platform/content` | Browse / moderate ingested content items |
| **Intelligence** | `/platform/intelligence` | Ranking engine, flags, analytics, preview (see below) |
| Enrichment | `/platform/enrichment` | Embedding / enrichment batches |
| Media | `/platform/media` | Media items + transcription pipeline |
| Media Studio | `/platform/media/atomization` | Unified media atomization + transcript/chapter workbench: publication paths, workflow rail, review queue, policy controls, per-item Studio editor, source/run diagnostics |
| Pipeline | `/platform/pipeline` | Ingestion / processing state |
| Quality | `/platform/quality` | Content quality profiles |
| Storage | `/platform/storage` | Object-storage circulation / tiering |
| Retention | `/platform/retention` | Database capacity, configurable thresholds and reviewed News cleanup |
| System Health | `/platform/system-health` | Live backend health, migrations, AI metrics |
| Users | `/admin`, `/admin/users` | Admin account / role / permission management (IAM) |

Retention shows the selected cleanup's stage: Observe → Prepare → Review/approve →
Enable/execute → Verify. Use **Execution settings** to enable reviewed cleanup and
**Policy in force** to edit thresholds and limits. Saving settings never executes
a cleanup. See the [Retention guide](../plans/implemented-systems/retention-and-fresh-start-systems.md/retention-autopilot.md).

## Architecture (BFF)

The browser only ever talks to the Console's own origin. Catch-all proxy routes forward to the backends with the access token attached server-side:

| Console route | Forwards to |
|---------------|-------------|
| `/api/cms/[...path]` | `CMS_BASE_URL` |
| `/api/iam/[...path]` | `IAM_BASE_URL` |
| `/api/aggregation/[...path]` | `AGGREGATION_BASE_URL` |
| `/api/ai-metrics` | scrapes Enrichment + Media `/metrics` (Prometheus) |
| `/api/system-health` (+ `/migrations`, `/restart`) | aggregated backend health + ops |
| `/api/auth/*` | IAM (login / refresh / me / logout) |

By design there is **no direct DB or queue access** — tuning knobs live behind CMS config tables surfaced as admin pages, and jobs are triggered through CMS/Aggregation APIs.

## Media Studio

Media Studio is the command center for long-media chaptering. It consumes CMS `/admin/media-atomization/*` and `/admin/content/:id/studio` APIs only; Console must not infer state from queues or write atomization records directly.

- Shows editable tenant policy, source overrides, episode controls, and policy invariants: atomize only >40m, feed floor 4:30, hard max 40m, short chapters merge.
- Operators can exclude whole media sources, exclude/enable one parent episode, and queue or re-queue eligible >40m parents through CMS.
- Pipeline rail columns: Ready, Transcript, Planning, Cutting, Embedding, Review, Published, Disabled, Failed.
- Review queue exposes confidence, duration bucket, review reason, playback preview, in-page Studio selection, and approve/reject actions.
- The Studio tab embeds per-item playback, transcript editing, transcript approval, chapter generation/editing, comparison, and STT actions. Legacy `/platform/media-studio` URLs redirect into `/platform/media/atomization?tab=studio`.
- Stale/offline states should identify the failed API and disable mutating actions when live data is unavailable.

## Authentication

Auth is delegated to **IAM**. `POST /api/auth/login` proxies to IAM, which returns an HS256 JWT; the access + refresh tokens are stored in httpOnly cookies (`console_access_token`, `console_refresh_token`). `middleware.ts` redirects any unauthenticated request (except `/login`) to the login page. Every BFF proxy reads the access cookie and attaches `Authorization: Bearer` server-side. `GET /api/auth/me` resolves the operator via IAM `/api/v1/roles/me`.

## Configuration

All backend URLs are server-side (the BFF reads them; they're never exposed to the browser). `scripts/log-service-connections.js` prints the resolved targets on `dev`/`build`/`start`.

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `CMS_BASE_URL` | yes | http://localhost:8080 | CMS backend (`/admin/*`, intelligence, storage, quality) |
| `IAM_BASE_URL` | yes | http://localhost:4003 | IAM (auth, admin users) |
| `AGGREGATION_BASE_URL` | yes | http://localhost:5002 | Source discovery / preview / run |
| `ENRICHMENT_BASE_URL` | for AI metrics | http://localhost:5050 | Enrichment `/metrics` scrape |
| `MEDIA_BASE_URL` | for AI metrics | http://localhost:5051 | Media `/metrics` scrape |
| `ENRICHMENT_RESTART_TOKEN` | for Enrichment restart | — | Dedicated control-plane capability; never reuse the normal service token |
| `PLATFORM_BASE_URL` | no | http://localhost:3000 | Wahb-Platform origin (cross-links) |
| `NEXT_PUBLIC_GRAFANA_URL` | no | — | Optional Grafana embed on system-health |

## Dev Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start dev server on :3005 |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run type-check` | `tsc --noEmit` |

Jest (`jest.config.js`) and Playwright (`playwright.config.ts`, `e2e/`) configs are present for unit and end-to-end tests.

---

## Intelligence Tab

Full control over how content is ranked and distributed across feeds — the UI for the per-tenant ranking engine. Feeds stay chronological until ranking is activated.

### Dashboard — `/platform/intelligence`
Algorithm status (Active/Inactive), embedding coverage, flagged-item count, currently-trending count, a **Signal Health** and a **Score Distribution** histogram across READY content.

### Ranking Config — `/platform/intelligence/ranking`

| Section | Controls |
|---------|----------|
| Algorithm Flow | Visual diagram: Signals → Weighted Sum → Flags → Diversity → Final Feed |
| Weight Radar / Sliders | Per-signal weights that **auto-normalize** to 1.0 as you drag |
| Decay Settings | Freshness decay hours, velocity window hours, trending threshold multiplier |
| Recirculation | Toggle + max age (days) for re-surfacing older content |
| Activate / Deactivate | Master switch — feeds are chronological when inactive |

> Weights are validated server-side (must sum to 1.0 ± 0.01); the sliders auto-normalize on the client.

### Content Flags — `/platform/intelligence/flags`
Per-item editorial overrides (`content_flags` table): **Boost** (×multiplier), **Suppress** (bury), **Pin to Top**, **Exclude from Feed** — searchable, with a distribution pie chart, notes, and `set_by` attribution.

### Analytics — `/platform/intelligence/analytics`
Source performance (avg likes/views/shares), velocity leaderboard (top items by interaction rate), trending items (recent vs. average rate), topic clusters (bubble scatter), an embedding-coverage panel, and a **Similar Content** lookup (pgvector cosine neighbors by content ID).

### Feed Preview — `/platform/intelligence/preview`
Test ranking without touching production: toggle Pods / News, override signal weights inline (temporary), see the ranked list with per-item score breakdown + a **Score Waterfall**, position-change arrows vs. chronological, and an **Apply to Production** button that saves overrides to the active `RankingConfig`.

## Data Flow

```
Platform Console (browser)
      │  (own /api/* BFF — token attached server-side)
      ▼
CMS Admin API (/admin/*, /admin/intelligence/*)   IAM (/api/v1/auth, roles)   Aggregation (/admin/*)
      ├── RankingConfig (per-tenant, PostgreSQL)
      ├── ContentFlags (per-item table)
      └── Analytics (pgvector, user_interactions)
```
