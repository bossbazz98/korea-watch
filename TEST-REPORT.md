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
