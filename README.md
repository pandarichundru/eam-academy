# EAM Academy

A static Enterprise Asset Management field guide with searchable lessons, source documents, quizzes, workshops and a read-only SQL lab. Quiz results, notes, bookmarks and dashboard progress stay in the browser. Use **My learning** to export or import a backup.

## Run locally

Run `python3 -m http.server 8000` from this directory and open [localhost:8000](http://localhost:8000). No install or build is required. After the first online visit finishes caching, lessons, search and SQL work offline. Ctrl+K or Cmd+K focuses search.

## Add material

- **Lesson** — Copy a similar record in `curriculum.json`. Give it a new stable ID and preserve the module, walkthrough, verification and source evidence fields. Technical lessons also need SQL that runs against `data/training.db`.
- **Quiz** — Append a record to `quizzes.json`. Match the lesson title and module exactly. Supply a unique ID, difficulty in the prompt, options, zero-based answer index and an explanation.
- **SQL challenge** — Append the next numeric ID in `challenges.json`. Reuse an existing level, list the required tables and provide the prompt, SQL and hint. Run the solution on both practice databases in numerical order to populate `expected`. Set `cols` to the column count and `ordered` when the prompt requires sorting.
- **Offline files** — Include new runtime assets in the list in `sw.js`. The deployment workflow versions the cache per commit.

## Deploy

Select **Settings → Pages → Source → GitHub Actions**. Push to `main` or run **Deploy academy** manually. The workflow publishes static assets under the repository's Pages path.
