# v1.0.0 — public distribution and country expansion

Owner-approved scope: [proposal #241](https://github.com/diegoami/Geoclick2027/issues/241).
Release version: **1.0.0**. itch.io page: <https://diegoami.itch.io/geoclick>.
This plan records work still to land; it is not a claim that 1.0.0 is released.

## Work batches

| Batch | Status | Deliverable |
| --- | --- | --- |
| Distribution | Complete; [PR #242](https://github.com/diegoami/Geoclick2027/pull/242) merged | Verified migration of 39 releases into Geoclick2027; links and publisher updated |
| Boundary and target audit | All 22 new countries complete; Norway 15 counties; known Dutch/German corrections implemented | Licensed, reproducible sources and suitable map types for 22 countries |
| Maps | All 44 expansion maps and six legacy-country packages complete (217 total) | Administrative maps and towns/urban maps; generated through the existing pipeline |
| Facts | Complete: 6208/6208 playable slots, zero missing/short sets; strict audit passes ([proposal #244](https://github.com/diegoami/Geoclick2027/issues/244)) | Facts for added targets in English, German, and Italian; existing target gaps audited |
| Content completion | DE/IT manuals and all three town rebuilds complete; 120/120 playable country slots pass | Deferred thin towns maps and German/Italian manual checked against agreed scope |
| itch.io | Candidate pack exported: four 1280×800 screenshots, cover/banner, EN/DE/IT descriptions and tags; tagged refresh pending; owner uploads | #240 viewport baseline, ZIP smoke test, screenshots, cover, descriptions, tags and local listing preview |
| Release preparation | All facts complete; 1.0.0 manifests and candidate CHANGELOG prepared; all four local gates pass; final review: no blockers, two comma-space typos corrected | Seven manifests and lockfile entries at 1.0.0; accurate CHANGELOG; gates |
| Milestone and publication | Pending | Owner-approved merge, milestone review, installers tried, exact tag and publication |
| Retirement | Pending | Delete old release repository only after migration verification and merged replacement links |

Code PRs receive the required external-family review and owner merge approval.
The owner starts milestone review on the final candidate, unless explicitly
choosing the documented waiver. Do not bump or tag 1.0.0 before the content
and distribution work are complete. Deploys remain stopped.

## Country scope

The owner approved the first twelve countries and then all ten internet-presence
additions on 2026-10-25. These are 22 additional countries, not 22 maps.

| Country | Intended starting maps | Source/design check before building |
| --- | --- | --- |
| Ethiopia | Regions and cities | Recheck post-SNNPR boundaries; old source was rejected in v0.18 |
| Democratic Republic of the Congo | Provinces and cities | Current provincial divisions; Natural Earth country spelling |
| Tanzania | Regions and towns | Current regions and Zanzibar; suitable national extent |
| Uganda | Broad regions and towns | Avoid making the first map an overwhelming district list |
| Ghana | Regions and towns | Validate newer regional divisions |
| Angola | Provinces and towns | Validate recent province changes |
| Iraq | Governorates and cities | Verify current divisions and source attribution |
| Uzbekistan | Regions and cities | Autonomous republic and capital treatment |
| Nepal | Provinces and towns | Current provinces rather than the old development regions |
| Sri Lanka | Provinces and towns | Local names, duplicates, suitable town count |
| Taiwan | Counties/cities and towns | Consistent source naming and separate administrative cities |
| Hungary | Counties and towns | Capital treatment and local diacritics |
| Singapore | Broad planning regions and urban locations | Use real planning geography; do not invent separate towns |
| Israel | Districts and cities | Source extent, disputed boundaries and attribution recorded |
| United Arab Emirates | Emirates and cities | Multipart emirates and duplicate city/region names |
| Slovakia | Regions and towns | Diacritics and capital-region treatment |
| Slovenia | Broad regions and towns | Prefer learnable broad divisions before dense municipalities |
| Estonia | Counties and towns | Current counties and suitable town count |
| Latvia | Broad regions and towns | Do not silently use superseded municipality boundaries |
| Lithuania | Counties and towns | County versus municipality level made explicit |
| Iceland | Regions and towns | Small-country target count; offshore extent |
| Costa Rica | Provinces and towns | Offshore islands excluded where they distort the map |

No forced 20-town minimum for small countries. Exclude distant territories
without being asked. Pin external boundary sources and record their year,
licence, attribution, exclusions and build command in MAPS.md. Verify target
counts/names and map rendering before calling a country complete.

## Facts

Read authored data/facts files; never hand-edit generated facts.json.
The initial audit found 190 authored files, 3,017 place IDs, 3,108 fact sets
(including kind-specific sets), and 8,853 sentences per language. All existing
sets have equal EN/DE/IT sentence counts. This is structural parity, not proof
of complete target coverage or translation quality. 348 sets have fewer than
three English sentences.

Match playable targets to the authored resolver, respecting city/region kinds.
Fill missing facts in all three supported languages. Prefer three useful,
sourced sentences; do not pad a set merely to make its count three.
Spanish is a later recommendation, not approved scope.

## Historical release migration

**Completed 2026-10-25:** all 39 historical releases and 138 original assets
were copied, downloaded again and matched by SHA-256. Final GitHub metadata
and asset digests match the export; v0.20.0 is Latest. An anonymous public
download of its checksum file returned HTTP 200 and matched the backup.
The durable sibling directory Geoclick2027-release-backup/2026-10-25 holds
original metadata, a Git mirror, issue metadata, every asset, the reviewed
backup report and final-github-audit.json. Exactly two original v0.7.0 Windows
checksum entries are stale; copied notes disclose their verified hashes while
the original manifest and installers remain unchanged. The old repository is
still intact. Replacement links and publisher changes landed in PR #242 (merge d296ac3).
This is migration of historical versions, not publication of v1.0.0.

Run from the implementing worktree after fetching tags:

~~~powershell
node scripts/migrate-releases.mjs
node scripts/migrate-releases.mjs --backup-only
node scripts/migrate-releases.mjs --confirm
node scripts/migrate-releases.mjs --verify-only
~~~

Default is read-only dry run. Backup and verification reports are under
dist-release/migration-backup (ignored). Use --backup-dir to retain an export
outside a worktree that will eventually be removed. Keep that export after
retirement. The tool refuses conflicting metadata and never overwrites assets.
It verifies canonical destination tags against local tags, audits original
SHA256SUMS.txt, then downloads copied assets and compares SHA-256. Historical checksum discrepancies block copying by default. After reviewing backup-verification.json, --preserve-stale-checksums permits only the exact tag/asset/hash discrepancies recorded in the reviewed complete backup report, with matching GitHub asset digests; copied release notes list the discrepancy and actual hashes. Original SHA256SUMS.txt files are preserved verbatim.

GitHub cannot preserve original release publication timestamps on creation.
Original timestamps remain in the backup and copied notes. Original release
IDs, asset IDs, download counters and external URLs also change. Canonical
source tags and commits remain unchanged.

Before deleting the old repository: retain its Git mirror and repository/issue
metadata as well as the release backup; verify every historical release; land
all replacement links; confirm public downloads work. No deletion command is
part of the migration tool. Old external URLs will stop working after deletion.

## itch.io and final verification

Implementation target following the owner rejecting 640x480 (2026-10-25), superseding the earlier #240 baseline:
target **1280x800** for desktop/itch.io and check **1024x768** as a lower bound.
640x480 is not a release requirement. Check phones/tablets separately, record
the chosen embed size, keep fullscreen under player control, and test
the extracted ZIP rather than just source. The owner handles itch.io navigation, page changes and upload. Do not claim an upload or phone test
without evidence.

Label local tests separately from deployment testing. Local browser checks,
installer map rendering and Android signature/update checks are required.
There is no live deployment test while deploys are stopped.

## Initial boundary-source audit (2026-10-25)

Observed metadata from the official geoBoundaries current/gbOpen ADM1 API.
These are candidates, not approved current boundaries. All download URLs in
this audit pin geoBoundaries commit 9469f09. Verify geometry and names before
selecting a source. In particular, Ethiopia has 11 old units, Angola 18,
Tanzania 30, Iraq 18, Slovenia only two broad units and Latvia 43 municipalities;
these need newer data or a different geographic level before map building.

| ISO | Source year | Units | Recorded licence |
| --- | --- | ---: | --- |
| ETH | 2016 | 11 | Creative Commons Attribution 4.0 (CC BY 4.0) |
| COD | 2017 | 26 | Open Data Commons Open Database License 1.0 |
| TZA | 2015 | 30 | Open Data Commons Open Database License 1.0 |
| UGA | 2017 | 4 | Open Data Commons Open Database License 1.0 |
| GHA | 2021 | 16 | Creative Commons Attribution-ShareAlike 2.0 |
| AGO | 2021 | 18 | Public Domain |
| IRQ | 2022 | 18 | CC0 1.0 Universal (CC0 1.0) Public Domain Dedication |
| UZB | 2017 | 14 | Open Data Commons Open Database License 1.0 |
| NPL | 2020 | 7 | Creative Commons Attribution 3.0 Intergovernmental Organisations (CC BY 3.0 IGO) |
| LKA | 2017 | 9 | Open Data Commons Open Database License 1.0 |
| TWN | 2017 | 22 | Open Data Commons Open Database License 1.0 |
| HUN | 2011 | 20 | CC0 1.0 Universal (CC0 1.0) Public Domain Dedication |
| SGP | 2016 | 5 | Open Data Commons Open Database License 1.0 |
| ISR | 2006 | 6 | Public Domain |
| ARE | 2017 | 7 | Open Data Commons Open Database License 1.0 |
| SVK | 2017 | 8 | Open Data Commons Open Database License 1.0 |
| SVN | 2021 | 2 | Creative Commons Attribution 4.0 (CC BY 4.0) |
| EST | 2016 | 15 | Open Data Commons Open Database License 1.0 |
| LVA | 2021 | 43 | Creative Commons Attribution 4.0 International (CC BY 4.0) |
| LTU | 2017 | 10 | Open Data Commons Open Database License 1.0 |
| ISL | 2017 | 8 | Open Data Commons Open Database License 1.0 |
| CRI | 2017 | 7 | Open Data Commons Open Database License 1.0 |

Metadata endpoint: https://www.geoboundaries.org/api/current/gbOpen/ISO/ADM1/ (replace ISO).

## itch.io asset handoff (owner request, 2026-10-25)

Do not navigate to itch.io or edit its page: the owner will do that.
Prepare an upload-ready local pack containing authentic final-build screenshots,
a cover using existing branding, short and full descriptions, suggested tags,
platform/control/language details, installation notes and a local listing preview.
Supply the tested HTML5 package and relevant installer references/files for the
owner to upload. Final screenshots must reflect the actual 1.0.0 build and its
contents; candidate previews must be identified as such. No invented counts,
reviews, awards, unsupported platforms or simulated gameplay screenshots.


## Country-expansion checkpoint (2026-10-25)

Checkpoint saved at the owner's request; resumed on 2026-10-26. Branch: maps/v1.0-country-expansion.
Worktree: C:/Users/diego/projects/Geoclick2027-work/maps-v1.0-country-expansion.
The complete expansion is in [PR #243](https://github.com/diegoami/Geoclick2027/pull/243); local gates pass and the independent review reports no blockers. Owner testing/merge approval is next.

All 22 approved countries now have their two map packages: 44 new maps and
735 targets, giving 217 maps across 79 country groups plus six continents.
The raw index has 80 country labels because Czech Republic and Czechia are
joined in the catalogue. Singapore has five regions and 55 planning areas,
rather than a misleading towns map. All 44 new choices were verified in the
rendered browser catalogue at 1280 × 800 on localhost:5187.

Authored facts are complete: all 735 expansion targets have three sentences
in each of English, Italian and German, across all 22 countries. The strict
coverage audit is data/scripts/audit-v1-country-facts.ts --strict. Generated
hooks are refreshed from data/facts, including shared continent targets.

Current Angola (21), Iraq (19), Ethiopia (14) and Tanzania (31) source polygons
pass validity and pairwise area-overlap checks. Singapore is explicitly retained
in the world picker despite the continent quiz's minimum-area filter;
Congo-Kinshasa links to the existing Democratic Republic of the Congo polygon.
The catalogue regressions caught and now guard these missing-row cases.

Next: owner testing and explicit merge approval for PR #243, then the version
bump/candidate PR, milestone review and final release/itch.io artifacts. The old
first-batch review is historical.

Windows is canonical. A preserved Linux build mirror with its own dependencies,
raw sources and tile tools is at
/home/diego/projects/Geoclick2027-build/v1.0-connected-20261025.
Overlay committed tracked branch files before rebuilding; never copy Windows
node_modules. MAPS.md records the batch commands.

Version remains 0.20.0. No 1.0.0 bump, candidate, milestone review, tag,
installers, publication or final itch.io asset pack exists yet. The old releases
repository still exists; its verified backup and migrated releases are preserved.
The owner handles itch.io navigation and upload; the developer still owes the
asset pack above. No deployment was tested (deploys remain stopped).
Vite defaults to strict port 5187 and Tauri uses the same devUrl, because
5173 belongs to another game. Desktop opens at 1280 × 800 with a
1024 × 640 minimum (the 1024 × 768 lower-bound check remains). Representative Nepal, Angola, DR Congo and Singapore
planning-area canvases loaded at 1280 × 800 without page errors or failed
local asset requests. No installer or device check is implied.

Checkpoint local verification: check, tests, lint and build all passed through
npm run gates -- --quiet. Visual/browser and installer checks remain pending.

## First-batch verification (2026-10-26)

Estonia now has all 34 previously missing sets (15 counties and 19 towns),
with three authored sentences in English, Italian and German per set; Tallinn
was preserved. Source references are recorded per target/kind in
data/facts/estonia.json. Name hooks distinguish historical German exonyms
from official renaming, following the Estonian Language Institute.

The authored resolver reports full three-language coverage for all 173 targets
in the twelve first-batch maps. Generated hooks were refreshed for Estonia
counties/towns and the shared eastern-Europe towns map.

Local browser verification: all twelve Overview maps rendered at 1280x800
without page/console errors or horizontal page overflow. Estonia Quiz also
rendered at 1024x768 and an emulated 390x844 touch viewport. Screenshots and
the browser report are in ignored rendered/v1-map-checks. These are browser
checks, not physical-device or installer checks. About contains the canonical
Geoclick2027 releases URL and no old releases-repository link. No itch.io page
was opened. No deployment was tested; deploys remain stopped.

The next sixteen countries, final viewport/package work, final itch.io assets,
installer checks and 1.0.0 release steps remain pending. This first batch is
prepared as an ordinary PR for review and owner testing before merge.

Italian and German Tartu facts were also opened by clicking its map point in
the running browser; both displayed their authored translations. Windows
blocked Vitest’s default browser API port 63315 on IPv4 and IPv6. The client
project now binds loopback port 5191 with Vite’s normal busy-port fallback;
the full test gate then passed, including the client project. No test was
skipped to bypass this startup failure.

First-batch local gates: check, test, lint and build all passed on 2026-10-26.
The app test report includes 2,450 passing tests across all 63 files.

First-batch administrative labels use country-specific keys: German Landkreise
(Estonia), Komitate (Hungary) and Bezirke (Lithuania); Italian Comitati for
Hungary. This preserves the existing labels used by other countries. The
existing catalogue/localization tests pass (15 tests).

### Next-batch source checks (2026-10-26)

A bounded Natural Earth admin-1 audit found nine UAE pieces, including two
Neutral Zone polygons; do not silently invent assignments to force seven.
The [UAE government](https://u.ae/en/about-the-uae/the-seven-emirates) identifies
seven emirates. Natural Earth provides Sri Lanka’s 25 districts rather than
the intended nine provinces; the [tourism authority](https://srilanka.travel/provincial-tourism)
confirms nine provinces. Natural Earth has fourteen Uzbekistan pieces, but
the capital and its surrounding region both use Tashkent: they need distinct
stable IDs and labels.

The pinned geoBoundaries 9469f09 metadata provides 7/9/14 ADM1 units for
[ARE](https://www.geoboundaries.org/api/current/gbOpen/ARE/ADM1/),
[LKA](https://www.geoboundaries.org/api/current/gbOpen/LKA/ADM1/) and
[UZB](https://www.geoboundaries.org/api/current/gbOpen/UZB/ADM1/), respectively,
all representing 2017 OpenStreetMap/Wambacher data under ODbL 1.0. These are
candidates requiring geometry, currency and licence/attribution checks, not
implemented or accepted replacements. The preserved Linux toolchain is
available via WSL; no new maps were generated in this audit.

### PR #243 review fixes (2026-10-26)

The [first independent review](https://github.com/diegoami/Geoclick2027/pull/243#pullrequestreview-5649697413)
reported two blockers and two minor findings; all four were reproduced.
Slovakia/Lithuania regional output was stale relative to the recipe; Pest
omitted Erd; the three Wikidata towns maps had no region lines; the fetcher
still listed an unused Costa Rica source.

Regenerated the affected maps from the recipe. Hungary now also uses a dated
Wikidata snapshot, and Pest correctly identifies Erd (71,613 in that snapshot).
The town selection adds Sopron, Dunakeszi and Erd; all have three sourced
sentences in each language. Hungary retains Salgotarjan, Vac and Szekszard explicitly alongside the twenty
most populous choices, preserving their authored content. Hungary has 23 towns;
the twelve-map batch now has 173 targets. Region names come from
Wikidata hierarchies, with an attributed exact-geometry fallback for missing
Lithuanian county associations. Empty/ambiguous associations fail the fetch.
Costa Rica was removed from the snapshot refresh list. Estonia’s snapshot
threshold is 1,000 for regional facts, preserving Kardla/Jogeva; the playable
threshold stays 5,000. Each of the four snapshot-backed administrative maps
now has a largest-city fact for every region.

Added data regressions for snapshot metadata/population parity, town region
lines and authored three-language coverage. The focused data/catalogue suites
pass (41 tests). Full gates and a fresh independent review of the fixes follow
before owner handoff.

Population candidate selection no longer filters on Wikidata’s truthy preferred
count before choosing the newest observed statement. All valid statements are
fetched first, so an older preferred count cannot hide a qualifying newer
observation. The post-selection population threshold still applies.

Final source refresh succeeds for all four countries (135 Hungarian, 68 Slovak,
44 Estonian and 29 Lithuanian candidates), including the region ambiguity
checks. Regenerated all eight affected maps and refreshed the index/hooks.
Data integrity/selection/coverage suites pass (981 tests). Final local Chromium
checks show all retained/new Hungarian towns and the correct German Komitate
label; Italian/German Tartu cards display both the authored translation and
the restored region line. No page errors or horizontal overflow were reported.

## First-batch review record (2026-10-26; superseded handoff)

[PR #243](https://github.com/diegoami/Geoclick2027/pull/243) is ready for owner
testing. The [Claude Opus 5.5 follow-up review](https://github.com/diegoami/Geoclick2027/pull/243#pullrequestreview-5650235087)
covers code SHA 8ecfd30a828f67fe43b12921945706cf14516a3f and reports no blockers;
all four original findings are fixed. Its remaining non-blocking name-polish
item and disposition stay in the PR thread; address that item before final
release screenshots. This handoff update changes documentation only.

All four gates passed on the reviewed code, including 2,472 passing app tests
across 64 files with the browser project. Local Chromium checks are recorded
above. No deployment test: deploys remain stopped. The developer server is
stopped; the owner can run it from the implementing worktree on port 5187.

Draft itch.io promotional assets are exported durably at:
C:/Users/diego/projects/Geoclick2027-itchio-assets/draft-2026-10-26-8ecfd30
and the same path with .zip appended. The verified 15-file ZIP includes a
630x500 cover, 1280x720 banner, short EN/IT/DE text, full English description,
tags/settings notes, logo and a local listing-preview.html. Covers use the
existing branding. Gameplay previews are authentic development captures with
v0.20.0 badges, explicitly marked for replacement after the tagged 1.0.0 build.
This is not the playable HTML5 ZIP or final 1.0.0 asset pack. The owner handles
itch.io page changes/upload; no itch.io page was opened or changed.

The other sixteen approved countries, final content polish, viewport/package
work, final screenshots, installer/device checks, version bump, milestone
review/tag/publication and old-repository retirement still remain. Merge of
this first batch awaits the owner's explicit OK; no merge/tag/deploy occurred.


## Full-scope continuation (2026-10-26)

The owner correctly pointed out that twelve maps covered only six of the 22
approved countries. Do not hand off another partial country batch as though
the agreed expansion were complete. Continue all sixteen remaining countries,
their authored EN/IT/DE facts, final content polish and required verification.
PR #243 was converted back to draft; its prior reviews apply only to the
earlier code. Run a fresh external-family review after the full scope is ready.

The intermediate eight-country batch added sixteen maps for UAE, Sri Lanka,
Uzbekistan, Nepal, Taiwan, Uganda, DR Congo and Ghana. The subsequent batch
completed all 44 new map packages; current counts and fact coverage are above.
Pinned/licensed polygon inputs and their fetch recipes are in
v1BoundarySources.ts and fetch-v1-boundaries.ts. Town maps now reuse their
administrative map's polygons/names through regionsMap, fixing stale context
and the previously deferred suffix inconsistency when maps are rebuilt.

UAE, Sri Lanka and Ghana have richer dated Wikidata source snapshots after
the initial Natural Earth coverage audit. Coordinate selection prefers precision
only after choosing the newest population; rounded coastal points get a bounded,
unambiguous association within stated precision. Full source/fact audits and
facts authoring remain required before completion.

The last eight countries are Ethiopia, Tanzania, Angola, Iraq, Singapore,
Israel, Slovenia and Latvia. Their source specifications and reproducible importers are now durable code
in v1CurrentBoundarySources.ts and fetch-v1-current-boundaries.ts.
Official sources exist for Latvia's five regions (CC0), Slovenia's twelve
statistical regions (GURS CC BY 4.0), Singapore's five regions and 55 planning
areas (URA 2019; Singapore Open Data Licence), Tanzania's 31 regions and
Ethiopia's 14 regions/city administrations (OCHA CC BY IGO). OCHA's extra
Ethiopia Contested polygon must be neutral land context, not a fifteenth quiz
region. Iraq's current OSM/Geofabrik extract includes all nineteen governorates,
including Halabja. Angola can be reconstructed reproducibly from the current
licensed OSM outlines and OCHA municipality unions using the legal 2025
groupings; final checks pass Luena, Cazombo, Menongue, Mavinga and Catete,
polygon validity and pairwise non-overlap.
Do not use the unclear-licence third-party AI reconstruction.

Preserved Linux build mirror remains
/home/diego/projects/Geoclick2027-build/v1.0-connected-20261025.
Sources/caches there are task-owned and must not be wiped. Windows worktree
remains canonical. No merge, version bump, tag, deployment or itch.io access.


### Full catalogue local verification (fda2f03, 2026-10-26)

All four local gates pass after the full 44-map expansion: type checks,
2792 app tests (zero failures), lint and production web build. The desktop
build also produced development-version 0.20.0 MSI/NSIS bundles; neither was
installed or tried, and these are not 1.0 release artifacts. No deployment
was triggered or checked (deploys remain stopped).

Browser checks at 1280 × 800 confirmed all 44 choices in the rendered start
screen menus and successful canvases for Nepal, Angola, DR Congo and
Singapore planning areas, without page errors or failed local asset requests.
At this intermediate checkpoint facts were 403/735 complete; final coverage
is recorded below. PR #243 remains draft and needs a fresh external-family review after
content completion, followed by owner testing/merge approval. Its old reviews
do not cover this expanded code. No 1.0 bump, tag or publication has happened.


### Additional authored facts

Sri Lanka, Uganda and Slovenia now have three authored sentences per target
in English, Italian and German: 80 newly completed sets, 720 sentences.
Existing Colombo, Kampala and Ljubljana sets were preserved. Maribor’s two
sentences were retained in substance and expanded with its historic name.
Per-target checking references are stored in the authored country files.
Generated hooks were refreshed for their six maps and the shared Central
European cities map. At that checkpoint, coverage regressions included the 28 maps of the fourteen
completed countries and 1382 focused data/fact/translation tests passed.

Ghana's sixteen regions and nineteen remaining towns now have 35 complete
EN/IT/DE fact sets (315 sentences); Accra's existing set is preserved.
References are recorded per target in data/facts/ghana.json. The facts use
the current sixteen-region geography, despite older ten-region descriptions
on some tourism pages. Mole/Larabanga are in Savannah and Kyabobo is in Oti.
The Mampong town target is Asante-Mampong; Eastern Region's cocoa-history
fact explicitly names Mampong-Akuapem. Formation dates of the six 2019
regions were checked against the Ministry's implementation report.
Generated hooks are refreshed for both Ghana maps. No tag, release,
deployment, installer test or itch.io access is part of this content batch.


### Completion of all remaining facts

Taiwan, DR Congo, Ethiopia, Tanzania, Singapore, Israel, Iraq and Angola now
have all 332 missing trilingual sets: 2988 authored sentences. The complete
expansion passes the strict 735/735-target audit. Per-target references are
stored beside the authored content; existing capital facts are preserved.

The shared name fixups and regenerated Ethiopian maps use Adama, Woliso and
Hawassa. Iraqi maps use Erbil and Az Zubayr, correcting the source typo
Az Aubayr. Generated-data regressions guard these names. The trilingual
coverage regression now covers all 44 expansion maps.

Singapore landmarks were checked against the prepared 2019 planning polygons,
including the zoo in Central Water Catchment, the National Museum in Museum,
and Singapore General Hospital in Bukit Merah. Angola facts follow the current
21-province geography: Quiçama belongs to Icolo e Bengo and Cameia to Moxico
Leste. Facts avoid treating disputed boundaries or uncertain etymologies as
settled claims.

Generated hooks are refreshed. Local verification: all four gates pass
(type checks, 2822 app tests with zero failures, lint and production web build).
The browser shows all 44 new choices and representative canvases at 1280 × 800
without page errors or failed asset responses. Fresh external-family review
precedes owner testing. Deployments remain stopped; no live deployment test
was performed. No tag, publication, installer/device test or itch.io access
is part of this content completion.

### Full-scope PR review remediation

The independent full-scope review of ebbb104 was BLOCK:
https://github.com/diegoami/Geoclick2027/pull/243#pullrequestreview-5655934910.
All six findings were reproduced and addressed before owner testing:

- Dome's Wikidata item conflates the Accra locality with a Western North
  coordinate. Shared placeCorrections.ts uses the GeoNames Accra coordinate
  in both map selection and derived facts, while preserving the raw snapshot.
- JSON snapshots are now read with all fields intact, including coordinate
  precision. Both town-region and regional largest-city derivation use the
  same bounded canonical resolver.
- Sourced inhabited-centre coordinates replace obsolete shore points for
  Kalemie, Musoma and Kigoma. Their regions' largest-city assertions are
  enforced by the recipe and data tests, as are Cape Coast and Mekele.
- Mekele's known-bad Natural Earth count is replaced with the observed 2007
  census figure cited by UN-Habitat. The correction only replaces that stale
  value; a future updated source count is preserved.
- The owner explicitly excluded Zhongli, Bade, Pingzhen and Yangmei as Taoyuan
  boroughs. Miaoli, Douliou, Magong and Puzi replace them in the twenty-town
  selection and have complete sourced EN/IT/DE facts. The excluded districts'
  authored text is preserved under _excludedDistricts in taiwan.json.
- README uses localhost:5187. The desktop retains its 1280 × 800 default,
  with a 1024 × 640 minimum that fits smaller Windows work areas.

Ten affected map packages and all 44 expansion fact files were rebuilt.
Every one of the 394 playable town-region associations resolves correctly;
strict authored coverage remains 735/735. Four regional name-history sentences
were also clarified to explicitly identify the namesake city.
Focused data, boundary and translation checks: 1384 tests pass. Final local
gates and the follow-up review pass; the PR awaits owner testing.

Local verification on the review-fix commit: all four gates pass, with 2831 app
tests and zero failures. Actual served assets cover all 735 targets, and all
44 choices remain selectable. The 1024 × 640 Taiwan-tour screenshot exposed
long source credits crossing the fact card; map attribution now starts in its
expandable information control, matching the world picker's existing behavior.
The source credit remains available on demand. The follow-up review confirmed
all fixes and this layout adjustment before owner testing.

### Ready for owner testing

The independent follow-up reviewed all code at 46548f8c342530d6c41648ee52f49c40d3a0c6cc:
https://github.com/diegoami/Geoclick2027/pull/243#pullrequestreview-5656320311.
Verdict: no blockers; all six original findings resolved; no new MUST-FIX or
SHOULD issues. The reviewer independently passed 1383 focused tests, checked
the four corrected points against their committed polygons, inspected the
largest-city results, and read all replacement-town and clarified regional
sentences in all three languages.

Two MINOR notes are retained in the PR thread: Miaoli city and county share
the same correct name-origin sentence (kept to preserve their common etymology),
and Ghana/DR Congo source credits include an extra Tanzania municipal source
mention. The latter is cosmetic; all required licences are present. Neither
permits a wrong result under the PR's Protects contract. This subsequent status
record is documentation only; the independently reviewed code is unchanged.

Local testing: Geoclick runs at http://localhost:5187 from the implementing
worktree. Check the 44 new choices, Taiwan's twenty towns without the four
boroughs, tour facts in EN/IT/DE and the expandable source-information control.
All gates passed with 2831 app tests, strict coverage 735/735, and 394/394
canonical town-region associations. Deployments remain stopped; no live test
was performed. Merge requires the owner's explicit approval. Version bump,
installer/device checks, release milestone review, final tagged screenshots
and publication remain release tasks; itch.io is uploaded by the owner.

### Remaining content scope expanded by the owner (2026-10-26)

The owner explicitly selected completion of **all older playable facts before
1.0**, recorded in [proposal #244](https://github.com/diegoami/Geoclick2027/issues/244).
The reproducible baseline audit is:

    node --import tsx data/scripts/audit-authored-facts.ts --json=rendered/catalogue-facts-audit.json

At bfb7896 the catalogue has 6153 distinct authored file/ID/kind slots: 1960
have no authored facts and 332 have fewer than three sentences in at least one
language. Shared occurrences are counted once; city and region kinds remain
separate. Missing content is concentrated in Germany, Poland and the Netherlands.
The existing 735/735 expansion result does not imply whole-catalogue completion.
The release now requires the all-catalogue command with --strict to pass.

The implementing worktree for this continuation is
C:/Users/diego/projects/Geoclick2027-work/release-v1-content-completion,
on release/v1-content-completion, stacked on PR #243 while it awaits explicit
owner merge approval. The main checkout and that reviewed worktree are untouched.
Both localized manuals cover all 22 topics and are bundled alongside English;
19 focused build/content/language-race tests pass. Images are shared English
screenshots, disclosed in each translation. The manual follows the app language.

Denmark now uses a dated Wikidata snapshot and the more detailed, pinned
geoBoundaries five-region coastline, retaining Fredericia and the existing
Copenhagen representative centre. Its town selection is 21, including retained
Hillerød. Serbia uses the official 2022 RZS urban-settlement census workbook
and GeoNames coordinates, rather than incomplete Wikidata classes or municipal
population totals. Its 32 towns include the seven large cities missed by the
first rebuild. Every district has a sourced urban settlement; source credits
identify the actual providers. Norway keeps a curated Natural Earth twenty-town
sample, explicitly not a national top-twenty ranking. Unsupported county
largest-city claims are disabled. The fifteen current counties use pinned
Kartverket geometry. All three legacy town-map IDs remain stable.

The three backlog country passes are complete: Denmark 28/28, Norway 35/35,
Serbia 57/57 playable file/ID/kind slots, including two Danish continent aliases.
The whole catalogue now has 6208/6208 distinct playable file/ID/kind slots with
at least three sentences in EN/IT/DE: zero missing and zero short sets. All
parallel country drafts are integrated into authored files and regenerated
outputs. Exact queue validation checks identities, translations and references;
editorial review checks factual scope and translation samples. The strict
whole-catalogue audit passes. Content completion does not replace the remaining
PR, owner-merge and milestone release gates.

The owner approved updating known Dutch/German border cases. Voorne aan Zee
replaces its three predecessor municipalities, giving 342 Dutch targets. Hanau
is independent using official Hesse June 2026 geometry. Eisenach is merged into
Wartburgkreis, and a discovered name-cleaning collision between Leipzig city
and Landkreis Leipzig is fixed. The German total is 401. Only the three
affected map packages are rebuilt; other geometry retains its pinned edition.
Prepared collections pass GEOS validity/nonempty checks; Hanau and Main-Kinzig
share a non-overlapping cut. This is not an audit of every small border change.
New target facts are complete; existing unchanged IDs retain progress.

PR #245’s first review found incomplete Serbia/Danish town selection and a
strict-audit false pass for unknown countries. These are addressed; unknown
or empty filters now fail, and country aliases count only matching maps.
The stale Norway 11-county build command and inconsistent Bor mining dates are
corrected too. A fresh independent review is required on the updated head.
The updated type checks and 2856 app tests pass. An unused source import found
by lint was removed, and the production web build passes. All four gates run
again in the pre-push hook. Deployments remain stopped, so there is no
deployment test.

Actual local browser checks also pass on the isolated http://localhost:5188
preview: all three manual languages, Unicode section-link navigation, no page
errors, and rendered Norwegian county geometry at 1280 × 800. All fifteen
county polygons were visually inspected as well as machine-validated. The
reviewed expansion preview at 5187 remains available separately. This content
branch is still a work in progress under #244, not ready for 1.0 publication.


Local browser verification after the source/border corrections: actual overview
pages render all three affected Dutch/German packages (69/68/64 targets) and
the 21-town Danish/32-town Serbian packages at 1280 × 800, with no page errors
or failed asset responses. Leipzig city/county separation and the Hanau cut
also have focused regression coverage. These are local checks; no deployment
or itch.io navigation was performed.


### Second checkpoint review and identity/provenance remediation

The independent review of 025941f is recorded at
https://github.com/diegoami/Geoclick2027/pull/245#pullrequestreview-5660042591.
It confirmed the border changes, country fact parity and prior fixes, with
no blockers, one SHOULD and four MINOR findings. The Serbian snapshot’s four
homonymous-village matches were reproduced and treated as rework despite not
reaching the 32 shipped towns. Census oblast headers now constrain GeoNames
matching, and every matched point must agree spatially with its census district.
Kula, Odžaci, Aleksandrovac and Medveđa use their actual town coordinates.
All 155 matched settlements pass the district check; two small unmatched places
remain explicitly excluded. No shipped town IDs or populations change.

The other findings are addressed too: --strict=true is strict and other value
spellings fail; saved bindings require one country and original fetch/query
provenance; the Danish snapshot retains 18:31:55.641Z as its 26 October fetch time
and records reprocessing separately; Utrecht/Groningen hooks explicitly refer
to their namesake city; repeated source-credit segments are removed. The actual
PMTiles metadata now also credits RZS/GeoNames instead of hard-coded Wikidata.
Focused provenance, coverage and country checks pass 29 tests. All six backlog
packages are rebuilt, with original source SHA pins intact. Another review of
the final head is required before owner testing.

France’s 95 older gaps and Saudi Arabia’s 20 older gaps are complete: strict
country audits pass 146/146 and 35/35 respectively. Poland remains 418/418.
The Dutch pass is complete at 364/364 across nine maps; Greece, Iran, Ireland,
Sweden and Switzerland also pass their strict country audits. Germany and the
remaining countries continue in exact queued batches; no gap is deferred past 1.0.

### Portable browser package checkpoint (2026-10-27)

A separate HTML5 build uses hash routing, relative assets and bundled map
metadata, preserving the ordinary web/desktop/Android build. Run
`node scripts/package-html5.mjs --draft` for an internal candidate ZIP. The
default command requires a clean version tag and complete authored facts.
The initial prototype used version 0.20.0, with 743 files and all 217 maps.
It is not the 1.0.0 release or an itch.io upload.

The extracted ZIP was served under a nested URL on a static server without
route fallback. Germany and Serbia maps rendered, tours loaded, quiz navigation
and hard reloads preserved index.html, and EN/DE/IT manuals loaded all images.
The German Unicode table of contents also worked. No browser request/page errors
were recorded. Four map-resource unit tests and six packaging tests pass.
Generated HTML5 routes and output are excluded from lint/format scans.

That checkpoint had 5567/6208 complete facts. The subsequent completion pass
below supersedes its remaining-content status. Deploys remain stopped; no
deployment was tested.

### Complete facts and 1.0.0 candidate preparation (2026-10-27)

All 6208 playable slots now have three or more authored sentences in EN/IT/DE.
The final 641 sets cover Germany, Italy, Kazakhstan, Kenya, Kosovo, Moldova,
Morocco, New Zealand, North Macedonia, Pakistan, Peru, the Philippines, Russia,
South Africa, Thailand and Venezuela. Every queued batch passed exact country,
ID/kind, trilingual structure, source and Italian-style validation before
integration; numbers/years were checked with manual resolution of written
centuries and decades. All older missing and short sets are resolved.

The seven version manifests and lockfile entries now agree on 1.0.0. CHANGELOG
records a candidate, explicitly disclosing unbuilt/untested final installers.
HTML5 ZIP, its checksum sidecar and provenance report are integrated into
package-release and publish-release. Publication checks the exact asset list,
all hashes, complete facts, clean source and the version tag/commit. Drafts and
untagged candidates cannot be published. Nineteen release-tool regression tests
pass (migration, HTML5 and asset verification).

Candidate itch.io assets are exported outside the implementing worktree:
C:/Users/diego/projects/Geoclick2027-itchio-assets/candidate-1.0.0-20261027T082010Z
and its sibling ZIP. Eighteen files include four authentic 1280×800 screenshots,
630×500 cover, 1280×720 banner, full and short EN/DE/IT descriptions, tags,
upload notes and a local listing preview. Captures use the dirty candidate
build, visibly marked v1.0.0 / 3db1389; refresh from the reviewed release tag.
Actual packaged web output renders Taiwan overview, Finnish tour in German,
Hungarian overview in Italian and German quiz without request/page errors.
About shows 1.0.0 and canonical repository/itch.io links. The owner handles all
itch.io navigation/upload; no itch.io page was opened.

All four local gates pass: check, test (2873 app tests, zero failures), lint
and production build. The standard root test command now includes all nineteen
release-tool regressions. The manual-version checks caught the old version text
in EN/DE/IT and all three headings were updated to the 1.0.0 candidate.

Final independent review on c057ff6: [no blockers](https://github.com/diegoami/Geoclick2027/pull/245#pullrequestreview-5664961709). The sole MINOR finding was missing German comma spacing in two Dutch facts; both are corrected and regenerated. The reviewer independently checked all trilingual structures/numbers, sampled about sixty fact sets and exercised a nested browser ZIP. Twelve packaging and 54 focused app tests passed. The review was not the formal release milestone review.

The clean browser candidate from c057ff6 has 743 files / 217 maps and complete
fact hooks for all 7400 target appearances. Maps, tours, quiz reloads, all three
manuals/images/Unicode TOC and all 217 home-map choices pass on a nested host
without route fallback. It is untagged and correctly fails publication checks.
Clean candidate assets and playable ZIP are separately exported at
C:/Users/diego/projects/Geoclick2027-itchio-assets/candidate-1.0.0-c057ff6-20261027T083655Z.
This supersedes the earlier dirty promotional draft; tagged final refresh remains.

Remaining: explicit owner merge
approval for #243/#245, candidate milestone issue and owner-started review,
installer/device checks, exact reviewed tag, final artifacts/screenshots and
publication, then verified old-repository retirement. No tag, publication,
merge or deployment was performed. Android SDK/signing configuration is ready
in this worktree; no Android device or AVD was available during preflight.
