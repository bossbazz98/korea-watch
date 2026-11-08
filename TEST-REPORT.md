# Validation

This report is populated after final validation. Production Firebase/FCM/AI operations are not exercised by the offline tests.

Firestore emulator validation was attempted in the cloud, but downloading the official emulator JAR from storage.googleapis.com failed under the environment's network policy. Rules tests are included; run `cd worker && npm run test:rules` on the iMac with JDK 21 and Internet access before deployment. Rules compilation and the emulator assertions are not claimed as passed here.

The UI tests use mocked Firebase/AI and an actual Chromium browser. They cover the repository's web interface, not live service permissions.

## Final results — 2026-11-04 (Asia/Seoul)

- Source baseline: bossbazz98/korea-watch @ 101650078e1a8b55f7ff946b50c71d25753eac59, with the changes in this ZIP.
- Runtime tested: Linux, Node.js 24.19.0, npm 11.9.0, Chromium 154. Native macOS execution is not claimed.
- Clean release directory installation: `npm ci --offline --no-audit --no-fund --cache /workspace/.npm` passed using the populated package cache, with normal checksum checks. No dependency manifests/lockfiles were regenerated to bypass installation checks.
- `npm run build:web`: passed; Firebase SDK is bundled into the package.
- `AGENT_CHROMIUM=/usr/bin/chromium npm test`: passed all 12 existing self-test suites, including mobile/desktop rendering and authenticated-subscription UI interactions with fixtures.
- 10 added regression tests passed: bounded/private storage; atomic commit failure; repair-job acknowledgement; partial FCM retry/receipts; shared notification budget; article identity/numeric dedupe; parallel quota reservations; GitHub HTTP failure; quiet-hours retry; distinct-story emergency quota.
- Static server smoke test: all 14 URLs in the precache manifest returned HTTP 200 with bytes matching the packaged files.
- JavaScript syntax checks, shell syntax check, and `git diff --check` passed for the checked source.
- Emulator rules tests: NOT EXECUTED to completion (official emulator download blocked as described above).
- Production Firebase/FCM/AI calls, real push delivery, Apple hardware/browser behaviour, and deployment: NOT VALIDATED.

Do not treat fixture success as proof of production permissions or delivered notifications. Enable Anonymous Authentication, run the rules emulator tests, and use a test Firebase project before deploying to production.


## Node.js 25.9.0 compatibility — 2026-11-05 (Asia/Seoul)

- Updated the project engine declaration and Mac setup guard to accept Node 25.9+, while keeping Node 24.15+ support.
- Verified using the actual Node.js v25.9.0 binary on Linux. Native macOS execution and live Firebase calls are not claimed.
- Clean `npm ci --offline --no-audit --no-fund` installation passed with the populated package cache and normal integrity checks. npm emitted an EBADENGINE warning for superstatic@10.0.0, whose declared engines list Node 20/22/24. Dependency engine declarations were not altered or suppressed.
- Firebase CLI started successfully and reported version 15.34.2 under Node 25.9.0.
- `npm run build:web` and all 12 self-test suites plus 10 regression cases passed under Node 25.9.0, including Chromium UI tests.
- Added a Node 24 / 25.9.0 CI matrix. Remote CI outcomes are separate from these local test results.
- Firestore emulator tests and live deployment remain unverified here, as described above.

## Settings/reader UI validation — 2026-11-05 (Asia/Seoul)

- All 12 existing suites and 10 reliability regression cases passed on Node.js 25.9.0.
- Three audio tests passed, covering five distinct presets, live gain changes, mute, replacing a preview, stopping/disconnecting voices and cancellation while AudioContext resumes. Audio nodes are mocked in these unit tests.
- Real Chromium UI checks passed at 320×640, 390×844 and 1280×900: theme override/system mode, locale persistence, preserved notification drafts, tone/volume/mute persistence, preview and stop, no horizontal overflow, sticky settings actions, and close-button hit testing with the article image scrolled behind the toolbar.
- The existing fixture UI suite also saves an authenticated subscription with quiet hours using the redesigned controls.
- Light/dark and reader screenshots are included under docs/ui for review.
- Native iOS/Safari hardware, OS-level push audio and live Firebase delivery were not exercised. The selected tones apply only to foreground urgent alerts.

## Follow-up fixes — 2026-11-05 (Asia/Seoul)

- Existing suites were adapted to the shared Thai-field validation: fixtures representing successful translations no longer copy Korean headlines into Thai fields. Explicit invalid-language cases remain rejected.
- Regression cases exercise an 80-item Korean backlog alongside all 11 other categories, which publish across two worker rounds; another case repairs a Korean summary/body behind a Thai headline without sending a duplicate alert.
- Subscription unit tests cover preserving lastTestAt/pending requests, cooldown, disabling, and first real registration when local preferences incorrectly said enabled.
- Chromium fixture tests call the real browser showNotification API successfully on enable, verify a server-test request is written, then edit settings again without clearing the timestamp or pending request. This is not a claim of delivery to the user's physical device.
- UI checks cover one settings entry point, monochrome selection controls, seven sounds and server refresh on scrolling to the bottom with cooldown and manual retry.
- Updated Firestore Emulator tests cover save-after-test, preserving pending requests, replay/history-erasure denial, cross-user denial, cooldown expiry and disabling. New rules have not been compiled/executed here: the proxy explicitly denied the official emulator download (CONNECT 403). Run npm run test:rules on the iMac/CI before deployment.
- Live public status and Actions API diagnosis was attempted but those destinations were also denied by cloud networking. No production credentials, rules, data or notification state were modified.
- Native device push delivery, deployed rules and live category output remain to be confirmed after rules/Hosting deployment and merging/running the new worker on main.

## CI investigation after PR #4

- GitHub job pages confirm npm install, web build and browser installation succeeded; failure occurred in npm test, before rules tests. Other matrix jobs were canceled by fail-fast. Detailed failing assertion requires authenticated log access and is not inferred from exit code 1.
- Settings UI tests now select the installed full Chromium executable consistently with selftest8 and local runs, rather than implicitly switching to headless shell on CI. All existing UI assertions remain enabled. Local changed UI tests passed on Chromium 154.
- CI no longer cancels the sibling Node version on failure. It retains npm output, screenshots and emulator diagnostics, and includes the last 100 npm-test lines in the run summary. Pipeline exit status is preserved with pipefail.
- Remote CI success and the original assertion remain unconfirmed until the new run finishes / detailed log is available.

## Incident policy and publication follow-up — 2026-11-07 (Asia/Seoul)

Baseline: main 92fc161c2c21ac51ad3e0937718622942721d881. Diagnostic commit 17b94f9 is already an ancestor of main (PR #7).

User-supplied read-only production diagnostics at 2026-11-06T17:04:22.954Z show food=0 published/14 pending, foreign=1 published/16 pending, no disabled AI providers, Groq minute-quota errors, Gemini 503/timeouts and an incomplete model-unavailability message. This establishes provider pressure, not permanent inability of the foreign category to publish. The old worker spends title/racing requests on all Korean Peninsula coverage before normal categories; the new policy reserves those requests for the five incident classes. Category reassignment and empty structured responses are additional reproduced failure paths, not asserted as the sole historical production cause.

Validation on Linux, Node 24.22.1, JDK 21 and system Chromium 156:

- Full `AGENT_CHROMIUM=/usr/bin/chromium npm test` passed: 12 existing self-test scripts; 16 reliability/publication regressions; audio, subscriptions and scheduler suites; three browser viewport scenarios; 10 incident-policy and translation-recovery cases. Browser assertions compare settings heading/description font sizes to actual home elements and check layout/persistence.
- A reproduction with 40 ordinary Korean Peninsula stories, two-day-old food/foreign pending articles and a simulated per-minute 429 verifies that food/foreign lead the normal requests and persist as translated items in meta/feed even when the AI returns only korea. Ordinary Korean stories make no fast-lane/title requests.
- Policy cases cover all five event classes, North Korean missile/rocket variants, mine victim identity, drills/plans/denials/anniversaries, non-Korean/spoofed publishers, Google RSS provenance, nonincident high/all subscribers and invalid old retry jobs. Notification reliability tests still exercise receipts, partial retries, quiet hours and the shared per-device cap with qualified incident fixtures.
- AI tests cover empty JSON arrays/objects, incomplete Thai/body fields, missing batch entries, preservation of successful partial entries through fallback failure, explicit editorial rejection, retired-model fallback, complete error reporting, and minute-quota cooldown expiry.
- `npm run build:web` passed and includes news-policy.js in the 19-file offline shell. All 19 precache URLs returned HTTP 200 with bytes matching the final files; `git diff --check` passed. Generated SDK dependency bundles are unchanged.

Live Firebase reads from this cloud remain blocked by its outbound proxy (CONNECT 403 for firestore.googleapis.com); the production diagnosis above was supplied by the user. No production data, Firebase configuration, credentials, rules, push or deployment were changed. Firestore rules are unchanged; emulator validation remains blocked by storage.googleapis.com as documented earlier. Actual publication with live AI and physical-device push must be checked after the user merges/runs the worker and deploys Hosting. This branch is not merged automatically.

## Catalogue and touch refresh — 2026-11-09 (Asia/Seoul)

Baseline: main c96ea4f (PR #8 already merged). Branch: codex/categories-pull-refresh-2026-11-09. Runtime: Linux, Node 24.22.1 and system Chromium 156.

- Full `AGENT_CHROMIUM=/usr/bin/chromium npm test` and `npm run build:web` pass. Existing translation, atomic persistence, retry/notification, audio, subscription and scheduler tests remain included; fixtures formerly using removed categories were updated to the requested catalogue.
- Seven catalogue tests cover retained source-scope evidence after publication, exact order, country/topic boundaries (including Cambodia and unrelated background snippets), actual armed conflict vs readiness/metaphorical wars, viruses vs malware, new AI/crypto/energy/visa scopes, Korean publishers, legacy preferences and the three-publisher trending threshold.
- Seventeen reliability regressions include bounded fair translation with the new categories and repeat ingestion that upgrades an existing translated item to trending without another push. No live publication/AI capability is claimed by fixtures.
- Browser suites pass at 320×640, 390×844 and 1280×900. New navigation tests verify all thirteen tiles, selectable categories, all published stories in All, migrated notification choices, instant click/keyboard back-to-top, partial/full/cancelled pulls, horizontal/multi-touch/dialog/below-top guards, one request pair while busy, failure preservation and recovery. Genuine Chromium CDP touch input also triggers refresh; no physical iPhone/Safari validation is claimed. Partial/full logo screenshots are retained in ignored worker/agent-out.
- The updated offline shell includes category-policy.js and pull-refresh.js. Static HTTP checks verify all 21 precache assets match final filesystem contents. `git diff --check` passes.
- Firestore rules tests were attempted against demo-korea-watch; the CLI cannot download the official emulator JAR from storage.googleapis.com under cloud networking. The updated rules assertions are present, but rules compilation/assertions are NOT claimed as passed locally; require the CI rules job to pass before merging/deploying. No production Firebase data, rules, project settings, authentication, secrets or deployment were modified.

Release order after user review/merge: obtain the new main checkout, install/build/test, deploy firestore:rules first (new category keys), deploy hosting, then run Actions → Fetch news on main. Updating Hosting alone does not update the Actions worker. No automatic merge or production deployment is performed by this task.
