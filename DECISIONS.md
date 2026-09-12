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
- **Practice mode (Iteration 6) never writes back to SRS
  state, and starts from a blank map.** It exists so replaying a
  mastered map is still possible once nothing's due, without that
  session silently perturbing the real review schedule, and without
  implying you already "know" everything by pre-marking it discovered
  before you've actually re-tried it this round.
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
