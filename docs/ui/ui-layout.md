# UI layout update

Branch: `codex/ui-layout-2026-11-10`. HTML release marker: `20261110-ui-layout`.

This updates the real Firebase web/PWA app. It builds on `9929589` from the previous, still unmerged Liquid Lens branch so those changes remain included. No merge or Hosting deployment is performed by pushing this branch.

## Settings and bottom controls

Settings has a top-right close button instead of an upper back button. Bottom actions are Back and Save; the manual test-notification button is removed. Both close and Back return to the page that opened settings. IBM Plex Sans Thai applies to all settings text, including native form controls. The regular 400 weight is bundled alongside the existing weights and OFL license.

All bottom docks share a 68 px frame and 54 px controls, independent of the selected tab, page, and font setting. Main tabs read หน้าแรก / บันทึก / ตั้งค่า. Settings and reader actions retain their page-specific functions within the same frame. All dock labels use IBM Plex Sans Thai. The dock sits at `max(2px, safe-area-bottom - 4px)` plus the existing visual-viewport obstruction compensation. Normal browser chrome and standalone safe-area behavior remain handled by the existing viewport logic. The held lens moves up 8 px to remain visible near the lower edge; its spring and hold/drag behavior are retained.

Section titles and news headlines use a shared 20 px base; summaries, article text and additional details use a shared 16 px base. Both still follow the user's font scale. Logo lettering, numeric counters and form controls retain their own sizing.

## News layout

Featured photo frames have a 220–280 px minimum height depending on viewport width. Their flex growth fills remaining carousel height instead of leaving space below short headlines. Verified critical cards have a 2 px coral-red border plus an inset stroke; high-importance cards have a 2 px amber border. This uses the feed's normalized importance; it does not promote news to critical or alter alert eligibility.

The All-news grid uses one column below 640 px, two from 640 px, three from 960 px and four from 1280 px. Coarse-pointer, touch-only screens at most 500 px high keep one column for landscape phones. The maximum is four columns. The header's last-update subtitle is removed.

## Pull-to-refresh

The existing feed request starts immediately on release. The spinner stays visible for at least 450 ms before collapse, without delaying application of the returned feed. A request already taking longer than 450 ms has no extra delay. Re-entry remains blocked during the visual cycle; errors preserve the feed and allow retry afterward. Reduce Motion behavior is retained.

## Validation and deployment

`AGENT_CHROMIUM=/usr/bin/chromium npm --prefix worker test` passed, including existing news, translation and five-incident alert-policy regressions. UI checks cover 320/390/1280 px, settings close/back, equal dock dimensions, font metrics, critical/high borders, bookmark/share behavior and immediate feed rendering with a visible minimum spin. Additional viewport checks cover two columns at 768 px, three at 1024 px, four at 1440 px and one on a landscape phone at 844×390. `npm --prefix worker run build:web` includes the stylesheet and new font subsets in the offline shell.

Chromium tests verify viewport compensation, but physical iPhone/Safari toolbar behavior still needs a device check after deployment. This cloud environment has no Firebase login. Use the existing Mac login and the commands in [UPDATE-APP.md](../../UPDATE-APP.md) to deploy Hosting. These UI changes require no Firestore rules deployment or Fetch news workflow run. Firebase configuration, subscription schema and the original five-incident push policy are unchanged.
