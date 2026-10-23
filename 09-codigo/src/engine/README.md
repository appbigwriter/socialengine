# Domain engine

`registerEngineRoutes(app, deps)` registers generation, raster/video exports, trend sources and editorial decisions, publication authorization and durable queue management. `runWorkerOnce(deps)` claims one due job atomically. A server process must poll it; scheduling is persisted in PostgreSQL, not memory.

## Trend sources

- RSS/Atom: up to 40 valid items per collection; retains feed text, not an implied reading of linked full articles.
- HTML: one configured public page, main/article paragraph extraction. Does not crawl arbitrary links or execute JavaScript. Listing discovery, social API trend signals, semantic topic clustering and browser rendering are not implemented.
- Sources require acknowledgement of access/reuse terms. Robots rules apply before every target request, including redirects; access denial is visible. DNS is validated and pinned to the actual socket. Network limits: four redirects, 2 MB and 12 seconds per response, bounded robots fetches, only public HTTP(S) standard ports.
- Dedup uses canonical URL and normalized content/title hash. Multiple feeds carrying identical text do not increase confidence as independent reporting.
- Every collection stores extraction state, origin, historical observations and a versioned editorial ranking. Polling presence has no invented count. Growth requires quantitative values with matching unit, window, source, complete coverage and positive baseline. Current RSS/HTML connectors do not provide that quantitative signal; their output is explicitly recent opportunities.
- Keyword/exclusion matching is deterministic and accent-insensitive. Region/language are source configuration metadata, not a language/region classifier. Ranking calibration, varied real niche pilot, retention policy and extended independent evidence clustering remain pilot work.
- Failed collections retry exponentially up to four claims, then remain failed with a visible source error. Successful work schedules the next collection. Paused sources cause queued work to exit without fetching.

## AI

OpenAI Responses API with strict JSON schema and `store:false`; local Zod validation also validates returned content. Tenant key must be available through the vault and model must be explicitly configured. No shared-key fallback, mock success or external spending in automated tests. Tenant quotas reserve a persisted request under a PostgreSQL advisory transaction lock; failed/uncertain attempts count against the request limit. Token usage is the provider-returned value and cost remains unknown.

Settings key: `${tenantId}:ai`, value `{provider:'openai', model, monthlyRequests}`. Platform ceiling: `AI_MONTHLY_REQUEST_LIMIT` (default 100 requests/month, server-enforced). `OPENAI_MODEL` can provide an explicitly configured server model. Anthropic keys may be stored by the platform but this engine does not implement the Anthropic adapter yet.

Official reference verified during implementation: [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs).

## Media

PNG uses Sharp to rasterize editable slide fields; XML text is escaped and oversized copy fails validation instead of clipping silently. Rasterized user images are supported in the image slide layout. Video is optional FFmpeg H.264 rendering of 1–12 text scenes; available only when FFmpeg is installed. Audio and image scenes require an extended renderer and currently fail explicitly. Rendering creates a new draft revision that needs review. PDF extraction uses `pdf-parse` with explicit parser destruction; encrypted/image-only PDFs need user-provided text.

## Verification

`npx tsx --test tests/engine*.test.ts` runs isolated tests without paid APIs. Live sources require explicit opt-in `RUN_LIVE_TRENDS=true` for `tests/engine-live.test.ts`. Verified read-only on 2026-10-22 in temporary local PostgreSQL with RLS and two independent tenant scopes: BBC technology RSS produced 15 deduplicated records and example.com HTML produced one record. Both stored matching extraction/history/topic records and a future recurring job. This demonstrates actual connectors and scheduling; it is not evidence of a deployed production pilot or longitudinal trend growth.

Queue tests verify idempotency, concurrent claims, revoked membership, expired publication uncertainty and persisted quota reservations. Publication integrations, OAuth callbacks and external result confirmation are maintained in `src/social`.
