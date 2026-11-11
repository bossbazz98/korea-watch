# Card and lens fixes

Branch: `codex/card-lens-fixes-2026-11-11`. Base: main at `65c66bb`, which already includes the previous interaction update. Release: `20261111-card-lens-fixes`. No merge or live deployment is performed by pushing this branch.

## Confirmed causes and changes

The mobile card rules from the older layout still assigned `.card h3` to grid column 2. In the newer single-column card body this created an implicit second column: the reproduced headline was only 24 px high and appeared beside the tags. Card bodies now explicitly have one column and rows for tags, headline and timestamp. Regression checks verify full headline width, three visible lines and a headline position below the tag row at 320, 390 and 1280 px.

Both Home card sections use a shared category formatter capped at two distinct categories, followed by a pinned +N overflow chip. The chip cannot shrink out of view, includes the hidden category names in its title, and has a localized accessible label. Saved cards reuse the same formatter. The reader calls the unlimited formatter and retains every tag.

Topic tiles use 16 px base labels and smaller 16 px, medium-weight counters. Tracks are 148–180 px on smaller screens, with a six-column visible arrangement on wider screens. A 104 px minimum tile height expands with wrapped names and the existing font scale.

The colored lens plane had its intended color, but `.lens-copy-track` explicitly reset its descendants to the main foreground color. Colored tracks now inherit their plane's tint. The old capsule clipped its outer keyline and mixed its stroke with the optical mask. A separate, unmasked capsule border now provides a translucent light stroke and a dark outer keyline, including in the light theme. The optical content stays clipped inside its own layer. Hold/drag physics, keyboard behavior, Reduce Motion and viewport compensation are retained.

The reader's negative 8 px article margin put tags on top of the image edge. The article now starts after the image with 16 px of top padding. The publisher and KW logo have their own centered inline-flex group, so a wrapping timestamp cannot shift the logo away from the source name.

Saved rows now show day, full month name, and hour/minute in Asia/Seoul, with the time-zone label, and may wrap instead of truncating the date. Day grouping remains based on publication date.

Selected notification ranks now use the same ink/ink-foreground palette as selected theme/topic controls, including matching radio-indicator colors. The urgent option omits its long detail paragraph. Rank filtering, autosave, source validation and the original five-incident critical classifier are unchanged.

Settings previously reserved a permanent 220 px bottom inset. Its base is now dock position + dock height + 20 px. While a toast is visible, its measured height is temporarily reserved; an existing bottom scroll position follows the new end so the last setting is never hidden. Once the toast disappears the extra space is removed. No permanent blank area is left above the dock.

## Validation

`AGENT_CHROMIUM=/usr/bin/chromium npm --prefix worker test` covers all existing news/translation/notification regressions and the updated UI suite. UI checks cover two-category overflow on both card sections, headline placement and width, enlarged tile labels, complete reader tags below the image, publisher-logo alignment, full saved dates, selected-rank colors, omission of urgent details, and a 20 px bottom gap after toast dismissal. Chromatic track colors and the independent stroke are checked while holding and dragging in both themes. Screenshots cover the reader, saved page, settings bottom, and dark/light lens states at 320/390/1280 px. Wider-grid tests retain 768/1024/1440 px and landscape-phone coverage.

Build verification checks the offline shell and new release marker. Only Hosting needs deployment for this change; no worker, subscription schema, Firestore rules, credentials or Firebase project setup is modified. Physical iPhone/Safari rendering remains a device check after deployment. See [UPDATE-APP.md](../../UPDATE-APP.md) for the commands using the owner's existing Mac Firebase login.
