# v0.9.0 — The map you build yourself (planned 2026-09-19)

The programme that follows [PLAN_V0.8.md](PLAN_V0.8.md), whose beta is with
the product owner now. v0.8.0 gave every place something to say about
itself; this one acts on what he said after using it:

> _"The second line is worth it and it is very important, and as I said, it
> is worth rotating with other interesting facts. I want to invest time here
> because it is a feature I have not seen in other programs. I would like to
> make the known map the default one and change the interface. Of course what
> is known is shown, but if you tap a second region the previous region name
> stays, and to make it disappear you have to tap it again. So you can decide
> what names you want to show on the map for helping you memorize them. It
> means that the tutorial must be updated."_

Two changes, and they point the same way. **The Known map stops being a
readout and becomes something you build.** Today it shows what you have
earned and nothing else; a click reveals one name, and the next click takes
it away again. After this, a tap adds a name to the map and it stays until
you tap it off, so the map in front of you is the set you have chosen to
work on. And **the name-facts get the investment they earned**: more of them
per place, and on more maps.

**Status: planned.** The decisions below were taken by the product owner on
2026-09-19; no task is started.

---

## Product decisions (2026-09-19)

| #   | Question                                      | Decision                                                                                                                                                                           |
| --- | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | What does a map open on?                      | **Known**, not Overview. **Overview stays as a tab** — it is still the fastest way to meet a map you have never played, and nothing is taken away.                                 |
| 2   | Do the names you tap on survive?              | **Yes, remembered per map.** That is what makes it a study aid rather than a gesture: the set you are working on is still there tomorrow.                                          |
| 3   | What does tapping a name you already know do? | **Hides it; tapping again brings it back.** One rule for everything on the map, whatever put the name there. Lets you clear away what you are sure of and concentrate on the rest. |
| 4   | Does tapping still open the fact card?        | **When it puts a name on, yes; when it takes one off, no.** You are not asking about a place you are putting away.                                                                 |

## What this changes about the model

Today a name is drawn on the Known map if and only if the player has placed
it cleanly at least once (`cleanStreak >= 1`, in three strengths — FT-22).
That stays as the **default**, and a tap becomes an **override** on top of
it:

| Override | Name is drawn                       |
| -------- | ----------------------------------- |
| _none_   | if `cleanStreak >= 1` (as today)    |
| `shown`  | always, at the "asked for" strength |
| `hidden` | never, whatever the streak          |

A tap flips the override to whichever value contradicts what is on screen
now — so it always does the visible thing, and a name that becomes known
later still appears without the player having to know the rule.

## Tasks

One branch per task, `feat/ft-NN-…`; `npm run gates` before pushing; verify
in a real browser with screenshots; **ask the product owner before every
merge**; tick the ledger after each merge. 🧑 marks a point where the task
stops for the product owner.

### FT-39 — A map you build by tapping · High

- **Do:**
  - a map opens on **Known** (`/map/<id>`) rather than Overview; the map bar
    keeps both tabs and Known becomes the active one on arrival;
  - tapping a place toggles its name, per the table above, and the name
    stays until tapped off;
  - the override is remembered per map and per target, and is a per-device
    working set rather than learning progress — so it goes in
    `mapPrefs.svelte.ts` (localStorage, beside favourites and recents),
    **not** in the SQLite progress store. It is a view of a map, not a
    record of what the player knows, and it needs no schema migration in
    two native backends to say so;
  - the fact card opens when a tap reveals a name, and not when it hides
    one (decision 4);
  - a way back to plain: a **Clear** control that drops every override on
    this map, so a map cluttered with pins can be reset without hunting.
- **Tests:** the override logic is pure and unit-tested — default, shown,
  hidden, and the flip against what is currently visible; a browser test
  that two taps leave two names on the map, that a third tap on the first
  removes only that one, and that the set survives a reload.
- **DoD:** gates green; 🧑 the product owner sees it before the merge.

### FT-40 — The tutorial follows · Medium · deps: FT-39

- **Why:** the tutorial teaches the old model. Its Explore step says a click
  reveals a name, which is now only half the story, and it opens on a screen
  that is no longer the one a map opens on.
- **Do:** rework the affected steps so the tutorial teaches tapping names on
  and off as the way to build a map to study from; check every step still
  lands on the screen it thinks it does; retake the screenshots in
  `docs/TUTORIAL.md`.
- **DoD:** gates green; the tutorial run end to end on a phone-sized
  viewport and on the emulator.

### FT-42 — The card on a small screen · Medium · deps: FT-41

Raised by the product owner on 2026-09-19, while FT-39 was being merged:

> _"When it comes to phone and tablets we might have to make cuts, we might
> want to show one line and then we rotate."_

The card shows two lines — the computed one and the name-fact. On a phone
held upright that is a real share of the map, and the map is the thing being
learned. The idea is to show **one line at a time on a small screen** and
rotate between them, rather than shrink both.

Not started, and deliberately after FT-41: the rotation is worth designing
once there are several facts per place to rotate through, otherwise it is a
toggle between exactly two things. Open questions when it comes up — what
counts as a small screen, whether it rotates on a timer or on a tap, and
whether the computed line or the name-fact goes first.

### FT-41 — More facts, and more maps · Medium

- **Why:** decision-by-use. The second line is the part the product owner
  called the feature he has not seen elsewhere, so it gets the time.
- **Do:**
  - deepen the three pilot maps — more than two facts per place, so the
    rotation has somewhere to go;
  - extend to the next countries by the same rule (the name first, then the
    place), with the product owner reviewing each batch;
  - 🧑 he picks which countries come next.
- **DoD:** the orphan lint still passes; each batch reviewed before merge.

## Order

FT-39 → FT-40, since the tutorial can only be rewritten once the model it
teaches exists. FT-41 runs alongside both — it touches only `data/facts/`
and nothing FT-39 changes. FT-42 comes after FT-41, so the rotation is
designed against real depth rather than against two lines.

**→ Release `v0.9.0`** per [RELEASES.md](RELEASES.md), after v0.8.0 is
stable.

## Progress ledger

| Task  | State       | Merge     | Notes                                                                                                                                                                                |
| ----- | ----------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| FT-39 | **merged**  | `98fd98a` | a map opens on Known; a tap leaves a name until tapped again; one rule over what was earned and what was chosen, and the tap always does the visible thing                           |
| FT-40 | **merged**  | `35ba262` | steps 3 and 4 swap jobs; copy rewritten in three languages; the zoom detection moved into createMap after the tutorial stuck on step 2 because the step moved and the wiring did not |
| FT-41 | not started | —         |                                                                                                                                                                                      |
| FT-42 | not started | —         | the card on a small screen: one line at a time, rotating                                                                                                                             |

## Out of scope

- **Anything that syncs the chosen names between devices.** They are a
  per-device working set; cross-device sync is its own decision
  (DECISIONS.md, "SSO/cross-device sync deferred").
- **Changing what counts as known.** The clean streak and the ladder are
  untouched: this adds a layer over the top of them, and removes nothing.
- **FT-38, the Wikidata landmark pass**, still waiting from v0.8.0.

## Risks

- **A map that opens on Known opens nearly empty** for a player who has
  never played it — no names, just shapes. That is the point of the change,
  but it makes Overview's tab the thing a newcomer needs to find, and the
  tutorial's job (FT-40) more load-bearing than it was.
- **Pins and the ladder can disagree.** A name hidden by hand but known by
  the scheduler, or pinned but never learned, is now possible. The table
  above is the whole rule, and it needs to stay that simple.
