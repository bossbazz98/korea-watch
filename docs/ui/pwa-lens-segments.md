# PWA lens, compact topics and sliding appearance controls

Branch: `codex/pwa-lens-segments-2026-11-11`. Base: `c239641`; the previous card fixes were not yet in main when this work started. Release: `20261111-pwa-segments`. No merge or live deployment is performed by pushing this branch.

## Lens rendering

The independent clear capsule stroke is now visible only while the pointer is engaged by a hold or drag. It is absent at rest, during an ordinary tap and after release in both themes. The existing spring dimensions and native navigation buttons remain.

The prior chromatic implementation used four colored, scaled tracks with masks, blur and blend modes inside a backdrop-filtered floating control. The reported standalone purple stripe was not reproduced on a physical iPhone. To remove that compositing path, the lens now magnifies a single decorative row. Subpixel text shadows and small SVG drop shadows add color only at glyph edges while holding; there are no full colored mask/blend planes. The optical viewport still clips all content to the capsule. The real buttons keep IDs, labels and keyboard semantics; decorative content remains hidden from assistive technology.

## Topics and photos

Topics are placed before featured stories so both rows are visible on the initial mobile viewport without reducing the news photo height. Two flex rows share one horizontal scroll container, preserving the catalogue order. Each tile has intrinsic name width, with its label above its count; longer names do not stretch unrelated tiles in the other row. Compact-height rules also support landscape phones. Font scaling and the selected-topic filter are preserved.

The reader image has no pseudo-element gradient or photo filter. Pixel checks near the lower edge of the image verify that the original photo color remains visible. Image frame dimensions and the featured-card photos are retained.

## Appearance selectors

Language, theme and font controls use full capsule corners and one sliding surface behind their existing buttons/radio labels. Native selection and autosave update immediately. Position/size transitions take 280 ms, and foreground text follows the moving selection surface. Changing the interface language recreates the settings DOM, so the controller snapshots the current visible position and starts the new controller from it instead of jumping. Controllers disconnect observers and animation callbacks when settings closes or rerenders. Font preview sizes use `nth-of-type`, preserving 14/18/22 px samples after the decorative thumb is inserted. Keyboard activation and Reduce Motion can select immediately without animation.

The new module is included in the offline shell and no-cache Hosting headers. Subscriber schema, rules, worker behavior and Firebase configuration are unchanged.

## Validation and limits

The full `AGENT_CHROMIUM=/usr/bin/chromium npm --prefix worker test` suite passes. UI checks cover 320/390/1280 px plus a 390 px standalone simulation at device scale 3. They verify both topic rows above the dock, name-fitting widths and counts below labels, outline absence for taps/rest and visibility while holding, and a rendered-frame check rejecting a broad purple stripe. They also check the original photo color near the bottom edge, intermediate and final positions for all three appearance selectors, language rerender continuity, font sample sizes, persistence and Reduce Motion. Existing bookmarks/sharing, refresh, translation, delivery-rank and 184-story recovery regressions remain covered. Responsive grid checks retain tablet, desktop and landscape-phone coverage.

Chromium standalone simulation is not physical Safari validation. A WebKit launch was attempted but its executable was missing. Downloading the official Playwright WebKit package was then blocked by outbound policy: `403 Domain forbidden` for `cdn.playwright.dev` and `playwright.download.prss.microsoft.com`. No network policy or credentials were changed. Check the deployed PWA on the actual iPhone for final device rendering. Deployment uses the owner's existing Mac Firebase login; see [UPDATE-APP.md](../../UPDATE-APP.md).
