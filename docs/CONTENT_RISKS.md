# Content Risks – EAM Academy

> This document flags content in the EAM Academy repository that may carry
> licensing or attribution risk. It does **not** request or authorize any
> deletion; each item needs a human decision.

---

## ⚠️ Category A — Verbatim source excerpts embedded in JSON

### 1. `curriculum.json` → `source.evidence.steps[]` and `source.evidence.fields[]`

Each of the 180 lessons carries a `source.evidence` block with:
- **`steps[]`**: Numbered procedural steps copied verbatim from the HxGN EAM Help
  export (e.g. `"1. Select Start > Programs > Internet Explorer…"`)
- **`fields[]`**: Field descriptions copied verbatim from the HxGN Help pages
  (e.g. `"name": "Basics", "meaning": "Instructions on basic operation of the application"`)

**Source identified as**: `Hexagon EAM Help` (1 149 pages) and `Infor EAM 11.6`
(974 pages) — described in `catalog.json` stats.

**Display context**: These excerpts are shown in the lesson "Documentation reading"
section under the label *"Selected local source text for verification. The extract is
partial…"*. The app renders them in a `<div class="panel source-text">` with a note
that the extract is from an offline supplied export.

**Risk level**: **High**. The site displays verbatim copyrighted procedural steps from
vendor documentation as inline content. The disclaimer ("Supplied source text") does not
constitute fair use in all jurisdictions, particularly for commercial-adjacent uses.

**Recommended action** (requires owner decision):
1. Replace verbatim steps with original paraphrases in the lesson `walkthrough[]` field
   (this is already the design intent — walkthrough is original; evidence is reference).
2. Remove `source.evidence.steps[]` and `source.evidence.fields[]` from public display,
   or gate them behind a "Show source extract" `<details>` with an expanded disclaimer.
3. Confirm the HxGN Help export license: some vendor help systems explicitly allow
   educational reproduction; if so, document this with the specific license clause.

**Current UI state**: The "Documentation reading" section is **already inside a
`<details>` element** (collapsed by default) with the note *"Selected local source text
for verification. The extract is partial; use the linked online help for the full
text."* This partially mitigates visibility but does not resolve the copyright question.

---

### 2. `data/docs-{0..4}.json` — Full document body text

The chunked `docs-*.json` files contain the `body` field of each source page from the
HxGN Help export and Infor 11.6 User Guide. These are served to users who click any
source link and visit the `#doc/ID` route.

**Risk level**: **High**. These files contain large volumes of verbatim vendor
documentation text served directly to browsers. The offline export source is not
licensed for redistribution on a public site without explicit permission.

**Recommended action** (requires owner decision):
1. Remove `data/docs-*.json` from the public repository and GitHub Pages deploy, or
2. Replace with links to the official online documentation only
   (`source.online.url` already exists per lesson), or
3. Obtain written permission from Hexagon PPM and Infor to redistribute excerpts for
   educational use.

**Note for AUDIT**: Until resolved, the deployment workflow (`pages.yml`) copies all
`data/` files to `_site/`. If `docs-*.json` is removed, the Technical Library /
Reference routes will show "Record unavailable" for source text — the lesson content
itself is unaffected.

---

### 3. `data/code-{0..10}.json` — Recovered SQL objects

These contain recovered SQL trigger and stored procedure definitions for the EAM R5
database, described as `"Recovered SQL • unverified"` (1 271 objects in
`catalog.json` stats).

**Risk level**: **Medium**. SQL DDL (schema) is generally not copyrightable in many
jurisdictions, but SQL procedure logic may qualify. The exact provenance of
"recovered SQL" is unclear — whether from a live database schema, documentation, or
reverse engineering.

**Recommended action**: Flag each recovered object as *unverified and not for
production use*. The app already shows the note *"Offline extracts may span page
breaks. The written lesson is original training guidance, not a verbatim vendor
procedure."* Expand this disclaimer in the UI and in the README.

---

### 4. `data/eam-introduction-pages-2-3.pdf`

A PDF file containing what appear to be two teaching slides from an EAM introduction
course. Referenced from lesson INTRO01.

**Risk level**: **Medium**. Origin of the PDF is unknown. It is served directly from
GitHub Pages.

**Recommended action**: Confirm whether this PDF was created by the site author
(original work) or extracted from a third-party training course. If the latter, remove
or replace it with original slides. The lesson text in `introduction.json` already
provides equivalent content without the PDF.

---

## ✅ Category B — Original content (lower risk)

| Item | Assessment |
|---|---|
| `curriculum.json` → `title`, `concept`, `scenario`, `walkthrough`, `verify` | Original training guidance authored for this site |
| `introduction.json` lesson content | Original |
| `enrichment.json` → `context`, `flow`, `example`, `check` | Original additional context |
| `challenges.json` → `prompt`, `reason` | Original exercise prompts |
| `quizzes.json` → `q`, `explain` | Original quiz questions |
| `workshops.js` workshop narrative | Original case scenarios |
| `app.js`, `field-guide.js`, et al. | Original application code |
| `data/training.db`, `data/practice-*.db` | Fictional synthetic dataset — original |
| `data/schema.json` | Derived from fictional training.db — original |

---

## ⚠️ Category C — Outbound links to vendor resources

| Item | Assessment |
|---|---|
| `source.online.url` → `docs.hexagonppm.com` | External links to official docs; no reproduction |
| `source.online.version` → `12.2.1` | Version reference in link text; not reproduction |

Outbound links are low risk, but the accuracy of version numbers should be verified
periodically as HxGN Help URLs may change.

---

## TODO – Deferred items

- [ ] Confirm HxGN Help export license terms with the site owner
- [ ] Decide on `data/docs-*.json` strategy (remove / license / replace with links)
- [ ] Confirm provenance of `data/eam-introduction-pages-2-3.pdf`
- [ ] Decide on recovered SQL object disclaimer strategy
- [ ] Add content license split to `LICENSE` file once strategy is confirmed
