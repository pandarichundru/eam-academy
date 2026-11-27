# EAM Academy

> **Free, independent training for HxGN EAM and Infor EAM.**  
> Not affiliated with Hexagon or Infor. All lesson text, scenarios and SQL exercises are original work.

[![Deploy](https://github.com/pandarichundru/eam-academy/actions/workflows/pages.yml/badge.svg)](https://github.com/pandarichundru/eam-academy/actions/workflows/pages.yml)
[![Content checks](https://github.com/pandarichundru/eam-academy/actions/workflows/checks.yml/badge.svg)](https://github.com/pandarichundru/eam-academy/actions/workflows/checks.yml)

**Live site →** https://pandarichundru.github.io/eam-academy/

---

## What is this?

EAM Academy is a static, local-first learning site for **HxGN EAM** (formerly Infor
EAM). It covers the full application lifecycle from asset registration through work
management, purchasing, inventory, preventive maintenance, inspections, administration,
integration and SQL reporting — with a fictional SQLite training database you can query
right in the browser.

### Who it's for

| Role | Key sections |
|---|---|
| New user / beginner | Curriculum → Introduction to EAM, Fundamentals |
| Maintenance technician | Equipment management, Work management |
| Maintenance planner | Work management, Preventive maintenance |
| Inventory / purchasing | Materials and inventory, Purchasing management |
| Functional consultant | Full curriculum + Workshops |
| Technical consultant / analyst | Database and SQL, Technical Library, SQL Lab |
| System administrator | Administration, Customization and integration |
| Interview preparation | Role paths → Interview preparation |

---

## Features

- **187 lessons** across 12 modules with business scenarios, step-by-step walkthroughs,
  field documentation and verification guidance
- **110 SQL exercises** at four difficulty levels (Easy → Very Hard), graded against
  two independent datasets
- **SQL Lab** — write and run read-only SQLite queries against a 28-table training
  database, directly in the browser (no install required)
- **Technical Library** — 1,681 R5 database table definitions, 2,405 triggers,
  1,629 stored procedures, an interactive ER diagram explorer and a full-text code search
- **Workshops** — 12 business-decision scenarios linking lessons to real outcomes
- **Assessments & Quizzes** — 51 multiple-choice questions with explanations
- **Role paths** — curriculum organized by job role (10 roles)
- **Process flows** — five key EAM business lifecycles visualized
- **Local-first progress** — completions, bookmarks, notes and quiz state live in
  `localStorage`; export / import JSON backup for device portability
- **Offline capable** — service worker caches the app shell, fonts and visited lessons
  after the first online visit
- **No backend** — static files only; runs on GitHub Pages or any static host

---

## Run locally

```bash
# Clone the repo
git clone https://github.com/pandarichundru/eam-academy.git
cd eam-academy

# Start a local server (Python 3 ships with this)
python3 -m http.server 8000

# Open in browser
open http://localhost:8000
```

No build step, no install, no Node.js required. After the first online visit finishes
caching, lessons, search and SQL work offline.

**Keyboard shortcuts**: `⌘K` / `Ctrl+K` — focus search · `/` — focus search (when not
in a text field)

---

## Content structure

```
curriculum.json      # 180 lessons (functional / technical / consulting)
introduction.json    # 7 intro lessons (merged at runtime as "Introduction to EAM")
enrichment.json      # Per-lesson extra context, examples and flow diagrams
quizzes.json         # 51 quiz questions
challenges.json      # 110 SQL exercises with graded expected results
catalog.json         # 1,681 R5 database table definitions
extended.json        # Topic index and table relation data
code_meta.json       # Trigger / procedure counts and ER edge data
data/training.db     # Fictional 28-table SQLite training database
data/practice-*.db   # Two SQLite datasets used for SQL exercise grading
data/docs-*.json     # Chunked source document pages (lazy-loaded)
data/code-*.json     # Chunked recovered SQL objects (lazy-loaded)
```

All JSON files are **hand-authored source** — none is code-generated from another.

### Lesson format (`curriculum.json`)

Each lesson object has:

| Field | Required | Description |
|---|---|---|
| `id` | ✅ | Stable identifier (e.g. `L012`, `INTRO01`) |
| `module` | ✅ | One of the 12 curriculum modules |
| `title` | ✅ | Lesson title |
| `level` | ✅ | `Beginner` / `Intermediate` / `Advanced` |
| `type` | ✅ | `functional` / `technical` / `consulting` / `intro` |
| `concept` | ✅ | One-sentence learning objective |
| `scenario` | ✅ | Fictional PLANT01 business situation |
| `walkthrough` | ✅ | Ordered step strings (functional/consulting) |
| `verify` | ✅ | Expected outcome and troubleshooting note |
| `sql` | technical only | SELECT / CTE query for the SQL Lab |
| `source` | ✅ | HxGN + Infor source references and evidence |

---

## How to add content

### Add a lesson

1. Copy a similar record from `curriculum.json`.
2. Give it a **new stable ID** (next `L` number for functional; use `L` prefix + number
   for technical).
3. Set `module`, `level`, `type`, `concept`, `scenario`, `walkthrough`, `verify` and
   the `source` block.
4. For technical lessons, add `sql` with a query that runs against `data/training.db`.
5. Run `python3 scripts/check-content.py` to validate.

### Add a quiz question

Append a record to `quizzes.json`:
```json
{
  "id": "Q-FUN-042",
  "module": "Work management",
  "lesson": "Regular work order lifecycle",
  "q": "Which field uniquely identifies a work order?",
  "options": ["Description", "Equipment code", "Work order number", "Department"],
  "answer": 2,
  "explain": "The work order number is the system-assigned identifier. Description and equipment can repeat across orders."
}
```
`lesson` must match a lesson `title` exactly (case-sensitive).

### Add a SQL exercise

Append the next numeric ID to `challenges.json`:
```json
{
  "id": 111,
  "title": "Open orders with no activities",
  "prompt": "List work order IDs that have no activity records.",
  "level": "Medium",
  "tables": ["work_orders", "activities"],
  "sql": "SELECT w.id FROM work_orders w LEFT JOIN activities a ON a.wo = w.id WHERE w.status = 'Open' AND a.wo IS NULL;",
  "reason": "LEFT JOIN retains orders without activities; IS NULL on the right side identifies the unmatched rows.",
  "expected": [/* dataset 0 expected rows */, /* dataset 1 expected rows */],
  "cols": 1,
  "ordered": false
}
```
Run the query on both `data/practice-0.db` and `data/practice-1.db` to populate
`expected`.

### Add offline files

Include any new runtime asset in the `files` list in `sw.js`. The deployment workflow
versions the cache per commit SHA.

---

## Deploy

The site deploys automatically to GitHub Pages on every push to `main`.

**Manual setup** (first time):
1. Go to **Settings → Pages → Source → GitHub Actions**
2. Push to `main` or run **Deploy academy** from the Actions tab

The deploy workflow:
1. Runs `python3 scripts/check-content.py` (validates all lessons, quizzes, SQL)
2. Copies static assets to `_site/`
3. Patches the service worker cache version with the commit SHA
4. Uploads and deploys to GitHub Pages

---

## Project structure

```
eam-academy/
├── index.html              # App shell
├── app.js                  # Core router + all page renderers
├── field-guide.js          # Home page + lesson sidebar
├── challenges.js           # SQL practice UI
├── workshops.js            # Workshop scenarios + SQL stage data
├── library.js              # Lazy doc loader
├── query-client.js         # SQL Web Worker bridge
├── training-worker.js      # SQLite worker (runs sql-asm.js)
├── sql-asm.js              # Vendored sql.js asm.js build
├── sql-js-LICENSE.txt      # sql.js MIT license
├── sw.js                   # Service worker
├── style.css               # Design system
├── manifest.webmanifest    # PWA manifest
├── academy.svg             # Logo / favicon
├── social-preview.png      # 1200×630 OG image
├── LICENSE                 # MIT (code) + CC BY-NC-SA 4.0 (content)
├── README.md               # This file
├── CONTRIBUTING.md         # Contribution guidelines
├── curriculum.json         # 180 lessons
├── introduction.json       # 7 intro lessons
├── enrichment.json         # Per-lesson enrichment data
├── quizzes.json            # 51 quiz questions
├── challenges.json         # 110 SQL exercises
├── catalog.json            # 1,681 R5 table definitions
├── extended.json           # Topic index + ER relations
├── code_meta.json          # Code object metadata
├── practice.sql            # Reference SQL (not loaded at runtime)
├── data/
│   ├── training.db         # Fictional 28-table training database
│   ├── practice-{0,1}.db   # Two SQL exercise grading datasets
│   ├── schema.json         # Pre-extracted training schema
│   ├── docs.json           # Doc chunk manifest
│   ├── docs-{0..4}.json    # Source document pages (lazy-loaded)
│   ├── code.json           # Code chunk manifest
│   ├── code-{0..10}.json   # Recovered SQL objects (lazy-loaded)
│   └── eam-introduction-pages-2-3.pdf
├── scripts/
│   └── check-content.py    # Content validation script
├── docs/
│   ├── AUDIT.md            # Full site audit
│   └── CONTENT_RISKS.md    # Content licensing risk register
└── .github/
    └── workflows/
        ├── checks.yml      # CI: content + syntax checks
        └── pages.yml       # CD: deploy to GitHub Pages
```

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

---

## License

- **Code** (JS, CSS, HTML, scripts): [MIT](LICENSE)
- **Content** (lessons, scenarios, exercises, quizzes): [CC BY-NC-SA 4.0](LICENSE)

---

## Disclaimer

HxGN EAM and Infor EAM are trademarks of their respective owners. This site is an
independent educational resource with no commercial relationship to, and not affiliated
with or endorsed by, Hexagon AB or Infor Group. The fictional training database and all
lesson scenarios use simplified, made-up data and are not suitable for production use.
