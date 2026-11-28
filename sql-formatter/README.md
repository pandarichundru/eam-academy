# Offline SQL Formatter

A lightweight, single-page, client-side SQL formatter styled with the Obsidian & Porcelain design system.

## Privacy & Security
- **100% client-side:** All tokenization, highlighting, formatting, and minifying run locally in the browser (`sql-engine.js`).
- **Zero external requests:** No CDN scripts, no external fonts, no analytics, and no backend APIs.
- **Zero persistence:** Pasted SQL is never written to `localStorage`, `sessionStorage`, or cookies.
- **No database features:** No connections, credentials, execution, autocomplete, or schema browsing.

## Local Usage
Open `index.html` directly in any modern browser, or serve the `sql-formatter/` folder from any static web server:

```bash
cd sql-formatter
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

## Deployment
Copy the `sql-formatter/` directory (`index.html`, `style.css`, `sql-engine.js`, `app.js`) to any internal Nginx, Apache, S3, or static web host. No build step or runtime dependencies are required.
