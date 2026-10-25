# v1.0.0 — public distribution and country expansion

Owner-approved scope: [proposal #241](https://github.com/diegoami/Geoclick2027/issues/241).
Release version: **1.0.0**. itch.io page: <https://diegoami.itch.io/geoclick>.
This plan records work still to land; it is not a claim that 1.0.0 is released.

## Work batches

| Batch | Status | Deliverable |
| --- | --- | --- |
| Distribution | In progress | Verified migration of 39 releases into Geoclick2027; links and publisher updated |
| Boundary and target audit | Pending | Licensed, reproducible sources and suitable map types for 22 countries |
| Maps | Pending | Administrative maps and towns/urban maps; generated through the existing pipeline |
| Facts | Pending | Facts for added targets in English, German, and Italian; existing target gaps audited |
| Content completion | Pending | Deferred thin towns maps and German/Italian manual checked against agreed scope |
| itch.io | Pending | #240 viewport baseline, ZIP verification, smoke tests and guarded upload |
| Release preparation | Pending | Seven manifests and lockfile entries at 1.0.0; accurate CHANGELOG; gates |
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
SHA256SUMS.txt, then downloads copied assets and compares SHA-256. Historical checksum discrepancies block copying by default. After reviewing backup-verification.json, --preserve-stale-checksums permits copying original bytes only when they match GitHub asset digests; copied release notes list the discrepancy and actual hashes. Original SHA256SUMS.txt files are preserved verbatim.

GitHub cannot preserve original release publication timestamps on creation.
Original timestamps remain in the backup and copied notes. Original release
IDs, asset IDs, download counters and external URLs also change. Canonical
source tags and commits remain unchanged.

Before deleting the old repository: retain its Git mirror and repository/issue
metadata as well as the release backup; verify every historical release; land
all replacement links; confirm public downloads work. No deletion command is
part of the migration tool. Old external URLs will stop working after deletion.

## itch.io and final verification

Follow #240: determine usable portrait/landscape sizes, test 640x480 and 480x720,
record the chosen embed size, keep fullscreen under player control, and test
the extracted ZIP rather than just source. Upload only through an available
authorized route to diegoami/geoclick. Do not claim an upload or phone test
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
