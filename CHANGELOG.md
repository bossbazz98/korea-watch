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
