# Geoclick — Tutorial script and interaction spec (FT-09)

The script and interaction notes for the in-app tutorial. The shipped copy
lives in `app/src/lib/i18n.svelte.ts`; the step order and transitions live
in `app/src/lib/tutorialMachine.ts`. Keep this document and the user manual
aligned with those sources.

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

> **Steps 1 to 3, Europe, Italy and the map, came with FT-79 (2026-09-26).**
> The start screen opens on a world map (FT-77, #58), so the tutorial now
> takes the player the way they will find every map: the continent on the
> world, the country on the continent, then the map in the country's row.
> The page shows the map for these steps even when the player has chosen
> the list, and goes back to the list after the tutorial. A player who opens
> Italy — Regions some other way (Favourites, Recent) skips to step 4
> rather than pausing. Step numbers below count from these three.
>
> **Step 6, Terrain, was added in FT-43 (2026-09-19).** The layer shipped
> switched off in v0.8.0 and the product owner - who had asked for it - later
> opened the Known map and asked why the landmarks and reliefs were missing
> and whether they had been merged. They had. Turning it on by default fixed
> half of that; the other half is telling the player what they are looking
> at and that the button turns it off, which is what this step does.


An intro card, fourteen steps, and an outro card. The player does the real
thing at every action step; the tutorial waits for it and moves on by
itself. The explanation step (13) has a Next button; steps whose required
action has already happened also offer Next.

| # | Where | Highlights (`data-tutorial`) | Moves on when | What the player learns |
|---|---|---|---|---|
| Intro | home page | nothing (centred card) | Start | what's about to happen; Italy — Regions practice is sandboxed |
| 1 | home page, world map | `picker-europe` (Europe's name on the world) | the map opens Europe | where the maps are: every one starts from the world |
| 2 | home page, Europe | `picker-italy` (over Italy on the map) | a tap on Italy, which lights Italy's row | a country's maps are in its row |
| 3 | home page, Europe | `home-map-card` (Italy's row, in the panel beside or below the map) | the route becomes `/map/italy-regions` | choosing Regions in Italy's row opens that map |
| 4 | Known map | `map` (the map), `zoom-control` (the `+`/`−` buttons) | the player zooms or pans the map | zoom and pan, with mouse, touch or buttons |
| 5 | the Known map | `map` | the player taps a region and its name lands on the map | **the map you build**: tap a name on, tap it off again |
| 6 | the Known map | `terrain-toggle` (the Terrain button) | the player presses Terrain, either direction | Terrain's geographic detail; land and sea stay distinct when it is off |
| 7 | the Known map, then overview | `nav-overview`, then `map` | the route becomes `/map/italy-regions/overview` | names you earn appear on their own; Overview shows every name at once |
| 8 | overview | `nav-quiz` | the route becomes `/map/italy-regions/quiz` | where the quiz is |
| 9 | quiz | `slip-sicilia` (a name slip in the tray) | a correct drop, of any slip | drag a name onto its region |
| 10 | quiz | `slip-sardegna` | a wrong drop, of any slip | what a mistake looks like |
| 11 | quiz | `nav-overview` | the route becomes `/map/italy-regions/overview` | checking a region you're unsure of |
| 12 | overview | `nav-quiz` | the route becomes `/map/italy-regions/quiz` | going back to the quiz |
| 13 | quiz | `quiz-progress` (the "1 / 20 placed" line) | Next | solved regions stay solved; spaced repetition |
| 14 | quiz | `nav-tour` | the route becomes `/map/italy-regions/tour` | Tour mode |
| Outro | tour | nothing (centred card) | Finish, or Replay | the star, and how to replay the tutorial |

How this maps onto the original request (FEATURE_BACKLOG.md §3): 1 select
a map · 2 zoom and pan (added 2026-09-13) · 3 the map you build, which in
v0.9.0 (FT-39/FT-40) took the place the overview used to hold here, since a
map now opens on Known · 4 the overview, which moved after it and became
something the player navigates to rather than arrives on · 5 switch to Quiz
· 6 drag a name slip onto its region · 7 make a deliberate mistake · 8 check
a region in the overview · 9 return to the quiz · 10 spaced repetition ·
11 Tour.

---

## The steps in detail

The English copy is here; all three languages are in [Copy](#copy) below,
keyed by the translation key FT-11 will add.

### Intro — home page

> **Welcome to Geoclick**
> Learn the map by playing. This three-minute tutorial introduces the app's
> main features. Your practice on Italy — Regions won't change your real
> progress.
>
> [Exit tutorial] [Start]

A centred card with no highlight. Start goes to step 1.

### 1. Choose Europe — home page, the world

> Every map starts from the world. Choose **Europe**.

- **Setting:** the start screen's map, on the world whatever view was left
  last (the tutorial sets it on entering the step). The Map / List switch is
  disabled while the tutorial runs.
- **Highlight:** Europe's name on the map, a button of its own.
- **Moves on:** when the map opens Europe, however: the name, a tap on a
  European country, or Europe's heading in the panel. Another continent is
  a look around and doesn't count.

### 2. Choose Italy — home page, Europe

> Now click **Italy** on the map. Its row in the list lights up.

(Touch: "Now tap **Italy** …".)

- **Highlight:** a finger-sized ring over Italy (`picker-italy`), a marker
  that lets clicks through: a country is no element of its own.
- **Moves on:** a tap on Italy. Another country marks its own row and
  doesn't count.

### 3. Choose a map — home page, Europe

> Choose **Regions** in Italy's row to open that map.

- **Highlight:** Italy's row in the panel, lit (the tutorial lights it
  however the player reached the step). The overlay scrolls it into view.
- **Moves on:** when the route becomes `/map/italy-regions`, whichever way
  (a Favourites or Recent copy works too, from any of steps 1 to 3).
- **Off-script:** opening any other map pauses the tutorial.

### 4. Zoom and pan — Known map

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

### 5. The map you build — the Known map

Mouse:

> This is **Known**, the map you build. Click a region to put its name on
> the map — it stays there. Click it again to take it off, so you choose
> which names to study.

Touch:

> This is **Known**, the map you build. Tap a region to put its name on the
> map — it stays there. Tap it again to take it off, so you choose which
> names to study.

- **Highlight:** the map itself, undimmed. There is nothing to point at:
  the lesson is the whole surface.
- **Moves on:** when a tap puts a name on the map, about a second later so
  the name can be read. `MapView` calls the hook from the same handler that
  records the choice, and only when the tap REVEALED a name — hiding one
  does not count as learning what the tutorial is teaching.
- **This is the step that changed in v0.9.0** (FT-39/FT-40). It used to be
  the overview, and it used to say "hover over a name to enlarge it"; a map
  now opens here instead, and what the player needs to learn first is that
  a tap leaves a name behind.

### 7. The overview — the Known map, then overview

> Names you place right in the quiz appear here on their own, as strongly as
> you know them. New to a map? **Overview** shows every name at once — open
> it.

- **Highlight:** the Overview tab while still on the Known map; once the
  route is `/map/italy-regions/overview`, the map instead. Same card, same
  copy: one step across two screens, as step 4 has always been — only the
  two screens have swapped.
- **Moves on:** when the route becomes the overview.
- **Why it still exists:** a map that opens on Known opens nearly empty for
  someone who has never played it, so the screen that names everything at
  once is what a newcomer needs. Decision 1 in docs/PLAN_V0.9.md.
- **Back** from here returns to step 3 on the Known map.

### 8. Open the quiz — overview

> Ready for a quiz? Open the **Quiz**.

- **Highlight:** the Quiz tab.
- **Moves on:** the route becomes `/map/italy-regions/quiz`.

### 9. Place a name — quiz

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

### 10. Make a mistake — quiz

> Now get one wrong on purpose: drop **Sardegna** anywhere on the
> mainland. The region you hit flashes red, and Sardegna is shown where it
> really is.

- **Highlight:** the Sardegna slip.
- **Moves on:** a wrong drop of any slip (one the quiz scores as wrong).
  A drop on the sea or back on the tray isn't scored, so the step keeps
  waiting, and so does a drop that turns out correct: it waits for a real
  mistake.
- **Since v0.6.0 (FT-20):** one mistake ends that name's turn. The name is
  placed where it belongs, in the "shown" colour, and counts as not known.
- **Why Sardegna on the mainland:** it's far from anything else, so the
  24px drop tolerance can't turn the drop into a correct one by accident.

### 11. Check in the overview — quiz

> Not sure where a region is? Look it up in the **overview**.

- **Highlight:** the Overview tab.
- **Moves on:** the route becomes `/map/italy-regions/overview`. On
  Android, the back button goes there too (FT-14), and that counts.

### 12. Back to the quiz — overview

> Found Sardegna? Go back to the **Quiz**.

- **Highlight:** the Quiz tab.
- **Moves on:** the route becomes `/map/italy-regions/quiz`.
- **What the player sees:** the round carries on where it was left (FT-26,
  quizRound.ts). The regions placed in steps 6 and 7 are still marked, and
  the names still in the tray are the ones still to place - going out to
  the Overview and back does not restart the round.

### 13. What counts as known — quiz

> The regions you placed are still marked. Place a name right three times
> in a row and it counts as known — **Progress** shows how far you have
> got.

- **Highlight:** the progress line under the map name ("2 / 20 placed").
- **Moves on:** Next.
- **Rewritten at FT-26 (v0.6.0):** it used to explain spaced repetition
  ("each comes back for review later"). The scheduler still runs, but
  nothing in the interface talks about review dates any more, so the step
  explains the thing the player can actually see: the clean streak behind
  the progress map (DECISIONS.md, "The scheduler keeps running, out of
  sight").
- **Accuracy check of the copy:** three clean placements in a row is
  exactly KNOWN_CLEAN_STREAK (packages/srs); one mistake sends that name
  back to zero (FT-20), and the progress map draws the three strengths.
- **Shortened at FT-12:** the first draft (approved at FT-09) also said
  "what you solve stays solved" and "the map list shows how many are due
  on each map". At 360px it ran to 7 lines in German (5 in English, 6 in
  Italian), so both went; the rest says the same in 4 lines or fewer.

### 14. The tour — quiz

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

- **Step counter:** "Step 3 of 14" on the numbered steps.
- **Exit tutorial** (every card, and Esc on a keyboard) ends the tutorial straight
  away, with no confirmation: it's cheap to restart, and a confirmation
  would get in the way of a player who knows the app.
- **Back** (steps 2 to 14) shows the previous step, and goes to its screen
  if that's a different one. A step whose action is already done when it's
  shown (you're already on the quiz; a correct drop has already happened)
  shows **Next** instead of waiting. The tutorial remembers which actions
  happened: zoomed or panned, dropped correctly, dropped wrongly.
- **Next** only on step 13, and on any step whose action is already
  done (above).
- **Focus:** each new card takes keyboard focus. Its buttons are reachable
  with Tab, and the card is announced as a dialog without trapping focus
  (the player has to reach the real controls).

### Going off-script

Any route change that isn't the step's own screen or its target pauses
the tutorial. Examples: opening another map, the map list, the progress map
outside steps 4 to 7, or Tour before step 14.

- The card is replaced by a small bar at the bottom of the screen:
  **"Tutorial paused"**, with **Resume** and **End tutorial**.
- **Resume** goes back to the current step's screen and shows its card.
  Actions already done still count.
- **End tutorial** ends the tutorial too; Escape is the keyboard shortcut for
  the card's **Exit tutorial** action.
- The bar stays until one of the two is chosen; the tutorial never resumes
  by itself.

### Ending

Exit tutorial, End tutorial and Finish all:

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
  active: no review line at step 1 (an empty sandbox counts as never
  played), a count after the quiz. It goes back to the real line when the
  tutorial ends.
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
- **Length:** every numbered step's text fits in four lines at 360px wide
  in German, the longest language (measured at FT-12). The intro and
  outro may take five: they stand alone, with nothing to do behind them.
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
| `tutorial-button` | the Tutorial button | the start screen's toolbar (an icon, FT-82) and MapNav (the pill) |
| `picker-europe` (any `picker-<continent>`) | a continent's name on the start screen's world map | a MapLibre marker, set by WorldPicker |
| `picker-italy` | a ring over Italy on the Europe view | only while a tutorial runs; `pointer-events: none` |
| `home-map-card` | the row whose list holds `italy-regions`, in the map's panel or the list | not the Favourites/Recent copies |
| `zoom-control` | MapLibre's `+`/`−` group | third-party DOM: `createMap` sets the attribute after `addControl` |
| `nav-overview`, `nav-explore`, `nav-quiz`, `nav-tour` | MapNav's tabs | |
| `slip-<targetId>` | each quiz slip | e.g. `slip-sicilia`, `slip-sardegna` |
| `quiz-progress` | the "N / M placed" line | |

Two steps need a hook from a view, and both hooks do nothing when no
tutorial is running:

- QuizView calls one on every **scored** drop, with `{ correct }` (steps 6
  and 7);
- MapView (the progress map) calls one when a region click shows its name (step 4).

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
| `tutorial.skip` | Exit tutorial | Tutorial beenden | Esci dal tutorial |
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
| `tutorial.intro.body` | Learn the map by playing. This three-minute tutorial introduces the app's main features. Your practice on Italy — Regions won't change your real progress. | Lerne die Karte spielend kennen. In etwa drei Minuten zeigt dir das Tutorial die wichtigsten Funktionen. Dein Üben auf Italien — Regionen verändert deinen echten Lernfortschritt nicht. | Impara la mappa giocando. In circa tre minuti il tutorial ti mostra le funzioni principali. L'esercitazione su Italia — Regioni non modifica i tuoi progressi reali. |
| `tutorial.outro.title` | You're all set | Alles bereit | Tutto pronto |
| `tutorial.outro.body` | Pick any map and play. Tip: the star on a map keeps it at the top of your list. You can replay this tutorial any time with the Tutorial button. | Wähle eine beliebige Karte und leg los. Tipp: Mit dem Stern bleibt eine Karte oben in deiner Liste. Du kannst dieses Tutorial jederzeit über die Schaltfläche „Tutorial“ wiederholen. | Scegli una mappa qualsiasi e gioca. Suggerimento: con la stella una mappa resta in cima all'elenco. Puoi rifare questo tutorial quando vuoi con il pulsante Tutorial. |

### Steps

| Key | English | Deutsch | Italiano |
|---|---|---|---|
| `tutorial.continent` | Every map starts from the world. Choose **Europe**. | Jede Karte beginnt bei der Welt. Wähle **Europa**. | Ogni mappa parte dal mondo. Scegli **Europa**. |
| `tutorial.country` | Now click **Italy** on the map. Its row in the list lights up. | Klicke jetzt auf der Karte auf **Italien**. Seine Zeile in der Liste leuchtet auf. | Ora fai clic sull'**Italia** nella mappa. La sua riga nell'elenco si illumina. |
| `tutorial.country.touch` | Now tap **Italy** on the map. Its row in the list lights up. | Tippe jetzt auf der Karte auf **Italien**. Seine Zeile in der Liste leuchtet auf. | Ora tocca l'**Italia** sulla mappa. La sua riga nell'elenco si illumina. |
| `tutorial.step1` | Choose **Regions** in Italy's row to open that map. | Wähle **Regionen** in Italiens Zeile, um diese Karte zu öffnen. | Scegli **Regioni** nella riga dell'Italia per aprire questa mappa. |
| `tutorial.step2` | Zoom with the mouse wheel or the **+** and **−** buttons, and drag the map to move around. Try it now. | Zoome mit dem Mausrad oder den Tasten **+** und **−**, und ziehe die Karte, um dich zu bewegen. Probier es aus. | Usa la rotellina del mouse o i pulsanti **+** e **−** per lo zoom, e trascina la mappa per spostarti. Prova ora. |
| `tutorial.step2.touch` | Pinch to zoom, or use the **+** and **−** buttons, and drag with one finger to move around. Try it now. | Zoome mit zwei Fingern oder den Tasten **+** und **−**, und verschiebe die Karte mit einem Finger. Probier es aus. | Usa due dita o i pulsanti **+** e **−** per lo zoom, e trascina la mappa con un dito per spostarti. Prova ora. |
| `tutorial.step3` | This is **Known**, the map you build. Click a region to put its name on the map — it stays there. Click it again to take it off, so you choose which names to study. | Das ist **Gewusst**, deine eigene Karte. Klicke auf eine Region, um ihren Namen daraufzusetzen — er bleibt dort stehen. Noch einmal klicken nimmt ihn wieder weg: So wählst du selbst, welche Namen du lernen willst. | Questa è **Conoscenza**, la mappa che costruisci tu. Clicca una regione per mettere il suo nome sulla mappa: resta lì. Cliccala di nuovo per toglierlo — scegli tu quali nomi studiare. |
| `tutorial.step3.touch` | This is **Known**, the map you build. Tap a region to put its name on the map — it stays there. Tap it again to take it off, so you choose which names to study. | Das ist **Gewusst**, deine eigene Karte. Tippe auf eine Region, um ihren Namen daraufzusetzen — er bleibt dort stehen. Noch einmal tippen nimmt ihn wieder weg: So wählst du selbst, welche Namen du lernen willst. | Questa è **Conoscenza**, la mappa che costruisci tu. Tocca una regione per mettere il suo nome sulla mappa: resta lì. Toccala di nuovo per toglierlo — scegli tu quali nomi studiare. |
| `tutorial.terrain` | **Terrain** adds geographic detail behind the map, including rivers, mountain ranges and the sea overlay. The land and sea remain distinct when Terrain is off. Press **Terrain** to hide or show this extra detail. | **Gelände** ergänzt geografische Details hinter der Karte, darunter Flüsse, Gebirge und die Meeresdarstellung. Land und Meer bleiben auch ohne Gelände unterscheidbar. Drücke auf **Gelände**, um diese Details ein- oder auszublenden. | **Rilievo** aggiunge dettagli geografici dietro la mappa, tra cui fiumi, catene montuose e la rappresentazione del mare. Terra e mare restano distinti anche quando Rilievo è disattivato. Premi **Rilievo** per nascondere o mostrare questi dettagli. |
| `tutorial.terrain.touch` | **Terrain** adds geographic detail behind the map, including rivers, mountain ranges and the sea overlay. The land and sea remain distinct when Terrain is off. Tap **Terrain** to hide or show this extra detail. | **Gelände** ergänzt geografische Details hinter der Karte, darunter Flüsse, Gebirge und die Meeresdarstellung. Land und Meer bleiben auch ohne Gelände unterscheidbar. Tippe auf **Gelände**, um diese Details ein- oder auszublenden. | **Rilievo** aggiunge dettagli geografici dietro la mappa, tra cui fiumi, catene montuose e la rappresentazione del mare. Terra e mare restano distinti anche quando Rilievo è disattivato. Tocca **Rilievo** per nascondere o mostrare questi dettagli. |
| `tutorial.step4` | Names you place right in the quiz appear here on their own, as strongly as you know them. New to a map? **Overview** shows every name at once — open it. | Namen, die du im Quiz richtig platzierst, erscheinen hier von selbst — so deutlich, wie du sie kennst. Neu auf einer Karte? Die **Übersicht** zeigt alle Namen auf einmal. Öffne sie. | I nomi che indovini nel quiz compaiono qui da soli, con la forza con cui li sai. Mappa nuova? La **Panoramica** mostra tutti i nomi insieme: aprila. |
| `tutorial.step4.touch` | Names you place right in the quiz appear here on their own, as strongly as you know them. New to a map? **Overview** shows every name at once — open it. | Namen, die du im Quiz richtig platzierst, erscheinen hier von selbst — so deutlich, wie du sie kennst. Neu auf einer Karte? Die **Übersicht** zeigt alle Namen auf einmal. Öffne sie. | I nomi che indovini nel quiz compaiono qui da soli, con la forza con cui li sai. Mappa nuova? La **Panoramica** mostra tutti i nomi insieme: aprila. |
| `tutorial.step5` | Ready for a quiz? Open the **Quiz**. | Bereit für ein Quiz? Öffne das **Quiz**. | Vuoi fare un quiz? Apri il **Quiz**. |
| `tutorial.step6` | Drag a name from the tray onto its region. Try **Sicilia**: the big island off the toe of the boot. | Ziehe einen Namen aus der Ablage auf seine Region. Versuch es mit **Sicilia**, der großen Insel vor der Stiefelspitze. | Trascina un nome dal vassoio sulla sua regione. Prova con **Sicilia**, l'isola grande davanti alla punta dello stivale. |
| `tutorial.step7` | Now get one wrong on purpose: drag **any** name onto a region it does not belong to — **Sardegna** onto the mainland, say. The region you hit flashes red, and the name is shown where it really belongs. | Jetzt ein Fehler mit Absicht: Zieh **irgendeinen** Namen auf eine Region, zu der er nicht gehört — zum Beispiel **Sardegna** aufs Festland. Die getroffene Region blinkt rot, und der Name wird dort gezeigt, wo er wirklich hingehört. | Ora sbaglia apposta: trascina **un nome qualsiasi** su una regione a cui non appartiene — per esempio **Sardegna** sulla penisola. La regione che hai toccato lampeggia in rosso e il nome viene mostrato dove si trova davvero. |
| `tutorial.step8` | Not sure where a region is? Look it up in the **overview**. | Nicht sicher, wo eine Region liegt? Schau in der **Übersicht** nach. | Non sai dov'è una regione? Controlla nella **panoramica**. |
| `tutorial.step9` | Found Sardegna? Go back to the **Quiz**. | Sardegna gefunden? Dann zurück zum **Quiz**. | Trovata la Sardegna? Torna al **Quiz**. |
| `tutorial.step10` | The regions you placed are still marked. Place a name right three times in a row and it counts as known — **Known** shows how far you have got. | Deine platzierten Regionen sind noch markiert. Dreimal hintereinander richtig, und ein Name gilt als gewusst — **Gewusst** zeigt, wie weit du bist. | Le regioni che hai posizionato restano segnate. Tre volte di fila giuste e un nome conta come imparato — **Conoscenza** mostra a che punto sei. |
| `tutorial.step11` | Last one: the **Tour** flies you to each region in turn and shows its name. Open it. | Zum Schluss die **Tour**: Sie fliegt dich nacheinander zu jeder Region und zeigt ihren Namen. Öffne sie. | Per finire, il **Tour**: ti porta da una regione all'altra e ne mostra il nome. Aprilo. |

Notes on the copy:

- The tab names match the app's own labels in each language: Overview /
  Übersicht / Panoramica, Explore / Erkunden / Esplora, Quiz, Tour. "Tray"
  follows the existing tray label (Namensablage, vassoio dei nomi).
- Steps 2 and 3 name Italy in the player's language, as the map labels it
  (#71); the row itself still reads "Italy", as the catalog names it. The
  copy keys keep their old names (`tutorial.step1` is now step 3); the
  counter comes from each step's position.
- Italian avoids gendered forms: "Ti diamo il benvenuto" rather than
  "Benvenuto", "in prima persona" rather than "tu stesso".
- Step 10 was shortened at FT-12 to fit four lines (see step 10 above).

---

## Decided at the review (2026-09-14)

- **Explore gets a step of its own**, rather than a sentence in
  step 3. The tutorial is twelve steps since FT-43 added Terrain, fourteen
  since FT-79's Europe and Italy.
- **The sandbox covers Italy — Regions only**; every other map's progress
  stays live ([The sandbox](#the-sandbox)).
- **The star is a tip in the outro**, not a step.
- **Finish leaves the player on the tour.**
- **The copy is approved as drafted.** Italian uses neutral forms instead
  of the masculine "Benvenuto" / "tu stesso".
- **The button says "Tutorial"** in all three languages.
