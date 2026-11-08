# Changes in this delivery

- Shared category labels across web/worker; Korean Peninsula category and migration of old local preferences.
- Public feed and private translation backlog; bounded payload on all saves.
- Atomic Admin SDK batch for feed, backlog, seen, quota, and notification events; publication failures propagate.
- Durable notification chunks, partial-recipient retries, expiry cleanup, delivery receipts, one recipient cache and shared per-run budget.
- Versioned authenticated subscriptions, quiet hours, all-news level, per-owner delivery log, strict Firestore validation and test-request cooldown.
- Agent repair jobs acknowledged only after successful publication, using update preconditions on real Firestore snapshots.
- Full-headline/link/day article IDs; numeric guard against merging different values.
- Local Firebase SDK bundles and versioned precache; reader/card images, focus containment, and same-origin notification navigation.
- Bounded HTTP bodies and shared article deadline; AI reservations, malformed-JSON fallback, bounded output, and cancellation accounting.
- Checked GitHub HTTP responses and explicit UI/vision check states.
- Mac setup, env-file preload with external service-account path, static server, CI and security-rule tests.

Not a promise of complete semantic deduplication, exactly-once FCM delivery, production readiness without credential tests, or guaranteed emergency-alert latency. See README-iMac.md.

## Settings and reader refresh

- Four grouped settings cards with pinned header/footer and independently scrolling content.
- Language controls moved from the main header into settings; unsaved notification drafts survive language changes.
- Persistent system/light/dark preference, initial-load theme application, and matching browser theme color.
- Five locally synthesized foreground sounds, live volume slider, preview/stop controls, mute, and cleanup on close/background. No external audio downloads.
- Reader toolbar is outside the image scroll area, keeping the close button visible and clickable.
- New assets included in offline precache; CSS MIME support in the local/test servers and refreshed hosting cache headers.
- Chromium coverage at 320, 390 and 1280 pixels; audio lifecycle/volume/cancellation tests.

## Monochrome settings, subscription repair, category fairness and refresh

- Use the main app's neutral ink/surface palette in settings and remove the duplicate bell/settings entry point.
- Replace full-document subscription overwrites with owned-document transactions preserving lastTestAt and pending tests. Rules distinguish a normal edit from a new test request and keep the cooldown/ownership restrictions.
- Queue a server test on first enable and call the browser notification API after successful saving; remove the unverified enabled-status banner.
- Add a long air-raid wail and fast emergency siren (7 presets total).
- Rotate translation work across categories; bound Korean fast-lane work and protect published topics from an untranslated Korean backlog. Add targeted international searches.
- Validate Thai summary/body as well as headlines and repair legacy incomplete records without duplicate alerts.
- Refresh the homepage when scrolling to the bottom, with a 30-second automatic cooldown, manual retry and offline feedback; preserve settings and filters.
- Add read-only translation diagnostics, publication counts per category and the worker commit/branch.

## Incident alerts and category publication — 2026-11-07

- Critical level, emergency translation quota and news push are limited to confirmed North Korean attacks on South Korea, North Korean missile/rocket launches or tests, attacks on South Korea, missiles falling near South Korea, and South Korean soldiers stepping on antipersonnel mines. A shared policy checks original Korean headlines and approved South Korean publisher domains; threats, drills and historical/uncertain reports do not qualify. Google News publisher provenance is retained. New RSS articles from other publishers are excluded.
- Recheck persisted levels, notification outbox and delivery retries. Unverifiable legacy queued news is discarded; explicit device tests remain available. Existing high/all subscriptions cannot bypass the news policy. Settings offer urgent-only news delivery.
- General Korean Peninsula coverage uses the balanced normal translation queue instead of spending title/race requests first. Feed v9 clears old failed-attempt cooldowns once. Already translated food/foreign-worker stories with explicit source-text evidence regain those topics without repeating notifications.
- Retry structured empty/missing AI entries using another model, preserve good partial results, require nonempty Thai body text, and preserve food/foreign-worker labels supported by original headline/snippet. Explicit irrelevant results remain rejected.
- Remember unavailable models within a worker run and expose per-model errors separately from the truncated lastError summary. No new credentials, model IDs or Firebase configuration are introduced.
- Remove the settings brand eyebrow; match home section titles (20px), card headings (19px) and description text (16px). Include the shared policy in the offline shell.

## Catalogue and pull-to-refresh — 2026-11-09

- Replace the catalogue with the requested twelve topics in order, plus All: Korean Peninsula, world conflicts, infectious diseases/viruses, AI/technology, cryptocurrency, foreign workers in Korea, Korean minimum wage, Korean won, oil/energy, Thais/Thailand, Korean president/government and trending news. Remove food, generic Korea and separate labour-law tiles. Historical published records remain accessible in All.
- Add dedicated technology, cryptocurrency, foreign-worker and minimum-wage searches; broaden health, Thailand and energy coverage. Use shared original-source category guards on collection, AI publication and browser display. A search hint cannot place Cambodia's military readiness in Korean conflict; foreign wages/governments and unrelated currencies are excluded from Korea-specific topics. Critical/push incident rules remain unchanged.
- Trending is defined as at least three independent verified Korean publisher domains covering the same story. Retain provenance through duplicate merging and repeat ingestion, including already translated stories. A Google top-feed hint or an AI popularity claim alone is insufficient. Similarity grouping remains heuristic.
- Migrate local preferences (labour law → foreign workers; generic Korea → trending; retired food removed). Extend subscription rules for tech/crypto/hot while temporarily accepting the three legacy keys for older installed clients. Deploy the updated rules before Hosting. No Firebase project/authentication/credentials reset is needed.
- Make the brand a keyboard-accessible back-to-top button. Add top-only one-finger pull-to-refresh: the actual KW app mark fills bottom-to-top, triggers at 144px without waiting for release, and remains filled while loading. Guard horizontal swipes, scrolling below the top, open dialogs, multi-touch, cancellation and duplicate requests. Existing news survives a failed refresh; server news/status are reread without reloading the app or triggering a production worker.

## Feed display recovery and held brand refresh — 2026-11-09

- Fix the reported `Array.map → publisherKeys → classify` failure when the browser combines a new category policy with an older news policy lacking publisherKey. Load shared feed dependencies as ordered modules, version the affected imports to bypass already cached URLs, and add missing no-cache Hosting headers. Precache the exact versioned module URLs for offline startup.
- Normalize each published record independently, including legacy/null links, categories and Firestore timestamp shapes. One malformed record cannot discard the entire feed. Re-read from the server once per status update if status reports published news but the client has an empty feed; retain existing stories on read failure and show the refresh error above the feed.
- Pull the visible upper-left KW icon and KOREA WATCH wordmark into the screen centre, increasing size with drag distance and filling the text from the bottom. A full fill latches until release; release starts refresh and keeps the full mark visible until the read finishes. Cancelled gestures do not refresh. Preserve top-only, horizontal, multi-touch, dialog and busy guards.
- Remove the bottom Update news control, its CSS and automatic bottom-scroll refresh. The pull gesture is the refresh control; brand click/keyboard still returns to the top.
- Firebase data, rules, credentials, AI providers and worker processing are unchanged. This release needs Hosting deployment after review/merge.

## Mobile refresh capsule — 2026-11-09

- Replace only the pull-to-refresh presentation: a 36px dark capsule (#24292F, border #384049, white text and coral #FF6964 ring) opens centred in document flow below the sticky header. The existing header, logo, controls, cards and catalogue retain their resting layout.
- A predominantly vertical, one-finger pull beginning at the top moves the feed with resistance. The ring fills to a default 64 CSS px gesture threshold, changing ดึงเพื่อรีเฟรช → ปล่อยเพื่อรีเฟรช. Releasing early or cancelling restores the feed without loading; dragging back below the threshold disarms it.
- Release starts the existing news reader immediately, once per gesture. Keep current stories and show กำลังอัปเดตข่าว… while awaiting the feed. Status metadata is read independently and cannot delay applying the feed or finishing the spinner.
- Compare reader-visible content to show อัปเดตข่าวแล้ว or ยังไม่มีข่าวใหม่ accurately; metadata/object-key-order changes alone do not count as new content. Show the check/result or temporary failure message for one second, then collapse over 220ms. Reduced motion removes collapse/spinner animation. Horizontal rails, busy guards and retry after error remain covered.
- No category/filter/worker/Firestore-rule changes. The versioned refresh import and offline shell are rebuilt for Hosting deployment.
