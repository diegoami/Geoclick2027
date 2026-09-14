# Geoclick — Tutorial script and interaction spec (FT-09)

The script for the in-app tutorial, written before any of it is built.
FT-10 (sandbox), FT-11 (engine, overlay, steps) and FT-12 (first-visit
nudge, three-language walkthrough) build exactly what's here; if one of
them needs to change the script, change this file first.

**Status: draft for the product owner's copy review.** The questions still
open are at the end.

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

An intro card, ten steps, and an outro card. The player does the real
thing at every action step; the tutorial waits for it and moves on by
itself. Only the explanation steps (3 and 9) have a Next button.

| # | Where | Highlights (`data-tutorial`) | Moves on when | What the player learns |
|---|---|---|---|---|
| Intro | home page | nothing (centred card) | Start | what's about to happen, and that nothing is saved |
| 1 | home page | `home-map-card` (Italy's "Regions" card in the country list) | the route becomes `/map/italy-regions/overview` | choosing a map |
| 2 | overview | `map` (the map), `zoom-control` (the `+`/`−` buttons) | the player zooms or pans the map | zoom and pan, with mouse, touch or buttons |
| 3 | overview | `nav-overview`, with `nav-explore` ringed too | Next | names are on the overview; magnify by hover or tap; Explore hides them |
| 4 | overview | `nav-quiz` | the route becomes `/map/italy-regions/quiz` | where the quiz is |
| 5 | quiz | `slip-sicilia` (a name slip in the tray) | a correct drop, of any slip | drag a name onto its region |
| 6 | quiz | `slip-sardegna` | a wrong drop, of any slip | what a mistake looks like |
| 7 | quiz | `nav-overview` | the route becomes `/map/italy-regions/overview` | checking a region you're unsure of |
| 8 | overview | `nav-quiz` | the route becomes `/map/italy-regions/quiz` | going back to the quiz |
| 9 | quiz | `quiz-progress` (the "1 / 20 placed" line) | Next | solved regions stay solved; spaced repetition |
| 10 | quiz | `nav-tour` | the route becomes `/map/italy-regions/tour` | Tour mode |
| Outro | tour | nothing (centred card) | Finish, or Replay | the star, and how to replay the tutorial |

How this maps onto the original request (FEATURE_BACKLOG.md §3): 1 select
a map · 2 zoom and pan (added 2026-09-13) · 3 the overview (was "switch to
the overview", which FT-13 made automatic) · 4 switch to Quiz · 5 drag a
name slip onto its region · 6 make a deliberate mistake · 7 check a region
in the overview · 8 return to the quiz · 9 spaced repetition · 10 Tour.

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
- **Moves on:** at the end of any zoom or pan **the player** made:
  MapLibre's `zoomend` or `moveend` with an `originalEvent`. That covers
  the wheel, a trackpad pinch, a touch pinch, a drag, and the `+`/`−`
  buttons (MapLibre's NavigationControl passes the click as the
  `originalEvent`). The map's own opening fit has no `originalEvent`, so
  it doesn't count. Moves on about half a second after the gesture ends,
  so the player sees that it worked.
- **Which copy:** touch copy when `matchMedia('(hover: none)')` matches,
  which is phones and tablets. Otherwise the mouse copy.

### 3. The overview — overview

Mouse:

> This is the **overview**, where every region shows its name. Hover over a
> name to enlarge it. **Explore**, next to it, hides the names: click a
> region to see which one it is.

Touch:

> This is the **overview**, where every region shows its name. Tap a name to
> enlarge it. **Explore**, next to it, hides the names: tap a region to see
> which one it is.

- **Highlight:** the Overview tab (already selected), with a lighter ring
  on the Explore tab.
- **Moves on:** Next. Explore gets one sentence, not a step of its own
  (see open question 2).
- **Off-script:** opening Explore pauses the tutorial. Resume comes back
  here.

### 4. Open the quiz — overview

> Ready to test yourself? Open the **Quiz**.

- **Highlight:** the Quiz tab.
- **Moves on:** the route becomes `/map/italy-regions/quiz`.

### 5. Place a name — quiz

> Drag a name from the tray onto its region. Try **Sicilia**: the big
> island off the toe of the boot.

- **Highlight:** the Sicilia slip. The tray scrolls it into view: slips are
  in alphabetical order, so at phone width Sicilia is below the first row.
  The region isn't highlighted; the copy already gives it away.
- **Moves on:** a correct drop of **any** slip. A player who places
  something else first has still learnt the step.
- **Card position:** at the top, below the map bar, so it never covers the
  tray or Sicily (see [Layout](#layout)).

### 6. Make a mistake — quiz

> Now get one wrong on purpose: drop **Sardegna** anywhere on the
> mainland. The region flashes red and the name goes back to the tray.

- **Highlight:** the Sardegna slip.
- **Moves on:** a wrong drop of any slip (one the quiz scores as wrong).
  A drop on the sea or back on the tray isn't scored, so the step keeps
  waiting, and so does a drop that turns out correct: it waits for a real
  mistake.
- **Why Sardegna on the mainland:** it's far from anything else, so the
  24px drop tolerance can't turn the drop into a correct one by accident.

### 7. Check in the overview — quiz

> Not sure where a region is? Look it up in the **overview**.

- **Highlight:** the Overview tab.
- **Moves on:** the route becomes `/map/italy-regions/overview`. On
  Android, the back button goes there too (FT-14), and that counts.

### 8. Back to the quiz — overview

> Found Sardegna? Go back to the **Quiz**.

- **Highlight:** the Quiz tab.
- **Moves on:** the route becomes `/map/italy-regions/quiz`.
- **What the player sees:** the quiz rebuilds from the sandbox (FT-10). The
  regions placed in steps 5 and 6 come back already solved. It's the
  quiz's normal same-day carry-over: a region placed correctly isn't due
  again until tomorrow.

### 9. Spaced repetition — quiz

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

### 10. The tour — quiz

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

- A centred card, lower on the screen so the tour stays visible behind it.
- **Finish** ends the tutorial and leaves the player on the tour (see open
  question 4).
- **Replay** starts again from the intro, with a fresh sandbox.
- The star gets a sentence here rather than a step (open question 3).

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

- **Step counter:** "Step 3 of 10" on the numbered steps.
- **Skip** (every card, and Esc on a keyboard) ends the tutorial straight
  away, with no confirmation: it's cheap to restart, and a confirmation
  would get in the way of a player who knows the app.
- **Back** (steps 2 to 10) shows the previous step, and goes to its screen
  if that's a different one. A step whose action is already done when it's
  shown (you're already on the quiz; a correct drop has already happened)
  shows **Next** instead of waiting. The tutorial remembers which actions
  happened: zoomed or panned, dropped correctly, dropped wrongly.
- **Next** only on steps 3 and 9, and on any step whose action is already
  done (above).
- **Focus:** each new card takes keyboard focus. Its buttons are reachable
  with Tab, and the card is announced as a dialog without trapping focus
  (the player has to reach the real controls).

### Going off-script

Any route change that isn't the step's own screen or its target pauses
the tutorial. Examples: opening another map, the Explore tab, the map
list, or Tour before step 10.

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
that's just a route change, handled like any other: in step 7 it's the
expected move, elsewhere it pauses. On the map list, back closes the app
as usual, and the tutorial is gone with it.

### Reloading

The tutorial lives in memory. A browser reload, or closing the app, ends
it. The sandbox goes with it and real progress is untouched.

---

## The sandbox

What FT-10 builds, refined here with one change to its spec in
FEATURE_PLAN.md, which is flagged for the product owner (open question 5).

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
  usual. Today `setVisitRecording(on)` switches recording off for every
  map, so FT-10 narrows it to the tutorial map.
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
  whichever doesn't cover the highlighted element. On the quiz it's always
  the top, just below the map bar, because the tray is at the bottom.
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
| `map` | the map container | every map view |
| `zoom-control` | MapLibre's `+`/`−` group | third-party DOM: set the attribute after `addControl` in `createMap` |
| `nav-overview`, `nav-explore`, `nav-quiz`, `nav-tour` | MapNav's tabs | |
| `slip-<targetId>` | each quiz slip | e.g. `slip-sicilia`, `slip-sardegna` |
| `quiz-progress` | the "N / M placed" line | |

The drop steps need one more thing from QuizView: a hook called on every
**scored** drop with `{ correct }`. It does nothing when no tutorial is
running.

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
| `tutorial.intro.title` | Welcome to Geoclick | Willkommen bei Geoclick | Benvenuto in Geoclick |
| `tutorial.intro.body` | Learn the map by playing with it. This short tutorial takes about three minutes and you'll try every part of the app yourself. Nothing you do in it counts towards your progress. | Lerne die Karte, indem du mit ihr spielst. Dieses kurze Tutorial dauert etwa drei Minuten, und du probierst jeden Teil der App selbst aus. Was du dabei machst, zählt nicht für deinen Fortschritt. | Impara la mappa giocandoci. Questo breve tutorial dura circa tre minuti e proverai tu stesso ogni parte dell'app. Quello che fai qui non conta per i tuoi progressi. |
| `tutorial.outro.title` | You're all set | Alles bereit | Tutto pronto |
| `tutorial.outro.body` | Pick any map and play. Tip: the star on a map keeps it at the top of your list. You can replay this tutorial any time with the Tutorial button. | Wähle eine beliebige Karte und leg los. Tipp: Mit dem Stern bleibt eine Karte oben in deiner Liste. Du kannst dieses Tutorial jederzeit über die Schaltfläche „Tutorial“ wiederholen. | Scegli una mappa qualsiasi e gioca. Suggerimento: con la stella una mappa resta in cima all'elenco. Puoi rifare questo tutorial quando vuoi con il pulsante Tutorial. |

### Steps

| Key | English | Deutsch | Italiano |
|---|---|---|---|
| `tutorial.step1` | Let's start with a map. Open **Regions**, under Italy. | Fangen wir mit einer Karte an. Öffne **Regionen** unter Italy. | Iniziamo con una mappa. Apri **Regioni**, sotto Italy. |
| `tutorial.step2` | Zoom with the mouse wheel or the **+** and **−** buttons, and drag the map to move around. Try it now. | Zoome mit dem Mausrad oder den Tasten **+** und **−**, und ziehe die Karte, um dich zu bewegen. Probier es aus. | Usa la rotellina del mouse o i pulsanti **+** e **−** per lo zoom, e trascina la mappa per spostarti. Prova ora. |
| `tutorial.step2.touch` | Pinch to zoom, or use the **+** and **−** buttons, and drag with one finger to move around. Try it now. | Zoome mit zwei Fingern oder den Tasten **+** und **−**, und verschiebe die Karte mit einem Finger. Probier es aus. | Usa due dita o i pulsanti **+** e **−** per lo zoom, e trascina la mappa con un dito per spostarti. Prova ora. |
| `tutorial.step3` | This is the **overview**, where every region shows its name. Hover over a name to enlarge it. **Explore**, next to it, hides the names: click a region to see which one it is. | Das ist die **Übersicht**: Hier steht jede Region mit ihrem Namen. Fahre mit der Maus über einen Namen, um ihn zu vergrößern. **Erkunden** daneben blendet die Namen aus: Klicke auf eine Region, um zu sehen, welche es ist. | Questa è la **panoramica**, dove ogni regione mostra il suo nome. Passa il mouse su un nome per ingrandirlo. **Esplora**, lì accanto, nasconde i nomi: clicca una regione per scoprire qual è. |
| `tutorial.step3.touch` | This is the **overview**, where every region shows its name. Tap a name to enlarge it. **Explore**, next to it, hides the names: tap a region to see which one it is. | Das ist die **Übersicht**: Hier steht jede Region mit ihrem Namen. Tippe auf einen Namen, um ihn zu vergrößern. **Erkunden** daneben blendet die Namen aus: Tippe auf eine Region, um zu sehen, welche es ist. | Questa è la **panoramica**, dove ogni regione mostra il suo nome. Tocca un nome per ingrandirlo. **Esplora**, lì accanto, nasconde i nomi: tocca una regione per scoprire qual è. |
| `tutorial.step4` | Ready to test yourself? Open the **Quiz**. | Bereit für den Test? Öffne das **Quiz**. | Vuoi metterti alla prova? Apri il **Quiz**. |
| `tutorial.step5` | Drag a name from the tray onto its region. Try **Sicilia**: the big island off the toe of the boot. | Ziehe einen Namen aus der Ablage auf seine Region. Versuch es mit **Sicilia**, der großen Insel vor der Stiefelspitze. | Trascina un nome dal vassoio sulla sua regione. Prova con **Sicilia**, l'isola grande davanti alla punta dello stivale. |
| `tutorial.step6` | Now get one wrong on purpose: drop **Sardegna** anywhere on the mainland. The region flashes red and the name goes back to the tray. | Jetzt ein Fehler mit Absicht: Lege **Sardegna** irgendwo auf dem Festland ab. Die Region blinkt rot, und der Name geht zurück in die Ablage. | Ora sbaglia apposta: lascia **Sardegna** in un punto qualsiasi della penisola. La regione lampeggia in rosso e il nome torna nel vassoio. |
| `tutorial.step7` | Not sure where a region is? Look it up in the **overview**. | Nicht sicher, wo eine Region liegt? Schau in der **Übersicht** nach. | Non sai dov'è una regione? Controlla nella **panoramica**. |
| `tutorial.step8` | Found Sardegna? Go back to the **Quiz**. | Sardegna gefunden? Dann zurück zum **Quiz**. | Trovata la Sardegna? Torna al **Quiz**. |
| `tutorial.step9` | The regions you placed are still marked: what you solve stays solved. Each one comes back for review later, sooner if it gave you trouble, and less often each time you get it right. The map list shows how many are due on each map. | Die Regionen, die du platziert hast, sind noch markiert: Was du löst, bleibt gelöst. Jede kommt später zur Wiederholung zurück, früher, wenn sie dir schwerfiel, und seltener, je öfter du sie richtig hast. Die Kartenliste zeigt, wie viele auf jeder Karte fällig sind. | Le regioni che hai posizionato sono ancora segnate: quello che risolvi resta risolto. Ognuna torna più avanti per un ripasso, prima se ti ha dato problemi e sempre più di rado ogni volta che la indovini. L'elenco delle mappe mostra quante sono da ripassare su ogni mappa. |
| `tutorial.step10` | Last one: the **Tour** flies you to each region in turn and shows its name. Open it. | Zum Schluss die **Tour**: Sie fliegt dich nacheinander zu jeder Region und zeigt ihren Namen. Öffne sie. | Per finire, il **Tour**: ti porta da una regione all'altra e ne mostra il nome. Aprilo. |

Notes on the copy:

- The tab names match the app's own labels in each language: Overview /
  Übersicht / Panoramica, Explore / Erkunden / Esplora, Quiz, Tour. "Tray"
  follows the existing tray label (Namensablage, vassoio dei nomi).
- Step 1 says "Regions, under Italy" because that's what the card says:
  in the country list the card is labelled "Regions" under the heading
  "Italy". Country names stay in English in every language (DECISIONS.md,
  i18n), hence "unter Italy" and "sotto Italy".
- Italian: "Benvenuto" and "tu stesso" are masculine forms, as Italian
  apps usually write; open question 6 asks whether you'd rather avoid them.
- Step 9 has the longest copy, and at phone width in German it probably
  won't fit four lines. FT-12 checks, and if it doesn't fit the last
  sentence goes.

---

## Open questions for the copy review

1. **Is the copy right?** It's product text, so it's your call: tone,
   length, and each language.
2. **Explore:** one sentence in step 3 (as drafted), a step of its own, or
   not mentioned at all?
3. **The star:** a tip in the outro (as drafted), a step on the home page,
   or not mentioned?
4. **Finish:** leave the player on the tour (as drafted), or take them to
   the map list?
5. **Sandbox scope:** sandbox only Italy — Regions and leave every other
   map's progress live (as drafted, changing FT-10's spec), or FT-10's
   original "everything in memory" during the tutorial?
6. **Italian forms:** keep "Benvenuto" / "tu stesso", or use neutral
   wording ("Ti diamo il benvenuto", "proverai in prima persona")?
7. **The button label:** "Tutorial" in all three languages (as drafted;
   common in German and Italian), or "Einführung" / "Guida"?
