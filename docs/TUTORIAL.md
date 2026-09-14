# Geoclick — Tutorial script and interaction spec (FT-09)

The script for the in-app tutorial, written before any of it is built.
FT-10 (sandbox), FT-11 (engine, overlay, steps) and FT-12 (first-visit
nudge, three-language walkthrough) build exactly what's here; if one of
them needs to change the script, change this file first.

**Status: approved by the product owner, 2026-09-14.** The answers from
the review are listed at the end. The wording can still be tuned once
FT-11 shows it on screen and FT-12 checks it at phone width.

Settled elsewhere, not reopened here (FEATURE_PLAN.md, product decisions):

- **5:** the tutorial runs a real quiz, but its progress is sandboxed and
  never saved;
- **6:** it starts only from a Tutorial button (plus FT-12's dismissible
  nudge), never by itself;
- **7:** it always uses Italy — Regions (`italy-regions`);
- **8:** "preview" in the request means the Overview;
- **16:** it doesn't add Italy — Regions to Recent.

---

## The flow at a glance

An intro card, eleven steps, and an outro card. The player does the real
thing at every action step; the tutorial waits for it and moves on by
itself. Only the explanation steps (3 and 10) have a Next button.

| # | Where | Highlights (`data-tutorial`) | Moves on when | What the player learns |
|---|---|---|---|---|
| Intro | home page | nothing (centred card) | Start | what's about to happen, and that nothing is saved |
| 1 | home page | `home-map-card` (Italy's "Regions" card in the country list) | the route becomes `/map/italy-regions/overview` | choosing a map |
| 2 | overview | `map` (the map), `zoom-control` (the `+`/`−` buttons) | the player zooms or pans the map | zoom and pan, with mouse, touch or buttons |
| 3 | overview | `nav-overview` | Next | names are on the overview; magnify by hover or tap |
| 4 | overview, then explore | `nav-explore`, then `map` | the player clicks a region in Explore and its name shows | Explore: names hidden, click to find out |
| 5 | explore | `nav-quiz` | the route becomes `/map/italy-regions/quiz` | where the quiz is |
| 6 | quiz | `slip-sicilia` (a name slip in the tray) | a correct drop, of any slip | drag a name onto its region |
| 7 | quiz | `slip-sardegna` | a wrong drop, of any slip | what a mistake looks like |
| 8 | quiz | `nav-overview` | the route becomes `/map/italy-regions/overview` | checking a region you're unsure of |
| 9 | overview | `nav-quiz` | the route becomes `/map/italy-regions/quiz` | going back to the quiz |
| 10 | quiz | `quiz-progress` (the "1 / 20 placed" line) | Next | solved regions stay solved; spaced repetition |
| 11 | quiz | `nav-tour` | the route becomes `/map/italy-regions/tour` | Tour mode |
| Outro | tour | nothing (centred card) | Finish, or Replay | the star, and how to replay the tutorial |

How this maps onto the original request (FEATURE_BACKLOG.md §3): 1 select
a map · 2 zoom and pan (added 2026-09-13) · 3 the overview (was "switch to
the overview", which FT-13 made automatic) · 4 Explore (added at FT-09's
review, 2026-09-14) · 5 switch to Quiz · 6 drag a name slip onto its region
· 7 make a deliberate mistake · 8 check a region in the overview · 9 return
to the quiz · 10 spaced repetition · 11 Tour.

---

## The steps in detail

The English copy is here; all three languages are in [Copy](#copy) below,
keyed by the translation key FT-11 will add.

### Intro — home page

> **Welcome to Geoclick**
> Learn the map by playing with it. This short tutorial takes about three
> minutes and you'll try every part of the app yourself. Nothing you do in
> it counts towards your progress.
>
> [Skip] [Start]

A centred card with no highlight. Start goes to step 1.

### 1. Choose a map — home page

> Let's start with a map. Open **Regions**, under Italy.

- **Highlight:** Italy's "Regions" card **in the country list**. If
  Italy — Regions is also in Favourites or Recent, those copies aren't
  highlighted: the country-list card is always there, so the step works
  the same for everyone. The page scrolls the card into view.
- **Moves on:** when the route becomes `/map/italy-regions/overview`,
  whichever card was used (a Favourites or Recent copy works too).
- **Off-script:** opening any other map pauses the tutorial.

### 2. Zoom and pan — overview

Mouse and trackpad:

> Zoom with the mouse wheel or the **+** and **−** buttons, and drag the
> map to move around. Try it now.

Touch screens:

> Pinch to zoom, or use the **+** and **−** buttons, and drag with one
> finger to move around. Try it now.

- **Highlight:** the map, without dimming it (it's the whole screen), and
  a ring round the `+`/`−` buttons.
- **Moves on:** at the `moveend` of any zoom or pan **the player** made,
  about half a second later so the player sees that it worked. Which
  events carry the player's input differs, so OverviewView watches
  several: the `+`/`−` buttons pass it on every move event, a wheel or
  trackpad zoom only on MapLibre's own `wheel` event (its moves come from
  an easing animation, found in FT-11's browser run), and a drag or touch
  gesture starts with `dragstart` / `touchstart`. The map's own opening
  fit has none of these, so it doesn't count.
- **Which copy:** touch copy when `matchMedia('(hover: none)')` matches,
  which is phones and tablets. Otherwise the mouse copy.

### 3. The overview — overview

Mouse:

> This is the **overview**, where every region shows its name. Hover over a
> name to enlarge it.

Touch:

> This is the **overview**, where every region shows its name. Tap a name to
> enlarge it.

- **Highlight:** the Overview tab (already selected).
- **Moves on:** Next.
- **Off-script:** opening Explore now skips ahead to step 4's second half
  rather than pausing: it's where the tutorial is going next anyway.

### 4. Explore — overview, then explore

Mouse:

> **Explore** hides the names, so you can test yourself. Open it and click
> any region to see which one it is.

Touch:

> **Explore** hides the names, so you can test yourself. Open it and tap
> any region to see which one it is.

- **Highlight:** the Explore tab while on the overview; once the route is
  `/map/italy-regions` (Explore), the map instead. Same card, same copy:
  it's one step across two screens.
- **Moves on:** when the player clicks or taps a region in Explore and its
  name pops up, about a second later so the name can be read. MapView
  calls the tutorial hook from its existing region-click handler.
- **Back** from here returns to step 3 on the overview.

### 5. Open the quiz — explore

> Ready to test yourself for real? Open the **Quiz**.

- **Highlight:** the Quiz tab.
- **Moves on:** the route becomes `/map/italy-regions/quiz`.

### 6. Place a name — quiz

> Drag a name from the tray onto its region. Try **Sicilia**: the big
> island off the toe of the boot.

- **Highlight:** the Sicilia slip. The tray scrolls it into view: slips are
  in alphabetical order, so at phone width Sicilia is below the first row.
  The region isn't highlighted; the copy already gives it away.
- **Moves on:** a correct drop of **any** slip. A player who places
  something else first has still learnt the step.
- **Card position:** at the top, below the map bar, so it never covers the
  tray or Sicily (see [Layout](#layout)).
- **Sicily has to be visible:** the quiz used to fit the map to the whole
  screen, so Sicily started under the tray at 1280×800 and on phones.
  Since FT-11 the quiz fits the map into the space above the tray, for
  every map, not only in the tutorial.

### 7. Make a mistake — quiz

> Now get one wrong on purpose: drop **Sardegna** anywhere on the
> mainland. The region flashes red and the name goes back to the tray.

- **Highlight:** the Sardegna slip.
- **Moves on:** a wrong drop of any slip (one the quiz scores as wrong).
  A drop on the sea or back on the tray isn't scored, so the step keeps
  waiting, and so does a drop that turns out correct: it waits for a real
  mistake.
- **Why Sardegna on the mainland:** it's far from anything else, so the
  24px drop tolerance can't turn the drop into a correct one by accident.

### 8. Check in the overview — quiz

> Not sure where a region is? Look it up in the **overview**.

- **Highlight:** the Overview tab.
- **Moves on:** the route becomes `/map/italy-regions/overview`. On
  Android, the back button goes there too (FT-14), and that counts.

### 9. Back to the quiz — overview

> Found Sardegna? Go back to the **Quiz**.

- **Highlight:** the Quiz tab.
- **Moves on:** the route becomes `/map/italy-regions/quiz`.
- **What the player sees:** the quiz rebuilds from the sandbox (FT-10). The
  regions placed in steps 6 and 7 come back already solved. It's the
  quiz's normal same-day carry-over: a region placed correctly isn't due
  again until tomorrow.

### 10. Spaced repetition — quiz

> The regions you placed are still marked: what you solve stays solved.
> Each one comes back for review later, sooner if it gave you trouble, and
> less often each time you get it right. The map list shows how many are
> due on each map.

- **Highlight:** the progress line under the map name ("2 / 20 placed").
- **Moves on:** Next.
- **Accuracy check of the copy:** a first-try placement grades "good" and
  comes back after 1 day, then 6, then about 15, and so on; a placement
  after a mistake grades "hard" and comes back sooner; a region revealed
  after three misses stays due the same day (DECISIONS.md, "Persistence &
  retention"). "What you solve stays solved" means for today, which is what
  the player has just seen. The line on the map list reads "N to review".

### 11. The tour — quiz

> Last one: the **Tour** flies you to each region in turn and shows its
> name. Open it.

- **Highlight:** the Tour tab.
- **Moves on:** the route becomes `/map/italy-regions/tour`. The tour
  starts playing by itself, as it always does.

### Outro — tour

> **You're all set**
> Pick any map and play. Tip: the star on a map keeps it at the top of your
> list. You can replay this tutorial any time with the Tutorial button.
>
> [Replay] [Finish]

- A card at the top, below the map bar, clear of the tour's own controls
  at the bottom, so the tour stays visible and usable behind it.
- **Finish** ends the tutorial and leaves the player on the tour, which
  keeps playing (product owner, 2026-09-14).
- **Replay** starts again from the intro, with a fresh sandbox.
- The star gets a sentence here rather than a step (product owner,
  2026-09-14).

---

## Controls and edge cases

### Starting

- **Tutorial button:** on the home page, in the header next to the language
  switcher; on every map screen, in the map bar next to the language
  switcher. The tab row is already full at phone width (FT-13), so it's not
  a sixth tab. Label: "Tutorial".
- Starting from a map screen goes to the home page first and shows the
  intro.
- Pressing the button while a tutorial is running brings back the current
  card (it's the same as Resume when paused).

### On every card

- **Step counter:** "Step 3 of 11" on the numbered steps.
- **Skip** (every card, and Esc on a keyboard) ends the tutorial straight
  away, with no confirmation: it's cheap to restart, and a confirmation
  would get in the way of a player who knows the app.
- **Back** (steps 2 to 11) shows the previous step, and goes to its screen
  if that's a different one. A step whose action is already done when it's
  shown (you're already on the quiz; a correct drop has already happened)
  shows **Next** instead of waiting. The tutorial remembers which actions
  happened: zoomed or panned, dropped correctly, dropped wrongly.
- **Next** only on steps 3 and 10, and on any step whose action is already
  done (above).
- **Focus:** each new card takes keyboard focus. Its buttons are reachable
  with Tab, and the card is announced as a dialog without trapping focus
  (the player has to reach the real controls).

### Going off-script

Any route change that isn't the step's own screen or its target pauses
the tutorial. Examples: opening another map, the map list, Explore
outside steps 3 to 5, or Tour before step 11.

- The card is replaced by a small bar at the bottom of the screen:
  **"Tutorial paused"**, with **Resume** and **End tutorial**.
- **Resume** goes back to the current step's screen and shows its card.
  Actions already done still count.
- **End tutorial** is the same as Skip.
- The bar stays until one of the two is chosen; the tutorial never resumes
  by itself.

### Ending

Skip, End tutorial and Finish all:

- discard the sandbox and switch the progress repository back to the real
  one (FT-10);
- turn Recent recording back on;
- leave the player on the screen they're on. If that's the quiz, it
  **reloads with the player's real progress**: the player must never see
  sandbox data once the tutorial is over. The quiz keeps its repository
  for the life of the view, so FT-11 has to remount it (for example by
  keying the view on the sandbox being on or off).

### Android back button

FT-14's behaviour is unchanged: back goes up a level. Inside the tutorial
that's just a route change, handled like any other: in step 8 it's the
expected move, elsewhere it pauses. On the map list, back closes the app
as usual, and the tutorial is gone with it.

### Reloading

The tutorial lives in memory. A browser reload, or closing the app, ends
it. The sandbox goes with it and real progress is untouched.

---

## The sandbox

What FT-10 builds. This narrows FT-10's original spec ("one shared
in-memory instance" for everything) to one map; the product owner chose
this at FT-09's review, 2026-09-14.

- **Only Italy — Regions is sandboxed.** While the tutorial is active, the
  progress repository keeps `italy-regions` in memory, starting empty, so
  every region is due and the quiz starts fresh, whatever the player's
  real progress is. **Every other map reads and writes the real store as
  normal.**
- Why only one map, rather than FT-10's "one shared in-memory instance"
  for everything: the home page reads progress for all 44 maps. With a
  fully empty sandbox, step 1 would show every map card as "N to review",
  which looks like the player's progress has been wiped, on the very first
  screen of the tutorial. And a player who pauses and plays another map
  would lose that session without being told.
- Italy's own card on the home page shows the sandbox while the tutorial is
  active ("20 to review" at step 1, fewer after the quiz). That's accurate
  for the tutorial, and it goes back to the real count when it ends.
- **Recent:** visits to `italy-regions` aren't recorded while the tutorial
  is active (decision 16). Other maps opened while paused are recorded as
  usual (`setUnrecordedMap` in `mapPrefs.svelte.ts`).
- **Favourites** aren't touched by the sandbox: starring is a real choice
  the player makes, in or out of the tutorial.
- **Last session summary** ("Last: 18/20" on the home page): written to
  the sandbox like everything else for `italy-regions`, so a tutorial quiz
  finished to the end never replaces the real one.
- FT-10's test becomes: a full tutorial quiz on `italy-regions` leaves
  `localStorage` byte-identical (including Recent), while a session on
  another map during the tutorial saves normally.

---

## Layout

- **Spotlight:** the page is dimmed except for the highlighted element
  (8px of padding round it, rounded corners). The dimming lets every click
  and touch through, so the real controls all keep working; going
  off-script is handled by pausing, not by blocking. Step 2 doesn't dim,
  because the highlight is the whole map.
- **Following the element:** the spotlight follows scrolling, window
  resizes, rotation, the map bar's own layout changes and the quiz tray
  being resized.
- **Card position, wide screens:** next to the highlighted element, on
  whichever side has room, with a small pointer towards it.
- **Card position, phone width (under 720px, the map bar's own
  breakpoint):** a full-width card docked to the top or the bottom edge,
  whichever doesn't cover the highlighted element. On the quiz and the
  tour it's always the top, just below the map bar, because the tray and
  the tour's controls are at the bottom (at every width).
- **Length:** every card fits in four lines at 360px wide in German, the
  longest language. FT-12 measures this and shortens copy where needed.
- **Touch:** dragging a slip already works by touch (pointer events). The
  card never sits on the tray or on the region the step asks for.
- **Missing element:** if a step's element isn't on screen (still loading,
  or gone), the card shows centred without a spotlight, and moves once the
  element appears. FT-11 tests this.

---

## Anchors for FT-11

`data-tutorial` attributes on the real elements:

| Anchor | Element | Notes |
|---|---|---|
| `tutorial-button` | the Tutorial button | home header and MapNav |
| `home-map-card` | the `italy-regions` card in the country list | not the Favourites/Recent copies |
| `zoom-control` | MapLibre's `+`/`−` group | third-party DOM: `createMap` sets the attribute after `addControl` |
| `nav-overview`, `nav-explore`, `nav-quiz`, `nav-tour` | MapNav's tabs | |
| `slip-<targetId>` | each quiz slip | e.g. `slip-sicilia`, `slip-sardegna` |
| `quiz-progress` | the "N / M placed" line | |

Two steps need a hook from a view, and both hooks do nothing when no
tutorial is running:

- QuizView calls one on every **scored** drop, with `{ correct }` (steps 6
  and 7);
- MapView (Explore) calls one when a region click shows its name (step 4).

---

## Copy

The keys FT-11 adds to `i18n.svelte.ts`, with the text for each language.
German uses "du", like the rest of the app; Italian uses "tu".
Region names stay in Italian in every language, as they are on the map.
**Bold** marks the words shown in bold on the card; FT-11 decides how to
mark that up in the strings.

### Buttons and labels

| Key | English | Deutsch | Italiano |
|---|---|---|---|
| `tutorial.button` | Tutorial | Tutorial | Tutorial |
| `tutorial.start` | Start | Los geht's | Inizia |
| `tutorial.skip` | Skip | Überspringen | Salta |
| `tutorial.back` | Back | Zurück | Indietro |
| `tutorial.next` | Next | Weiter | Avanti |
| `tutorial.finish` | Finish | Fertig | Fine |
| `tutorial.replay` | Replay | Nochmal | Ricomincia |
| `tutorial.stepCounter` | Step {n} of {total} | Schritt {n} von {total} | Passo {n} di {total} |
| `tutorial.paused` | Tutorial paused | Tutorial pausiert | Tutorial in pausa |
| `tutorial.resume` | Resume | Fortsetzen | Riprendi |
| `tutorial.end` | End tutorial | Tutorial beenden | Termina il tutorial |

### Intro and outro

| Key | English | Deutsch | Italiano |
|---|---|---|---|
| `tutorial.intro.title` | Welcome to Geoclick | Willkommen bei Geoclick | Ti diamo il benvenuto in Geoclick |
| `tutorial.intro.body` | Learn the map by playing with it. This short tutorial takes about three minutes and you'll try every part of the app yourself. Nothing you do in it counts towards your progress. | Lerne die Karte, indem du mit ihr spielst. Dieses kurze Tutorial dauert etwa drei Minuten, und du probierst jeden Teil der App selbst aus. Was du dabei machst, zählt nicht für deinen Fortschritt. | Impara la mappa giocandoci. Questo breve tutorial dura circa tre minuti e proverai in prima persona ogni parte dell'app. Quello che fai qui non conta per i tuoi progressi. |
| `tutorial.outro.title` | You're all set | Alles bereit | Tutto pronto |
| `tutorial.outro.body` | Pick any map and play. Tip: the star on a map keeps it at the top of your list. You can replay this tutorial any time with the Tutorial button. | Wähle eine beliebige Karte und leg los. Tipp: Mit dem Stern bleibt eine Karte oben in deiner Liste. Du kannst dieses Tutorial jederzeit über die Schaltfläche „Tutorial“ wiederholen. | Scegli una mappa qualsiasi e gioca. Suggerimento: con la stella una mappa resta in cima all'elenco. Puoi rifare questo tutorial quando vuoi con il pulsante Tutorial. |

### Steps

| Key | English | Deutsch | Italiano |
|---|---|---|---|
| `tutorial.step1` | Let's start with a map. Open **Regions**, under Italy. | Fangen wir mit einer Karte an. Öffne **Regionen** unter Italy. | Iniziamo con una mappa. Apri **Regioni**, sotto Italy. |
| `tutorial.step2` | Zoom with the mouse wheel or the **+** and **−** buttons, and drag the map to move around. Try it now. | Zoome mit dem Mausrad oder den Tasten **+** und **−**, und ziehe die Karte, um dich zu bewegen. Probier es aus. | Usa la rotellina del mouse o i pulsanti **+** e **−** per lo zoom, e trascina la mappa per spostarti. Prova ora. |
| `tutorial.step2.touch` | Pinch to zoom, or use the **+** and **−** buttons, and drag with one finger to move around. Try it now. | Zoome mit zwei Fingern oder den Tasten **+** und **−**, und verschiebe die Karte mit einem Finger. Probier es aus. | Usa due dita o i pulsanti **+** e **−** per lo zoom, e trascina la mappa con un dito per spostarti. Prova ora. |
| `tutorial.step3` | This is the **overview**, where every region shows its name. Hover over a name to enlarge it. | Das ist die **Übersicht**: Hier steht jede Region mit ihrem Namen. Fahre mit der Maus über einen Namen, um ihn zu vergrößern. | Questa è la **panoramica**, dove ogni regione mostra il suo nome. Passa il mouse su un nome per ingrandirlo. |
| `tutorial.step3.touch` | This is the **overview**, where every region shows its name. Tap a name to enlarge it. | Das ist die **Übersicht**: Hier steht jede Region mit ihrem Namen. Tippe auf einen Namen, um ihn zu vergrößern. | Questa è la **panoramica**, dove ogni regione mostra il suo nome. Tocca un nome per ingrandirlo. |
| `tutorial.step4` | **Explore** hides the names, so you can test yourself. Open it and click any region to see which one it is. | **Erkunden** blendet die Namen aus, damit du dich selbst testen kannst. Öffne es und klicke auf eine Region, um zu sehen, welche es ist. | **Esplora** nasconde i nomi, così puoi metterti alla prova. Aprilo e clicca una regione per scoprire qual è. |
| `tutorial.step4.touch` | **Explore** hides the names, so you can test yourself. Open it and tap any region to see which one it is. | **Erkunden** blendet die Namen aus, damit du dich selbst testen kannst. Öffne es und tippe auf eine Region, um zu sehen, welche es ist. | **Esplora** nasconde i nomi, così puoi metterti alla prova. Aprilo e tocca una regione per scoprire qual è. |
| `tutorial.step5` | Ready to test yourself for real? Open the **Quiz**. | Bereit für den echten Test? Öffne das **Quiz**. | Ora la prova vera: apri il **Quiz**. |
| `tutorial.step6` | Drag a name from the tray onto its region. Try **Sicilia**: the big island off the toe of the boot. | Ziehe einen Namen aus der Ablage auf seine Region. Versuch es mit **Sicilia**, der großen Insel vor der Stiefelspitze. | Trascina un nome dal vassoio sulla sua regione. Prova con **Sicilia**, l'isola grande davanti alla punta dello stivale. |
| `tutorial.step7` | Now get one wrong on purpose: drop **Sardegna** anywhere on the mainland. The region flashes red and the name goes back to the tray. | Jetzt ein Fehler mit Absicht: Lege **Sardegna** irgendwo auf dem Festland ab. Die Region blinkt rot, und der Name geht zurück in die Ablage. | Ora sbaglia apposta: lascia **Sardegna** in un punto qualsiasi della penisola. La regione lampeggia in rosso e il nome torna nel vassoio. |
| `tutorial.step8` | Not sure where a region is? Look it up in the **overview**. | Nicht sicher, wo eine Region liegt? Schau in der **Übersicht** nach. | Non sai dov'è una regione? Controlla nella **panoramica**. |
| `tutorial.step9` | Found Sardegna? Go back to the **Quiz**. | Sardegna gefunden? Dann zurück zum **Quiz**. | Trovata la Sardegna? Torna al **Quiz**. |
| `tutorial.step10` | The regions you placed are still marked: what you solve stays solved. Each one comes back for review later, sooner if it gave you trouble, and less often each time you get it right. The map list shows how many are due on each map. | Die Regionen, die du platziert hast, sind noch markiert: Was du löst, bleibt gelöst. Jede kommt später zur Wiederholung zurück, früher, wenn sie dir schwerfiel, und seltener, je öfter du sie richtig hast. Die Kartenliste zeigt, wie viele auf jeder Karte fällig sind. | Le regioni che hai posizionato sono ancora segnate: quello che risolvi resta risolto. Ognuna torna più avanti per un ripasso, prima se ti ha dato problemi e sempre più di rado ogni volta che la indovini. L'elenco delle mappe mostra quante sono da ripassare su ogni mappa. |
| `tutorial.step11` | Last one: the **Tour** flies you to each region in turn and shows its name. Open it. | Zum Schluss die **Tour**: Sie fliegt dich nacheinander zu jeder Region und zeigt ihren Namen. Öffne sie. | Per finire, il **Tour**: ti porta da una regione all'altra e ne mostra il nome. Aprilo. |

Notes on the copy:

- The tab names match the app's own labels in each language: Overview /
  Übersicht / Panoramica, Explore / Erkunden / Esplora, Quiz, Tour. "Tray"
  follows the existing tray label (Namensablage, vassoio dei nomi).
- Step 1 says "Regions, under Italy" because that's what the card says:
  in the country list the card is labelled "Regions" under the heading
  "Italy". Country names stay in English in every language (DECISIONS.md,
  i18n), hence "unter Italy" and "sotto Italy".
- Italian avoids gendered forms: "Ti diamo il benvenuto" rather than
  "Benvenuto", "in prima persona" rather than "tu stesso".
- Step 10 has the longest copy, and at phone width in German it probably
  won't fit four lines. FT-12 checks, and if it doesn't fit the last
  sentence goes.

---

## Decided at the review (2026-09-14)

- **Explore gets a step of its own** (step 4), rather than a sentence in
  step 3. The tutorial is eleven steps.
- **The sandbox covers Italy — Regions only**; every other map's progress
  stays live ([The sandbox](#the-sandbox)).
- **The star is a tip in the outro**, not a step.
- **Finish leaves the player on the tour.**
- **The copy is approved as drafted.** Italian uses neutral forms instead
  of the masculine "Benvenuto" / "tu stesso".
- **The button says "Tutorial"** in all three languages.
