# Interaction update

Branch: `codex/interaction-polish-2026-11-11`, based on `23b50eb`. Release: `20261111-interactions`. No merge or live deployment is performed by pushing this branch.

## Home and app lifetime

The pull gesture is vertical, starts at the top, and has resistance. At 64 px of revealed space the ring is full. Only a qualified release produces one 15 ms vibration, respecting the device vibration preference. The request starts immediately; feed snapshots are buffered during the finite 600 ms turn. The loader and the turn must both finish before committing the feed and collapsing the space over 220 ms. There is one request per gesture, no automatic refresh while holding, no repeat ring animation and no dependence on the optional status read. Failed reads preserve the existing feed and show a retry message.

Home cards now include the story timestamp in KST. Featured and All use the same fixed card height, scaled to leave three headline lines at the selected font setting. Their photos use a shared 180 px height on small screens and 210 px on wider screens. The featured-topic subtitle is one ellipsized line. Existing urgency borders and the responsive maximum-four-column grid remain.

The sticky reader headline explicitly uses IBM Plex Sans Thai.

`app-lifecycle.js` records wall-clock background time on visibility/pagehide events. More than ten minutes away returns to Home, resets the category and scroll position, and requests feed/status afresh. Duplicate browser lifecycle events cannot repeat the reset. Startup and foregrounding check the service worker for updates. The worker announces the release from its installed cache; a different release reloads during the opening interval. Session state limits a stale-HTML reload to once per release per minute, avoiding a reload loop. A release arriving during reading waits until the next opening. Opening offline retains the installed app.

## Autosave and notification levels

Settings has no Save, Back or close control. The same three-tab dock remains visible with Settings selected. Device choices save synchronously and show a single replaceable 2-second toast, 12 px above the dock. Push preferences also persist locally immediately; remote writes are serialized/coalesced so navigating away or making rapid changes cannot let an older write win. Permission is requested directly from the enabling gesture. Failed/ offline synchronization remains dirty and retries on startup or reconnect, with truthful pending feedback. With no chosen topics the server subscription is inactive while the empty local selection remains intact.

The user explicitly clarified in this conversation that the five-incident restriction applies **only to urgent news**, and that the other options must work. The shared policy now has three matching modes:

| Choice | Matched levels |
| --- | --- |
| Urgent | Only the original five confirmed incidents |
| Urgent + important | Qualified critical plus high |
| All selected news | Qualified critical, high and normal |

All modes require topic intersection and a verified Korean publisher. Nonincident news must have completed translation. AI cannot create critical eligibility: the original five-incident classifier still controls promotion/demotion. The worker now queues newly translated eligible nonincident stories too, within the existing freshness window, four-news budget, quiet hours and deduplication. Outbox and delivery retries revalidate provenance and the recipient's **latest** topics/rank. Overflow summaries retain the corresponding recipient's story context. The app uses the same matching logic and does not replay currently visible stories merely because a setting was broadened.

No subscription schema, Firestore rules, credentials or Firebase project configuration is changed. A Hosting deploy updates the UI; the worker must also run this branch. Scheduled GitHub Actions still run main until the owner merges it. See [UPDATE-APP.md](../../UPDATE-APP.md).

## Saved stories and sharing

Saved stories have a search field, horizontally scrolling topic filters and KST publication-day groups (Today/Yesterday/date). Publication date is used so the time-only story timestamp agrees with its group. Cards have an 82 px square top-aligned image, at most two category chips and a visible +N overflow chip, and a three-line headline. A horizontal 134 CSS px swipe reveals the red delete action; a short swipe, rightward swipe or outside tap cancels. Snapshots still survive feed expiry and app restart. Bottom padding and a gradient keep the last card clear of navigation.

Share preview text has `min-width:0`, a two-line headline, one-line tags and a sheet that hides horizontal overflow. Four app actions include the native More share dialog (copy-link fallback on browsers without Web Share). Copy-link and summary-image actions are grouped with icons, short descriptions and chevrons. Export embeds the actual fetched article image; a missing/CORS-blocked image produces an error instead of a misleading replacement logo. KakaoTalk uses the system chooser; direct provider-specific SDK sharing is not configured.

## Optical dock

The normal dock is 353×62 px with a 330 px button row; centers are 66.5/176.5/286.5 px, 25 px icons and 11.5 px IBM labels. Narrow viewports proportionally fit the row. Home has an 8 px #ff2d55 dot. Dark/light surfaces and inset highlights use the requested colors.

Only three real buttons are interactive. A masked original row and five decorative copies (main + four chromatic planes) avoid double drawing; all copies have no IDs and are hidden from assistive technology. The main copy scales around the lens center. Pastel planes are masked to the rim and blend with screen/multiply in dark/light mode. The rim uses the requested small backdrop blur/saturation.

The controller integrates position (stiffness 520, damping ratio .78), dimensions and optical values (340/.62) with four substeps per animation frame. Speed-dependent narrowing and vertical compensation use the requested formula. Tap targets follow 150/330/470 ms stages, or 240/380 ms when tapping the same tab, and are clamped to the bar even at spring overshoot. Holding uses 80 ms milk and 170 ms glass stages; a drag beyond 6 px engages tracking. The rim has 35% rubber resistance beyond outer tab centers and at most 12 px additional bar stretch. Releasing selects the nearest tab and uses 110/260 ms milk/rest stages. Pointer cancellation restores the selected tab. Keyboard activation and Reduce Motion select immediately without motion.

## Verification

The browser suite covers 320/390/1280 px; ring fill/release/one turn, native touch, horizontal-swipe rejection, reduced motion, feed retention on failure, optical masks and unique button IDs, spring tap bounds, hold/drag/cancel/keyboard, story times, equal card heights, saved date groups/search/filters/delete, share overflow/native More and a pixel assertion proving the real article photo is in the generated image, immediate/serialized/offline autosave, locale/theme/font persistence, heading contrast >=4.5:1, long-absence reset and automatic-update reload-loop protection. Responsive checks cover 768/1024/1440 px and a landscape phone. Lifecycle/worker unit tests cover duplicate visibility events, a stored absence at startup, install/activation and version announcements. Worker tests cover the rank/topic delivery matrix and recipient changes before retry. Existing translation/publication regressions are retained, including the 184-story feed recovery.

Physical Safari/iPhone toolbar geometry and optical rendering still need a device check. Web Vibration is unavailable in Safari on iPhone; a web app cannot guarantee iOS haptics. Remote image export requires the publisher to permit cross-origin image loading. The cloud environment has no Firebase login or live Firestore access, so database writes and notifications in tests use fakes, and deployment uses the owner's existing Mac login and GitHub workflow secrets.
