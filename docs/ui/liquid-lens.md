# Liquid Lens and vertical news feed — 2026-11-09

Applies to the real Firebase web/PWA app, from main after the previous Liquid Glass change was merged. News selection, translation, subscriber schema and the five-incident push policy are unchanged.

## Navigation lens

One shared glass lens moves behind the three navigation buttons. Ordinary taps and keyboard activation select at normal size. A 200 ms hold or a horizontal drag of more than 8 px engages the enlarged lens. It follows the pointer through a damped spring rather than directly snapping to the finger. Releasing selects the nearest tab once, retains motion continuity, and returns the lens to normal size. Pointer cancellation restores the current tab without navigating.

The spring integrates four substeps per animation frame, with bounded frame time. Tracking uses stiffness 360/damping 34; release uses 185/22 for gentle settling. Expansion uses 240/28. Held scale reaches 1.12 horizontally and 1.60 vertically, with a 5 px upward offset to keep the expanded lens visible near the bottom edge. Normal motion stays inside the dock, with at most 3 px of spring overshoot near the outer tab stops. The animation loop stops after settling.

Reduce Motion snaps the selection without a spring or magnification, including when the setting changes during an animation. Native buttons retain click/keyboard semantics, aria-current and focus outlines. Horizontal touch dragging does not start pull-to-refresh or trigger a duplicate click on release.

## Bottom placement and settings

The dock sits at max(6 px, safe-area bottom). Normal browser chrome is handled by fixed positioning and the dynamic viewport. An extra browser visual-viewport obstruction lifts the dock by the measured overlap; pinch zoom is excluded to avoid moving controls around during zoom. Standalone mode keeps the dock at the safe edge.

Settings hides the three navigation tabs and has only Test notification and Save at the bottom. A header back button returns to the page from which settings was opened. The reader has only its close button at the top, while the bottom Back/Save/Share actions remain available. The compact reader headline and progress bar use the newly available top-left space.

## News and typography

Featured and All-news cards use the same photo/category/headline markup. All news is a single vertical column with no horizontal scrolling or source/summary rows inside cards; the full details remain in the reader. Featured image frames keep their 156 px mobile / 210 px wider-screen heights. Photos are enlarged 12% and lowered 4 px within their clipped frame.

The New chip is removed from news cards, the reader, and saved rows. Selected category ordering and news counts remain unchanged.

Original fonts are restored: IBM Plex Sans Thai 500/600/700 for headings and controls; Sarabun 400/500/600 for body text. Thai and Latin WOFF2 subsets are self-hosted from @fontsource/ibm-plex-sans-thai and @fontsource/sarabun 5.3.0. OFL licenses are in public/fonts. The offline shell precaches all font files and the new controller.

## Deploy

Download the GitHub ZIP for codex/liquid-lens-feed-2026-11-09, extract it in Downloads, then on the Mac already used for Firebase deployment:

```sh
cd ~/Downloads/korea-watch-codex-liquid-lens-feed-2026-11-09/worker
npm ci
npm run deploy:hosting
```

This updates only Hosting in korea-watch01. No rules deployment, worker run or merge is needed for these UI changes. The HTML release marker is 20261109-liquid-lens.

## Validation

Build plus the full npm test suite. Browser checks cover 320/390/1280 px, short taps without expansion, holding beyond 200 ms, spring following during drag, native touch selection, cancellation, Reduce Motion during animation, browser obstruction compensation, settings-back navigation, restored font families, a single-column feed, bookmark persistence, clipboard/summary images, refresh behavior, and recovery of all 184 published stories.

Chromium covers gesture and viewport geometry. Physical iPhone/Safari toolbar behavior still needs a device check after deployment. This cloud environment has no Firebase login, so Hosting is published from the owner's existing Mac login.
