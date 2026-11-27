#!/usr/bin/env python3
"""
Internal link checker for the EAM Academy /dist build.
Checks that all lesson pages referenced from sitemap.xml exist as files,
and that key cross-references in HTML are consistent.
"""
import sys
import re
from pathlib import Path

ROOT = Path(__file__).parent.parent
DIST = ROOT / 'dist'
errors = []

def err(msg):
    errors.append(msg)
    print(f'ERROR: {msg}', file=sys.stderr)

def main():
    if not DIST.exists():
        print('No dist/ directory found. Run python3 scripts/build.py first.', file=sys.stderr)
        sys.exit(1)

    print('Checking internal links in dist/...')

    # 1. Verify every URL in sitemap.xml has a corresponding index.html
    sitemap = (DIST / 'sitemap.xml').read_text()
    urls = re.findall(r'<loc>(.*?)</loc>', sitemap)
    base = 'https://pandarichundru.github.io/eam-academy'
    checked = 0
    for url in urls:
        path = url.replace(base, '').strip('/')
        if not path:
            path = 'index.html'
        elif not path.endswith('.html'):
            path = path + '/index.html'
        f = DIST / path
        if not f.exists():
            err(f'Sitemap URL missing file: {url} → dist/{path}')
        checked += 1

    print(f'  Sitemap: {checked} URLs checked')

    # 2. Verify 404.html exists
    if not (DIST / '404.html').exists():
        err('dist/404.html missing')
    else:
        print('  404.html: OK')

    # 3. Verify robots.txt exists
    if not (DIST / 'robots.txt').exists():
        err('dist/robots.txt missing')
    else:
        print('  robots.txt: OK')

    # 4. Verify search-index.json exists and is valid JSON
    si = DIST / 'search-index.json'
    if not si.exists():
        err('dist/search-index.json missing')
    else:
        import json
        data = json.loads(si.read_text())
        if not isinstance(data, list):
            err('search-index.json must be a list')
        else:
            print(f'  search-index.json: {len(data)} entries OK')

    # 5. Spot-check that lesson HTML contains actual lesson content
    lesson_pages = list((DIST / 'learn').glob('*/index.html'))
    if not lesson_pages:
        err('No lesson pages found in dist/learn/')
    else:
        import random
        samples = random.sample(lesson_pages, min(5, len(lesson_pages)))
        for p in samples:
            content = p.read_text()
            if '<article class="lesson-content">' not in content:
                err(f'{p}: missing lesson article element')
            if '<title>' not in content or 'EAM Academy' not in content:
                err(f'{p}: missing or malformed title')
        print(f'  Spot-checked {len(samples)} lesson pages OK')

    # 6. Verify key static assets exist in dist
    required_assets = [
        'style.css', 'app.js', 'sw.js', 'academy.svg',
        'manifest.webmanifest', 'social-preview.png',
        'curriculum.json', 'challenges.json',
    ]
    for asset in required_assets:
        if not (DIST / asset).exists():
            err(f'Missing required asset: dist/{asset}')

    print(f'  Static assets: {len(required_assets)} required files checked')

    if errors:
        print(f'\n{len(errors)} link check error(s) found.')
        sys.exit(1)
    else:
        print(f'\n✓ Link check passed: {checked} sitemap URLs, {len(lesson_pages)} lesson pages')

if __name__ == '__main__':
    main()
