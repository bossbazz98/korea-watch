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
