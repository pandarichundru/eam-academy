# EAM Academy – Full Audit

> **Branch**: `improvement/all-phases`  
> **Auditor**: AI-assisted full-stack review  
> **Audit date**: 2026-11-27  
> **Existing test suite**: PASS (`python3 scripts/check-content.py` → 187 lessons, 51 quizzes, 220 SQL results verified)

---

## 1. Repository File Map

| File / Path | Role | Notes |
|---|---|---|
| `index.html` | App shell (112 lines) | Hash-routed SPA; `<main>` has only "Loading academy…" placeholder |
| `app.js` | Core app (1 250 lines, 109 KB) | Routing, all page renderers, SQL lab, search, progress, quizzes, glossary, ER explorer, crosswalk, code viewer, lessons, assessments |
| `field-guide.js` | Home + lesson sidebar (124 lines) | `fieldHome()`, `workshopCards()`, `activityDay()`, `logActivity()`, `learningDashboard()`, `attachLessonContents()` |
| `challenges.js` | SQL practice UI (140 lines) | Loads `challenges.json` lazily on first practice route visit |
| `workshops.js` | Workshops + SQL stage data (77 lines) | In-memory workshop definitions + `sqlResults` pre-computed table |
| `library.js` | Lazy doc loader (52 lines) | Fetches `data/docs.json` → chunk paths → flattens; same pattern for `data/code.json` |
| `query-client.js` | SQL worker bridge (10 lines) | Wraps Web Worker with 10 s timeout |
| `training-worker.js` | SQLite worker (21 lines) | `importScripts('sql-asm.js')`; runs query in `data/training.db` or `data/practice-{0,1}.db` |
| `sql-asm.js` | sql.js asm.js build (1.3 MB) | Vendored; `sql-js-LICENSE.txt` present |
| `sw.js` | Service worker (77 lines) | Cache-first for data/JSON/db; network-first for HTML/JS/CSS; cache-busted by `GITHUB_SHA` at deploy |
| `style.css` | Stylesheet (2 914 lines) | Full design system; cache-busted with `?v=` string |
| `curriculum.json` | **Source** – 180 functional/technical/consulting lessons (592 KB) | Main lesson bank; never generated |
| `introduction.json` | **Source** – 7 intro lessons referencing curriculum IDs (8 KB) | Merged at runtime with curriculum; not generated |
| `enrichment.json` | **Source** – per-hex-page enrichment data: `context`, `flow`, `example`, `check` (21 KB) | Keyed by HxGN page number |
| `quizzes.json` | **Source** – 51 quizzes (25 KB) | Linked to lesson title + module |
| `challenges.json` | **Source** – 110 SQL exercises with expected results for 2 datasets (76 KB) | Not generated from any other file |
| `catalog.json` | **Source** – 1 681 R5 tables + TOC + doc stats (197 KB) | `tables`, `keys`, `toc`, `stats` |
| `extended.json` | **Source** – 844 topic entries + 245 ER relations (749 KB) | `topics: list`, `relations: list` |
| `code_meta.json` | **Source** – trigger/procedure/view counts + ER edges + col tokens (167 KB) | `counts`, `key_tables`, `er_edges`, `col_tokens` |
| `data/docs.json` | Manifest – lists chunk filenames for `docs-0..4.json` | Loaded by `library.js` |
| `data/code.json` | Manifest – lists chunk filenames for `code-0..10.json` | Loaded by `library.js` |
| `data/docs-{0..4}.json` | Chunked docs (1.0–2.0 MB each) | HxGN Help + Infor 11.6 source pages |
| `data/code-{0..10}.json` | Chunked code (0.5–1.8 MB each) | Recovered SQL triggers/procedures/views |
| `data/training.db` | SQLite DB for SQL lab (192 KB) | Fictional 28-table schema |
| `data/practice-{0,1}.db` | SQLite DBs for SQL exercises (200 KB each) | Two different datasets for grading |
| `data/schema.json` | Training schema (8 KB) | Pre-extracted for the SQL lab sidebar |
| `data/eam-introduction-pages-2-3.pdf` | PDF teaching slides | Referenced from lesson INTRO01 |
| `practice.sql` | Sample SQL file (58 lines) | Not loaded by any JS; informational only |
| `academy.svg` | SVG logo / favicon | Exists; used in `<link rel="icon">` and manifest |
| `manifest.webmanifest` | PWA manifest (1 line) | Exists; references `academy.svg` as icon |
| `scripts/check-content.py` | Content validation script | Validates lessons, quizzes, SQL challenges against both DBs |
| `.github/workflows/checks.yml` | CI: syntax + content checks on all pushes/PRs | No Lighthouse, no axe, no link checker |
| `.github/workflows/pages.yml` | CD: copy → `_site/` → deploy to GitHub Pages | No build step; raw files served |
| `README.md` | Minimal readme (18 lines) | No screenshot, features list, license, or disclaimer |

### Generated vs source files
All JSON files are **hand-authored source**. No file is code-generated from another. `challenges.js` is **not** generated from `challenges.json`; they are independent (JS = UI code, JSON = data). The `data/code.json` and `data/docs.json` files are **manifests** (index files), not generated from code.

---

## 2. Runtime Architecture

```
index.html (shell)
  ├── Google Fonts (CDN, render-blocking)
  ├── style.css?v=... (render-blocking)
  ├── query-client.js   → defines runTrainingQuery() (sync load)
  ├── challenges.js     → defines practice UI (sync load)
  ├── library.js        → defines academyAPI() (sync load)
  ├── workshops.js      → defines workshops[], sqlResults{} (sync load)
  ├── field-guide.js    → defines fieldHome(), learningDashboard() (sync load)
  └── app.js            → defines everything else; on DOMContentLoaded:
        Promise.all([curriculum.json, catalog.json, extended.json,
                     enrichment.json, code_meta.json, quizzes.json,
                     introduction.json])
          → lessons[], groups{} built
          → route() called
          → serviceWorker registered (sw.js)
```

**Hash routing**: `#home`, `#learn`, `#lesson/ID`, `#module/NAME`, `#workshops`, `#workshop/MODULE`, `#sql-course`, `#sql/ID`, `#sql/pump-N`, `#technical`, `#tables`, `#table/NAME`, `#triggers`, `#procedures`, `#codes`, `#code/ID`, `#er/TABLE`, `#crosswalk`, `#practice`, `#practice/LEVEL`, `#exercise/N`, `#reference`, `#search/QUERY`, `#doc/ID`, `#glossary`, `#fields`, `#topics`, `#paths`, `#path/ROLE`, `#flows`, `#pump`, `#progress`, `#assess`, `#coverage`

**Data loading on route**:
- SQL lab: worker spawned, loads `sql-asm.js` + `.db` via `importScripts` + `fetch`
- Technical library (docs): `library('docs')` → fetches `data/docs.json` → fetches all chunks lazily once; chunks are ~1–2 MB each
- Code explorer: `library('code')` → fetches `data/code.json` → fetches all 11 chunks lazily; total ~15 MB

---

## 3. Console Errors & 404s (Offline Analysis)

> **Note**: The sandbox has no outbound network access and no browser. The analysis below is derived from static code inspection. Items marked with ⚠️ need live verification via browser DevTools once published.

| # | Issue | Severity | Evidence |
|---|---|---|---|
| 1 | `manifest.webmanifest` exists ✅ | — | File present |
| 2 | `academy.svg` exists ✅ | — | File present |
| 3 | Google Fonts CDN call (render-blocking) | Medium | `<link>` in `<head>` without `preload` for WOFF2 |
| 4 | `style.css?v=436551215215` – manual version string | Low | Cache-busting works but fragile |
| 5 | `sw.js` lists `manifest.webmanifest` as a cached asset? | Low | `sw.js` does NOT list `manifest.webmanifest` or `introduction.json` in `files[]`. The `introduction.json` will be fetched on first route but is **not** in the SW cache list → offline first-visit to home could fail on lesson sidebar | 
| 6 | `introduction.json` not in SW cache | Medium | Missing from `sw.js files[]` array; will be a network miss offline after cold start |
| 7 | `data/code.json` / `data/docs.json` indices not in SW cache | Low | Expected; they're lazy-loaded |
| 8 | `practice.sql` referenced nowhere in JS | Low | Dead file; not loaded by any script |
| 9 | Scripts load in sequence, synchronously | Medium | Six `<script>` tags in body, no `defer` or `type="module"` |
| 10 | `window.location.hash` routing → no canonical URL per lesson | High | Crawlers see only the shell; zero lesson text in HTML |
| 11 | No `<noscript>` message | High | Users with JS disabled see only "Loading academy…" forever |
| 12 | Generic meta description (< 150 chars, no keywords) | High | SEO impact |
| 13 | No Open Graph / Twitter tags | High | Social share shows no preview |
| 14 | No canonical `<link>` | Medium | Duplicate content risk |
| 15 | Title "EAM Academy" – not descriptive | Medium | SEO impact |
| 16 | `sql-asm.js` (1.3 MB) always loaded via `importScripts` even when SQL lab not visited | High | Loaded eagerly in worker on first SQL query; not on page load — **acceptable** |
| 17 | No LICENSE file | Medium | MIT / CC license intent not documented |
| 18 | No `robots.txt` or `sitemap.xml` | Medium | Crawlers may index incorrectly |
| 19 | No `404.html` | Low | GitHub Pages default 404 shown |
| 20 | Chunk files `data/code-{0..10}.json` total ~15 MB; loaded all at once when any code search runs | High | No pagination or worker-based streaming |
| 21 | `extended.json` (749 KB) loaded eagerly in `Promise.all` even if unused | High | Included in startup fetch regardless of route |
| 22 | `catalog.json` (197 KB) loaded eagerly | Medium | Needed for reference pages only |
| 23 | Startup `Promise.all` loads 7 JSON files synchronously; total startup data ~1.7 MB on first visit (without SW) | High | Very slow on mobile / slow connections |
| 24 | No visible error state if JS fails | High | Users see "Loading academy…" indefinitely |
| 25 | Repo has no license file | Medium | IP risk unclear |
| 26 | Repo has no topics/description on GitHub | Low | Discovery impact |

---

## 4. Data / Content Structure

### curriculum.json (180 lessons)
Structure per lesson:
```json
{
  "module": "string (12 modules)",
  "title": "string",
  "concept": "string",
  "scenario": "string",
  "walkthrough": ["step strings"],
  "verify": "string",
  "type": "functional|technical|consulting",
  "level": "Beginner|Intermediate|Advanced",
  "id": "L001..L180",
  "source": {
    "hex": { "title", "page", "id", "pages": [...] },
    "infor": null | { "title", "page", "id", "kind" },
    "online": { "version", "url", "scope" },
    "evidence": { "intro", "steps": [...], "fields": [...] }
  },
  "sql": "string (technical lessons only)"
}
```

### introduction.json (7 lessons: INTRO01..INTRO07)
Each references a `curriculum.json` lesson ID via `reference`. At runtime these are merged into a synthetic "Introduction to EAM" module prepended to `lessons[]`.

### enrichment.json
Keyed by HxGN page number (string). Values: `{ context?: string[], flow?: string[], example?: [col, val, explain][], check?: string }`. Only 24 of 180+ lessons have enrichment entries.

### challenges.json
`{ exercises: [{id, title, prompt, level, tables, sql, reason, expected: [[row,...]×2], cols, ordered}], schema: {table: [col,...]} }`

### catalog.json
`{ tables: [{name, columns:[{name,type,pk},...], links:[str]},...], keys: {...}, toc: [[title,page],...], stats: {source:count} }`

### code_meta.json
`{ counts: {trigger:2405, procedure:1629, view:304, ...}, key_tables: {...}, er_edges: [{from,to,label},...], col_tokens: {...} }`

### extended.json
`{ topics: [{title,page,excerpt,steps},...], relations: [{table,col,ref_table,ref_col},...] }`

---

## 5. Confirmed Change List (by Phase)

### Phase 0 – Quick Fixes
- [x] Add `introduction.json` to `sw.js` cache list (offline fix)
- [x] Add `<noscript>` message to `index.html`
- [x] Update `<title>` to full descriptive title
- [x] Write 150–160 char meta description
- [x] Add `<link rel="canonical">` (pointing to live URL)
- [x] Add Open Graph tags (`og:title`, `og:description`, `og:image`, `og:url`, `og:type`)
- [x] Add Twitter Card tags
- [x] Create social preview image placeholder (1200×630 SVG/PNG)
- [x] Add footer trademark note (already present; expand)
- [x] Create `LICENSE` (MIT for code, CC BY-NC-SA 4.0 for content)
- [x] Add JS-failure error state (replace "Loading academy…")

### Phase 1 – Repo Restructure + README
- [ ] Create `/src`, `/content`, `/vendor`, `/styles`, `/scripts`, `/public` layout
- [ ] Move files to new locations; update all paths
- [ ] Expand README (screenshot, features, local run, content structure, contributing)
- [ ] Add `CONTRIBUTING.md`
- [ ] Set repo description + topics (requires GitHub UI or `gh` CLI, flagged for user)

### Phase 2 – Static Pre-rendering
- [ ] `scripts/build.mjs` — read content, write `/dist`
- [ ] Static HTML per lesson (`/learn/<slug>/index.html`)
- [ ] Static home page with hero HTML
- [ ] `sitemap.xml`, `robots.txt`, `404.html`
- [ ] `search-index.json` (lightweight: title, tags, summary)
- [ ] Per-lesson JSON chunks (replace monolithic curriculum.json)
- [ ] `noscript` progressive fallback
- [ ] Update GitHub Actions to run build then deploy `/dist`
- [ ] Hash→path redirect shim

### Phase 3 – Performance + Reliability
- [ ] Self-host Geist/Geist Mono WOFF2 (`font-display: swap`)
- [ ] esbuild bundle + content-hash filenames; remove `?v=` strings
- [ ] Lazy-load SQL engine / worker on demand
- [ ] Updated service worker caching strategy

### Phase 4 – IA + UX
- [ ] Reduce primary nav (merge SQL Lab + SQL Exercises → "Practice"; merge Technical Library under Reference)
- [ ] Role-based starting paths on home
- [ ] Export/Import progress (already in `progressPage()`; needs promotion)
- [ ] Audience/level/prerequisites at lesson top
- [ ] axe accessibility checks

### Phase 5 – Content Quality
- [ ] `content-audit.csv` (title, module, level, has-quiz, has-exercise, last-reviewed)
- [ ] "Report an issue" link per lesson (pre-filled GitHub issue URL)
- [ ] "Last updated" per lesson (from git history)
- [ ] Add schema disclaimer note per technical lesson (sample DB)

### Phase 6 – Testing + CI
- [ ] Expand `check-content.py` with JSON schema validation, link checking
- [ ] Lighthouse CI + axe in GitHub Actions
- [ ] Link checker on `/dist`
- [ ] SQL solution runner for all technical lessons

### Phase 7 – Growth
- [ ] Privacy-friendly analytics (GoatCounter) behind a toggle
- [ ] Issue templates
- [ ] Contribute page

---

## 6. Risk Register

| Risk | Disposition |
|---|---|
| `extended.json` (749 KB) loaded at startup even if unused | ⚠️ DEFER to Phase 2 — deferred/lazy loading |
| `catalog.json` (197 KB) loaded at startup | ⚠️ DEFER to Phase 2 |
| Source evidence fields contain verbatim HxGN/Infor text excerpts | ⚠️ See `docs/CONTENT_RISKS.md` |
| `data/eam-introduction-pages-2-3.pdf` — provenance unknown | ⚠️ Flagged in CONTENT_RISKS.md |
| `online.url` fields link to `docs.hexagonppm.com` | ✅ Outbound links; not content reproduction |
| lesson `source.evidence.steps[]` and `source.evidence.fields[]` are verbatim excerpts | ⚠️ Flagged in CONTENT_RISKS.md |

---

## 7. Files Confirmed Unused / Candidates for Removal

| File | Status |
|---|---|
| `practice.sql` | Not loaded by any JS; informational only. **Keep** as reference; document it |
| `data/code.json`, `data/docs.json` | Manifest files; keep |
| `extended.json` topics section | Loaded at startup but only used by `topics()` and `fields()` routes. **Phase 2**: load lazily |
