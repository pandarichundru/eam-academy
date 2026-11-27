# Contributing to EAM Academy

Thank you for your interest in improving EAM Academy. This is an independent
educational project; contributions that improve accuracy, clarity, coverage or
technical quality are welcome.

---

## Before you contribute

- Read the [license](LICENSE). Code contributions are MIT; content contributions are
  CC BY-NC-SA 4.0. By submitting a pull request, you agree to these terms.
- Read `docs/CONTENT_RISKS.md` before adding any content derived from vendor
  documentation.
- Check the [open issues](https://github.com/pandarichundru/eam-academy/issues) to
  avoid duplicating work.

---

## Ways to contribute

### 🐛 Report a bug or error

Use the GitHub Issues tab. Include:
- The route / lesson ID where the error appears (e.g. `#lesson/L012`)
- What you expected vs. what you saw
- Browser and OS

### ✏️ Fix a lesson error

1. Fork the repo.
2. Edit `curriculum.json` or `introduction.json` — do not change the `id`, `module` or
   `source` fields without discussion.
3. Run `python3 scripts/check-content.py` from the repo root — it must exit 0.
4. Open a pull request with a short description of what was wrong and your fix.

### ➕ Add a lesson

See the [Add a lesson](README.md#add-a-lesson) section in the README. Key rules:
- Keep the `id` stable and unique; use the next available `L` number for functional
  lessons.
- `walkthrough` must be original writing — do not copy vendor documentation verbatim.
- The `source.evidence.steps[]` and `.fields[]` arrays are for internal reference only;
  they may not include full verbatim vendor procedures.

### 🔢 Add a SQL exercise

See [Add a SQL exercise](README.md#add-a-sql-exercise) in the README. Key rules:
- The solution must run correctly on **both** `data/practice-0.db` and
  `data/practice-1.db`.
- Populate `expected` by running the solution on each database.
- `cols` and `ordered` must be set correctly.

### 🧪 Improve CI or tooling

Improvements to `scripts/check-content.py`, the GitHub Actions workflows, or the
build system are welcome. Keep the checks fast (< 30 s) and free of external network
calls.

---

## Development setup

```bash
git clone https://github.com/pandarichundru/eam-academy.git
cd eam-academy
python3 -m http.server 8000
# open http://localhost:8000
```

Validate content before every commit:
```bash
python3 scripts/check-content.py
```

---

## Code style

- JavaScript: `'use strict'`; ES2020+; no build required for existing code.
- CSS: custom properties; BEM-like class names; no preprocessors.
- JSON: 2-space indentation.
- Avoid introducing new external dependencies without discussion.

---

## Content policy

- All lesson text, scenarios, walkthroughs and SQL must be **original writing**.
- Do not reproduce verbatim procedures from HxGN EAM Help or Infor documentation.
- You may reference official documentation by URL using the existing `source.online.url`
  pattern.
- Flag any content that may carry copyright risk in `docs/CONTENT_RISKS.md` rather
  than silently including it.

---

## Pull request checklist

- [ ] `python3 scripts/check-content.py` exits 0
- [ ] No new 404s (checked all file references in `sw.js` and `index.html`)
- [ ] New IDs are unique across all files
- [ ] No verbatim vendor documentation in lesson text
- [ ] PR description explains what was changed and why
