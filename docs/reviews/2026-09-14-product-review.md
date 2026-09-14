# Geoclick v0.5.0 — independent product review

*Reviewed 14 September 2026. Version v0.5.0 (build `160840e`), web build at
https://zesty-centaur-40e7c5.netlify.app/ and a local dev copy of the same
commit. The reviewer had no part in building the product.*

---

## 1. Executive summary

Geoclick is a clean, well-engineered, honest little map trainer with one
genuinely good idea — per-place spaced repetition on subnational maps —
wrapped in a product that is not yet a game and not yet a destination.
It does what it says, it never crashes, it respects the player (no ads, no
account, no dark patterns), and after a full quiz round I believed the
"remembers what you know" claim. But the loop has no pull: there is
nothing to beat, nobody to beat, no variety in how a round unfolds, and
the content set (22 countries' first-level regions and big towns; no world
map, no capitals, no flags) skips the single thing every casual player
asks a geography app for first. It is, today, a strong portfolio piece
and a usable study tool for a narrow group; it is not yet something a
stranger would come back to on Tuesday.

| Dimension | Score | One-line justification |
|---|---|---|
| **Fun** | **4 / 10** | The drag-a-shape mechanic is satisfying for about one round; there's no timer, score to beat, streak, surprise, or social layer to make round two matter. |
| **Learning value** | **7 / 10** | Real SRS per place, "due" counts on the home page, practice mode that doesn't pollute the schedule — better pedagogy than any map-quiz site. Loses points for a review-round design that leaks answers by elimination (see §3). |
| **UX / usability** | **6 / 10** | Desktop: clear, forgiving, no blockers — every drag, mis-drop and small-target case I tried behaved. Phone: the map is fitted under the toolbar so northern regions start hidden, dense maps are unplayable without zooming, tap targets are under-sized, and the quiz is drag-only with no keyboard or screen-reader path. Spaced repetition is explained once (tutorial) and then shown only as "N to review". Full analysis in §4. |
| **Polish** | **7 / 10** | Consistent, calm, responsive, fully trilingual, with a real hands-on tutorial. Held back by prototype copy ("Pick a demo map"), no page titles/meta tags, an overlapping version badge, and an empty progress chip on the "Up to date!" screen. |
| **Content breadth** | **4 / 10** | 44 maps / ~1,400 targets is respectable for subnational regions, but no countries-of-the-world, no capitals, flags, rivers, or physical features — competitors offer 300–400+ quizzes. |
| **Market potential — as-is** | **2 / 10** | Unlisted, sideloaded, unsigned, on an anonymous subdomain with no title or description; nobody can find it, and phone users who do hit F1 immediately (§7.1). |
| **Market potential — fully productized** | **5 / 10** | With the launch work done, a real and defensible niche ("Anki for maps", §7.2a) at an estimated 5–30k MAU; an education second wave; a broad casual breakout is unlikely against Seterra/GeoGuessr and the daily-game crowd (§7.2b). |

---

## 2. What Geoclick is

A single-purpose web app (also wrapped as a Windows app via Tauri and an
Android APK via Capacitor) for learning where a country's regions and
biggest towns are. You pick one of 44 maps — Italy's regions, Germany's
states, Japan's prefectures, Brazil's 48 largest towns, and so on — and
use it in one of four ways: **Overview** (every name shown), **Explore**
(click to reveal a name), **Quiz** (drag name slips from a tray onto the
right shape or dot), and **Tour** (an automatic north-to-south fly-over).
The quiz is graded with an SM-2-style spaced-repetition scheduler: each
place has its own next-review date, the home page shows "N to review"
per map, and the quiz only asks what is due. Everything is stored on the
device; there is no account, no server, no ads, no price. The interface is
in English, German and Italian; place names stay in the local language.

It is explicitly a solo portfolio project at v0.5.0, and it reads like
one in the best sense — the documentation is exceptional, the decisions
are reasoned, and the engineering is careful (MapLibre + PMTiles vector
tiles, graph-coloured regions so neighbours never share a colour, a
tested SRS package).

---

## 3. Hands-on impressions

**What I actually did.** I read the full user manual and all 42
screenshots. I then ran the app locally at the v0.5.0 commit with a
scripted Chromium (Playwright) at 1280×800 with a mouse and at 390×844
with synthetic touch events (Pixel 7 profile): first-visit home page,
Italy — Regions overview and explore, a complete 20-region quiz round
(one correct drag, one deliberate wrong drag, three misses on Molise to
trigger a reveal, then the remaining 17), a reload to see the review
round, the home page afterwards, a perfect Netherlands round followed
by the "Up to date!" and practice flows, sea/mis-drops, small-region
and Ruhr-cluster drops at default zoom, the 110-province tray, the USA
tour, the tutorial through step 3 on desktop and steps 1–2 on the phone,
touch drags (correct, wrong, and four small states) on Germany — States,
a DOM/accessibility inspection (names, roles, focus order, font and
tap-target sizes), and keyboard input on a focused slip. I also fetched
the live Netlify site to check bundle composition and HTML metadata.
What I did **not** do: use a real touchscreen or a real screen reader,
run the Windows or Android builds, or test German/Italian beyond
reading the manual's screenshots. Pinch/double-tap gestures, the
Android back button, and app-shell behaviour are judged from the manual.

### First minutes

The home page loads in about 1.4 s locally and is immediately legible: a
title, three language pills, a tutorial pill, and a two-column alphabetical
list of countries. The first-visit nudge ("New here? A three-minute
tutorial shows you around.") is polite and dismissible. Two things
undercut it. The welcome line says **"Pick a demo map to explore."** — the
word *demo* tells a first-time visitor this isn't a real product, and
"explore" doesn't say what you'll do. And the live site ships **no
`<title>`, no meta description, and no Open Graph tags on any route**
(verified against `/`, `/map/italy-regions/quiz`,
`/map/germany-states/overview`): the browser tab shows the bare URL, a
shared link unfurls as nothing, and search engines have nothing to index.
For a product whose only distribution channel is a URL, that is the most
consequential small bug in the build.

The map screens are calm and readable: warm parchment background, six
muted region colours, a big orange "you are here" tab in the map bar. The
overview's hover-to-magnify labels are a nice touch. Explore is exactly as
described. The tour is pleasant for a minute and then dull — it is a
slideshow with a speed dial, and nothing invites you to interact.

### The quiz loop

The drag-and-drop is well done. The dragged slip follows the pointer as a
white label, the region under it lights blue, a correct drop turns the
region green and pins the name, a wrong drop flashes red and shakes the
slip. Drops on the sea or back on the tray are correctly treated as
"changed my mind". A whole 20-region round took my script about 12 s of
pure input; a human would take two to four minutes. The end-of-round
panel ("Done! 18 / 20 placed correctly on the first try. 4 total
mistakes. 1 revealed after too many misses.") is accurate and the "Play
again" button correctly only appeared because Molise was still due.

Three design problems surfaced while playing, none of them bugs:

1. **The review round gives the answer away.** After finishing, I reloaded
   the quiz. It opened at "19 / 20 placed" with 19 regions already green
   and labelled, and one slip — Molise — in the tray. There is exactly one
   un-green region on the map. The "review" is a formality; I could not
   have got it wrong. The same applies whenever only a few places are
   due: the non-due regions are pre-labelled, so the due ones are solvable
   by elimination. This inflates SRS grades exactly when the scheduler
   most needs an honest signal (the places you struggled with). Seterra
   and Lizard Point avoid this trivially because every round is the full
   set. The fix isn't hard (leave non-due regions unlabelled and
   unhighlighted in review rounds, or pad the round with a few
   non-due "distractor" slips that are graded but not rescheduled), but as
   shipped, the headline feature is partly self-defeating.
2. **Every round is the same round.** The tray is alphabetical, the map
   is the same, and there's no randomisation of order, direction, or
   framing. A full practice round on a 16-state map is a matching
   exercise with a shrinking set of candidates; the last four are free.
   There's no "name this highlighted region" reverse direction, no
   typing, no "find X" prompt with a clock — the mechanics that make
   Seterra rounds feel like a test rather than a jigsaw.
3. **Nothing is at stake and nothing is compared.** The score panel
   reports numbers with no reference: no previous best, no time, no
   accuracy percentile, no streak, no "you've now mastered 14/20". The
   home card's "Last: 18/20 (4 mistakes)" is the only memory of a round,
   and it is overwritten.

Smaller things: the towns quiz progress line says "Drag each name onto
its **region**" on a towns map; the version badge overlaps MapLibre's ⓘ
credit at bottom-right on every map screen (visible in every screenshot,
including the manual's); and on the Italy provinces quiz, 110 slips fill
the bottom third of the screen while the map shrinks to a mosaic of
regions a few pixels wide — playable only after zooming, which the manual
acknowledges but the UI doesn't help with.

### The tutorial

Good. It is the real UI with a dimmed overlay and an outlined target, it
waits for you to do the thing (open the map, zoom, click a region, drop
Sicilia), and it explicitly sandboxes progress. Steps 1–3 behaved
exactly as documented. Eleven steps and three minutes is slightly long
for what is, at bottom, "drag names onto the map", but it does teach the
spaced-repetition idea, which is the one non-obvious concept. A full page
navigation ends it (documented), which will surprise phone users who
switch apps.

### Phone vs desktop

At 390×844 the layout holds, but the chrome is heavy: the five stacked
map-bar buttons, the map name chip, the progress line and the language
pills together take the top quarter of the screen before the map begins,
and the tray takes the bottom third. Germany — States is playable in the
remaining half. **Japan — Towns is not**: 66 dots cluster into
overlapping blobs along Honshū at the default zoom, and the target
you're aiming for is often under two or three others. Dropping requires
zooming first, every time. The towns maps in general are a weaker
learning format than the region maps — you are hitting a dot near a
coastline rather than recognising a shape, and the dots' colours carry no
information — but they are where roughly half the content lives.

### What holds up

The SRS actually works and is legible: after one round the home page
said "1 to review", the card said "Last: 18/20 (4 mistakes)", and the
localStorage keys were exactly the three the architecture doc describes.
No console errors beyond a WebGL driver warning. The map data is
thoughtfully curated (Crimea, overseas territories, non-canonical
Australian territories, Natural Earth duplicates — all handled and
documented). The trilingual UI is complete, not a veneer. It is a
trustworthy piece of software.

---

## 4. UX and usability, in depth

This section is deliberately the longest. Everything marked **[verified]**
was checked hands-on with a scripted Chromium at 1280×800 (mouse) and at
390×844 with touch events (Pixel 7 profile); **[manual]** means judged
from the user manual and its screenshots only. Where I compare with
Seterra I mean the current GeoGuessr-hosted web version
([geoguessr.com/vgp/3007](https://www.geoguessr.com/vgp/3007)) and the
Seterra app.

### 4.1 First-run experience

**Can a new player understand what to do in the first minute without the
tutorial?** Mostly yes on desktop, less so on a phone.

- The home page is a list of country names with "Regions" / "Towns"
  rows and a star. A player will click a country row. That lands on the
  **Overview**, which shows every name and nothing to do — there is no
  "Start quiz" call to action on the landing view. The four modes are
  small tabs at the top-left; "Quiz" is the third of five buttons, not
  highlighted, not explained. A player who came for a game may take
  10–20 seconds to find it. Seterra lands you *in* the quiz with a
  "click on X" prompt at the top; Lizard Point does the same. Geoclick
  lands you in the answer key. **[verified]** (The DECISIONS log says
  landing on Overview was requested on purpose; the cost is a missing
  "play" affordance.)
- Once in the quiz, the progress line says "Drag each name onto its
  region — 0 / 20 placed" and the tray of names is visible. That is
  enough instruction: I believe most people work out the drag without
  help. **[verified]** The instruction is 12 px grey text in a chip,
  though (measured), which is easy to miss.
- The **tutorial offer** ("New here? A three-minute tutorial shows you
  around.") is clear, non-modal, and dismissible in one tap; the offer
  never nags again. Good. **[verified]** The tutorial itself is
  well-built (it waits for the real action; it sandboxes progress; on a
  phone the card sits at the bottom and the target card is scrolled
  into view — **[verified]** at 390×844, steps 1–2). Where it gets in
  the way: eleven steps is long for a one-mechanic app; steps 3, 8, 9
  and 10 are "press Next" or "go back to X" filler; a first-time player
  who skips it learns nothing about spaced repetition, because that idea
  is only ever explained inside step 10. The tutorial ends on a full
  page reload, which on a phone means switching to another app and back
  can kill it (documented, but a surprise). **[manual]**
- "Pick a demo map to explore." is the only copy on the home page that
  says what the product is, and it says "demo". A one-sentence promise
  ("Learn where the regions and cities of 22 countries are — and
  remember them") is missing.

### 4.2 Navigation and information architecture

- **Home page.** 22 country headings × 2–3 rows, two columns on desktop,
  one on a phone. Alphabetical by English country name. It scans fine on
  desktop (about 1.5 screens) and is a long scroll on a phone (the
  Italy group is roughly six screens down). No search, no continent
  grouping, no "all regions maps" filter. The Favourites/Recent panel
  fixes this for returning players, but a new player on a phone hunting
  for "Spain" scrolls past 17 countries. **[verified]** (phone home
  screenshot). Card copy is terse to the point of ambiguity: "Towns"
  says nothing about *which* towns (the 100k threshold is only in the
  manual), and card lines like "Last: 17/20 (3 mistakes)" mix two
  different numbers (first-try correct vs total wrong drops) without a
  label.
- **Favourites / Recent.** Work as described, appear only when
  non-empty, star is consistent everywhere. **[verified]** on desktop.
  Fine.
- **The map bar.** Five equal buttons: ‹ Maps, Overview, Explore, Quiz,
  Tour. The active one is solid orange. The good: it is on every map
  screen, it is consistent, the URL changes per mode so back/forward and
  bookmarks work (**[verified]**: browser back from a quiz returned to
  the previous map). The less good: the four modes are presented as
  peers with icons (eye, compass, tick, play) that don't explain
  themselves, and there is no sense of a *sequence* (study → test) or
  of which one is the game. "Overview" vs "Explore" is the confusing
  pair — both are "look at the map", one with names and one without;
  the names don't say which is which. A label like "Names on / Names
  off" or a two-state toggle would be clearer than two nouns. The Tour
  is the odd one out (passive) and is given the same weight as Quiz.
- **Where am I / what map is this.** The map name is a 12 px grey chip
  under the bar ("Italy — Regions"), easy to overlook; on the home
  page, the same map is called "Regions" under an "Italy" heading. Minor
  but it adds up.

### 4.3 The core quiz interaction

- **Drag from the tray.** Mouse and touch both work; touch drag does
  not scroll the page and does not pan the map. **[verified]** at
  390×844 with synthetic touch events: Bayern placed, Berlin-on-Bayern
  correctly rejected. The slip follows the pointer; the region under
  the pointer lights blue. Seterra's click-where-X-is is one action per
  target; Geoclick's is press-drag-release, roughly three times the
  motor cost per target, which matters on a 110-item map. That is the
  price of the tactile mechanic.
- **Hit targets.** Every small region I tried landed at the default
  zoom on both desktop and phone: Valle d'Aosta, Molise, Liguria
  (desktop); Berlin, Bremen, Hamburg, Saarland (phone). **[verified]**
  The 24 px tolerance does its job. On the Germany towns map the Ruhr
  cluster (Dortmund/Essen/Duisburg are 14 px apart on screen at
  1280×800) also accepted all three drops on their exact centroids
  **[verified]** — but a human doesn't drop on a centroid, and the
  "closest dot wins" rule means a 10 px miss becomes a wrong answer
  with a red flash on a neighbour you didn't mean. Dense towns maps
  (Japan 66, Ruhr, Randstad) need auto-zoom or grouping.
- **Feedback.** Right = green fill + pinned label + slip leaves the
  tray. Wrong = brief red flash on the region you hit, slip shakes and
  turns red in the tray. Revealed after three misses = gold-brown fill
  and brown label. All three are distinct and immediate.
  **[verified]** Two gaps: nothing tells you *how many misses you have
  left* on a slip (the third miss surprises with a reveal), and the
  red flash is on the *wrong* region, which is correct semantically but
  gives no hint toward the right one. Seterra's approach — show the
  correct location after a miss, in a contrasting colour — teaches
  faster.
- **Mis-drops.** Dropping on the sea, off the map, or back on the tray
  is a no-op, not an error. **[verified]** (sea drop: counter unchanged,
  slip not marked red). This is well-judged; it is also unexplained in
  the UI, so a player who lets go over the Adriatic sees the name snap
  back and doesn't know whether that counted.
- **The tray on small screens.** At 390×844 the tray occupies the
  bottom 30 % (measured 253 px), slips are 35 px tall (fine for touch),
  and it scrolls for long lists. The resize handle is a 40×4 px grey
  bar — visually a decoration, not an obvious control — and I would not
  expect anyone to discover it without the manual. **[verified]**
  measured. On Italy — Provinces the tray shows ~20 of 110 names; the
  rest are two or three scrolls away, and the alphabetical order means
  finding "Vibo Valentia" is a scroll to the bottom every time.
- **The progress line.** "Drag each name onto its region — 5 / 20
  placed", 12 px, in a chip under the map name, not an ARIA live region
  (measured). Understandable, but it counts *placed* (including
  revealed) rather than *known*, so "20 / 20 placed" can hide three
  reveals until the score panel. On towns maps it still says "region".
  When nothing is due, the chip renders empty (a blank white pill under
  the map name on the "Up to date!" screen). **[verified]**
- **The score panel.** "Done! 18 / 20 placed correctly on the first
  try. 4 total mistakes. 1 revealed after too many misses." Accurate and
  plain. It lacks any reference point (previous result, best, time) and
  any *next step* besides "Play again"/"Back to maps". The ×-to-dismiss
  and "look at the finished map" behaviour is good. **[verified]**
- **Is spaced repetition understandable to a normal player?** Partly.
  "8 to review" on a card is clear enough as a to-do count. "No reviews
  needed" is clear. What is *not* clear without the manual: why the
  quiz sometimes opens with 12 of 20 already green (a review round);
  why "Play again" sometimes isn't there; what "Practice all regions"
  changes (nothing — but the panel has to say so in a footnote); and
  why a place you got right yesterday is back today. The first time a
  player opens a quiz and finds most of it already solved, they will
  think it's a bug or a saved game, not a schedule. One line of copy on
  the review round ("Reviewing 8 regions due today — the rest are
  already known") would fix most of this. **[verified]** that the
  review round shows no such explanation. The deeper problem — that a
  review round with one due region is solvable by elimination — is in
  §3.
- **"Up to date!" / practice / review-round logic.** The states are
  correct and consistent: full round → "All caught up! Next review in
  1 day." → reopening gives "Up to date! … Practice all regions" →
  practice shows "Practice mode —" in the progress line. **[verified]**
  on Netherlands — Regions. The logic is sound; the labelling assumes
  the player already knows what "review" and "practice" mean here.

### 4.4 Phone / touch vs desktop

- **Chrome density.** At 390×844 the map bar (80 px tall), map-name
  chip, progress chip and language/tutorial pills stack to about 330 px
  of overlays at the top; the tray takes 253 px at the bottom. The
  fully unobstructed map is roughly 270 px tall — a third of the screen.
  **[verified]** measured.
- **The map is fitted to the whole canvas, not to the visible part.**
  Consequence, seen on every phone quiz I opened: on Germany — States,
  Schleswig-Holstein and Hamburg start *under* the map-bar buttons and
  the map-name chip; on Italy — Provinces the progress line sits over
  Piedmont and Lombardy while a third of the map area below Sicily is
  empty parchment. Northern targets are hidden on first paint, and the
  first thing a phone player must do is pan. **[verified]** (screenshots
  at 390×844). This is the single most damaging phone defect, and it is
  a padding parameter in the fit call.
- **Thumb reach.** The tray is at the bottom (good); the map bar,
  zoom buttons, language pills and star are all at the top (bad for
  one-handed use). Zooming during a quiz means reaching to the top-right
  29×29 px buttons or pinching over a map that also accepts drops.
- **Tap targets.** Language pills 32×22 px, Tutorial 76×22, star 28×28,
  zoom buttons 29×29, tray handle 40×4. All below the 44–48 px
  guideline (Apple HIG / Material). Slips at 35 px tall are acceptable;
  the map-bar buttons at ~80 px are generous. **[verified]** measured.
- **Crowded labels.** On the phone Overview of Italy — Regions, labels
  collide (Trentino-Alto Adige over Friuli-Venezia Giulia, Valle
  d'Aosta over Piemonte, Campania/Basilicata/Puglia stacked). The
  tap-to-magnify helps once you know it exists. **[verified]**
  screenshot. Towns maps are worse: Japan's 66 dots overlap into blobs
  along Honshū at the default zoom. **[verified]**
- **Gestures.** One-finger pan, pinch zoom, drag-from-tray, tap-to-
  magnify all coexist without documented conflicts; my synthetic touch
  drags never panned the map or scrolled the page. **[verified]** for
  drag; pinch and double-tap **[manual]**.
- **Readability.** Slip text is 14.4 px, chips 12 px, body 16 px. On a
  phone the 12 px chips are small but legible; the version badge is
  noise. Labels on the map (white on dark green, ~65 % opacity pill)
  read well against every palette colour. **[verified]** by inspection.
- **Desktop.** No comparable problems: the fit leaves the map clear of
  the bar, the tray is 22 vh, everything is reachable, and a full round
  is comfortable with a mouse. Desktop is the platform this UI was
  designed on and it shows.

### 4.5 Visual design, readability, consistency

- **Palette.** Six muted fills, graph-coloured so neighbours differ;
  green = placed, red = wrong, gold-brown = revealed, deep blue = hover.
  Coherent and calm; the parchment background is a good call. The
  hover blue is clearly visible on every fill I checked. The solved
  green is visibly different from every unsolved fill (the DECISIONS
  log records a ΔE check). **[verified]** by inspection.
- **Labels.** One label style everywhere (white on dark green pill);
  consistent across Overview, Explore, Quiz and Tour. On dense maps at
  phone size they overlap; the app has no collision handling because it
  deliberately uses DOM popups instead of MapLibre's symbol layer.
- **Typography.** A system sans, three sizes (16/14.4/12). Fine, if
  small at the 12 px tier. Headings on the home page are clear.
- **Cards and placement.** The score panel and "Up to date!" panel are
  centred modals over the map — fine. Tutorial cards sit top or bottom
  depending on the step, correctly avoiding the tray. The dimmed
  overlay with an orange outline is effective and never blocks
  interaction. **[verified]**
- **Consistency lapses.** Version badge overlapping the MapLibre ⓘ on
  every map screen; the empty progress chip on "Up to date!"; "region"
  wording on towns maps; "Italy — Regions" in the chip vs "Regions"
  under "Italy" on the home page; country names always in English even
  in the German/Italian UI ("Italy — Regionen"). Small, but a
  usability-sensitive owner will want them gone.

### 4.6 Accessibility

- **Keyboard.** The quiz is drag-only. Slips are `<button>` elements
  that receive focus, but Enter, Space and arrow keys do nothing
  (**[verified]**: focused a slip, pressed all three, counter
  unchanged). The manual states this openly. Explore is click-only on a
  WebGL canvas. So the two interactive modes are unusable without a
  pointer. Seterra's web quiz is also click-on-canvas, but its "Type"
  mode is keyboard-native; JetPunk and Sporcle are keyboard-first.
  A keyboard path for Geoclick exists cheaply: focus a slip, press
  Enter, then Tab/arrow through regions (they are features in a vector
  layer, so the app already knows them) and Enter to drop.
- **Screen readers.** Positive: `lang="en"` set, one `<main>`
  landmark, an H1 and H3 outline, every button and link has an
  accessible name (95 interactive elements, 0 unnamed), language pills
  use `aria-pressed`, the tray handle is a proper `role="slider"` with
  a label, the canvas has `role="region" aria-label="Map"`.
  **[verified]** by DOM inspection. Negative: slips have no role or
  label beyond their text, so a screen reader hears "Abruzzo, button"
  with no hint of what to do; the progress line is not `aria-live`;
  right/wrong feedback is purely visual (no announcement); the map's
  regions are invisible to assistive tech. Net: navigable, not playable.
- **Colour-blindness.** Right/wrong is green vs red — the classic
  deuteranopia pair — but each has a redundant cue: correct adds a
  label and removes the slip; wrong shakes the slip and reddens its
  text; revealed adds a label in a different (brown) pill. So the
  states are distinguishable without colour, if not at a glance. The
  six-colour categorical palette includes pink and salmon next to the
  transient red flash, which will reduce the flash's visibility for
  some users. Acceptable, not excellent.
- **Text size.** No in-app setting (the planned Normal/Large switch was
  replaced by magnify-on-hover/tap). Browser zoom works on the chrome
  but not on map labels, which are fixed pixel sizes. 12 px UI text
  fails most readability guidance for older users.
- **Motion.** The tour auto-plays on open, and there is no
  `prefers-reduced-motion` handling I could find for the fly-to
  animations. **[verified]** by inspection, low confidence.

### 4.7 Friction points, ranked

| # | Severity | Where | What happens | Verified | Concrete fix |
|---|---|---|---|---|---|
| F1 | **Blocker (phone)** | Every quiz/overview on a phone | Map is fitted to the full canvas; the top ~330 px of overlays hide the northernmost regions (Schleswig-Holstein, Hamburg on Germany; Piedmont/Lombardy on Italy provinces). First action must be a pan. | Yes, 390×844 | Pass top/bottom padding to `fitBounds` equal to the measured overlay heights; or collapse the chips into the map bar on narrow screens. |
| F2 | **Blocker (phone, dense maps)** | Japan/Germany towns, Italy provinces on a phone | Targets overlap into blobs; dropping on the intended one is guesswork without zooming. | Yes | Auto-zoom to the bounding box of *unplaced* targets after each drop, or split dense maps into regional sub-rounds; on towns maps, enlarge the hit ring for the hovered dot and show its region outline. |
| F3 | **Major** | Review rounds | Non-due regions are pre-labelled green, so the due ones are solvable by elimination; with one due region the "review" is automatic. Inflates SRS grades. | Yes | Show non-due regions unlabelled and neutral during a review round; or add graded-but-unscheduled distractor slips. |
| F4 | **Major** | Review round, first encounter | Quiz opens at "12 / 20 placed" with no explanation; reads as a bug or a saved game. | Yes | One line above the tray: "Reviewing 8 regions due today — the other 12 are already known." Link "why?" to a short explainer. |
| F5 | **Major** | Landing on Overview | No visible "Start quiz" call to action; the game is a small unhighlighted tab. | Yes | Add a primary "Start quiz" button on the Overview (and on the home card), or land in the quiz with a "Show names" toggle. |
| F6 | **Major** | Quiz, keyboard/AT users | Drag-only; no keyboard or screen-reader path to play. | Yes | Enter on a focused slip enters "placing" mode; arrow/Tab cycles regions with an announced name; Enter drops. |
| F7 | **Major** | Phone home page | 22 countries in one column; a target country can be six screens down. | Yes | Sticky letter index or continent tabs; or a compact "country chip" grid at the top. |
| F8 | **Moderate** | Tap targets | Language pills 32×22, star 28×28, zoom 29×29, tray handle 40×4. | Yes, measured | Minimum 44×44 hit areas (padding, not necessarily larger glyphs); a visible grip on the tray handle. |
| F9 | **Moderate** | Wrong drop | No miss counter; the third miss reveals without warning. Flash is on the wrong region, no hint toward the right one. | Yes | Show "2 tries left" on the slip after a miss; on the third, briefly pulse the correct region before revealing. |
| F10 | **Moderate** | Overview vs Explore | Two nouns for "names on" / "names off"; icons don't explain. | Judged | Rename to "Study" and "Test yourself", or make names a toggle inside one view. |
| F11 | **Moderate** | Score panel / cards | Numbers with no reference (no best, no previous, no time); "Last: 17/20 (3 mistakes)" mixes two metrics unlabelled. | Yes | Add "Best: 19/20" and a mastery count; label the numbers. |
| F12 | **Minor** | Every map screen | Version badge overlaps MapLibre ⓘ. | Yes | Move the badge to the home page footer, or offset it. |
| F13 | **Minor** | "Up to date!" screen | Empty progress chip renders under the map name. | Yes | Hide the chip when there is no text. |
| F14 | **Minor** | Towns quizzes | "Drag each name onto its region." | Yes | "…onto its town." |
| F15 | **Minor** | Home page | "Pick a demo map to explore." | Yes | Replace with a product promise; drop "demo". |
| F16 | **Minor** | Tray | Alphabetical order on a 110-name list means a scroll per name; also makes every round identical. | Yes | Shuffle by default; add a "sort A–Z" toggle. |
| F17 | **Minor** | Tutorial | Eleven steps, four of them filler; a reload ends it. | Steps 1–3 verified, rest manual | Cut to ~7 steps; persist the step so a reload resumes. |

### 4.8 UX compared with the competition

Seterra's web quiz is uglier and busier (ads, GeoGuessr chrome, login
prompts), but its core loop has three UX properties Geoclick lacks: a
persistent instruction ("Click on: Lombardy"), immediate corrective
feedback (the right answer is shown after a miss), and an end screen
with a percentage and time you can compare with your last try. Lizard
Point is plain HTML but keyboard-friendly and gives a strike count.
JetPunk and Sporcle are typing games with a clock — different feel,
higher tension. Stack the States is the model for touch: big targets,
one action per question, constant reward. Geoclick's drag mechanic is
the most *pleasant* of the group on a desktop and the most
*demanding* on a phone, and its calm visual design is the best of the
group. Its UX weakness is not the mechanic; it is everything around
the mechanic — orientation, explanation, feedback that teaches, and the
phone fit.

---

## 5. Competitive landscape

| Product | Audience | Core mechanic | Content | Platforms | Price / model | What makes it sticky |
|---|---|---|---|---|---|---|
| **Geoclick v0.5.0** | Self-directed learners | Drag name slips onto shapes/dots; SRS schedules reviews | 44 maps, 22 countries, first-level regions + 100k+ towns; no world map | Web, Windows (unsigned), Android APK (sideload) | Free, no ads, no account | Due-count on home page; favourites |
| **Seterra** (GeoGuessr) | Students, teachers, enthusiasts; since 1997 | "Click X" on a map, timed and graded; Pin and Type modes; learn mode | 400+ quizzes: countries, capitals, flags, oceans, physical features, many subnational sets; 40+ languages | Web; iOS/Android app | Web free with login for high scores; "Learn" locked behind upgrade; app free, offline, no ads/IAP | Time + accuracy score, high scores per quiz, leaderboards, huge catalogue |
| **Lizard Point** | Schools, teachers, self-learners | Click-the-map quizzes, strikes; study mode | 350+ geography quizzes incl. countries, US states, provinces, capitals, flags; custom quizzes; printable maps | Web | Free with ads; donations; free accounts save scores | Progress tracking, teacher section, custom quizzes |
| **JetPunk** | Quiz enthusiasts ("geography nerds") | Timed type-the-answers; click-map quizzes; 3-mistake rules on some | Reported 20,000+ geography quizzes incl. user-made click maps (page blocked my fetch; count unverified) | Web | Free with ads; accounts and badges | Timer, badges, user-generated content, huge variety |
| **Sporcle** | Trivia crowd | Timed type/click quizzes | Thousands of geography quizzes, clickable maps | Web, apps | Free with ads; Sporcle Orange $4/mo or $44/yr ad-free | Timer, stats, playlists, badges |
| **Worldle / Globle / Travle** | Casual daily players | One puzzle a day; distance/direction hints; share result | Countries of the world (one per day) | Web, apps | Free (ads on some) | Daily ritual, share-to-social, streaks |
| **GeoGuessr** (proper) | Casual + competitive | Street-view location guessing; duels, battle royale | Whole world | Web, apps, Steam | Free tier = 5-location daily challenge; Pro Unlimited $3.99/mo yearly or $6.99 monthly since Jan 2026 | Multiplayer, ranked play, streamers, World Championship |
| **Anki + Ultimate Geography deck** | Serious memorisers | Flashcards (map→country, flag→country, capital↔country) with FSRS/SM-2 | 205 sovereign states, 978 cards, 15 languages; **no subnational regions** | Anki (desktop free, iOS paid, Android free) | Free deck (open source) | Real SRS; but no interactive map |
| **Stack the States / Stack the Countries** | Kids 8–12, families | Answer questions to earn states, then stack them (physics); "Map It" tap-the-location | US states / world countries: capitals, shapes, flags, landmarks | iOS, Android, Amazon | $2.99 one-off, no ads/IAP, 6 family profiles | Juicy game feel, unlockables, progress map |
| **Play-Store "World Map Quiz"-type apps** (StudyGe, World Geography Quiz Game, etc.) | Casual mobile | Multiple choice / tap-the-country; tournaments | Countries, capitals, flags, some US states; 6,000+ questions in some | Android/iOS | Free with ads + premium unlock | Global rankings, multiplayer, daily quests |

Sources: Seterra overview ([geoguessr.com/quiz/seterra](https://www.geoguessr.com/quiz/seterra)) and a live quiz page showing Pin/Type modes, "Log in to save your results" and a locked "Learn" mode ([geoguessr.com/vgp/3007](https://www.geoguessr.com/vgp/3007)); Seterra iOS app listing — free, 4.8★ on ~17,000 ratings, 300+ quizzes, offline, no ads/IAP, leaderboards ([apps.apple.com](https://apps.apple.com/us/app/seterra-geography-full/id1093460065)); GeoGuessr 2026 price change ([geoguessr.support](https://www.geoguessr.support/support/solutions/articles/206000067275-price-changes-2026)); Lizard Point ([lizardpoint.com/geography](https://lizardpoint.com/geography/)); JetPunk map-quiz tag ([jetpunk.com/tags/fill-in-the-map](https://www.jetpunk.com/tags/fill-in-the-map)) and click-map series ([jetpunk.com/series/176412](https://www.jetpunk.com/series/176412/click-map-quizzes)); Sporcle Orange pricing ([sporcle.com/memberships](https://www.sporcle.com/memberships/)); Ultimate Geography deck ([github.com/anki-geo/ultimate-geography](https://github.com/anki-geo/ultimate-geography)); Stack the States review with price ([educationalappstore.com](https://www.educationalappstore.com/app/stack-the-states)); Stack the Countries ([play.google.com](https://play.google.com/store/apps/details?id=com.freecloud.StackTheCountries)); Worldle/Globle comparison ([earthguessr.com](https://www.earthguessr.com/blog/worldle-vs-globle-vs-travle-daily-geography-games)). *Unverified:* the "Seterra Android app is free with ads" claim appears in third-party blogs but not on the store page I could read; JetPunk's "20,000+ geography quizzes" comes from a search snippet; GeoGuessr's "100 million players" is a marketing figure from a lead-gen site.

### Where Geoclick is ahead

- **Spaced repetition on an interactive map.** Nobody in the table does
  this. Seterra's "Learn" mode is a study view, not a scheduler; Lizard
  Point tracks scores, not memory; the Anki deck has real SRS but no
  interactive map and no subnational content. This is a real gap and
  Geoclick sits in it alone. Whether users *care* is the open question —
  most map-quiz players want a score, not a schedule — but for anyone
  who has ever used Anki, it is an instant "oh, finally".
- **Drag-the-name-to-the-shape.** Seterra, Lizard Point and JetPunk all
  do "click the map where X is"; Geoclick inverts it so you see all the
  names and choose a shape for each. It feels more tactile and it
  suits touch. It is not obviously *better* pedagogically (both are
  recognition tasks), but it is distinctive.
- **No ads, no account, no upsell, offline apps.** Seterra's web
  version now asks you to log in for high scores and upgrades for Learn
  mode; Lizard Point, JetPunk and Sporcle are ad-funded. Geoclick's
  cleanliness is a genuine plus for parents and teachers — but the
  Seterra app already offers free, offline, ad-free, which blunts it.
- **Local-language names and a genuinely trilingual UI.** Small, but
  done properly.
- **Curation quality.** Region sets are the ones locals would recognise
  (Crimea handled with a stated rationale, overseas départements
  excluded, Australia's canonical 8). Most Play-Store apps are sloppier.

### Where it is on par

- Visual quality and responsiveness are at or above Seterra's web UI.
- Subnational coverage (22 countries) is comparable to Lizard Point's
  and below Seterra's.

### Where it is behind

- **No world / continent / countries map.** This is the entry point for
  99% of geography-game users and every competitor has it. A new
  visitor who wants "countries of Europe" leaves.
- **No capitals, flags, rivers, mountains, physical features.** Seterra
  has 400+ quizzes; Geoclick has one question type.
- **No timer, no score to beat, no leaderboards, no badges, no
  share-to-social.** Every incumbent has at least two of these.
- **No daily hook.** Worldle-style games proved a daily ritual plus a
  shareable result is the cheapest retention mechanic in the genre.
- **No custom quizzes / no map editor.** Lizard Point and Seterra both
  let teachers and users assemble their own sets.
- **Distribution.** Not in any store, unsigned Windows installer with a
  SmartScreen warning, anonymous Netlify subdomain, no metadata. It
  cannot be found, and even when found it looks unfinished.

---

## 6. Fun value

**Is it fun?** For one round, mildly. The first drag that lands green is
satisfying; the wrong-drop shake is good feedback; the three-miss reveal
is a kind design. After that the loop has no gradient. The core loop is:
*open map → drag N names → read a number → leave*. The "come back
tomorrow" hook is a single orange line ("8 to review") on a card.

**For whom?** The person who enjoys it is someone who *already wants* to
know Japan's prefectures — an exam candidate, a language learner, an
expat, a quiz-league regular, an Anki user. They will value the SRS and
tolerate the flatness. A casual player who arrives from a "fun geography
game" search will not find a hook in the first two minutes.

**What's missing for "one more round":**

- *A goal.* No mastery indicator per map (e.g. "14/20 mastered", a
  progress ring), no per-country completion, no "you've learned 312
  places". The SRS state exists; it just isn't surfaced as an
  achievement.
- *A clock or a score to beat.* Time-to-complete and best-ever-accuracy
  are the two numbers every map quiz shows. Their absence is deliberate
  (learning, not racing) but it removes the cheapest source of tension.
  A per-map personal best would cost almost nothing.
- *A streak.* Days in a row with reviews done. Duolingo's most copied
  mechanic for a reason; it maps directly onto SRS's "do your reviews
  today".
- *Variety.* Reverse direction ("what is the highlighted region?" with
  typing or multiple choice), a "find X" prompt with a countdown,
  border-only or unlabelled-neighbour hard modes, random tray order.
  Right now every round of a given map is the same round.
- *Surprise.* No sound, no confetti, no particle on a green drop, no
  little fact when a region is placed ("Molise — Italy's second-smallest
  region"). The roadmap's own "motion/feedback design" item is exactly
  this and it is still open.
- *Social.* No share card, no comparison, no classroom code. Nothing
  leaves the device, which also means nothing brings anyone else in.

---

## 7. Potential

### 7.1 Potential as-is

Today Geoclick would not find users, and that has little to do with its
quality. It lives on an anonymous Netlify subdomain with no page title,
no description and no social preview; its apps are a sideloaded APK and
an unsigned installer that Windows warns against; nothing on the home
page says what it is; there is no world map for a first-time visitor to
recognise; and the phone experience starts with half the regions hidden
under the toolbar (§4.7, F1). Anyone who arrives does so by personal
link. Of those who arrive, desktop users will get a pleasant round and
leave with no reason to return; phone users will fight the layout. The
spaced-repetition idea — the one thing worth returning for — is
invisible until the second visit. As-is, the realistic audience is the
owner's friends, a handful of Reddit clicks, and portfolio reviewers.

### 7.2 Potential if fully productized

Assume the owner does the launch work: domain and name, store listings
on Google Play / App Store / Microsoft Store with signed installers,
SSO accounts with cross-device sync (the parked Supabase branch),
leaderboards or social features, more content, a privacy policy, and
actual marketing. What could it become? Three paths, judged separately.

#### Reference points for sizing

- Seterra's Android app has about **2.4 million** cumulative downloads
  ([AppBrain](https://www.appbrain.com/app/seterra-geography/com.seterra))
  and its iOS app 4.8★ on ~17,000 ratings
  ([App Store](https://apps.apple.com/us/app/seterra-geography-full/id1093460065));
  the web quiz has run since 1997 in 40+ languages
  ([Seterra](https://www.geoguessr.com/quiz/seterra)). This is the
  ceiling for a *map-quiz* product with 25 years of SEO.
- The Globle/Worldle/Flagle bundle app has about **560,000** downloads
  and ~500/day ([AppBrain](https://www.appbrain.com/app/globle-guess-the-country/com.globle.app214867));
  Worldle's web version reportedly drew 500,000 players in a single day
  at its Feb 2022 peak (secondary sources; unverified). This is the
  ceiling for a *daily-puzzle* geography game riding a fad.
- GeoGuessr grew from 10M users (2019) to 80M+ (2024) on a subscription
  model after dropping its free tier ([Dealroom](https://app.dealroom.co/companies/geoguessr));
  Pro Unlimited is $47.88/year since Jan 2026
  ([GeoGuessr support](https://www.geoguessr.support/support/solutions/articles/206000067275-price-changes-2026)).
  Not a comparable — a different game — but it proves people pay for
  geography.
- Stack the States sells at $2.99 one-off, no ads, and has sustained a
  one-person studio for over a decade
  ([Educational App Store](https://www.educationalappstore.com/app/stack-the-states)).
  This is the model for a *paid educational* app.
- Community reach: r/geography has ~1.64M members
  ([reddapi](https://reddapi.dev/subreddits/geography/insights));
  Geography Now has ~3.9M YouTube subscribers
  ([Social Blade](https://socialblade.com/youtube/handle/geographynow)).
  Large, reachable, and already served by free tools.

#### (a) Enthusiasts and deliberate learners — "Anki for maps"

**Position it could reach.** The default tool for *retaining*
subnational geography, sitting between Seterra (broad, quiz-only, no
scheduler) and Anki's Ultimate Geography (real SRS, no interactive map,
countries only — [GitHub](https://github.com/anki-geo/ultimate-geography)).
Defensible differentiators, in order of strength: per-place SRS on a
real map (nobody has it); subnational depth (Seterra has some
subnational sets, but not scheduled and not offline-first); no ads, no
tracking, public-domain data (an active selling point on F-Droid and
r/Anki); trilingual, local-language names. Seterra could copy the
scheduler in a quarter if it wanted to; the defence is being first,
open, and deeper (provinces, districts, counties) where a mass product
won't go.

**Ceiling.** Order of magnitude: **5,000–30,000 monthly active users**
after two years, of whom a few thousand daily. Reasoning: the Anki
geography deck has been downloaded by tens of thousands over years
(AnkiWeb doesn't publish counts; the GitHub repo has thousands of stars
— unverified), the map-quiz app market tops out around Seterra's
2.4M cumulative installs for the *entire* category, and an SRS
trainer is a subset of a subset. Enough to sustain a hobby with a
small income; not a company.

**Business models.** Free and open source with donations (fits the
values, earns almost nothing); one-time purchase of the apps at €3–5
with the web free (Stack the States' model; realistic revenue in the
low thousands of euros per year at this audience); a "supporter"
unlock for sync and extra maps (€10–15/year). Ads would contradict the
positioning and should be off the table. Subscriptions don't fit a
product a learner "finishes".

**Launch work — necessary vs nice-to-have.**

| Item | Necessary? | Solo effort | Cost |
|---|---|---|---|
| UX fixes F1–F5 (§4.7) | **Yes, before anything else** | 1–2 weeks | — |
| Domain, name, page titles/meta/OG, one landing page | Yes | 2–3 days | ~€15/yr |
| World + continent country maps | Yes (the on-ramp) | 1 week (pipeline exists) | — |
| Google Play listing (signed AAB, screenshots, data-safety form) | Yes | 3–5 days | $25 once |
| Privacy policy / GDPR page (trivial while nothing leaves the device) | Yes | 1 day | — |
| Signed Windows installer | Yes for Windows | 2–3 days | Azure Trusted Signing ~$10/mo ([Melatonin](https://melatonin.dev/blog/code-signing-on-windows-with-azure-trusted-signing/)) or an OV cert from ~$99/yr |
| F-Droid listing (requires open source) | Strongly recommended for this niche | 2–4 days | — |
| Progress export/import | Yes (sync substitute) | 2–3 days | — |
| Reverse/typed recall mode | Yes for "learners" | 1–2 weeks | — |
| SSO + cross-device sync (Supabase branch) | Nice-to-have at first; needed by month 6 | 2–3 weeks + ongoing | Supabase free tier, then ~$25/mo |
| Apple App Store (needs a Mac, Xcode, iOS shell) | Nice-to-have; iPhone users are a large share of this audience | 3–4 weeks incl. hardware | $99/yr + Mac |
| Microsoft Store | Nice-to-have | 2 days | $19 once |
| Analytics | Minimal, privacy-respecting page counts only (Plausible/Umami) | 1 day | €0–9/mo |
| Marketing: r/geography, r/Anki, r/GeoGuessr, Hacker News "Show HN", F-Droid new-apps, 2–3 geography YouTubers/TikTokers with a review key | Yes; this is the whole acquisition plan | ongoing, ~2 days/month | — |

**Risks.** Discoverability (a one-person project has no SEO against a
1997-vintage incumbent; community posts give spikes, not a baseline);
Seterra copying the scheduler; content scale (enthusiasts will ask for
counties, districts, historical maps — every new admin level is a
pipeline decision and a data-licence check); retention (SRS reviews
taper to near-zero once maps are mastered, so the product must keep
adding maps or the user "graduates" and leaves — a good problem, but a
churn problem); maintenance (MapLibre, Tauri, Capacitor, SvelteKit all
move; three shells is a lot for one person).

#### (b) Broad casual public

**Position it could reach.** Honestly: one of many. The casual
geography audience is split between daily puzzles (Worldle/Globle:
one puzzle, share the grid, streak) and GeoGuessr's street-view
duels. Map quizzes are the *study* genre, and their casual share is
already taken by Seterra with GeoGuessr's distribution behind it. A
drag-the-names trainer with SRS is not a casual pitch. The only
novel casual angle the existing assets support is a **daily subnational
puzzle** ("Regionle": today's region silhouette — which country, which
region? — with distance hints and a share card). Nobody owns that; it
would inherit the Worldle audience's habits; and it needs no new data.
Defensible differentiator: subnational content at scale (44 maps,
1,400+ targets, growing) that the daily-game clones don't have.

**Ceiling.** With a daily mode and a share card that catches on:
**50,000–300,000 monthly players** at a peak, decaying fast unless the
puzzle keeps varying — the Globle app's 560k lifetime installs after
four years is the realistic top for a geography daily. Without a daily
mode, casual reach stays in the low thousands.

**Business models.** Daily games are ad-funded or free with a
"unlimited/archive" unlock (the Globle app sells an archive of 3,000+
puzzles). Ads would erase the "no ads" differentiator that the
enthusiast path relies on, so the two paths conflict here; an
"archive + unlimited practice" unlock at €2–4 is the compromise.
Subscriptions don't fit.

**Launch work.** Everything in the (a) table, plus: the daily mode
with a share card (2–3 weeks), a timed/scored challenge mode with
personal bests (1–2 weeks), sound and motion (1–2 weeks), server-side
"today's puzzle" and, later, leaderboards (needs the account/sync
layer; 3–4 weeks), an App Store presence (casual mobile skews iOS),
and a real marketing push (creator seeding, a launch-day Reddit/HN/
Product Hunt cycle, a TikTok-able clip). Roughly 3–4 months of solo
work on top of (a).

**Risks.** Fad decay (every Wordle-like has a half-life); the daily
mode is a different product from the trainer and dilutes the message;
leaderboards and social features bring moderation, abuse and GDPR
obligations a one-person project may not want; ads vs values; the
casual market punishes phone UX problems immediately, so F1/F2 are
existential here.

#### (c) Education — schools, teachers, homeschool

**Position it could reach.** A classroom-safe alternative to Seterra
and Lizard Point for *regional* geography in countries where the
curriculum includes learning one's own regions — which is exactly the
DACH/Italian/French/Spanish/Polish set the content already covers, in
a UI already available in German and Italian. Differentiators: no ads,
no accounts for minors, works offline on a school laptop, projector-
friendly Tour, a scheduler that tells a pupil what to revise. Lizard
Point has teacher pages, custom quizzes and printable maps
([lizardpoint.com](https://lizardpoint.com/geography/)); Seterra has
custom quizzes and a learn mode. Geoclick has none of the teacher-side
tooling yet.

**Ceiling.** Education is won school by school. A plausible outcome
with a couple of years of teacher-network work: **a few hundred
classrooms, 5,000–20,000 pupils per year**, concentrated in two or
three countries. That is the size of a successful free classroom tool,
not a business, unless licensed.

**Business models.** Free for pupils, always (ads and accounts for
minors are both non-starters in EU schools). Options: a paid teacher
tier (assignment links, class results, custom map sets; €30–60 per
teacher per year — realistic revenue in the low tens of thousands at
the ceiling); school or district licences (require sales effort, VAT,
invoices, DPAs — heavy for a solo developer); or free with a
"supporter" tier and grant funding. Per-pupil accounts would trigger
GDPR-K and parental-consent obligations; avoid them by keeping pupils
anonymous and letting the *teacher* hold the account.

**Launch work.** The (a) table, plus: assignment links (map + mode +
language pre-selected, 1 week), a pupil results card that can be
screenshotted or exported (3 days), teacher-facing custom sets
("just these 8 Länder", 2–3 weeks), printable blank maps (1 week),
a teacher landing page and a one-page data-protection statement (2
days), and outreach through teacher networks (German Lehrerforen,
Italian teacher Facebook groups, homeschool communities, Twinkl-style
resource sites). Homeschool parents are the easiest entry: they
already pay for Stack the States and buy one-off apps.

**Risks.** Procurement and privacy paperwork; the school year's rhythm
(one launch window per year); teachers need curriculum alignment
(which regions, which names — "Toscana" vs "Tuscany" matters in an
English classroom, and the aliases field is empty); support load
from non-technical users; Chromebooks and locked-down networks.

### 7.3 Recommended launch path

**Pursue (a) first, with (c) as the second wave; treat (b) as an
optional experiment (the daily mode) once (a) is stable.** The
reasoning: (a) is where the existing differentiator is decisive, it
costs the least, and everything it needs is also a precondition for
(c). (b) needs the most work, conflicts with the no-ads positioning,
and competes on the incumbents' strongest ground.

**Minimum launch steps, in order:**

1. UX fixes F1–F5 from §4.7 (phone fit, dense-map zoom, review-round
   leak and explanation, "Start quiz" affordance) and the polish items
   F12–F15. *Nothing goes public before this.*
2. Name, domain, page titles/meta/OG, a one-screen landing page with a
   real promise and three screenshots.
3. World and continent country maps.
4. Mastery count, best score, and a review streak on the home page.
5. Progress export/import.
6. Google Play listing (signed), signed Windows installer, F-Droid
   submission (implies open-sourcing — decide this deliberately).
7. Privacy page; minimal privacy-respecting analytics.
8. Launch posts: r/geography, r/Anki, Show HN, F-Droid; send keys to
   two or three geography creators.
9. Reverse/typed recall mode (first post-launch feature, driven by
   feedback).
10. SSO + sync (unpark the Supabase branch) once there are users on
    two devices asking for it — not before.
11. Teacher assignment links and results card → outreach to DACH/IT
    teacher networks (wave 2).

**What success looks like.**

| Horizon | Targets |
|---|---|
| **3 months** | Public under a real name; Play Store + signed Windows + F-Droid live; F1–F5 fixed; world map shipped; ≥1,000 unique visitors from launch posts; ≥300 app installs; ≥50 people with a 7-day review streak; a Play Store rating ≥4.3 on ≥20 ratings; zero "I didn't understand the review round" complaints in feedback. |
| **6 months** | 2,000–5,000 MAU across web and apps; ≥500 weekly-active; day-30 retention ≥15 % of installers; recall mode shipped; export/import in use; first unsolicited teacher enquiry; 10+ community-contributed map requests triaged into MAPS.md; sync decision made on evidence. |
| **12 months** | 5,000–15,000 MAU; 1,000+ DAU doing reviews; iOS shipped if the numbers justify a Mac; teacher tier or supporter unlock live with ≥100 paying users (≈€3–5k/year — enough to cover costs, not a salary); 60+ maps including a second admin level for 5+ countries; a daily-mode experiment measured against the trainer's retention. |

If the 3-month numbers are missed by an order of magnitude despite the
UX fixes and a competent launch, the honest reading is that the niche is
smaller than estimated, and the daily-puzzle experiment (b) becomes the
next test rather than more content.

---

## 8. Recommendations

Effort: S = a day or two, M = a week, L = several weeks. Audience:
**E** = enthusiasts/learners, **B** = broad public, **T** = teachers,
**All** = everyone.

### Quick wins (do before anything else)

Given that usability sank the earlier versions, the UX items (F1–F5 in
§4.7) come first, ahead of any new content or feature.

0. **Fit the map to the *visible* area on phones** (All, S; fixes F1).
   Pad the fit by the measured overlay heights so no region starts
   under the map bar. Also collapse the map-name / progress / language
   chips into one row, or into the bar, below 640 px.
1. **Ship page titles, meta description and Open Graph tags on every
   route** (All, S). The live site has none; the browser tab shows a
   URL. Also give the map routes a title like "Italy — Regions quiz ·
   Geoclick". Highest value per hour of anything on this list.
2. **Fix the review-round elimination leak and explain the review
   round** (E, S–M; fixes F3, F4). In a due-only round, leave non-due
   regions unlabelled and neutral (or fade them and drop their labels),
   so the due region is not the only un-green shape — or include 3–5
   non-due distractor slips that are graded but not rescheduled. Add
   one line above the tray: "Reviewing 8 regions due today."
   Without this, the SRS data is partly noise and the feature looks
   like a bug.
3. **Give the Overview a primary "Start quiz" button and replace "Pick
   a demo map to explore."** (All, S; fixes F5, F15) with a one-line
   promise: "Learn where the regions and cities of 22 countries are —
   and remember them." Drop "demo" everywhere it's user-visible.
4. **Fix the small consistency lapses** (All, S; F12–F14): version
   badge overlap, empty progress chip on "Up to date!", "onto its
   region" wording on towns maps.
5. **Shuffle the tray order by default** (E/B, S; F16), with
   alphabetical as an option. Alphabetical + fixed = every round
   identical.
6. **Show a per-map mastery number and best score on the card and
   score panel** (All, S; F11): "14 / 20 mastered", "Best: 19/20".
   The state already exists.
7. **Auto-zoom the quiz to fit the *unplaced* targets on big or dense
   maps** (All, S–M; F2), so Japan — Towns and Italy — Provinces on a
   phone don't start as an unplayable cluster.
7b. **Miss counter and corrective feedback** (All, S; F9): "2 tries
   left" on a slip after a miss; pulse the correct region before a
   reveal.
7c. **44 px minimum hit areas and a visible tray grip** (All, S; F8).

### Medium

8. **A countries-of-the-world map and per-continent country maps** (All,
   M). Natural Earth admin-0 is right there and the pipeline exists. This
   is the on-ramp for every audience; without it the app looks like it
   is missing the first chapter.
9. **A reverse mode: highlight a region, player picks/types the name**
   (E, M). Turns recognition into recall, doubles the variety, and gives
   the SRS a second, harder grade source. The DECISIONS log already
   defers exactly this.
10. **A daily streak tied to reviews** (E/B, S–M): "3 days in a row"
    on the home page, computed locally from review timestamps. No server
    needed.
11. **A timed "challenge" mode with a personal best** (B, M). Separate
    from the graded quiz so the learning loop stays calm; racing mode
    for people who want a number to beat.
11b. **A keyboard path through the quiz** (E/T, M; F6): Enter on a
    focused slip, arrows to cycle regions with the name announced,
    Enter to drop. Makes the game playable with assistive tech and is
    the only way a school with accessibility requirements can adopt it.
11c. **Phone home page navigation** (All, S–M; F7): a sticky A–Z
    index or continent tabs, and a compact country grid.
11d. **Rename Overview/Explore or merge them behind a "names" toggle**
    (All, S–M; F10), and cut the tutorial to ~7 steps with resume-on-
    reload (F17).
12. **Progress export/import as a file** (E/T, S–M). Solves cross-device
    without the deferred Supabase work, and lets pupils hand a result to
    a teacher. Cheap insurance against "I cleared my browser".
13. **Play Store listing, a real domain, signed Windows installer** (All,
    M — mostly admin). Sideloaded APKs and SmartScreen warnings cap
    distribution at people who already trust you.
14. **Light "juice"** (B, M): a short green pop and a subtle sound on a
    correct drop, a one-line fact on placement (population, capital),
    confetti on a perfect round. The roadmap's own open item.

### Big bets

15. **"Regionle" — a daily subnational puzzle with a shareable result**
    (B, L). One region silhouette a day, guess country then region, distance
    hints, a 5-square share grid. Nobody owns daily *subnational*
    geography; the data and rendering already exist; it is the only
    plausible viral surface this product has.
16. **Teacher assignment links and a projector mode** (T, M–L). A URL
    that opens a specific map, mode and language, plus an end-of-round
    "show this to your teacher" card. Pair with a short teacher page.
    Target DACH/Italian schools where the content already matches the
    curriculum.
17. **Capitals, flags and physical features as additional question
    types** (B/E, L). Needed to compete with Seterra's catalogue breadth;
    only worth it after 8–11 have proven people come back.
18. **Open-source it and go to F-Droid** (E, S admin, L in maintenance).
    "No ads, no tracking, public-domain data, real SRS" is a strong
    F-Droid pitch and the most likely place an enthusiast community forms
    around a one-person project.

### Where enthusiasts and the broad public diverge

- Enthusiasts want *rigour*: honest review rounds, recall modes, mastery
  stats, export, more countries at deeper levels (provinces, counties).
  Keep the calm, ad-free, no-timer graded quiz as their core.
- The broad public wants *tension and sharing*: timers, bests, streaks,
  daily puzzles, share cards, sound. Build those as **separate modes**
  beside the graded quiz rather than inside it, so neither audience is
  compromised. Do not put a timer on the SRS round.

---

## 9. Risks and open questions

- **Category gravity.** GeoGuessr owns Seterra and is pushing map
  quizzes into a paid ecosystem; if they add scheduling to Learn mode,
  Geoclick's single differentiator is gone. Speed to a public,
  discoverable version matters more than polish.
- **SRS may be the wrong frame for the mass market.** "N to review" is a
  chore signal, not a play signal. The enthusiast will love it; the
  casual player may read it as homework. Test the framing ("3 regions
  ready to play" vs "3 to review").
- **Towns maps are half the content and the weaker half.** Dot-hitting
  with 24–30 px tolerance teaches less than shape recognition and breaks
  down on dense clusters. Consider showing town *labels-as-targets* or
  region-context hints, or deprioritising towns in favour of a world map.
- **Device-only progress is both the privacy story and the churn
  story.** Cleared site data = everything gone; two devices = two
  strangers. Export/import (12) is the minimum; the parked sync branch
  becomes relevant the moment there's a domain and a store listing.
- **Distribution is currently zero.** No store, no domain, no SEO, no
  metadata, no social presence. Every recommendation above is moot if
  nobody can find it. Fix 1, 3 and 13 first.
- **Open question — what is it for?** The manual says "a game for
  learning geography"; the code says "a study tool"; the home page says
  "demo". Choosing between "Anki for maps" (niche, sustainable, aligned
  with what's built) and "a fun geography game" (broad, expensive,
  crowded) is the decision this review would push the owner to make now,
  because the next ten features differ depending on the answer.
- **Open question — Italy-first?** Three of the 44 maps are Italian
  (regions, 110 provinces, towns) and the tutorial is Italy. A deliberate
  "learn Italy properly" positioning (regions, provinces, comuni,
  DE/IT/EN UI) would be a narrower but far more defensible product than
  "22 countries, one level each".

---

*Method note: scores are the reviewer's judgement on a 1–10 scale where
5 is "adequate for a shipped hobby project" and 8+ is "competitive with
the category leaders". Competitor claims are cited inline; anything I
could not verify against a primary page is marked as such.*
