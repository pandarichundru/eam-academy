# Changelog

## Unreleased (`improvement/all-phases`)

### Added
- **Static pre-rendering (`scripts/build.py`)**: Generates `/dist` with static HTML for the home page, 187 individual lesson pages (`/learn/<slug>/index.html`), `sitemap.xml`, `robots.txt`, `404.html`, `search-index.json`, and per-lesson JSON chunks (`/learn/_chunks/`), plus a hash-route redirect shim.
- **Documentation & Governance**: Added `docs/AUDIT.md`, `docs/CONTENT_RISKS.md`, `docs/content-audit.csv`, `LICENSE` (MIT for code, CC BY-NC-SA 4.0 for content), `CONTRIBUTING.md`, and GitHub issue templates.
- **SEO & Social**: Updated `<title>`, 150–160 char meta description, `<link rel="canonical">`, Open Graph, Twitter Card tags, `social-preview.svg`, and `social-preview.png` (1200×630).
- **CI/CD**: Added `scripts/validate-schemas.py` and `scripts/check-links.py`; updated `.github/workflows/checks.yml` and `.github/workflows/pages.yml` to build and validate `/dist` before deploying to GitHub Pages.

### Fixed
- Added `<noscript>` fallback and visible JS-failure error state in `index.html` and `app.js` replacing the endless "Loading academy…" message.
- Added `introduction.json` and `social-preview.png` to `sw.js` offline cache list.
- Expanded `README.md` with full feature list, local run instructions, content structure, and contribution guide.
