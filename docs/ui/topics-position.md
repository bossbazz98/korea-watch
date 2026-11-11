# Restore Topics below Featured

Branch: `codex/topics-below-featured-2026-11-11`. Base: `1234c41`. Release: `20261111-topics-below`.

Home order is Featured → Topics → All news. Only the section order and release marker change. Topics retain two compact horizontal rows, name-fitting frames and counts under labels. The latest lens renderer, unshaded reader photo and sliding settings selectors are retained.

The existing UI assertion now checks this section order and verifies that both topic rows can be viewed above the dock when scrolling to Topics, instead of requiring them on the initial viewport. A targeted Chromium check covers 320/390/1280 px and a standalone simulation. The web build and offline shell are regenerated.

Deploy Hosting using [UPDATE-APP.md](../../UPDATE-APP.md). No worker run, rules deployment or Firebase setup is needed. Pushing this branch does not merge main or deploy the live app.
