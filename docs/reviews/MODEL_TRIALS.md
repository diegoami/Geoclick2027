# Model trials: how the reviewers behaved

A short record of patterns seen with the external reviewers, so that the choice of
reviewer and the shape of the brief rest on evidence. Newest first. The reviewer is
DeepSeek V4.1 Flash by default (`.opencode/reviewer-model`); the implementer is
Claude, so a Claude reviewer is never used on Claude's work.

## 2026-10-04: DeepSeek V4.1 Flash on the user manual rewrite (PR #213)

Seven review rounds on one documentation PR, each finding between one and seven
claims about the app that the code contradicted, every one true and every one
fixed. The reviewer checked claims against the code well (it read `labelCollision.ts`,
`stretchedNames.ts`, `tourSpeed.ts`, `TutorialOverlay.svelte` and found the exact line),
but each pass sampled different sections, so new false claims surfaced in later rounds
that were already present in the first draft (tour speed, stretched names, label
placement, tray order, country names, tutorial dimming).

What helped: asking in the brief to "list every false claim you can find, going through
every section" (round 4 onward) did not end the pattern but widened each pass; a test
that ties a claim to the app (counts, button words, the country list against the
catalog) ends that class of error for good. What to do next time: write the claims
narrower (fewer specifics about rendering), put every checkable claim under a test where
possible, and, after the second round that finds new items, read the whole document
against the code before asking again.

## 2026-10-04: DeepSeek V4.1 Flash on data-only fact batches (PRs #215 to #222)

Facts batches (about 15 to 47 places each, three languages) were reviewed with the
claims listed in the PR body. Real errors found by the reviewer that I had written from
memory: the height of the Cristo del Otero (21 m, not 30), Zrenjanin's name history
(Petrovgrad 1935 to 1946), the Mugodzhar Hills as the southern end of the Urals,
Kostanay's rename in 1895. It also enforced the "name first" rule from DECISIONS.md.
Listing the figures worth a second look in the PR body focused the review on them and
is worth keeping.
