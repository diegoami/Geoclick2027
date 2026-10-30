# Geoclick — User manual

This manual explains Geoclick to someone who wants to understand it without
installing or running it. Every screen is shown with a screenshot, and every
button, label and message is explained: what it looks like, what it does, and
what the player sees in return. Geoclick is made by Diego Amicabile.

It describes **Geoclick v1.2.0**, including the current fixes on main. The
running version and build identifier appear in the small version badge and on
the About page.

The screenshots come from the web version, on a laptop-sized window and on a
phone-sized screen, and are made by a script (`npm run manual-shots`) that can be
rerun to keep this manual current. These web screenshots were refreshed on
30 October 2026. The Windows and Android apps share these game
screens (see [Getting Geoclick](#2-getting-geoclick)); the two pictures of the
app windows in that section are older. The progress shown in the screenshots
(how much of each map is known, favourites and so on) is made-up example data.

## Your first five minutes

1. Open Geoclick and choose **List**. Search for **Denmark** and choose its
   **Regions** map: five regions make a manageable first round.
2. The map opens on **Known**. With no quiz answers yet, it has no earned names.
   Choose **Overview** to study the five names. Zoom in when a label is small.
3. Choose **Quiz** and leave **Place names** selected. Click or tap a name in
   the tray, then its region. You can also drag the name onto the region.
4. A correct answer stays green. A mistake shows the right location in brown;
   read it, then continue with the next name. Each name gets one answer per round.
5. Finish all five names to see **Done!** and your score. Close the panel with
   **×**, then choose **Play again**, or choose **Known** to see what you earned.
6. Return for more rounds. Three correct answers across rounds take a new name
   to **Known** if you make no intervening mistakes. Use **Tour** whenever you
   want the game to introduce the places one at a time.

Prefer a guided introduction? Press **?** on the start screen and then
**Start**. The tutorial uses Italy and keeps its practice separate from your
real progress.

## Contents

- [Appearance and text size](#appearance-and-text-size)
1. [What Geoclick is](#1-what-geoclick-is)
2. [Getting Geoclick](#2-getting-geoclick)
3. [How the screens fit together](#3-how-the-screens-fit-together)
4. [The start screen](#4-the-start-screen)
5. [Map screens: what they have in common](#5-map-screens-what-they-have-in-common)
6. [Known: the map you build](#6-known-the-map-you-build)
7. [Overview: see every name](#7-overview-see-every-name)
8. [Quiz: drag the names onto the map](#8-quiz-drag-the-names-onto-the-map)
9. [What counts as known](#9-what-counts-as-known)
10. [Tour: a guided flight over the map](#10-tour-a-guided-flight-over-the-map)
11. [Towns maps](#11-towns-maps)
12. [Facts and name origins](#12-facts-and-name-origins)
13. [Terrain](#13-terrain)
14. [My maps: favourites and recent](#14-my-maps-favourites-and-recent)
15. [The tutorial](#15-the-tutorial)
16. [Languages](#16-languages)
17. [On a phone](#17-on-a-phone)
18. [The Windows and Android apps](#18-the-windows-and-android-apps)
19. [Your data and privacy](#19-your-data-and-privacy)
20. [The maps](#20-the-maps)
21. [Questions and answers](#21-questions-and-answers)
22. [Glossary](#22-glossary)

---


## Appearance and text size

Choose **Appearance** (the A− / A+ icon) in the start screen toolbar or a
map's **Settings** panel, including during a quiz. Settings starts collapsed;
click **Settings** again to hide it. Use **A−** and **A+** to choose a text
size from 50% to 300%; **Reset** returns text to 100%. All interface text,
quiz names and map labels follow the size. Geographic map zoom is separate.

Choose **Classic**, **Ocean**, **Forest** or **High contrast** to change
interface and label colors. Geographic map colors retain their meaning;
High contrast does not replace the basemap with a dark map. Settings apply
immediately and are remembered on this device when storage is available.
Use the close button or Escape to return to the map. If the map toolbar is
hidden, show it with the button below the map zoom controls first.

## 1. What Geoclick is

Geoclick is a game for learning geography: where a country's regions, states
or provinces are, where its main towns and cities are, and where the countries
and capitals of a continent are.

- **221 maps across 81 countries and the six continents.** Most countries have
  two maps: its regions (called states, provinces, prefectures or districts,
  depending on the country) and its larger towns. Some also have finer, more
  detailed maps. See [The maps](#20-the-maps).
- **Four ways to use each map:**
  - **Known:** the map you build. Names you have placed right in the quiz are
    written on it as strongly as you know them, and you can tap any place to
    add its name and read a fact about it;
  - **Overview:** the whole map with the names written on it, to look at and
    learn from, as many as fit without overlapping, the rest a zoom away;
  - **Quiz:** the game itself. Drag (or tap) each name from a tray onto the
    map, or name the place that lights up;
  - **Tour:** the map flies from place to place on its own, showing each name
    in turn.
- **It remembers what you know.** Each name climbs one step every time you
  place it right on the first try, and counts as known after three steps; a
  mistake takes it down one step. The better you know a map, the fewer names
  its quiz offers at a time.
- **Most places have something to say.** A name's origin and something about
  the place: see [Facts and name origins](#12-facts-and-name-origins).
- **Three languages:** English, German and Italian, for the buttons and for
  the facts.
- **No account, no sign-up.** Everything is kept on the device you play on.
- **Three ways to play:** in a web browser, as a Windows app, or as an Android
  app. All three are the same game.
- **A built-in tutorial** walks a new player through it in about three minutes.

## 2. Getting Geoclick

- **In a web browser:** open https://geoclick.netlify.app/. Nothing to
  install; it works in any recent browser, on a computer or a phone.
- **Windows and Android apps:** download them from the public releases page,
  https://github.com/diegoami/Geoclick2027/releases/latest. The web
  version's About page links there too ("Download for Windows or Android").
  - **Windows:** run the `-setup.exe` file (or the `.msi`). Windows SmartScreen
    warns about an "unknown publisher", because the installer isn't
    code-signed; choose *More info*, then *Run anyway*.
  - **Android:** open the `.apk` file on the phone and allow Android to install
    apps from unknown sources when it asks. Geoclick isn't in the Play Store.
- **Previews:** the releases page sometimes also has *alpha* or *beta* versions,
  marked as pre-releases. They're test builds of the next version; the one
  marked *Latest* is the normal one.
- **Source code:** https://github.com/diegoami/Geoclick2027.

The Windows app is a window showing the same screens as the website:

![The Windows app, showing the France — Regions map](manual/windows-app.jpg)

The Android app fills the phone screen, under the phone's own status bar:

![The Android app, showing the Argentina — Regions map on a phone](manual/android-app.jpg)

## 3. How the screens fit together

- The **start screen** is where you choose a map: a world map and a list.
- Choosing a map opens it on **Known**.
- On every map screen, a row of buttons at the top (the *map bar*) switches
  between **Known**, **Overview**, **Quiz** and **Tour** for that map, or goes
  back to the start screen (**Maps**).
- **My maps** (your favourites and recent maps) and **About** open from the
  start screen's toolbar; the **user manual** opens from About.
- The **tutorial** can be started from the start screen or from any map screen,
  and it takes you through the main screens in turn.

Every screen has a web address of its own, for example `/map/italy-regions/quiz`
for the Italy — Regions quiz, so a screen can be bookmarked or shared as a link.

## 4. The start screen

This is the first screen. It opens on a map of the world (or on the continent you
left it on), with the continents named on it, and a panel of maps beside it.

![The start screen: the world map and the continents](manual/home-map.jpg)

**The toolbar** is one bar of icons. Each icon's name shows when you hover it,
and a screen reader reads it:

- **Geoclick**, the name, on the left (hidden on a narrow phone);
- **Map / List**, two icons side by side: the world map with its panel, or the
  list of every map. Your choice is kept;
- **★ My maps**: your favourites and recent maps, on a page of their own, with
  a number on the star saying how many there are (see
  [My maps](#14-my-maps-favourites-and-recent));
- **EN**: the language (see [Languages](#16-languages));
- **?**: starts the [tutorial](#15-the-tutorial);
- **ⓘ About**: what Geoclick is, the version, the credits, the link to this
  manual, and in the web version the link to download the apps;
- **Exit**: closes the app, in the Windows and Android apps only.

**The version badge**, in small grey type at the top left, shows the version
number and a short build code, for example `v0.19.0 · d858a67`. It is useful
when reporting a problem.

### Choosing a map on the world map

- Tap a **continent**, or the sea near it, to enter it: the panel then lists
  that continent's countries. Tap the sea nearest the continent you are in to
  open its **Countries** map.
- Tap a **country's name** on the map to open its main map straight away, on
  Known. A country with no map of its own tells you so.
- In the panel, every row has a **map-type menu** on its right (Countries,
  Capitals, Regions, Towns…). Choosing a type opens that map at once; tapping
  the country's name opens the one the menu shows. The menu remembers the last
  type you chose for each country.

Standard maps come first in a country's menu, whole nations before their
parts. The finer ones are listed below a line, after the standard ones (see
[Detailed maps](#detailed-maps)).

### What you know, on the world map

Once you have played, the world map shows how far you have got:

- A country you have played is painted from pale to full green, by how much of
  it you know. Its regions and towns maps count; detailed maps don't.
- A country you know completely gets a **gold outline**.
- A country you have never played keeps its continent's colour.

A small legend on the map shows the green ramp and your total across all
maps, for example "1 240 / 9 800 names known".

### What to play next

One line above the map (or the list) suggests a map to play, for example:

- "Continue Italy — Regions — 14 / 20 known": a map you have started;
- "Play Italy — Regions again — 3 slipped a level last time": a map where your
  last round lost ground;
- "Next: Italy — Towns — you know all of Italy — Regions": the next map of a
  country whose map you know completely.

Press the line to open that map's quiz. It is hidden when there is nothing to
suggest, and during the tutorial.

### The list

The **List** view is the same rows without the map, in alphabetical groups, with
a search box above them:

![The start screen as a list, with the search box](manual/home-list.jpg)

### Finding one map among many

Type a few letters in the **search box** and the list narrows to what
matches, with a count underneath:

![Searching for "towns"](manual/home-search.jpg)

- It matches the **country** ("korea" finds South Korea) and the **kind of
  map** ("towns" finds every towns map).
- Accents and capitals do not matter, and two words narrow rather than widen.
- It searches what you can see, so it follows the language you are in: in
  German, "Städte" finds the towns maps.
- **Clear**, or the Escape key, puts the whole list back.

### The first visit

On a device that has never used Geoclick, a beige box at the top offers the
tutorial:

![The start screen on a first visit, with the tutorial offer](manual/home-first-visit.jpg)

- **"New here? A three-minute tutorial shows you around."**
- **Start the tutorial** (orange) starts it.
- **No thanks** hides the box.

Either way the box never comes back on that device. Nothing ever starts by
itself.

### Detailed maps

Some countries have finer maps: districts, provinces, municipalities, the parts
of a large country, towns of 50 000 and up. They have hundreds of places, so
they are not offered first. In a country's menu they sit below a line, and in a
map's type row a **Settings → Show detailed maps** tick adds them (see
[The type row](#the-type-row)). Once you have opened a detailed map it joins
the standard ones, in the menu and in the type row.

## 5. Map screens: what they have in common

Every map screen (Known, Overview, Quiz and Tour) has the same frame around
the map. Here it is on Known, for Italy — Regions:

![A map screen: the map bar, the type row, the zoom buttons](manual/known.jpg)

**Top left, the map bar:**

- **‹ Maps**: back to the start screen.
- **Known**, **Overview**, **Quiz**, **Tour**: the four modes of this map, each
  with a small icon (a compass, an eye, a tick in a circle, a play triangle).
  The current one is filled orange with white text; the others are white with
  orange text.

### The type row

Under the map bar, a row of buttons lists the other maps of the same country
or continent: here **Regions** (the open one, in orange) and **Towns**. Press
one to switch to it without going back to the start screen; the row wraps onto
a second line rather than scrolling.

- **The star** at the end of the row marks the map as a favourite (filled and
  orange when it is one).
- **Settings → Show detailed maps** is a tick below the row. Ticked, the row also lists
  the country's detailed maps:

![Germany's type row with Show detailed maps ticked](manual/type-bar.jpg)

- A detailed map you have opened stays in the row, with a large **red X** on its
  button. The X sends it back behind the tick again. It does not show on the map
  you are in, or while the tick is on.

![Germany's type row after opening a detailed map: its button has a red X](manual/type-bar-x.jpg)

### The other controls

**Settings**, below the map selector, starts collapsed. Open it for **Show
detailed maps**, the language menu, **Terrain**, **Sound** (in a quiz),
**Appearance** and **Tutorial**. Click Settings again to hide these controls.
The quiz-mode buttons remain outside Settings, directly under the map selector.

- **EN ⌄**: the language menu (English, Deutsch, Italiano):

![The language menu](manual/language-menu.jpg)

- **Terrain**: shows or hides the landscape behind the map (see
  [Terrain](#13-terrain)).
- **Sound**, on the quiz only, beside **Terrain**: turns the answer sounds on
  or off. It starts off. When it is on, a right answer plays two short, quiet,
  rising notes and a wrong one a low note. Your choice is kept.
- **Tutorial**: starts the tutorial.
- **Appearance**: choose 50–300% text size and a color scheme (see
  [Appearance and text size](#appearance-and-text-size)).
- **On the quiz only**, the visible **Place names / Name places** pair chooses
  how the quiz asks (see [Name places](#name-places)). Before your first answer,
  **Practise the N not yet known** may appear beside it (see
  [Every round is the whole map](#every-round-is-the-whole-map)).
  These gameplay controls are outside Settings. There is no instruction or
  running placed/named counter line.

**Top right:**

- **+** and **−** zoom in and out.
- **The arrow** below them turns the map back to "north up" if it has been
  rotated (with a right-button drag on a computer, or a two-finger twist on a
  touch screen). Most players never rotate the map.
- **The eye** hides the map bar, the type row and the pills so that the map has
  the whole screen, which helps in a quiz on a small tablet. Press it again to
  bring them back. The choice lasts until you close the app.

![The same map with the buttons hidden](manual/buttons-hidden.jpg)

**Bottom right:** a line of small print saying where the map's data comes from
(on a phone it starts folded behind an ⓘ). **The version badge** is at the top
left.

### Moving around the map

On every map screen the map can be zoomed and moved:

| | With a mouse or trackpad | On a touch screen |
|---|---|---|
| Zoom in or out | the mouse wheel, a trackpad pinch, or **+** / **−** | pinch with two fingers, or **+** / **−** |
| Zoom in one step | double-click | double-tap |
| Move the map | drag it | drag with one finger |

A drag or pinch can start anywhere, including on a name written on the map.

### Colours

On Known, Quiz and Tour, regions are painted in soft pinks, blues, purples,
oranges and greys, chosen so that neighbouring regions never share a colour. On
the Overview every region is the same green, because none of them is hidden
from you there. In the quiz, green means *placed*.

## 6. Known: the map you build

A map opens here. It shows the names you have earned, and the ones you choose:

![Known: some names strong, some lighter, some faint](manual/known.jpg)

A name is written on the map for either of two reasons:

- **You have placed it right in the quiz** at least once. It is drawn as
  strongly as you know it, by its *level* (see
  [What counts as known](#9-what-counts-as-known)):

| How the name looks | What it means |
|---|---|
| **Known**, solid | the top level: placed right on the first try three times more than you have missed it, roughly |
| **Nearly**, lighter | one step below |
| **Seen once**, faint | two steps below |

- **You tapped it.** It is then drawn as **Chosen**.

A small legend in the bottom-left corner names the four styles. A name with no
level is left off until you tap its place.

**Tap a place to put its name on the map; tap it again to take it off.** Tapping
a place whose name is already shown hides it, so you decide which names are in
front of you. Choosing a second place does not remove the first. A **Clear**
button appears in the legend while you have made choices, and puts the map back
to what you have earned. Your choices last for the sitting: when the app is
reopened, the map shows what you know and nothing else.

Putting a name on the map also opens the place's **fact card**, with its name and
something about it (if there is anything to show; taking a name off closes the card):

![Tapping Sicilia puts its name on the map and opens its fact card](manual/known-fact.jpg)

Because a mistake takes a name down a step, this map is an honest picture of
what you actually know. Nothing here is scored. On a towns map, tap a town's dot.

**A map you have never played** shows a small card, **"Nothing known yet"**,
with an **Overview** button to study the names and a **Quiz** button to start
playing.

![A new map: Nothing known yet, with Overview and Quiz buttons](manual/known-empty.jpg)

### Starting a map over

When you have earned anything on the map, the legend also has a **Reset
progress** button. It asks first, in a dialog: "Reset your progress on Italy —
Regions?". **Cancel** leaves everything as it was; **Reset** sends every name
of this map back to unknown. It also clears the names you tapped and a round
you left half played. Your other maps, your favourites and the map's last
score stay as they are.

![Reset progress asks for confirmation before erasing the map’s earned levels](manual/reset-progress.jpg)

Do not confuse it with **Clear**, which only takes off the names you chose by
tapping and changes nothing you have earned.

## 7. Overview: see every name

Every region is painted the same green and has its name written on it, in dark
letters with a pale halo; on a towns map each town's name is white on a dark green
label beside its dot. This is the screen to study from. Nothing is scored here.

![Overview: every region named](manual/overview.jpg)

**Names never overlap.** A name that has no room where it belongs first tries a
line above or below its place, or is stretched along the region where it fits.
Only when nothing is free is it left out, the way an atlas does, rather than
printing two names on top of each other. When two names want the same spot, the
larger region keeps its name. Nothing is lost: **zoom in** and the names that
were left out appear as room is made for them. A region's name is drawn along
the region's long direction where that fits, and then it grows or shrinks as you
zoom; the others keep their size on screen.

**Enlarging a name:** names are small so that they fit, but any one of them can
be enlarged. With a mouse, point at it; on a touch screen, tap it (tap it
again, or tap anywhere else, to shrink it back). The name grows and rises above its
neighbours:

![Overview: pointing at Toscana enlarges it](manual/overview-magnified.jpg)

Tapping a place also opens its fact card (see [Facts](#12-facts-and-name-origins)).

## 8. Quiz: drag the names onto the map

The quiz is the game. The map is shown in colour without names, and the names to
place are in a **tray** along the bottom of the screen, in a fixed, roughly alphabetical order.
Here the quiz on Denmark's five regions, at the start:

![The quiz at the start: five names in the tray](manual/quiz-start.jpg)

On a map you have not learned, the tray holds **ten names at a time** and
refills as you place them. Once you know a map, it holds back more (see
[Fewer names as you improve](#fewer-names-as-you-improve)).

### Dragging a name

Press on a name in the tray (with the mouse button, a finger or a pen), drag it
over the map, and let go on the region you think it belongs to. While you drag,
the name follows the pointer, and the region under it lights up blue:

![Dragging Midtjylland over its region](manual/quiz-dragging.jpg)

The blue highlight only shows *where* you are, not whether it's right. It's the
same colour on every region.

- **Letting go on the sea, off the map, or back on the tray** doesn't count as
  anything: the name simply goes back to the tray. That's the way to change your
  mind in the middle of a drag.
- **Small regions** (a city-state like Berlin, or Molise in Italy) are
  forgiving: a drop just next to them still counts for them. The forgiveness
  only ever helps the right answer.

**On a touch screen** your finger would hide the place you are aiming at, so
while you drag, the name floats above your finger with a small orange-ringed
pin below it. The pin is the point that counts: the region under the pin
lights up, and the drop lands where the pin is. Near the top of the screen the
pin goes below your finger instead. With a mouse, the name lands where the
pointer is, as before.

### Tapping instead of dragging

You don't have to drag. Tap (or click) a name in the tray to pick it up: it
lifts and is outlined, and the line "Now tap its place on the map" appears.
Then tap its place on the map. To let the name go without answering, tap it
again, tap the tray's empty space, or press Escape.

![Midtjylland selected: the game asks you to tap its place on the map](manual/quiz-selected.jpg)

A tap counts exactly like a drop: small regions are just as forgiving, and on a
towns map the nearest town counts. Moving the map around while a name is
picked up doesn't count as an answer.

### Right

The region turns green, its name stays written on it, and the name leaves the
tray. The counter goes up:

![Two regions placed](manual/quiz-progress.jpg)

### Wrong: one mistake ends that name's turn

There are no second tries. The region you dropped on flashes red for a moment,
and at the same time the name is placed where it really belongs, so the mistake
shows you the answer. That name is marked differently from one you placed
yourself: its region turns a muted gold-brown instead of green, and its label is
brown. A fact card about it stays up until your next drop, because that is the
moment worth reading it.

![A wrong drop: Syddanmark dropped elsewhere is shown in its own place](manual/quiz-wrong.jpg)

A name shown after a mistake counts as a mistake in your score, and takes that
name down one step: a known name becomes "nearly" known, and one right answer in
a later round brings it back (see [What counts as known](#9-what-counts-as-known)).

### Names you mix up

When you drop a name on the wrong place, Geoclick remembers the pair: the name,
and the place you put it on. In later rounds, a name you mixed up comes into the
tray together with the name it was mixed up with, so you have to tell the two
apart. A pair is forgotten once you know both names.

### Fewer names as you improve

A map gets harder as you learn it. Geoclick counts how many of its names you
know and offers fewer names at a time as that share grows:

| Names of the map you know | The tray offers |
|---|---|
| under a quarter | 10 at a time |
| a quarter or more | 6 at a time |
| 60 % or more | 3 at a time |
| 85 % or more | 1 at a time |

The tray refills as you place names, so there is always something to drag until
the round is done; the names you haven't placed yet simply wait their turn.

![Italy, mostly known: the quiz offers three names at a time](manual/quiz-hand.jpg)

Why it gets harder: with every name in front of you, the last few drops of a
round can be worked out by elimination. With one name at a time, you have to
know where it goes.

### Resizing the tray

The short grey bar at the top of the tray is a handle. Drag it up to make the
tray taller, or down to see more of the map. With a keyboard, move to the handle
with Tab and use the arrow keys. When there are more names than fit, the tray
scrolls. When the quiz opens, the map is fitted into the space above the tray, so
no region starts hidden under it.

### The end of a quiz

When the last name is placed, a panel appears over the map with your score:

![The score panel: Done!](manual/quiz-done.jpg)

- **"Done!"**
- **"5 / 5 placed correctly on the first try."** A name counts only if it was
  right on the very first drop.
- **"Last time: 14 / 20."** The same count for your previous round on this
  map, when there was one.
- **"2 total mistakes."** All wrong drops together.
- **"2 shown after a mistake."** Only when some names had to be shown.
- **"Time: 1:42"**, on a timed round only (see [Best time](#best-time)).
- **"14 / 20 known"** (with "· 3 names at a time" when it applies): where the
  round leaves you. "· Slipped a level: 2" is added when a mistake took names
  down a step.
- **Newly known**: the names this round made known.
- **To work on**: the names you got wrong.
- **Mixed up**: each wrong drop as a pair, for example "Molise placed on
  Abruzzo".

  Press a name in these lists to open its fact card. A long list ends with
  "+4 more".
- **Study these** opens Known with the names to work on written on the map as
  **Chosen**, so you can look at them before the next round.
- **Practise the 6 not yet known** starts a practice round (see
  [Every round is the whole map](#every-round-is-the-whole-map)).
- **×**, top-right, closes the panel so you can look at the finished map. To
  play a new round on that map, choose **Play again** on the map. The map bar's
  **Maps** button returns to the start screen.

![A completed round with a mistake: To work on, Mixed up and Study these](manual/quiz-review.jpg)

For example, if you put **Syddanmark** on **Midtjylland**, the result lists
Syddanmark under **To work on** and records the pair under **Mixed up**.
Choose **Study these** to open Known with the missed name already chosen.
Looking at it helps you study; the next quiz answer is what changes its level.

### Every round is the whole map

A quiz normally asks for every name on the map, and Geoclick keeps track of how
well you know each name as you go.

When you know some of a map's names but not all of them, a **Practise the 6 not
yet known** button offers a shorter round. It appears beside the quiz-mode controls
(only before your first answer of a round), on the score panel, and next to
**Play again**. In a practice round the names you know start out already placed
on the map, and only the others are asked. The visible quiz controls then show
"Practice ·". Answers count exactly as in a full round: practice can raise or lower the
levels of the names it asks. It is a shorter scored round, rather than an
unscored rehearsal. Names already known are left at their existing levels.

![Practice on Italy: known regions are already placed and six names remain to learn](manual/quiz-practice.jpg)

### Best time

Once you know every name of a map, its rounds are timed. Only the time you
spend in the quiz counts, and no clock shows while you play. The score panel
then shows the time, for example "Time: 1:42", with **"New best!"** when a
round with no mistakes beats your best. A round with mistakes says "Only a
round with no mistakes sets a best time." The best time also shows in
[My maps](#14-my-maps-favourites-and-recent).

### Leaving in the middle

You can step out of a round and come back to it. Looking a name up in the
**Overview** and returning to the **Quiz** leaves the round exactly as it was:
the names you placed are still marked, and the tray still holds the ones you
haven't. Reloading the page, or coming back another day, starts a fresh round.

### Name places

The quiz can also ask the other way round. Below the map selector, two joined
buttons choose how it asks: **Place names** (the quiz described so far) and
**Name places**. In **Name places**, one place on the map lights up blue, and
the tray offers its name among four names. The other names are its nearest
neighbours, so you can't guess by distance. As you learn the map, the choice
grows to five names (from 60 % known) and six (from 85 %).

![Name places: a region lights up and the tray offers numbered answers](manual/quiz-name-places.jpg)

Pick a name with a tap or a click, or with the number keys **1** to **6**: each
name shows its number. A wrong pick works as in the drag quiz: the place you picked flashes
red, the right name is shown on the lit-up place, and its fact card opens.
Answers count towards the same levels as in **Place names**.

Switching between the two starts a new round. Your choice is kept for next
time. The tutorial always uses **Place names**.

### What the quiz needs

**Place names** needs a mouse, a trackpad, a finger or a pen to choose the
place, by dragging or by tapping. A name in the tray can be picked up with Tab
and Enter, but its place is chosen with the pointer. **Name places** can be
played with the keyboard alone, with the number keys.

## 9. What counts as known

Geoclick keeps one number for every place on every map: its *level*, from
nothing up to known. It moves one step at a time:

| What happened in the quiz | The place's level |
|---|---|
| **Right on the first try** | one step up: nothing → Seen once → Nearly → Known |
| **Shown after a mistake** | one step down: Known → Nearly → Seen once → nothing |
| **Never played** | nothing |

A place counts as **known** at the top level, three steps up. Roughly, that
means you have placed it right three times more than you have missed it. Time
never lowers a level: a map you leave for a month is still known when you come
back. That one number drives everything you see:

- the bar on the map's card in [My maps](#14-my-maps-favourites-and-recent);
- the colours of the world map on the start screen;
- the Known map, where a known name is written at full strength, a nearly known
  one more lightly, and one seen once faintly;
- how many names the quiz offers at a time.

Because a mistake takes a name down only one step, one slip on a name you know
well makes it "nearly" known, and the next right answer makes it known again.
A name you keep missing goes down step by step until it has no level at all.
Progress from earlier versions keeps working: a name that was known is still
known. To start a map over, use **Reset progress** on Known (see
[Starting a map over](#starting-a-map-over)).

Underneath, Geoclick also keeps a review date for each place (the *spaced
repetition* idea that flashcard apps such as Anki use). Nothing in the app shows
those dates, and nothing stops you playing any map at any time.

What is kept is kept per device: see [Your data and privacy](#19-your-data-and-privacy).

## 10. Tour: a guided flight over the map

The tour flies over the map on its own, one place at a time, roughly from north
to south. At each stop it zooms in, lights the place up in orange, and shows its
name and, where it has one, a fact about it, then moves on after a few seconds. It starts playing as
soon as the screen opens:

![The tour, at one of its stops](manual/tour.jpg)

The compact controls at the bottom of the screen use icons: a left arrow goes
back one stop, the play/pause button starts or stops the tour (when the tour is
over it becomes a circular arrow that replays it from the beginning), and the
right arrow skips to the next stop. Previous and next are disabled at the
beginning and end. Each icon has an accessible name (and a tooltip on hover).
When the tour is over, a **Try the quiz** button appears next to the replay
button and opens the map's quiz.

- **"3 / 20"** shows the stop you're on, out of how many.
- The speed menu offers 0.5×, 0.75×, 1×, 1.5×, 2× and 3×. A tour starts at 0.75×,
  which gives each stop about four seconds, except on very big maps, where it
  starts faster so that the whole tour takes about three minutes.

Nothing is scored. The map can still be zoomed and moved during the tour.

## 11. Towns maps

A towns map is about cities rather than regions: the towns and cities of roughly
100 000 inhabitants or more (50 000 on some countries, as few as 20 000 on some
detailed maps, a selection of the biggest on the largest). Each town is a **dot**, and the country's regions are
drawn faintly underneath for reference.

The Overview names every town. A town's name sits **beside** its dot, never on
top of it, in the best free spot next to it, so the dot you are looking for is
always visible:

![Italy — Towns, Overview](manual/towns-overview.jpg)

Everything else works as on a regions map. In the quiz, drop each name onto its
town's dot:

- The dots are painted in different colours so that close neighbours are easy to
  tell apart.
- A drop counts for the town whose dot is **closest** to where you let go,
  within a small distance. So dropping between two close towns counts for the
  nearer one. A town is easier to hit than its dot: the tap area is larger.

The United States is the one country whose cities come as four maps: the 50 over
a million, and three slices at 200 000: East, Center and West.

## 12. Facts and name origins

Most places have a few sentences of their own, in your language. The first is
usually about the **name**: where the word comes from, who it is named after, what
it meant. Hiroshima is "wide island"; Lombardia is named for the Longobards, the
"long-beards"; Chicago is a word for wild garlic. Where an origin is disputed, the
sentence says so. The current catalogue includes English, German and Italian fact text for
every playable target. The exact card content varies by place; a name origin
may explain that its derivation is uncertain.

A **fact card** opens at the bottom of the screen:

- when you **tap a place** in Known or the Overview;
- **after a wrong drop** in the quiz, so it can never give an answer away (it
  stays until your next drop; a correct drop opens no card);
- at every **stop of the tour**, where there is something to show.

The card shows the name's origin, another sentence about the place, and a line
worked out from the map: for a region, its biggest city; for a town, the region it
is in and its rank by population on that map. The origin stays the same; the other
sentence changes from visit to visit. In Known, the Overview and the Quiz, **×**
closes the card; on the tour it changes by itself at each stop.

## 13. Terrain

The **Terrain** button, next to the language menu, shows or hides the landscape
behind the map. It is on by default. With it on, you see the sea, the rivers and
the named seas, ranges, deserts and peaks around the map, and the heights of the
peaks, in your language. Turning it off leaves just the map, with land and sea still told
apart.

![Terrain off](manual/terrain-off.jpg)

Terrain names do not get in the way: a click goes through them to the place
underneath.

## 14. My maps: favourites and recent

Press the **★** in the start screen's toolbar. The page holds two lists:

![My maps: favourites and recent maps](manual/my-maps.jpg)

- **Favourites (★):** every map you've starred. Star a map with the star on its
  card here, or with the star at the end of the type row on any map screen. Click
  a filled star to unstar it.
- **Recent (🕘):** the last five maps you opened, newest first. Opening a map on
  any of its screens counts, and opening one again moves it to the top. A map can
  be in both lists.

Each card shows the map's name, and once you have played it:

| On the card | Meaning |
|---|---|
| a **bar** | how much of the map you know (orange, green when you know all of it); its accessible name says "14 / 20 known" |
| **"· 3 names at a time"** | the quiz now holds names back (see [Fewer names as you improve](#fewer-names-as-you-improve)) |
| **"★ Mastered · best 1:42"** | you know every name of the map; the time is your best round with no mistakes (see [Best time](#best-time)) |
| **"Last: 17/20 (3 mistakes)"** | your last finished quiz on this map: 17 of 20 places right on the first try, 3 wrong drops in total. The mistakes part is left out when there were none |
| **"20 names"** | you have never played this map's quiz; this is how many names it has |

Both lists are kept on the device only. The number on the toolbar's star counts
the maps in both.

## 15. The tutorial

The tutorial is a hands-on walkthrough: it doesn't show a video, it asks you to
do the real thing on the real screens, and waits until you have. It always ends
up on Italy — Regions, takes about three minutes, and works in English, German
and Italian.

**The tutorial's practice on Italy — Regions doesn't change your real
progress.** Its quiz uses a separate, temporary record, and Italy — Regions
doesn't land in Recent. If you leave the tutorial and play another map while it
is paused, that map behaves normally and records your progress.

### Starting it

- the **Tutorial** button (or the **?** in the start screen's toolbar); or
- **Start the tutorial** on the first-visit box.

It opens with a welcome card:

![The tutorial's welcome card](manual/tutorial.jpg)

**Start** begins; **Exit tutorial** closes it.

### What it looks like

Each step is a white card with the step number ("Step 1 of 14"), a short
instruction, and buttons. On most steps the rest of the screen is dimmed, except
for the thing the step is about, which is outlined in orange; a few steps only
point at a control without dimming. The screen keeps working during the tutorial
(the Map / List switch on the start screen is the exception, so that the map
stays in view), and the dimming is only there to draw the eye.

### The steps

| Step | Where | The card says (English) | Moves on when |
|---|---|---|---|
| 1 | start screen, the world map | "Every map starts from the world. Choose **Europe**." | the map opens Europe |
| 2 | start screen, Europe | "Now click **Italy** on the map. Its row in the list lights up." | you click Italy |
| 3 | start screen, Europe | "Choose **Regions** in Italy's row to open that map." | you open Italy — Regions |
| 4 | the Known map | "Zoom with the mouse wheel or the **+** and **−** buttons, and drag the map to move around. Try it now." | you zoom or move the map |
| 5 | the Known map | "This is **Known**, the map you build. Click a region to put its name on the map — it stays there. Click it again to take it off, so you choose which names to study." | you click a region and its name lands on the map |
| 6 | the Known map | "**Terrain** adds geographic detail behind the map, including rivers, mountain ranges and the sea overlay. The land and sea remain distinct when Terrain is off. Press **Terrain** to hide or show this extra detail." | you press **Terrain**, either direction |
| 7 | the Known map, then overview | "Names you place right in the quiz appear here on their own, as strongly as you know them. New to a map? **Overview** shows every name at once — open it." | you open the Overview |
| 8 | overview | "Ready for a quiz? Open the **Quiz**." | you open the Quiz |
| 9 | quiz | "Drag a name from the tray onto its region. Try **Sicilia**: the big island off the toe of the boot." | you place any name correctly |
| 10 | quiz | "Now get one wrong on purpose: drag **any** name onto a region it does not belong to — **Sardegna** onto the mainland, say. The region you hit flashes red, and the name is shown where it really belongs." | you make a wrong drop |
| 11 | quiz | "Not sure where a region is? Look it up in the **overview**." | you open the Overview |
| 12 | overview | "Found Sardegna? Go back to the **Quiz**." | you open the Quiz |
| 13 | quiz | "The regions you placed are still marked. Place a name right three times and it counts as known; a mistake takes it back one step — **Known** shows how far you have got." | you press **Next** |
| 14 | quiz | "Last one: the **Tour** flies you to each region in turn and shows its name. Open it." | you open the Tour |

The first three steps show the map even if you chose the list; the list comes
back after the tutorial. On touch screens the steps say "tap", "pinch" and "drag
with one finger" instead of mentioning the mouse. In the quiz steps the card sits
at the top, so it never covers the tray or the island you're asked to find.

The last card, on the Tour, says "You're all set" and offers **Finish**, which
ends the tutorial and leaves you on the tour, and **Replay**, which starts it
again.

### The buttons on the cards

- **Next** appears on the explanation step (13) and on a step whose required
  action you've already done.
- **Back** goes to the previous step, and to its screen if that's somewhere
  else.
- **Exit tutorial** ends the tutorial at once. The **Esc** key does the same.

### Wandering off

If you go somewhere the step didn't ask for (another map, a different tab), the
tutorial pauses. The card is replaced by a small bar at the
bottom of the screen:

- **Resume** takes you back to where the step is and shows its card again.
- **End tutorial** ends it.

The tutorial never carries on by itself while paused. Reloading the page or
closing the app also ends it.

## 16. Languages

The whole interface is available in **English**, **German** and **Italian**.
Switch with the **EN ⌄** menu, on the start screen or on any map screen; the
change is immediate and remembered on the device.

The built-in manual follows the selected language too. Its shared screenshots
show the English interface; the German and Italian text uses the translated
button labels. All three manuals are included in the installed apps.

What changes and what doesn't:

- **Translated:** every button, heading and message, the tutorial, the kind of
  map ("Regions" / "Regionen" / "Regioni", "Towns" / "Städte" / "Città"), the
  facts and name origins of the places that have them, the terrain names (Alps / Alpen / Alpi),
  and the names of countries on the start screen and on the continents' maps, and of
  the towns on the maps of several countries: Italy is "Italien" in German and
  "Italia" in Italian. The title of a country's own map keeps the English country
  name ("Italy — Regioni").
- **Not translated:** the regions of a country's own maps keep their names in
  the country's own language (Toscana, Bayern, Île-de-France), which is how they
  appear on local maps.

## 17. On a phone

The phone version has the same screens and features, arranged for a narrow
screen. The start screen, with the toolbar and the map above its panel:

![The start screen on a phone](manual/phone-home.jpg)

On map screens, the buttons of the map bar are stacked icon over label and share
the width of the screen:

![Known on a phone](manual/phone-known.jpg)

The quiz tray starts at up to about a third of the screen, and scrolls:

![The quiz on a phone](manual/phone-quiz.jpg)

### Gestures

- **Drag with one finger** to move the map; **pinch** to zoom; **double-tap** to
  zoom in one step.
- **Drag a name** from the quiz tray with your finger. The name floats above
  your finger, with a small orange-ringed pin below it; the pin marks the point
  that counts, so your finger doesn't hide the place. Near the top of the
  screen the pin goes below your finger.
- Or **tap a name** in the tray, then tap its place on the map (see
  [Tapping instead of dragging](#tapping-instead-of-dragging)).
- **Tap** a name on the Overview to enlarge it.

In the Android app the phone gives a light tap when an answer is right and a
double buzz when it is wrong, unless the phone is set to reduce motion. The
**Sound** button on the quiz adds sounds, on any device.

### The Android back button

In the Android app, the phone's back button goes **up one level** rather than back
through every screen you've visited:

- from a map's Quiz, Overview or Tour, back to that map's Known screen;
- from a map's Known screen, back to the start screen;
- from the start screen, it first goes from a continent back up to the world,
  and from the world it closes the app.

In a web browser on a phone, the browser's own back button works as in any
website.

## 18. The Windows and Android apps

The apps are the same game as the website, packaged to install:

- **Same screens and features**, including the tutorial and all three languages.
  The differences are that the "Download for Windows or Android" link isn't shown
  inside the apps, and that they have an **Exit** button on the start screen.
- **The maps are built in**, so the apps don't need the internet to play.
- **The Android app vibrates** on quiz answers: a light tap when right, a
  double buzz when wrong. It stays still when the phone is set to reduce
  motion. Sounds are off until you press **Sound** on the quiz.
- **Progress is kept inside the app**, separately from any browser on the same
  device (see [Your data and privacy](#19-your-data-and-privacy)).
- **Updating:** install the new version over the old one. Progress, favourites
  and settings are kept.
- The version badge in the corner shows which version is installed.

### About, downloads and this manual

Open **About** with **ⓘ** on the start screen. It shows the version, credits
and a **User manual** link. In the web version it also offers the Windows and
Android downloads. The manual opens inside Geoclick and follows your selected
language; use its contents links to jump to a topic.

![About: game information, version, download and user manual links](manual/about.jpg)

## 19. Your data and privacy

- **No account.** There's nothing to sign up for or log in to.
- **Nothing leaves the device.** Your progress isn't sent anywhere; there is no
  Geoclick server holding it.
- **Kept on the device, per browser or app.** Geoclick remembers, on the device
  where you play:
  - how well you know each place, each map's last result and best time, and
    the names you have mixed up;
  - your favourites and recent maps, and the detailed maps you have opened;
  - the language you chose, whether Terrain and Sound are on, and how the quiz
    asks (Place names or Name places);
  - whether you've seen or dismissed the tutorial offer.
- **Consequences:**
  - playing on a phone and on a laptop gives two separate progress records; they
    don't sync;
  - two different browsers on the same computer also keep separate records, and
    so do the app and a browser;
  - clearing the browser's data for the site erases Geoclick's progress in that
    browser, and uninstalling the Android app erases it on the phone.

## 20. The maps

221 maps across 81 countries and the six continents.

- **Continents.** Each continent has a **Countries** map and a **Capitals** map.
  Europe's cities also come in five parts (north, south, east, west and centre).
- **Countries.** 81 country groups have maps of their own:
  Algeria, Angola, Argentina, Australia, Austria, Bangladesh, Belgium, Bolivia,
  Brazil, Bulgaria, Canada, Chile, China, Colombia, Congo-Kinshasa, Costa Rica,
  Croatia, Cuba, Czechia, Denmark, Ecuador, Egypt, Estonia, Ethiopia, Finland, France, Germany, Ghana,
  Great Britain, Greece, Hungary, Iceland, India, Indonesia, Iran, Iraq, Ireland,
  Israel, Italy, Japan, Kazakhstan, Kenya, Latvia, Lithuania, Malaysia, Mexico,
  Morocco, Nepal, Netherlands, New Zealand, Nigeria, Norway, Pakistan, Peru,
  Philippines, Poland, Portugal, Romania, Russia, Saudi Arabia, Serbia, Singapore,
  Slovakia, Slovenia, South Africa, South Korea, Spain, Sri Lanka, Sweden, Switzerland,
  Taiwan, Tanzania, Thailand, Turkey, Uganda, Ukraine, United Arab Emirates, USA,
  Uzbekistan, Venezuela, Vietnam.
  Most have **regions** (states, provinces, prefectures…) and **towns**.
  Singapore has regions and a detailed map of its 55 planning areas.
- **Detailed maps** (behind the *Show detailed maps* tick): Germany's districts
  and its towns of 50 000 and up, Italy's 110 provinces (also in north, centre and
  south thirds) and its towns of 50 000 and up, Poland's counties, the
  Netherlands' municipalities, France's departments, the Philippines' provinces,
  and similar. On the biggest, only about half the names fit at the zoom the map
  opens at; the rest appear as you zoom in.
- **The United States** has four city maps: **Cities** (the 50 over a million)
  and three slices at 200 000, East, Center and West, split at the Mississippi
  and the Rockies. A city that two maps both cover, such as Chicago, counts on
  each of them separately.
- Maps show the country's main territory; far-away overseas territories are left
  out.
- **Where the data comes from.** Natural Earth, a free public-domain world map,
  for most borders, and geoBoundaries (CC0 or open licences, credited on each
  map) where Natural Earth is out of date or missing. Most towns come from
  Natural Earth's list of populated places; the towns of 50 000 and up on the
  detailed maps, and some facts, come from Wikidata. Each map's own small print
  says what it uses.

## 21. Questions and answers

**Can I lose my progress?** Only by clearing the browser's data for the site,
by removing the app together with its data, or by pressing **Reset progress**
on a map's Known screen (which asks first, and resets only that map). There's no
way to lose it by playing: the tutorial doesn't touch it, and a round you leave
changes only the names you actually placed.

**Why did my "known" count go down?** A mistake on a known name takes it down
one step, to "nearly" known. One right answer in a later round makes it known
again. Time alone never lowers it. See
[What counts as known](#9-what-counts-as-known).

**How do I start a map over?** On its Known screen, press **Reset progress** in
the legend and confirm with **Reset**. **Clear** is different: it only takes
off the names you tapped.

**Can I practise only the names I don't know yet?** Yes: press **Practise the 6
not yet known** (the number is yours) before your first answer, or on the score
panel. See [Every round is the whole map](#every-round-is-the-whole-map).

**The tray only offered me three names. Why?** Because you know most of that map.
The better you know it, the fewer names the quiz puts in front of you, so the
last few can't be worked out by elimination. See
[Fewer names as you improve](#fewer-names-as-you-improve).

**I dropped a name and nothing happened.** You let go on the sea, outside the
map, or on the tray. That doesn't count; drag it again.

**A region is too small to hit.** Zoom in first (mouse wheel, pinch or **+**).
Small regions also accept drops just next to them.

**Can I see a name while playing the quiz?** Not on the quiz screen; that's the
point. Switch to **Overview** to look it up, then back to **Quiz**. The places
you've already placed are still placed when you come back.

**Where is the map I want?** Use the search box on the start screen. If it is a
detailed map, open a map of the same country and tick **Settings → Show detailed maps**.

**A button of mine has a red X. What does it do?** It is a detailed map you
opened earlier. The X puts it back behind the tick.

**Can I play on two devices?** Yes, but each device keeps its own progress.

**How do I see the tutorial offer again?** Press **Tutorial** at any time; the
one-time offer box itself doesn't come back.

**Which version do I have?** Look at the grey badge at the top left of any screen,
or at the About page, for example `v0.19.0 · d858a67`.

**Windows says the installer is from an unknown publisher.** It isn't
code-signed; choose *More info*, then *Run anyway*.

**Who makes Geoclick?** Diego Amicabile. The source code is at
https://github.com/diegoami/Geoclick2027.

### If something does not look right

| What you see | What to try |
|---|---|
| A name is missing from Overview | Zoom in. Labels that would overlap are hidden until there is room. |
| Most controls have disappeared | Press the eye button at the right edge to show the buttons again. |
| A selected quiz name will not return to the tray | Tap the name again, tap empty tray space, or press Escape. |
| A dot is difficult to hit | Zoom in, then tap the name and its town marker separately. The nearest marker within the tap area is used. |
| The map is blank or fails to load in the browser | Check your connection and reload. The installed Windows and Android apps include their maps for offline play. |
| The game warns that progress could not be saved | Keep the page open and check that this browser allows site storage. Avoid clearing site data: that removes saved progress. |
| A new browser or installed app shows no progress | Progress belongs to the browser or app where you earned it. Return to that browser or app; there is no cross-device sync. |

If a problem persists, note the **version and build code** from the badge or
About, the map name, the mode, and the steps that caused it. Include your
browser or app, device, and a screenshot when reporting it through the
[source repository’s Issues page](https://github.com/diegoami/Geoclick2027/issues).

### Controls at a glance

| Action | Control |
|---|---|
| Switch map mode | Known, Overview, Quiz or Tour in the map bar |
| Move / zoom | Drag the map / wheel, pinch, or + and − |
| Answer in Place names | Drag a tray name to its place, or tap the name and then its place |
| Cancel a selected name | Tap it again, tap empty tray space, or Escape |
| Answer in Name places | Tap an answer or press its number, 1–6 |
| Resize the name tray | Drag its handle; with keyboard focus on the handle, use the arrow keys |
| Study a missed answer | Study these on the results panel |
| Hide / restore map controls | Eye button on the right |
| End the tutorial | Exit tutorial or Escape |
| Open help | Maps → About → User manual |

## 22. Glossary

| Term | Meaning |
|---|---|
| **Map** | One set of places to learn, for example Italy — Regions. |
| **Place** / **target** | One region, state, province, town or country on a map. |
| **Known** | The map you build: each name earned in the quiz drawn as strongly as you know it, plus the names you tap. |
| **Overview** | The map with its names shown, as many as fit without overlapping (a town's name sits beside its dot); zoom in for the rest. |
| **Quiz** | The game: drag or tap each name from the tray onto the map (**Place names**), or name the place that lights up (**Name places**). |
| **Tour** | The automatic flight from place to place. |
| **Tray** | The strip of names at the bottom of the quiz. |
| **Slip** | One name in the tray. |
| **Placed** | Dropped on the right place (green). |
| **Shown** | Placed for you after a mistake (gold-brown); takes the name down one level. |
| **Level** | How well you know a name: nothing, Seen once, Nearly or Known. One step up for each right first try, one step down for each mistake. |
| **Known (place)** | A place at the top level, three steps up. |
| **Mastered** | A map whose every name is known; its rounds are timed. |
| **Mix-up** | A name you dropped on another name's place; the two come into the tray together until you know both. |
| **Round** | One playing of a map's quiz: every name, from blank to done. |
| **Practice round** | A round that asks only the names not yet known; the known ones start out placed. |
| **Detailed map** | A finer map (districts, provinces, towns of 50 000…) kept behind *Show detailed maps*. |
| **Favourites** | Maps you've starred. |
| **Recent** | The last five maps you opened. |
| **Map bar** | The row of buttons at the top of every map screen. |
| **Type row** | The row under the map bar listing the country's other maps. |
| **Fact card** | The card with a place's name origin and facts. |
| **Version badge** | The small grey version number at the top left. |
