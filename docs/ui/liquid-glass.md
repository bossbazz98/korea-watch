# Liquid Glass app update — 2026-11-09

This change applies the reviewed four-screen design to the real Firebase web app. It uses the existing feed and subscription services. It does not add sample news, recreate Firebase, change Firestore rules, or broaden the five-incident push policy.

- Home: floating glass tab bar, selected featured topics in selection order, photo/category/headline-only feature cards, and a 350 ms logo scroll-to-top.
- Refresh: red ring around a point, 80 CSS px of resisted feed movement, release-to-load, one feed read per round plus a non-blocking status read, immediate rendering when the feed returns, no “no new news” message. Offline/error paths keep current stories. Reduced Motion stops spinning and uses fades.
- Reader: full-bleed media, fixed icon controls, sticky one-line headline and reading progress, persistent bookmarks, real link sharing, and a previewable 600×900 summary image.
- Saved news: device-local snapshots remain readable after leaving the live feed, with swipe-left or keyboard-accessible deletion. Up to 150 stories per browser profile; storage errors preserve the existing list and show an error.
- Settings: a full tab with fixed save/test actions, TH/EN/Korean menus, light/dark/system themes, live text-size adjustment, independently selected featured topics, sound and vibration controls, region preference, notification categories and KST quiet hours.

## Existing notification policy

The user explicitly chose to retain push for the five verified incidents affecting South Korea. The other two level cards are displayed disabled. In-app alerts also respect enablement, selected categories, quiet hours, and the independent sound/vibration controls.

Region selection is stored locally. It is not a Cell Broadcast connection and does not claim to prioritize regional alerts without a data source. Korean menus show original Korean headlines where present; the supplied translated summaries remain Thai, with a source link and an explanatory label. Subscription language remains within the existing Thai/English schema. These choices require no rules migration.

Custom in-app sound and vibration depend on browser support. Background notification sound continues to follow the operating system. KakaoTalk uses the device share sheet, or copies a link when Web Share is unavailable. Summary images use the news photo when its server permits CORS, otherwise a branded placeholder, avoiding tainted-canvas export failures.

## Deploy the actual app

Use the new project folder, not the previous design-prototype folder. The downloadable source archive is named `korea-watch-liquid-glass-app-2026-11-09.zip`.

On the Mac already signed into Firebase:

```sh
cd ~/Downloads/korea-watch-liquid-glass-app-2026-11-09/worker
npm ci
npm run deploy:hosting
```

The command builds the offline shell and deploys **only Hosting** to the existing `korea-watch01` project. No `firebase init`, rules deployment, Fetch news workflow run, or merge is needed for this UI update. Existing news continues to come from the worker on main.

After deployment, open `https://korea-watch01.web.app/`. The current HTML contains `data-release="20261109-liquid-glass"`. If an installed app is still open on the previous version, close and reopen it. The new service-worker cache includes all UI modules and local fonts.

## Validation

- `npm run build:web`
- `npm test` (existing worker/translation/notification regressions plus updated UI checks)
- UI checks at 320×640, 390×844 and 1280×900; saved state across restart, native touch swipe/delete, clipboard/image sharing, topic ordering, locale/theme/font/audio persistence, sticky controls, refresh failure and recovery.
- Existing stale-empty/malformed-feed regressions verify all 184 published stories remain visible.

Browser checks use Chromium fixtures and never send real notifications or social messages. Physical iPhone/Safari verification remains a device check after Hosting deployment.

Cloud validation note: the Firestore rules emulator could not be downloaded from `storage.googleapis.com` under this environment's outbound policy. No Firestore rules or subscriber schema changed. Hosting deployment requires the Firebase account already used on the owner's Mac; this cloud environment has no configured Firebase identity.
