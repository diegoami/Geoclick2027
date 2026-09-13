# Geoclick — Decisions

A scannable log of *why* the project works the way it does — decisions
made along the way, with the reasoning, not the implementation detail.
For "what was built and how it was verified," see the relevant
iteration in [ROADMAP.md](ROADMAP.md) or the system description in
[ARCHITECTURE.md](ARCHITECTURE.md); this file exists so "why did we
decide X" doesn't require digging through either. Workflow/process rules
(how Claude works in this repo) live in [CLAUDE.md](CLAUDE.md), not here
— this file is about the product and its design, not day-to-day process.

Keep this updated the same way as the other docs: when a decision gets
made, made explicitly to correct an earlier one, or gets revisited, add
or amend an entry here as part of that change, not as an afterthought.

## Quiz mechanic

- **Drag-and-drop slip matching, not flashcard recognition/recall.** A
  set of name slips on the game area; drag one onto the region it names,
  drop to confirm. Chosen over an original flashcard-style design because
  it's a more direct test of map knowledge (find the *shape*, not just
  recognize a name) and a clearer visual differentiator from Seterra. The
  two-directional flashcard idea isn't gone, just deferred — nothing
  about drag-to-match blocks adding it later as a second quiz mode. See
  ROADMAP.md's Iteration 4.
- **A third item status, `'revealed'`, not just correct/incorrect.**
  After `MAX_ATTEMPTS_BEFORE_REVEAL` (3) wrong drops on the same slip, it
  auto-resolves: name shown, slip leaves the tray, but scored and colored
  differently from a real success (excluded from `scoreSession`'s
  `perfect` count, muted color rather than success-green). Reason: a
  slip you keep failing needs a way out, not an infinite retry loop.
- **Solved regions stay permanently labeled ("discovered"), via DOM
  `maplibregl.Popup`s, not a MapLibre symbol layer.** A feature-state-
  driven symbol layer was tried first (matching the pattern already used
  for fill color) and dropped: even with `text-allow-overlap`/`text-
  ignore-placement` set, MapLibre's collision/placement system
  unpredictably hid some labels regardless of opacity — confirmed
  directly via `queryRenderedFeatures` showing a label feature simply
  wasn't in the render results for one region while five others were
  fine. DOM popups have no such collision system.
- **Drop hit-testing: exact-pixel for hover, a tolerance radius
  (`DROP_TOLERANCE_PX`, 24px) for the drop itself — and the tolerance
  only ever helps the *correct* target land, never reattributes which
  region a wrong drop hit.** Needed because small regions (Bremen,
  Saarland) can be only a couple of screen pixels wide at a normal zoom
  level — exact-pixel-only hit-testing made them nearly impossible to
  hit. The 24px figure came from directly measuring Bremen's actual
  miss distance via `queryRenderedFeatures` at increasing radii, not a
  guess (an initial 14px guess still failed Bremen specifically).
- **A drop only counts as an attempt at all if it lands on or near some
  region.** Dropping outside the map, back onto the name tray (which
  visually overlaps the bottom of the map container), or on empty map
  space (sea, gaps between regions) are all treated as "changed my
  mind" — no error recorded, no wrong-flash, slip just returns to the
  tray. Landing on an actual *different* region still counts as wrong.
  This took three passes to get right (outside-the-page, then the tray-
  overlap case, then empty-space-inside-the-map) — each found by the
  user actually playing the quiz, not anticipated in advance.

## Persistence & retention

- **Local-first, no user accounts.** Progress lives on the device/
  browser, keyed to nothing but that. Spaced repetition only needs
  somewhere to remember state across sessions on one device — it doesn't
  need a login. Accounts are a separate, later concern (Iteration 8+),
  triggered only by wanting to sync progress *across* devices or a
  public leaderboard, not by spaced repetition itself. See
  ARCHITECTURE.md's Storage section.
- **Iteration ordering: local persistence before spaced repetition**,
  reversed from the original numbering. Spaced repetition has nothing to
  persist into without storage first — building it in the original order
  would mean starting from a design that couldn't actually be exercised
  end to end. See ROADMAP.md's Status section.
- **Same-day quiz progress persists immediately, not just at full
  session completion — but only for a genuinely clean, error-free
  match.** Abandoning a quiz partway through used to save nothing at
  all, forcing a full re-solve of everything (including regions you'd
  already gotten right minutes earlier) if you came back the same day.
  Fixed by persisting each correct match as it happens. But a region you
  fumbled (wrong drop before eventually getting it right) or gave up on
  (revealed) is exactly the one that needs more practice, not less —
  letting it coast as "done" for the rest of the day would work against
  the app's actual purpose. So only `errors === 0` matches persist;
  anything with an error, including a subsequently-corrected one, comes
  back as a completely fresh slip if you reopen the map later the same
  day. Deliberately stops at "today" with no real interval — that's
  Iteration 6's job, this was a same-day stopgap so partial progress
  wasn't thrown away in the meantime.
- **Iteration 6 retires the same-day mechanism above rather than running
  it alongside real spaced-repetition state.** Once `CardState`/
  `dueDate` exists, it's the one source of truth for "is this target
  already handled" — no parallel bookkeeping. A clean win now produces a
  `dueDate` of tomorrow-or-later, which is a strict generalization of
  "stays discovered until the calendar day rolls over," same visible
  effect from a real scheduler instead of a stand-in. A failed/revealed
  grade's resulting `dueDate` has to still land same-day, not get pushed
  to tomorrow by a naive "minimum interval = 1 day" implementation —
  otherwise the already-shipped, already-tested "mistakes resurface the
  same day" behavior regresses. See ROADMAP.md's Iteration 6 section,
  "Consistency review."
- **Only a full fail ("again"/revealed) is forced to repeat the same
  day — a recovered mistake ("hard": correct, but only after a wrong
  drop) graduates normally to "due tomorrow-or-later," not a same-day
  repeat.** A real fork, asked explicitly rather than assumed: strict
  "any mistake means more practice today" (matching Iteration 5's
  same-day rule to the letter) vs. standard spaced-repetition semantics,
  where eventually getting it right still counts as a pass. Decided on
  the latter. "Hard" still builds a weaker interval and lower ease
  factor than "good" would, so it resurfaces sooner than a region
  nailed first try — just not literally later the same day.
- **Every review interval is capped at 365 days (`MAX_INTERVAL_DAYS`)**
  (GC-010, 2026-09-13). Uncapped, `round(interval * easeFactor)` grew
  1 → 6 → 15 → 38 → 95 → 238 → 595 → 1488 days by the 8th clean review
  (the score panel would say "Next review in 2265 days"), and by the 20th
  it overflowed `Date` into a `"NaN-NaN-NaN"` due date — which
  string-compares after every real date, so `isDue` returned false
  forever and the card silently left the review pool, with nothing
  logged. Why a year rather than the review's alternative of 180 days:
  this is a geography game with a few dozen targets per map, not a
  thousands-of-cards exam deck, so reviewing a *mastered* region once a
  year costs the player almost nothing, and a year is the natural
  "do I still know this" horizon for place knowledge. The cap first
  bites at the 7th consecutive clean review (238 × 2.5 = 595 → 365), so
  it only ever affects regions a player demonstrably knows. It also
  makes the Date overflow structurally impossible rather than just
  unlikely. No migration was needed for already-stored cards: a review
  only happens when a card is due, so an interval over 365 days first
  becomes possible at that 7th review, after 1+6+15+38+95+238 = 393 days
  of history — and this app is weeks old, so no stored card can hold an
  overlong interval or a NaN date yet.
- **Ease factor now recovers: a clean ("good") review adds 0.1, up to a
  ceiling of 2.5 (`MAX_EASE_FACTOR`)** (GC-010). Before, "good" left ease
  unchanged and nothing ever raised it, so every "hard" (-0.15) was
  permanent: one fumble followed by 20 perfect reviews still sat at 2.35,
  and a card fumbled every other time slid to the 1.3 floor. +0.1 is
  SM-2's own adjustment for a perfect answer. The ceiling is the default
  on purpose — new cards start at the maximum, and ease exists to slow
  down cards you *struggle* with, not to let a long clean streak compound
  intervals faster than the default rate (the interval cap above bounds
  those anyway). Net effect on a card fumbled every other review: it
  still loses ease, but at -0.05 per hard/good pair instead of -0.15,
  and a clean run brings it back. Together with the same-day "again"
  rule and three grades instead of SM-2's six, this makes the scheduler
  SM-2-*derived*, not "classic SM-2" as the docs used to claim — fixed in
  `packages/srs/src/index.ts` and ARCHITECTURE.md.
- **Practice mode (Iteration 6) persists nothing — no SRS state and no
  last-session summary — and starts from a blank map.** It exists so replaying a
  mastered map is still possible once nothing's due, without that
  session silently perturbing the real review schedule, and without
  implying you already "know" everything by pre-marking it discovered
  before you've actually re-tried it this round. *Amended by GC-020
  (2026-09-13):* the code used to save the last-session summary for
  practice rounds too, contradicting "never writes back" — so a casual
  practice round silently replaced the home page's "Last: 18/20" record
  of the last real graded session. Resolved toward the rule rather than
  toward the code: the home page line describes where you stand on your
  review schedule, and a practice score doesn't. Practice results are
  still shown on the score panel at the end of the round; they just
  aren't kept.
- **The score panel's "Play again" only shows when it's actually
  accurate — when a due session finishes and something's still due, not
  automatically.** Found by actually finishing a map: since a revealed
  target stays due the same day by design, "Play again" after a finished
  session sometimes led nowhere (an immediate bounce to "Up to date!"),
  which reads as broken. The panel now checks whether anything's still
  due right when the session completes: if so, "Play again" stays and
  is accurate; if the whole map just graduated, it's replaced with
  "All caught up! Next review in N days" plus "Back to maps"/"Practice
  all regions" — no button implying there's something left to replay.
  The same fix applies to practice mode's own "Play again": since
  practice never changes due-state, it now starts another practice round
  directly instead of re-running a due-check that can't have changed.

## Data & maps

- **Ukraine's map includes Crimea and Sevastopol, merged in from outside
  Natural Earth's own `admin='Ukraine'` filter.** The dataset tags both
  under `admin='Russia'` instead, reflecting de facto control rather
  than international recognition — most of the world, including the UN,
  considers them Ukrainian territory under occupation. Put to the user
  rather than decided unilaterally, since it's a genuine judgment call
  outside "just fix bad source data": asked whether to ship what the
  source provides (25 targets, documented omission) or merge the two
  features in by hand. Chosen: merge them in, via a new `--extra-where`
  option that runs an independent, country-unconstrained query — see
  MAPS.md for the exact mechanism.
- **"Great Britain" was asked for, not "United Kingdom" — taken
  literally, not as loose synonyms.** Great Britain excludes Northern
  Ireland by definition; the UK doesn't. Both the regions map (dissolved
  from the UK's admin-1 districts, Northern Ireland's 26 dropped via a
  new `--exclude-field=geonunit` option) and the towns map (Belfast
  dropped via a new `--exclude` option on `build-points-map.ts`) honor
  this literally rather than defaulting to the more common "UK" framing.
  Noted in MAPS.md as a scope call the user can correct if "United
  Kingdom" (including Northern Ireland) was actually meant.
- **Overseas territories are excluded from a country's regions/towns
  map by default — same reasoning as `usa-states`'s Alaska/Hawaii
  exclusion, generalized.** France's and Spain's regions/towns maps
  initially shipped including their overseas départements (Guadeloupe,
  Martinique, Guyane française, Mayotte, Réunion) and, for Spain, the
  Canary Islands and the Ceuta/Melilla exclaves — all geographically
  distant from (or disconnected from) the mainland, which blows out the
  map's bounding box far past the useful extent for a demo map, exactly
  like Alaska/Hawaii would for the USA. Corrected same-day, user-flagged:
  drop them via `--exclude` (regions map, matched against the pre-dissolve
  département/provincia name) and `--exclude` on the towns map. Applies
  going forward to any country whose full territory includes far-flung
  overseas possessions — check for this before building a new country's
  maps, not just for France/Spain specifically.
- **Which 5 countries to add next (Japan, Canada, Australia, Portugal,
  Netherlands) was Claude's call, not user-specified.** The user asked
  for "10 more maps you think are interesting for people" and explicitly
  delegated the selection. Picked for geographic/cultural spread beyond
  the Europe-and-USA set built so far, not by any other criteria (e.g.
  population, land area) — flagged here since it's a product judgment
  call made without the user, unlike every other country added earlier
  (all user-named).
- **Australia's regions map excludes Jervis Bay Territory, Macquarie
  Island, and Lord Howe Island — a "not part of the canonical 8"
  judgment call, distinct from the overseas-territory rule above.**
  Natural Earth's raw admin-1 rows for Australia include these 3 in
  addition to the 6 states + NT + ACT that Australian schools actually
  teach as "the states and territories." Jervis Bay Territory isn't
  overseas at all (a tiny federal enclave inside NSW); Macquarie
  Island and Lord Howe Island are remote but are usually treated as
  belonging to Tasmania/NSW respectively, not as separate first-order
  entities. Excluded via the same `--exclude` mechanism as the overseas
  cases, but the underlying reasoning is "not a real state/territory,"
  not "too far from the mainland" — worth distinguishing if a future
  country raises the same "which of these rows actually count" question.
- **Russia's regions map excludes Crimea and Sevastopol, for direct
  consistency with the earlier Ukraine decision — not a new political
  judgment call, a mechanical application of one already made.** Natural
  Earth tags both under `admin='Russia'` (reflecting de facto control),
  the same as it does for `ukraine-regions`' source rows before that
  map's `--extra-where` merge — but it keeps their `iso_3166_2` codes
  under the Ukrainian `UA-` prefix even there. Showing them as Russian
  territory on `russia-regions` while already showing them as Ukrainian
  on `ukraine-regions` would contradict the project's own stated
  reasoning (UN-level international consensus) for the earlier
  decision, not present a second even-handed option. Applied to both
  the regions and towns maps.
- **India's regions map keeps Jammu & Kashmir and Ladakh as India
  depicts them, unlike Crimea — a deliberate distinction, not an
  oversight.** Crimea has near-universal international consensus (the
  UN included) against the controlling country's own claim, which is
  what justified overriding Natural Earth's `admin` tag there. Kashmir
  is a genuine three-way dispute (India/Pakistan/China) with no
  equivalent clean resolution to defer to — there's no "the world
  agrees, override the data" move available the way there was for
  Crimea. Default: show it as Natural Earth's own India-administered
  data depicts it, the same treatment every other non-Ukraine country
  in this project gets, rather than picking a side where the world
  hasn't. Revisit only if a comparably clean international consensus
  ever emerges, the same bar Crimea had to clear.
- **India's towns map excludes Amaravati despite it clearing the
  population threshold by a wide margin — a data-quality call, not a
  political one.** Its `POP_MAX` (5.8M) would rank it #7 nationally,
  ahead of Ahmedabad/Pune/Surat, but Amaravati is Andhra Pradesh's
  still-under-construction planned capital with an actual population of
  a few thousand people. `POP_MAX` is already known to sometimes read
  as a broader urban-agglomeration estimate (see the `POP_MAX` section
  below) - this is the same failure mode taken to an extreme past the
  point of being a reasonable tradeoff, actively misleading rather than
  "using a bigger boundary than expected." Excluded outright rather than
  accepted as another instance of the disclosed `POP_MAX` limitation.
- **Natural Earth has real exact-duplicate rows for the same city
  (Brazil's Vila Velha/Natal, Mexico's Mazatlán, Indonesia's Bandar
  Lampung, each appearing twice) — fixed with a general dedup step in
  `build-points-map.ts`, not a per-country workaround.** Found only once
  this project started building large towns maps (50+ candidates), where
  duplicates became likely enough to actually hit — smaller towns maps
  (5-40 targets) apparently never happened to include one. Left
  unhandled, two features sharing a name would produce two targets with
  the same `slugify()`-derived id: duplicate map pins, duplicate/
  colliding quiz slips. Dedupes by id after name fixups, keeping
  whichever duplicate has the higher `POP_MAX` — applies to every
  country's towns map going forward, not just this batch's.
- **Adaptive town selection (`--min-count`/`--max-count` on
  `build-points-map.ts`), replacing a one-size-fits-all `>100k`
  threshold.** Requested directly by the user (2026-09-13): "For
  countries like Sweden it makes sense to have a minimum of cities to
  show and change the 100k limit, while if there are too many cities
  like in China we have to think of increasing it." Both flags are
  no-ops at their defaults, verified by rebuilding `sweden-towns-100k`
  with the updated script and confirming byte-identical output against
  the already-shipped version - existing maps are unaffected unless
  explicitly rebuilt with the new flags. `--max-count=50` applied to
  every large country in the 2026-09-13 batch (China/Brazil/Mexico/
  Russia/India/Indonesia) - picked to stay under the largest
  already-shipped towns map (`japan-towns-100k`, 66) rather than an
  arbitrary round number. `--min-count=8` applied to Finland (only 4
  towns clear 100k) - not retroactively applied to the already-shipped
  `sweden-towns-100k` (5 towns), since that wasn't part of what was
  asked; revisit Sweden specifically if the user wants it bumped up
  too. See MAPS.md's "Adaptive town selection" section for the
  mechanism.
- **Public-domain data sources only (Natural Earth), on purpose.** A
  constraint carried through the whole project, not just an initial
  default — flagged again explicitly when scoping the self-serve
  map-authoring backlog item, which would need a different source (e.g.
  GADM) for finer administrative levels: don't adopt a new source
  without confirming it's actually redistributable the same way.
- **Map-building scripts live in the repository, not run once from
  outside it.** Stated explicitly at the user's request, though it was
  already true in practice — `data/scripts/` is committed like any other
  code. The gap this closes isn't the scripts existing, it's that no map
  currently shipping had its exact build command recorded anywhere
  outside conversation history. `MAPS.md` is the fix: every shipping
  map's command, plus planned ones, in one place — reproducing or
  auditing a map shouldn't depend on asking what was run.
- **Point targets (towns/cities) get a new style layer and a new
  pipeline script, not branches added to the existing polygon ones.**
  Worked out against the actual code, not reasoned abstractly: checked
  every place that currently assumes polygon geometry (hit-testing,
  click/hover binding, camera framing, the `labels` source-layer — which
  turned out to be unused by any app code at all, every popup anchors at
  `Target.centroid` directly instead). A `targets-circle` style layer
  reuses the exact same feature-state color scheme as `targets-fill` so
  a point map plays like the same game with round markers, not a second
  visual language. `Target.type` alone distinguishes a point map from a
  polygon one — no new map-level "geometry kind" field, since a map is
  always homogeneous. Built as `italy-towns-100k`/`germany-towns-100k` —
  see `MAPS.md`'s "Point-target implementation" section for the full
  breakdown, including two real bugs found only by testing the actual
  built maps (tippecanoe silently drops most points at low zoom by
  default; the polygon tolerance mechanism's "is the name present
  nearby" check breaks down for city clusters closer together than the
  tolerance radius itself) that weren't anticipated in the original
  design pass.
- **A point map's drop tolerance requires the dragged target to be the
  *closest* candidate to the drop point, not merely present within the
  tolerance radius — polygon maps keep the simpler check.** Found by
  testing the Ruhr area directly: Essen and Duisburg render only ~22px
  apart on screen at the default zoom, inside the 30px point tolerance,
  so dropping a "Duisburg" slip squarely on Essen's own marker still
  registered as Duisburg solved correctly. Polygons don't get this
  fix — the simpler membership check has shipped and been tested for
  months, and two candidates rarely sit that close together for
  polygon-sized targets, so there was no reason to risk changing
  behavior that already works.
- **Guided tour mode comes before the quiz**, pedagogically — represents
  ARCHITECTURE.md's original pitch: a reveal-first, tour-style
  introduction to a map before testing on it, differentiating from
  Seterra's quiz-only approach.
- **Lakes are rendered as a purely contextual layer, selected by bounding-
  box intersection rather than tagged to a country.** Found by actually
  looking at the USA map: Michigan's two peninsulas visually merged into
  neighboring states with no indication of the Great Lakes between them —
  the state polygons themselves were correct, nothing was wrong with the
  geometry, there was just no water rendered in the gap. Lakes aren't
  attributed to an admin boundary the way states are (Lake Superior spans
  into Canada, for instance), so they're selected by whether they
  intersect the map's overall bounding box, not by an `admin` field
  match — and a lake extending past that box is fine to keep, not
  something to clip away. First cut still read as barely visible — fixed
  not by making the lake color more saturated (the first instinct) but by
  lowering the *land* fill's opacity instead (`targets-fill` 0.85 → 0.6),
  on the user's suggestion. Lighter land contrasts against the lake blue
  better than a more saturated lake did against the land.
- **An "Overview" view (all regions pre-labeled "discovered", no
  interaction beyond pan/zoom) sits above Tour and Quiz on the map
  landing page.** Requested directly: seeing the whole answer key at a
  glance is the most basic thing to offer before asking someone to learn
  or be tested on a map, so it leads the list rather than being an
  afterthought. Deliberately reuses the same visual language as a solved
  quiz target (green fill, name popup) rather than inventing a new one.

## Hosting & infra

- **Netlify, not Cloudflare Pages.** Cloudflare was tried first and
  abandoned after several distinct platform-specific failures (Workers-
  vs-Pages confusion, `_redirects` ordering differences, and — the actual
  deciding issue — broken HTTP Range-request support for byte-serving
  `.pmtiles` files, confirmed via an open, unresolved upstream issue).
  Full postmortem in ROADMAP.md's Iteration 3.5 section.
- **Netlify builds cost credits on the plan in use — don't trigger them
  casually.** Push to a branch and let a normal git-triggered build (or
  the user's own manual dashboard trigger) handle it; don't use the
  Netlify MCP tool's deploy operation as a debugging or verification
  step.
- **New features/fixes: branch first, merge to `main` only after the
  user has tested it locally and approved it.** `main` auto-deploys.
  Doc-only changes are the exception and go straight to `main`.
- **Iteration 7 (desktop packaging) reprioritized ahead of the GUI/UX
  evaluation**, on explicit user request after seeing all five demo maps
  working — wanted a working desktop build to look at before spending
  time on interface redesign, rather than following the numeric iteration
  order.
- **Tauri wraps `app/build` completely unmodified — no separate
  desktop-only frontend code.** `desktop/src-tauri/tauri.conf.json`'s
  `beforeBuildCommand` just runs the existing `npm run build
  --workspace=app`; the only new code is the Rust plugin registration
  (`desktop/src-tauri/src/lib.rs`) and one new `ProgressRepository`
  implementation (`app/src/lib/sqliteProgressRepository.ts`) picked at
  runtime by `createProgressRepository()`'s `isTauri()` check. Confirms
  the "one shared web core, three shells" strategy from ARCHITECTURE.md
  actually holds up in practice, not just on paper.
- **SQLite schema is a direct column-for-column mirror of the
  `ProgressRepository` interface** (`card_states`/
  `last_session_summaries` tables in `lib.rs`'s `migrations()`), not a
  redesigned data model. The interface was already deliberately
  backend-agnostic (see Iteration 5's design) specifically so this swap
  wouldn't need one — confirmed by writing the SQLite implementation
  with zero changes to the interface itself.
- **Android packaging (Capacitor) reprioritized ahead of the GUI/UX
  evaluation too**, same reasoning as Tauri above — explicit user
  request to have both real packaged shells (desktop *and* mobile) in
  hand before spending time on interface redesign, not just desktop
  alone. iOS stays a separate, later item regardless of this reordering:
  it hard-requires a Mac with Xcode, hardware this project doesn't have,
  so it can't be pulled forward the same way Android can.
- **Capacitor's SQLite schema is hand-mirrored from Tauri's, not shared
  code — and since GC-040 (2026-09-13) the mirroring is enforced by a
  test instead of a comment.** Same `card_states`/`last_session_summaries`
  tables, column for column. The original reason for not sharing
  ("Capacitor has no equivalent of Tauri's `migrations()`") stopped being
  true in GC-040: Android now has a real versioned migration list
  (`MIGRATIONS` in `capacitorMigrations.ts`, driven by `PRAGMA
  user_version`). Before that it ran `CREATE TABLE IF NOT EXISTS` on every
  open with no version at all — so the real risk the review found was
  never "two copies might drift", it was that the first schema change on
  Android had no mechanism to run exactly once per device.
  **Why still two copies rather than one generated schema:** sharing would
  mean a build step — one `.sql` file pulled into Rust via `include_str!`
  and into TypeScript via a raw import — across two very different
  runners (tauri-plugin-sql's compile-time `Migration` list vs. a runtime
  JS loop), for a schema of two tables and twelve columns. The failure
  that sharing prevents is drift, and
  `capacitorMigrations.test.ts` now catches drift directly: it runs every
  lib.rs migration and every Android migration against a real SQLite
  (`node:sqlite`) and fails if the schemas differ or the lists have
  different lengths. Same protection, no build machinery. Revisit if a
  third backend appears or migrations start carrying data transforms that
  would be painful to write twice. **Why migration 0 is `IF NOT EXISTS`
  while every later one is a plain ALTER:** every Android install from
  before GC-040 already has the tables but reports `user_version = 0`;
  migration 0 has to be a no-op over them (keeping every row) and just
  stamp version 1. Tested against a fixture of the old on-open SQL.
- **PMTiles on Android: buffer the whole archive in memory rather than
  work around Capacitor's missing Range-request support.** Capacitor's
  Android WebView local asset server can't return real `206 Partial
  Content` responses for arbitrary file types — a known, open upstream
  issue (ionic-team/capacitor#7664) — so pmtiles' normal range-request
  `FetchSource` silently never gets real tile data on Android, even
  though the identical file renders correctly in the browser/Tauri
  builds. Considered and rejected: patching/forking Capacitor's asset
  handler (real upstream fix, but out of scope to maintain a fork for);
  serving map tiles from the live Netlify deploy instead of bundling them
  (would make map data require network access, undermining the "download
  once, play offline" pitch these demo maps were always built around).
  Chosen instead: since every demo map is well under 1MB, fetch each
  `.pmtiles` file once as an ordinary full `GET` (which Capacitor serves
  fine — only *partial*-content responses are broken) and hand pmtiles a
  custom in-memory `Source` that serves its byte-range reads out of that
  buffer, via the library's own documented `Protocol.add()`/`.get()`
  pre-registration API. Scoped to native Capacitor only
  (`Capacitor.isNativePlatform()`) — the browser and Tauri builds already
  work correctly via real range requests and don't need to change. This
  approach stops making sense if a much larger map (multi-MB+) is ever
  added for Android specifically; revisit then, not now.

## GUI/UX round 1 (2026-09-12)

- **Explored with the `design` skill before writing any implementation
  code.** Four directions (top nav, on-map labels, quiz tray, map colors)
  were mocked up — the color options as *real live renders* of the actual
  app with paint properties swapped at runtime via `setPaintProperty`, not
  drawn approximations — and approved one at a time in a published canvas
  before any Svelte/style code changed. Caught a real problem this way
  that a mockup-only process wouldn't have: the approved on-map label
  style was only checked for contrast against a single green fill: once
  the categorical palette was picked, the pill needed a measured opacity
  bump (55%→65%) to keep 4.5:1 contrast against the palette's lightest
  color. Checked with actual WCAG math, not eyeballed.
- **Map fill color is a hash on the region's own name, not a curated
  per-map list.** `["%", ["length", ["get","name"]], 8]` picks one of 8
  muted palette colors per feature. The alternative — a `match` expression
  enumerating every region name per map — would need maintaining by hand
  for all six current maps (and every future one), defeating the point of
  a shared `base.json`. Tradeoff accepted: this is a length-based hash,
  not true adjacency-aware graph coloring, so two neighboring regions can
  occasionally land on the same color. That reads as a minor cosmetic
  imperfection for a decorative palette, not a bug worth a real map-
  coloring algorithm — revisit only if a specific map's collision is
  actually distracting in practice.
- **Click-to-explore, tour-reveal, and quiz-solved/overview labels now
  share one visual treatment**, not three. They used to be two different
  styles (`.geoclick-popup` at a larger size for the single-interaction
  case, `.geoclick-solved-popup` smaller for the many-at-once case) —
  unified because the user's own framing of the complaint ("the label
  that shows a region's name, on click, during tour, or when solved")
  treated them as one thing, and after the redesign there was no good
  reason left to keep two.
- **The top nav bar is one shared `MapNav.svelte` component, not four
  copies.** Extracted after the first round shipped: the user asked for
  "the same or similar tabs" on the Overview/Quiz/Tour views too, at which
  point four near-identical copies of the same markup/CSS would have been
  clearly wrong, unlike the Tauri/Capacitor SQLite-schema case (there,
  duplication was chosen because there's no shared runtime to put a
  common definition in — here, all four call sites are Svelte components
  in the same app, exactly what a shared component is for. Added an
  `active` prop so each view highlights its own tab (solid accent
  background) rather than showing four generic buttons with no sense of
  "you are here", and a `subtitle` snippet so QuizView's progress count
  stacks naturally under the nav instead of a second hand-positioned
  overlay guessing where the first one ends.
- **Quiz tray height is a resize handle, not a bigger fixed default.**
  The problem wasn't that 30vh was too small for every map — it's exactly
  right for a 20-target map like `italy-regions` and cramped for a
  110-target one like `italy-provinces`. A single new fixed height can't
  be right for both; a user-adjustable one (drag or arrow keys,
  `role="slider"`) can. Not persisted across sessions — in-scope was
  giving the user control in the moment, not remembering a preference;
  that's a small, separate addition if it turns out to matter.
  **Follow-up, found by the user actually trying to shrink it:** the
  handle couldn't make the tray small - a classic flexbox gotcha, not a
  logic bug. `.tray-slips` (the wrapping slip container) is a `flex: 1`
  child; flex items default to `min-height: auto`, which for a wrapping
  container resolves to "tall enough to fit every row" - that silently
  overrode the smaller height the handle was setting on its parent, no
  matter how far you dragged. Fixed with an explicit `min-height: 0` on
  `.tray-slips` (lets it actually defer to its own `overflow-y: auto`)
  plus `overflow: hidden` on `.tray` itself as a belt-and-braces backstop.
  Also lowered the default (30vh → 22vh) and minimum (15vh → 9vh) now
  that shrinking actually works - the old bounds were partly compensating
  for the bug by never asking for a height small enough to expose it.

## Home page map list (2026-09-12)

- **Grouped by country, not just a flat alphabetical list.** The user's
  own framing ("organize it better, at least alphabetically") set
  alphabetical as the floor, not the ceiling. With 28 maps across 14
  countries and every country already shipping its maps as a natural
  regions/towns pair (a trio for Italy, which also has a provinces map),
  a flat 28-row alphabetical list would still read as a wall of similar
  entries ("France — Regions", "France — Towns" sorted apart from each
  other alphabetically by their full name isn't even guaranteed). A
  heading per country groups the pair visually and lets the link text
  drop the now-redundant country prefix (just "Regions"/"Towns" under an
  "France" heading, not "France — Regions"). Countries are ordered
  alphabetically by name, and each country's own maps alphabetically by
  label - both levels meet the stated minimum, the grouping is the part
  beyond it.
- **A 2-column CSS grid above the existing 640px breakpoint, one column
  below it.** Reuses the breakpoint `MapNav.svelte` already established
  rather than inventing a new one. With 14 country groups, a single
  column at desktop width would push later countries far down the page
  for no reason - two columns is a small CSS change (`display: grid`
  behind the media query, `display: flex; flex-direction: column` below
  it), not a new dependency or a bigger redesign.
- **No search/filter UI.** Considered and rejected as disproportionate to
  the actual complaint: grouping plus alphabetical order already gets any
  country to a glance/scroll away, and a search box adds a second way to
  find something that mostly duplicates what the grouped layout already
  does at this list size (14 countries). Revisit only if the list grows
  enough that scrolling itself becomes the complaint, not scanning.

## Internationalization (i18n)

- **Hand-rolled dictionary + `t()`/`tPlural()` helper (`app/src/lib/
  i18n.svelte.ts`), not a library (`sveltekit-i18n`, `typesafe-i18n`,
  inlang/Paraglide).** Requested directly by the user (2026-09-12),
  alongside map-list reorganization and optional SSO. Scoped to the app's
  own UI chrome only — nav labels, home page text, quiz/tour status and
  button copy — around 35 distinct strings across five components. That's
  well under the scale where a library's build-step/plugin machinery,
  message-extraction tooling, or generated-types pipeline pays for
  itself; CLAUDE.md's own guidance ("three similar lines is better than a
  premature abstraction") points the same direction. A plain
  `Record<TranslationKey, string>` per language, with `TranslationKey` a
  union type (not `Record<string,string>`) so TypeScript itself catches a
  missing translation as a compile error, gets the one property worth
  having from a real i18n library — completeness checking — without any
  of the tooling overhead.
- **State lives in a module-scope Svelte 5 rune (`.svelte.ts`), not a
  classic `writable` store.** `$state` at module scope is the documented
  Svelte 5 pattern for state shared across components; every call site
  reading `t()`/`getLanguage()` inside a template or `$derived` picks up
  changes the same way reading any other `$state` value does, no store
  subscription boilerplate needed.
- **Persisted to `localStorage` under `geoclick:language:v1`, guarded the
  same way `progressRepository.ts`'s `createLocalStorageProgressRepository`
  is** (`typeof localStorage === 'undefined'` checks) — the home page and
  other routes prerender at build time, when `localStorage` doesn't
  exist. Defaults to English when nothing is stored or the value isn't a
  recognized language.
- **Map/target names are explicitly out of scope, on purpose.** Region
  and city names (Toscana, Bayern, Kyiv, ...) are real geographic proper
  nouns already localized per-country through `data/scripts/
  build-map.ts`/`build-points-map.ts`'s `NAME_FIXUPS` tables and
  `--name-field` — a separate, already-solved mechanism (see MAPS.md).
  Routing those through the UI dictionary would conflict with decisions
  already made per-country for reasons that have nothing to do with the
  viewer's own display language.
- **Pluralization is a hand-picked `.one`/`.other` key pair per counted
  string (`tPlural()`), not a CLDR plural-rules library.** English,
  German, and Italian all only distinguish singular (count === 1) from
  everything else for the specific counts this app displays (mistakes,
  days until next review) - matches how these strings were already
  worded before i18n existed (`mistake`/`mistakes`, `day`/`days`).
  Good enough for three languages and a handful of counted strings; would
  need revisiting (a real plural-rules table) if a language with richer
  plural categories (e.g. Polish, Russian) were ever added.
- **Switcher is three small text pills (EN/DE/IT), not flags or a
  dropdown.** Matches the existing muted, small-pill visual language from
  GUI/UX round 1 (see above) rather than introducing a new control style.
  Shown in two places: `MapNav.svelte` (present on every map-scoped view)
  and the home page header (which doesn't render `MapNav`) - both reuse
  the same `LanguageSwitcher.svelte` component rather than duplicating
  the markup.

## Visual refresh: background (2026-09-13)

- **The map's "ocean/empty space" background moved from flat gray
  (`#eef3f6`) to a warm parchment tone (`#f0ead9`), not a richer blue.**
  Requested directly: "the background color is kind of meh, maybe
  something more captivating." A richer blue was tried first (`#a9cfdf`)
  since water conventionally reads as blue on maps, and rejected after
  actually looking at it: it reads too close to the lakes layer's own
  blue (`#bcdcea`, DECISIONS.md's earlier "Lakes are rendered as a
  purely contextual layer" entry), undoing the contrast that entry
  already tuned once — the Great Lakes nearly vanished into the
  surrounding "ocean" background on `usa-states`. A warm neutral instead
  of a cool one keeps the original design's actual intent (a plain
  backdrop, not a literal ocean) while looking more intentional than
  flat gray, and — checked directly, not assumed — makes the lakes
  layer's blue read *more* clearly against a warm background than it
  did against the old cool gray-blue one, not less. Also re-verified
  against `italy-provinces`' full 8-color categorical palette (every
  hash-derived land color, not just green) and a towns map's `context`
  layer (`japan-towns-100k`) before settling on the value — neither
  regressed.
- **The home page background moved from plain white to a soft
  three-stop gradient** (`#e3f0e6` sage → `#dce6f2` blue → `#f7ecd9`
  cream, `160deg`, fixed so it doesn't scroll with content) drawn from
  the same muted-earthy family as the map's own categorical palette,
  for the same "meh" complaint. A first, much subtler version (near-
  white with barely-there tinting) was tried and rejected as still too
  timid to actually read as a change — the shipped version is
  deliberately more visible while staying low-saturation enough not to
  fight with body text or the map-card borders.

## Quiz solved-state contrast (2026-09-13)

- **Unsolved and solved regions/cities now differ by opacity
  (saturation), not just hue.** Reported directly after the background
  refresh above made it more noticeable: "looking at the quiz the color
  scheme is confusing, I do not know which regions have been recognized
  or not." Root cause, found by checking the actual palette rather than
  guessing: the 8-color categorical palette (unsolved default) includes
  a muted teal-green (`#8fb8a8`) close enough to `quizCorrect`'s green
  (`#5a9c6f`) that at the same flat 0.6 opacity, an unsolved region
  could plausibly read as already-solved at a glance — the hue
  difference alone wasn't a strong enough signal.
- **Fix: `fill-opacity`/`circle-opacity` became `case` expressions
  matching the same feature-states `fill-color`/`circle-color` already
  branch on**, not a new mechanism. Any named state (solved, wrong,
  revealed, hovered, explore-highlighted) renders at high opacity (0.8
  fill / fully opaque circle); the unsolved default drops to low
  opacity (0.3 fill / 0.65 circle). Saturation itself is now the
  primary "is this done yet" signal, independent of which of the 8
  hash-derived colors an unsolved region happens to have - directly
  matching the user's own suggested fix ("different level of
  saturation"). Circles kept a higher unsolved-state floor than fills
  (0.65 vs 0.3) since a point marker's *only* visual footprint is its
  fill - dropping it as low as a polygon's would risk making an
  unsolved city hard to see/aim for, unlike a polygon target, which
  stays fully legible via its always-visible outline regardless of
  fill opacity.
- **Applies uniformly across every view sharing this style** (MapView's
  click-explore, TourView's reveal, QuizView's solve/wrong/reveal,
  OverviewView's "everything already discovered"), not something scoped
  to the quiz specifically - `base.json` has one shared paint
  expression per layer, not a per-view variant. Checked directly, not
  assumed: `italy-regions` (polygon quiz, two real solves) and
  `sweden-towns-100k` (point quiz) both verified live before shipping -
  solved targets read unambiguously against every unsolved one in both
  geometry types.

## SSO/cross-device sync deferred (2026-09-13)

- **The Supabase SSO/cross-device-sync work is deliberately paused, not
  abandoned.** The user asked to resume it ("let us pickit up") after it
  had sat unfinished since 2026-09-12, and it was reconciled with four
  intervening merges to `main` (map-list reorg, i18n, eight-countries
  batch, background + quiz-contrast) — branch brought up to date,
  `svelte-check` clean, and a real gap fixed along the way
  (`AccountStatus.svelte` had hardcoded English from predating the i18n
  merge, now routed through `t()`). Immediately after seeing that state,
  the user changed their mind: "it does not make sense to add that
  before planning to buy a domain, go public, set it up in a store."
- **Reasoning: cross-device sync only pays for itself once there's a
  public, persistent identity for someone to return to** — a domain, a
  live public deployment, app-store presence. Building auth/sync
  infrastructure ahead of that is premature; the feature would have
  no real audience to serve yet.
- **The branch (`feature/supabase-sso-sync`, at commit `f8fa986`) is
  being kept, not deleted or merged** — the work (Supabase client,
  Postgres schema with row-level security, `supabaseProgressRepository`,
  Google sign-in UI, sync layer, see the "Cross-device sync (Supabase)"
  entry above) stays parked exactly as reconciled, ready to pick up once
  a domain purchase, public launch, or app-store submission is actually
  being planned. See ROADMAP.md's Iteration 8+ backlog for the
  corresponding status update.

## Remediation programme structure (2026-09-13, first draft — since scaled down)

- **SUPERSEDED same day: `main` is a normal integration branch again, no
  release-branch buffering.** The plan below built its whole release-branch
  structure around avoiding paid Netlify builds. The product owner then
  confirmed directly that build cost is not actually a constraint — see
  CLAUDE.md's Workflow section, updated the same day. Task/feature branches
  now merge straight into `main` once approved, same as every other feature
  in this project's history; `docs/RELEASES.md` was rewritten accordingly
  rather than deleted, since tags and release notes are still wanted (see
  the entry below).
- **SUPERSEDED TWICE, same day — final: ONE engine (opus), ONE agent, no
  multi-agent anything.** Draft 1 had four engines
  (haiku/sonnet/opus/fable); draft 2 cut that to two (sonnet implements,
  opus reviews/orchestrates) to push back on cost; draft 3 is the product
  owner's final call: "for complex tasks let us Opus do them, or maybe let
  us just Opus do the change alone, no two steps required, no multi agent,
  just loop." So: `engine: opus` on all 19 tasks, and the same single agent
  works them sequentially in a loop. What replaced the cold-context
  reviewer, deliberately and with the loss acknowledged: the four scripted
  gates are the mechanical review, and the product owner is the judgement
  review at merge time. `/code-review` is available on a branch without
  spawning anything, and is worth running on the two High-effort tasks
  (GC-021, GC-032). The rule that survived intact is "two failed attempts
  and stop" — a task with a written DoD that fails twice means the DoD is
  wrong, not the work.
- **The nice-to-have tier is back in, on an effort test.** Draft 2 dropped
  review items #20-#30 entirely ("no nice to have things"); the product
  owner then reversed it — "Ok the nice to have, do those, if they are low
  effort." All eleven pass that test (every one was Low in draft 1's own
  estimate, five are one-liners inside a file another task already opens),
  so all 30 punch-list items are now assigned: 19 tasks instead of 15, with
  GC-004/GC-031/GC-033/GC-080 restored as tasks and #20/#21/#23/#24/#26
  folded into GC-003/GC-022/GC-020/GC-041. #24 is the one with a real
  production footprint (`window.__map` currently ships to every user).
- **No zombies, as an explicit requirement.** The product owner asked for
  it directly, and the parallel design was what created them: worktrees,
  one `node_modules` each, a dev server each, a branch each. Draft 3's
  answer is mostly structural — one checkout, one branch at a time, one
  fixed dev port (5174, leaving 5173 for the owner) — plus
  `node scripts/task.mjs doctor [--fix]`, run every loop iteration and
  before every release: it finds orphan worktrees, `worktree-agent-*` and
  merged-but-undeleted branches, state/branch disagreement, interrupted
  state writes, and stray listeners on 5173-5199. It reports processes and
  never kills them — one of them is usually the owner's own dev server.
- **No GitHub for the remediation programme; task state is one local file
  per task.** The product owner: "not using Github, but just using local
  harnesses." A `status:` field in `docs/tasks.yaml` was rejected because
  three implementers plus an orchestrator doing read-modify-write on one
  YAML file is a silent lost-update race — so state is
  `.orchestrator/state/GC-0NN.json`, one file per task (single writer by
  construction, temp-file + rename, transition table enforced by
  `scripts/task.mjs`). With draft 3's single agent the race it was designed
  around cannot happen at all, so the state files are simply the loop's
  memory across restarts — kept because a transition table that refuses an
  illegal move is cheap insurance against a confused session. `tasks.yaml`
  is immutable spec. **Because those files are gitignored, the trackable
  record is a committed progress ledger** — the table in
  `docs/REMEDIATION_PLAN.md`, ticked as part of each merge; the product
  owner should never have to run a command to see where the programme
  stands. The review handoff is a branch plus `git diff main...<branch>`
  plus a worklog (`task.mjs log`), not a draft PR. Consequence accepted and
  confirmed by the owner: the programme is single-machine.
- **A release "batch" is a completed wave; the programme closes at
  `v0.2.0`.** Release tracking stays (git tag + `CHANGELOG.md` entry) but
  goes local. A wave boundary is the batching unit because it is already
  defined by the DAG, needs no fresh judgement, and is the point where the
  tree is quiescent — "every N tasks" would cut mid-dependency, and
  "whenever someone remembers" is how the project went eight iterations
  without a tag. Waves 0+1 → `v0.1.1`, wave 2 → `v0.1.2`, waves 3+4 +
  programme close → `v0.2.0` (the shape shifted in draft 3 when the restored
  nice-to-haves added waves 3 and 4). `1.0.0` stays reserved for the real public launch (see the
  SSO-deferral entry), so the closing milestone is a MINOR bump under that
  ceiling: "known issues from the Sept 13 review resolved".
- **REVERSED same day: the "nice-to-have / low value" tier (`#20`–`#30`) is
  back in.** Draft 2 dropped it ("let us focus on the necessary things, no
  nice to have things"); the owner then restored it conditionally — see the
  effort-test entry above. GC-000 is the only thing still dropped. The
  `dropped:` list in `tasks.yaml` and the restored-items table in
  `docs/REMEDIATION_PLAN.md` are the record either way, so nothing gets
  silently re-derived as new work later.
- **Still holds**: two failed attempts then stop and escalate rather than
  grinding a third (a written DoD that fails twice means the spec is wrong,
  not the work); gates before merge, always. What did NOT survive draft 3:
  cold-context review by a separate agent, because there is no separate
  agent. See [docs/ORCHESTRATION.md](docs/ORCHESTRATION.md).
- **SUPERSEDED after GC-001: the human is no longer the per-task merge
  authority — the loop automerges.** Product owner, 2026-09-13, after
  approving the first task: *"I think we need to change the behaviour to
  automerge."* The loop now merges a task itself once all four gates are
  green and every DoD item is verified, and reports each merge in a short
  summary. It still stops for the three release tags (the product owner's
  only routine gate), for two failed attempts, for a DoD item it cannot
  verify on this machine, and for a spec that is wrong in substance. The
  cost, accepted knowingly: `main` (which deploys) now gets each task
  without a human reading the diff first. The compensations are the gates,
  the written DoD, `/code-review` on the two High-effort tasks, and every
  merge being one `git revert` away. Scoped to the remediation loop only —
  CLAUDE.md's ask-before-merge rule still governs all other work.
- **Root `package.json` is the single source of truth for the version.** The
  repo had drifted to three different versions across seven files (`0.0.1`
  workspace, `0.1.0` Tauri/Cargo, `1.0` Android `versionName`);
  `scripts/sync-version.mjs` propagates and `--check`s it. The Android shell
  claiming `1.0` was the worst of the three — it is POC quality. Still
  holds; unaffected by the two supersessions above.

## First tracked release, v0.1.0 (2026-09-13)

- **The current state of `main` — everything shipped before any
  remediation fix lands — is tagged `v0.1.0` and treated as the project's
  first real release**, not just an informal snapshot. Product owner's
  call: reaching the point of having an independent review, a remediation
  plan, and a release process all in place is itself a milestone worth
  marking, distinct from whenever the remediation work itself finishes.
  See [CHANGELOG.md](CHANGELOG.md) for the release notes.
- **The version and a short build/commit identifier are shown on every
  screen** (`app/src/lib/VersionBadge.svelte`, bottom-right corner,
  injected at build time from `package.json` and `git rev-parse
  --short HEAD`) — requested directly ("release number and build should
  be prominent in the application"), not left as something only visible
  by reading a file. `1.0.0` stays reserved for the real public-launch
  milestone (domain, app-store submission) per the SSO-deferral entry
  above; `0.1.0` is deliberately a low number for "first tracked release,"
  not a claim of feature-completeness.
