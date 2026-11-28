#!/usr/bin/env python3
"""
EAM Academy Static Build Script
Reads /content (JSON files) and writes /dist with:
  - Static HTML home page
  - One static HTML page per lesson at /learn/<slug>/index.html
  - sitemap.xml, robots.txt, 404.html
  - search-index.json (lightweight: title, tags, summary)
  - Per-lesson JSON chunks
  - Hash-redirect shim for old #hash URLs
"""

import json
import os
import re
import shutil
import hashlib
from pathlib import Path
from datetime import datetime, timezone

ROOT = Path(__file__).parent.parent
DIST = ROOT / 'dist'
CONTENT = ROOT  # JSON files at root for now; Phase 1 restructure moves to /content

SITE_URL = 'https://pandarichundru.github.io/eam-academy'
BUILD_DATE = datetime.now(timezone.utc).strftime('%Y-%m-%d')

# ─── Helpers ───────────────────────────────────────────────────────────────────

def slugify(text):
    """Convert lesson title or ID to URL-safe slug."""
    s = text.lower().strip()
    s = re.sub(r'[^a-z0-9]+', '-', s)
    return s.strip('-')

def e(text):
    """HTML-escape a string."""
    return (str(text)
            .replace('&', '&amp;')
            .replace('<', '&lt;')
            .replace('>', '&gt;')
            .replace('"', '&quot;'))

def load_json(path):
    return json.loads(Path(path).read_text(encoding='utf-8'))

def write(path, content):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding='utf-8')

def module_slug(module_name):
    return slugify(module_name)

# ─── Load content ──────────────────────────────────────────────────────────────

def load_all():
    curriculum = load_json(CONTENT / 'curriculum.json')
    introduction = load_json(CONTENT / 'introduction.json')
    enrichment = load_json(CONTENT / 'enrichment.json')
    quizzes = load_json(CONTENT / 'quizzes.json')

    # Merge introduction into lessons (same as runtime app.js)
    intro_lessons = []
    curr_map = {l['id']: l for l in curriculum}
    for item in introduction:
        base = {**item,
                'module': 'Introduction to EAM',
                'level': 'Beginner',
                'type': 'intro',
                'source': curr_map[item['reference']]['source']}
        intro_lessons.append(base)

    lessons = intro_lessons + curriculum

    diagrams = load_json(CONTENT / 'lesson-diagrams.json')
    notes = load_json(CONTENT / 'lesson-notes.json')
    records = load_json(CONTENT / 'lesson-records.json')
    expected = {l['id'] for l in lessons if l['type'] in ('functional', 'intro')}
    if set(diagrams) != expected or set(notes) != expected:
        raise ValueError('Provide exactly one diagram for each functional and introductory lesson')
    for lesson in lessons:
        lid = lesson['id']
        lesson['diagram'] = diagrams.get(lid)
        lesson['diagram_notes'] = notes.get(lid, [])
        lesson['records'] = records.get(lid, [])
        if lid in diagrams and (len(notes[lid]) != len(diagrams[lid]['labels']) or not all(notes[lid])):
            raise ValueError(f'Provide one explanation per diagram label for {lid}')

    # Build groups
    groups = {}
    for l in lessons:
        groups.setdefault(l['module'], []).append(l)

    # Build slug → lesson map (using lesson ID as primary slug)
    slug_map = {}
    for l in lessons:
        slug = l['id'].lower()
        slug_map[slug] = l
        # Also map by title slug for readability
        title_slug = slugify(l['title'])
        if title_slug not in slug_map:
            slug_map[title_slug] = l

    return lessons, groups, enrichment, quizzes, slug_map

# ─── Page template ─────────────────────────────────────────────────────────────

def html_shell(title, description, canonical_path, og_image, body_html,
               extra_head='', body_class='', nav_active=''):
    canonical = f'{SITE_URL}{canonical_path}'
    og_img = f'{SITE_URL}/{og_image}'
    return f'''<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{e(title)}</title>
  <meta name="description" content="{e(description)}">
  <meta name="theme-color" content="#ffffff">
  <link rel="canonical" href="{canonical}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="{canonical}">
  <meta property="og:title" content="{e(title)}">
  <meta property="og:description" content="{e(description)}">
  <meta property="og:image" content="{og_img}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:site_name" content="EAM Academy">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="{e(title)}">
  <meta name="twitter:description" content="{e(description)}">
  <meta name="twitter:image" content="{og_img}">
  <link rel="manifest" href="/eam-academy/manifest.webmanifest">
  <link rel="icon" href="/eam-academy/academy.svg" type="image/svg+xml">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist+Mono:wght@400;500;600&family=Geist:wght@400;500;600;700&display=swap">
  <link rel="stylesheet" href="/eam-academy/style.css?v=BUILD_HASH">
  {extra_head}
</head>
<body{' class="' + body_class + '"' if body_class else ''}>
  <a class="skip" href="#main">Skip to content</a>
  <header class="site-header">
    <a class="brand" href="/eam-academy/">
      <span class="brandmark" aria-hidden="true">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
          <rect x="2" y="2" width="12" height="12" rx="2.5"></rect>
          <path d="M5.5 6h5M5.5 8.2h3.5M5.5 10.4h5"></path>
        </svg>
      </span>
      <span class="brand-text">EAM <b>Academy</b><small>Field Guide</small></span>
    </a>
    <nav id="topnav" aria-label="Primary">
      <a href="/eam-academy/"{"aria-current='page'" if nav_active=='home' else ''}>Home</a>
      <a href="/eam-academy/#practice">SQL Practice · 110</a>
      <a href="/eam-academy/#learn"{"aria-current='page'" if nav_active=='learn' else ''}>Curriculum</a>
      <a href="/eam-academy/#workshops">Workshops</a>
      <a href="/eam-academy/#sql-course">SQL Lab</a>
      <a href="/eam-academy/sql-formatter/">SQL Formatter</a>
      <a href="/eam-academy/#technical">Technical Library</a>
      <a href="/eam-academy/data/database-reference.html">Database Reference</a>
      <a href="/eam-academy/#reference">Reference</a>
      <a href="/eam-academy/#progress">My Learning</a>
    </nav>
    <button id="mobileNavBtn" type="button" class="mobile-nav-btn" aria-controls="topnav" aria-expanded="false" aria-label="Toggle navigation menu">
      <span>Menu</span>
    </button>
  </header>
  <noscript>
    <div class="noscript-banner" role="note">
      <strong>JavaScript is disabled.</strong> Some features (SQL lab, quizzes, progress tracking) require JavaScript. Lesson content is visible without it.
    </div>
  </noscript>
  <main id="main" tabindex="-1">
    {body_html}
  </main>
  <footer>
    <div class="footer-inner">
      <span>Independent training resource · Local-first · Not affiliated with Hexagon or Infor</span>
      <span class="footer-trademark">HxGN EAM and Infor EAM are trademarks of their respective owners.</span>
    </div>
  </footer>
  <script>
    // Hash-route redirect shim: redirect old /#lesson/ID → /eam-academy/learn/ID/
    (function() {{
      var h = location.hash;
      if (!h || h === '#' || h === '#home') return;
      var base = '/eam-academy';
      var m;
      if ((m = h.match(/^#lesson\\/([^/]+)$/))) {{
        location.replace(base + '/learn/' + encodeURIComponent(m[1]).toLowerCase() + '/');
      }} else if ((m = h.match(/^#module\\/([^/]+)$/))) {{
        location.replace(base + '/#module/' + m[1]);
      }} else {{
        // Other hash routes: redirect to SPA shell
        location.replace(base + '/' + h);
      }}
    }})();
  </script>
  <script src="/eam-academy/query-client.js" defer></script>
  <script src="/eam-academy/challenges.js" defer></script>
  <script src="/eam-academy/library.js" defer></script>
  <script src="/eam-academy/workshops.js" defer></script>
  <script src="/eam-academy/field-guide.js" defer></script>
  <script src="/eam-academy/app.js" defer></script>
</body>
</html>'''

# ─── Home page ────────────────────────────────────────────────────────────────

def build_home(lessons, groups):
    modules = list(groups.keys())
    n_lessons = len(lessons)
    n_modules = len(modules)

    module_grid = ''
    for mod, ls in list(groups.items())[:8]:  # Show first 8 modules on home
        module_grid += f'''
        <a class="tile" href="/eam-academy/#module/{e(mod)}">
          <h3>{e(mod)}</h3>
          <p>{len(ls)} lessons</p>
        </a>'''

    body = f'''
    <div class="front">
      <div class="front-copy">
        <div class="eyebrow">Enterprise asset management</div>
        <h1>Learn EAM in practice.</h1>
        <p>Explore the work behind an asset, trace the records it creates, and use SQL to explain what happened.</p>
        <div class="row footer-links">
          <a class="button primary" href="/eam-academy/#lesson/INTRO01">Start here · What is EAM?</a>
          <a class="button" href="/eam-academy/#sql">Try the SQL Lab</a>
          <a class="button" href="/eam-academy/#practice/Hard~Joins">Hard join exercises</a>
          <a class="button" href="/eam-academy/data/database-reference.html">Database Reference</a>
        </div>
      </div>
    </div>

    <section class="section">
      <h2>What you will learn</h2>
      <p>EAM Academy covers the full HxGN EAM and Infor EAM application lifecycle across {n_modules} modules and {n_lessons} lessons:</p>
      <ul>
        <li><strong>Functional curriculum</strong> — asset registration, work orders, PM schedules, inventory, purchasing, inspections, administration and integration</li>
        <li><strong>SQL Lab</strong> — write and run read-only SQLite queries against a 28-table training database, right in the browser</li>
        <li><strong>110 SQL exercises</strong> — graded against two independent datasets at four difficulty levels</li>
        <li><strong>Technical Library</strong> — 1,681 R5 table definitions, triggers, stored procedures and an interactive ER diagram</li>
        <li><strong>Workshops</strong> — 12 business-decision scenarios linking lessons to real outcomes</li>
      </ul>
    </section>

    <section class="section">
      <h2>Choose your starting point</h2>
      <div class="grid home-tiles">
        <a class="tile entry-tile" href="/eam-academy/#learn">
          <h3>Functional curriculum</h3>
          <p>{n_lessons} lessons across {n_modules} modules, with business scenarios and source evidence.</p>
        </a>
        <a class="tile entry-tile" href="/eam-academy/#practice">
          <h3>SQL Exercises</h3>
          <p>Write and check your own queries across four difficulty levels, from SELECT to historical reporting.</p>
        </a>
        <a class="tile entry-tile" href="/eam-academy/#paths">
          <h3>Role-based paths</h3>
          <p>Follow a curriculum organized around your job responsibilities.</p>
        </a>
        <a class="tile entry-tile" href="/eam-academy/#reference">
          <h3>Reference library</h3>
          <p>Look up guides, field definitions, database tables and relationships.</p>
        </a>
      </div>
    </section>

    <section class="section">
      <h2>Curriculum modules</h2>
      <div class="grid">
        {module_grid}
      </div>
    </section>

    <section class="section">
      <h2>About this site</h2>
      <p>EAM Academy is a free, independent training resource for HxGN EAM and Infor EAM practitioners.
         All lesson text, scenarios, SQL exercises and quizzes are original work.
         <strong>Not affiliated with Hexagon or Infor.</strong></p>
      <p><a href="https://github.com/pandarichundru/eam-academy">View source on GitHub</a></p>
    </section>
    '''

    # Keep the interactive shell and its event targets around the pre-rendered homepage.
    shell = (ROOT / 'index.html').read_text(encoding='utf-8')
    start = shell.index('>', shell.index('<main id="main"')) + 1
    end = shell.index('</main>', start)
    html = shell[:start] + body + shell[end:]
    write(DIST / 'index.html', html)
    print('Built: dist/index.html')

# ─── Lesson pages ─────────────────────────────────────────────────────────────

def lesson_description(l):
    concept = l.get('concept', '')
    module = l.get('module', '')
    level = l.get('level', '')
    # Aim for 150-160 chars
    desc = f"{concept} Module: {module}. Level: {level}. EAM Academy: free HxGN and Infor EAM training."
    return desc[:160]

def render_lesson_body(l, enrichment, groups):
    module = l.get('module', '')
    title = l.get('title', '')
    lesson_id = l.get('id', '')
    level = l.get('level', '')
    ltype = l.get('type', 'functional')
    concept = l.get('concept', '')
    scenario = l.get('scenario', '')
    walkthrough = l.get('walkthrough', [])
    verify = l.get('verify', '')
    sql = l.get('sql', '')

    # Source refs
    source = l.get('source', {})
    hex_src = source.get('hex', {})
    online = source.get('online', {})
    online_url = online.get('url', '')
    online_ver = online.get('version', '')

    # Enrichment
    page_key = str(hex_src.get('page', ''))
    more = enrichment.get(page_key, {}) if ltype != 'intro' else {}

    # Find prev/next in module
    module_lessons = groups.get(module, [])
    idx = next((i for i, x in enumerate(module_lessons) if x['id'] == lesson_id), -1)
    prev_l = module_lessons[idx - 1] if idx > 0 else None
    next_l = module_lessons[idx + 1] if idx >= 0 and idx < len(module_lessons) - 1 else None

    nav_links = '<div class="lesson-nav">'
    if prev_l:
        nav_links += f'<a class="button" href="/eam-academy/learn/{prev_l["id"].lower()}/">← {e(prev_l["title"])}</a>'
    if next_l:
        nav_links += f'<a class="button" href="/eam-academy/learn/{next_l["id"].lower()}/">→ {e(next_l["title"])}</a>'
    nav_links += '</div>'

    # Context section
    context_html = ''
    if more.get('context') and ltype == 'functional':
        ctx_paras = ''.join(f'<p>{e(x)}</p>' for x in more['context'])
        context_html = f'<section class="section"><h2>How it works</h2>{ctx_paras}</section>'

    # Worked example
    example_html = ''
    if more.get('example') and ltype == 'functional':
        rows = ''.join(
            f'<tr><td>{e(r[0])}</td><td>{e(r[1])}</td><td>{e(r[2]) if len(r)>2 else ""}</td></tr>'
            for r in more['example']
        )
        example_html = f'''<section class="section">
          <h2>Worked example</h2>
          <div class="scroll"><table>
            <thead><tr><th>Record / field</th><th>Training value</th><th>Explanation</th></tr></thead>
            <tbody>{rows}</tbody>
          </table></div>
        </section>'''

    # Fields
    fields_html = ''
    evidence = source.get('evidence', {})
    fields = evidence.get('fields', [])
    if fields and ltype == 'functional':
        rows = ''.join(
            f'<tr><td>{e(f.get("name",""))}</td><td>{e(f.get("meaning",""))}</td></tr>'
            for f in fields
        )
        fields_html = f'''<section class="section">
          <h2>Documented fields and options</h2>
          <p class="muted">Selected field descriptions extracted from the supplied HxGN pages. Not an exhaustive field list.</p>
          <div class="scroll"><table>
            <thead><tr><th>Field / option</th><th>Source excerpt</th></tr></thead>
            <tbody>{rows}</tbody>
          </table></div>
        </section>'''

    # Walkthrough or SQL
    if ltype == 'technical':
        procedure_html = f'''<section class="section">
          <h2>Technical walkthrough</h2>
          <p>Use the local synthetic dataset, not a production database. <a href="/eam-academy/#sql">Open SQL lab</a></p>
          <pre>{e(sql)}</pre>
          <div class="note">
            <strong>Sample database disclaimer:</strong> The training database uses a simplified fictional schema.
            It is not the production EAM R5 schema; table and column names differ.
          </div>
          <a class="button primary" href="/eam-academy/#sql/{e(lesson_id)}">Open this query in SQL lab</a>
        </section>'''
    else:
        intro_text = {
            'intro': 'Follow the example in order.',
            'consulting': 'Agree the business scope, owners and test environment before applying the guidance.',
        }.get(ltype, 'Before starting, confirm the relevant organization, authorized role, and referenced master data.')
        steps_html = ''.join(f'<li>{e(s)}</li>' for s in walkthrough)
        procedure_html = f'''<section class="section">
          <h2>Prerequisites and written walkthrough</h2>
          <p>{e(intro_text)}</p>
          <ol class="steps">{steps_html}</ol>
        </section>'''

    # Online source link
    source_link = ''
    if online_url:
        source_link = f'<p><a class="ext-link" href="{e(online_url)}" target="_blank" rel="noopener noreferrer">Official online documentation ({e(online_ver)})</a></p>'

    # Report issue link
    issue_title = f'Content error: {lesson_id} – {title}'
    issue_url = f'https://github.com/pandarichundru/eam-academy/issues/new?template=bug_report.md&title={issue_title.replace(" ", "+")}'

    figure_html = ''
    if diagram := l.get('diagram'):
        labels = [e(label) for label in diagram['labels']]
        if diagram['kind'] == 'pair':
            def pictogram(i):
                if 'icons' not in diagram:
                    return ''
                icon = e(diagram['icons'][i // 2])
                return f'<svg class="slide-icon" aria-hidden="true"><use href="/eam-academy/data/lesson-illustrations.svg#{icon}"></use></svg>'
            pairs = ''.join(f'<div><dt>{labels[i]}</dt><dd>{pictogram(i)}{labels[i+1]}</dd></div>' for i in (0, 2))
            drawing = f'<dl class="slide-pair">{pairs}</dl>'
        elif diagram['kind'] == 'tree':
            leaves = ''.join(f'<li>{label}</li>' for label in labels[1:])
            drawing = f'<div class="slide-tree"><strong>{labels[0]}</strong><ul>{leaves}</ul></div>'
        elif diagram['kind'] == 'flow':
            steps = ''.join(f'<li>{label}</li>' for label in labels)
            drawing = f'<ol class="slide-flow">{steps}</ol>'
        else:
            raise ValueError(f'Unknown diagram kind for {lesson_id}')
        answer = f'<p>{e(diagram["answer"])}</p>' if diagram.get('answer') else ''
        annotations = ''.join(f'<dt>{label}</dt><dd>{e(note)}</dd>' for label, note in zip(labels, l['diagram_notes']))
        figure_html = f'<figure class="lesson-slide"><figcaption>{e(diagram["question"])}</figcaption>{drawing}{answer}<details><summary>Explore the diagram</summary><dl>{annotations}</dl></details></figure>'
        if l['records']:
            cards = ''.join(f'<li><a href="/eam-academy/data/database-reference.html#Table:{e(r["table"])}">{e(r["table"])} · {e(r["meaning"])}</a><p>{e(r["basis"])}</p></li>' for r in l['records'])
            figure_html += f'<details class="lesson-records"><summary>See the records behind this step</summary><ul>{cards}</ul></details>'
    reading_html = ''
    if reading := l.get('reading'):
        links = ''.join(f'<li><a href="{e(url)}">{e(label)}</a></li>' for label, url in reading)
        reading_html = f'<section class="section"><h2>Read the sources</h2><ul>{links}</ul></section>'

    return f'''
    <article class="lesson-content">
      <div class="eyebrow">{e(module)}</div>
      <h1>{e(title)}</h1>
      <p class="muted">{e(lesson_id)} · {e(level)} · {"Technical SQL lesson" if ltype == "technical" else "Written functional tutorial"}</p>

      <div class="lesson-toolbar">
        <div class="row lesson-meta">
          <span class="pill">{e("Academy introduction" if ltype == "intro" else "HxGN primary")}</span>
          {'<span class="pill">Infor supporting</span>' if source.get('infor') else ''}
        </div>
        <div class="row lesson-actions">
          <button data-mark="{e(lesson_id)}" aria-label="Bookmark lesson">Bookmark</button>
          <button class="primary" data-done="{e(lesson_id)}" aria-label="Mark lesson complete">Mark complete</button>
        </div>
      </div>

      {figure_html}
      <section class="section">
        <h2>What you will learn</h2>
        <p>{e(concept)}</p>
        <p>By the end, you should be able to explain the business purpose, describe the steps for the scenario, and identify how to check the result.</p>
      </section>

      <section class="section">
        <h2>Business scenario</h2>
        <div class="scenario">{e(scenario)}</div>
        <p class="muted">Fictional PLANT01 example for learning; not a live EAM transaction.</p>
      </section>

      {reading_html}
      {context_html}
      {procedure_html}
      {example_html}
      {fields_html}

      <section class="section">
        <h2>Expected result &amp; troubleshooting</h2>
        <div class="panel"><p>{e(verify)}</p></div>
      </section>

      <section class="section">
        <h2>Source references</h2>
        {source_link}
        <p class="muted">Offline extracts may span page breaks. The written lesson is original training guidance, not a verbatim vendor procedure. Confirm release, configuration and access before using a real system.</p>
      </section>

      <footer class="lesson-footer">
        <span class="muted">Last reviewed: {BUILD_DATE}</span>
        <a href="{e(issue_url)}" target="_blank" rel="noopener noreferrer" class="report-link">Report an issue with this lesson</a>
      </footer>

      {nav_links}
    </article>
    '''

def build_lessons(lessons, groups, enrichment):
    for l in lessons:
        lesson_id = l['id']
        slug = lesson_id.lower()
        path = DIST / 'learn' / slug / 'index.html'

        title = f"{l['title']} – EAM Academy"
        description = lesson_description(l)
        body = render_lesson_body(l, enrichment, groups)

        # Use the same controls, routes and assets as the homepage while keeping
        # the complete pre-rendered lesson available to readers without JavaScript.
        html = (ROOT / 'index.html').read_text(encoding='utf-8')
        html = html.replace('<head>', '<head>\n  <base href="../../">', 1)
        html = html.replace('<body>', f'<body data-initial-route="lesson/{e(lesson_id)}">', 1)
        html = re.sub(r'<title>.*?</title>', lambda _: f'<title>{e(title)}</title>', html, count=1)
        for attr, value in [('name="description"', description), ('property="og:title"', title),
                            ('name="twitter:title"', title), ('property="og:description"', description),
                            ('name="twitter:description"', description), ('property="og:url"', SITE_URL + f'/learn/{slug}/')]:
            html = re.sub(r'(<meta ' + attr + r'\s+content=")[^"]*', lambda m: m[1] + e(value), html, count=1)
        html = html.replace(f'rel="canonical" href="{SITE_URL}/"', f'rel="canonical" href="{SITE_URL}/learn/{slug}/"')
        start = html.index('>', html.index('<main id="main"')) + 1
        html = html[:start] + body + html[html.index('</main>', start):]
        write(path, html)

    print(f'Built: {len(lessons)} lesson pages in dist/learn/')

# ─── Search index ──────────────────────────────────────────────────────────────

def build_search_index(lessons, groups):
    index = []
    for l in lessons:
        index.append({
            'id': l['id'],
            'title': l['title'],
            'module': l['module'],
            'level': l.get('level', ''),
            'type': l.get('type', ''),
            'summary': l.get('concept', '')[:200],
            'url': f'/eam-academy/learn/{l["id"].lower()}/',
        })
    write(DIST / 'search-index.json', json.dumps(index, separators=(',', ':')))
    print(f'Built: dist/search-index.json ({len(index)} entries)')

# ─── Per-lesson JSON chunks ────────────────────────────────────────────────────

def build_lesson_chunks(lessons):
    chunks_dir = DIST / 'learn' / '_chunks'
    chunks_dir.mkdir(parents=True, exist_ok=True)
    for l in lessons:
        slug = l['id'].lower()
        chunk = {
            'id': l['id'],
            'title': l['title'],
            'module': l['module'],
            'level': l.get('level'),
            'type': l.get('type'),
            'concept': l.get('concept'),
            'scenario': l.get('scenario'),
            'walkthrough': l.get('walkthrough', []),
            'verify': l.get('verify'),
            'sql': l.get('sql'),
            'source': l.get('source', {}),
        }
        write(chunks_dir / f'{slug}.json', json.dumps(chunk, separators=(',', ':')))
    # Build chunk manifest
    manifest = [{'id': l['id'], 'slug': l['id'].lower()} for l in lessons]
    write(DIST / 'learn' / '_chunks' / 'manifest.json', json.dumps(manifest, separators=(',', ':')))
    print(f'Built: {len(lessons)} lesson JSON chunks in dist/learn/_chunks/')

# ─── sitemap.xml ──────────────────────────────────────────────────────────────

def build_sitemap(lessons):
    urls = [
        f'<url><loc>{SITE_URL}/</loc><changefreq>weekly</changefreq><priority>1.0</priority></url>',
    ]
    for l in lessons:
        slug = l['id'].lower()
        urls.append(
            f'<url><loc>{SITE_URL}/learn/{slug}/</loc>'
            f'<changefreq>monthly</changefreq><priority>0.8</priority></url>'
        )
    xml = ('<?xml version="1.0" encoding="UTF-8"?>\n'
           '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
           + '\n'.join(urls) +
           '\n</urlset>')
    write(DIST / 'sitemap.xml', xml)
    print(f'Built: dist/sitemap.xml ({len(urls)} URLs)')

# ─── robots.txt ───────────────────────────────────────────────────────────────

def build_robots():
    txt = f'User-agent: *\nAllow: /\nSitemap: {SITE_URL}/sitemap.xml\n'
    write(DIST / 'robots.txt', txt)
    print('Built: dist/robots.txt')

# ─── 404.html ─────────────────────────────────────────────────────────────────

def build_404():
    body = '''
    <div class="error-state">
      <h1>Page not found</h1>
      <p>The page you are looking for doesn't exist. It may have moved or the URL may be incorrect.</p>
      <div class="row">
        <a class="button primary" href="/eam-academy/">Go to home</a>
        <a class="button" href="/eam-academy/#learn">Browse curriculum</a>
      </div>
      <script>
        // Try to redirect old hash routes
        var stored = sessionStorage.getItem('eam_404_path');
        if (!stored) {
          sessionStorage.setItem('eam_404_path', location.pathname);
        }
      </script>
    </div>
    '''
    html = html_shell(
        title='Page not found – EAM Academy',
        description='Page not found on EAM Academy.',
        canonical_path='/404.html',
        og_image='social-preview.png',
        body_html=body,
    )
    write(DIST / '404.html', html)
    print('Built: dist/404.html')

# ─── Copy static assets ───────────────────────────────────────────────────────

def copy_assets():
    # Static files that need to be served from dist
    static_files = [
        'style.css',
        'app.js',
        'field-guide.js',
        'challenges.js',
        'workshops.js',
        'library.js',
        'query-client.js',
        'training-worker.js',
        'sql-asm.js',
        'sql-js-LICENSE.txt',
        'sw.js',
        'academy.svg',
        'social-preview.png',
        'social-preview.svg',
        'manifest.webmanifest',
        'curriculum.json',
        'introduction.json',
        'lesson-diagrams.json',
        'lesson-notes.json', 'lesson-records.json', 'lesson-visuals.js',
        'study.css', 'appearance.js', 'pump-scene.css', 'pump-scene.js',
        'enrichment.json',
        'quizzes.json',
        'challenges.json',
        'catalog.json',
        'extended.json',
        'code_meta.json',
    ]

    for f in static_files:
        src = ROOT / f
        if src.exists():
            dst = DIST / f
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, dst)

    # Copy data directory
    if (ROOT / 'data').exists():
        shutil.copytree(ROOT / 'data', DIST / 'data', dirs_exist_ok=True)
    if (ROOT / 'sql-formatter').exists():
        shutil.copytree(ROOT / 'sql-formatter', DIST / 'sql-formatter', dirs_exist_ok=True)

    print('Copied static assets to dist/')

# ─── Main ──────────────────────────────────────────────────────────────────────

def main():
    print(f'Building EAM Academy → {DIST}')
    print(f'Build date: {BUILD_DATE}')

    # Clean dist
    if DIST.exists():
        shutil.rmtree(DIST)
    DIST.mkdir(parents=True)

    # Load content
    lessons, groups, enrichment, quizzes, slug_map = load_all()
    print(f'Loaded: {len(lessons)} lessons, {len(groups)} modules')

    # Build pages
    build_home(lessons, groups)
    build_lessons(lessons, groups, enrichment)
    build_search_index(lessons, groups)
    build_lesson_chunks(lessons)
    build_sitemap(lessons)
    build_robots()
    build_404()
    copy_assets()

    # Summary
    dist_files = list(DIST.rglob('*'))
    total_size = sum(f.stat().st_size for f in dist_files if f.is_file())
    print(f'\n✓ Build complete: {len([f for f in dist_files if f.is_file()])} files, '
          f'{total_size / 1024 / 1024:.1f} MB total')
    print(f'  Lesson pages: {len(lessons)}')
    print(f'  Sitemap URLs: {len(lessons) + 1}')

if __name__ == '__main__':
    main()
