#!/usr/bin/env python3
"""
JSON Schema Validation for EAM Academy content files.
Validates required fields, types, unique IDs, and cross-file references.
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).parent.parent
errors = []

def err(msg):
    errors.append(msg)
    print(f'ERROR: {msg}', file=sys.stderr)

def load(path):
    return json.loads((ROOT / path).read_text(encoding='utf-8'))

# ─── curriculum.json ──────────────────────────────────────────────────────────

def validate_curriculum():
    lessons = load('curriculum.json')
    assert isinstance(lessons, list), 'curriculum.json must be a list'

    ids = set()
    modules = set()
    REQUIRED = ['id', 'module', 'title', 'level', 'type', 'concept', 'scenario', 'verify', 'source']
    VALID_TYPES = {'functional', 'technical', 'consulting'}
    VALID_LEVELS = {'Beginner', 'Intermediate', 'Advanced'}

    for i, l in enumerate(lessons):
        prefix = f'curriculum.json[{i}] id={l.get("id", "?")}'

        for field in REQUIRED:
            if field not in l:
                err(f'{prefix}: missing required field "{field}"')

        lid = l.get('id', '')
        if lid in ids:
            err(f'{prefix}: duplicate ID "{lid}"')
        ids.add(lid)
        modules.add(l.get('module', ''))

        ltype = l.get('type', '')
        if ltype not in VALID_TYPES:
            err(f'{prefix}: invalid type "{ltype}" (must be one of {VALID_TYPES})')

        level = l.get('level', '')
        if level not in VALID_LEVELS:
            err(f'{prefix}: invalid level "{level}" (must be one of {VALID_LEVELS})')

        if ltype == 'technical' and not l.get('sql'):
            err(f'{prefix}: technical lesson missing "sql" field')

        if ltype in ('functional', 'consulting') and not l.get('walkthrough'):
            err(f'{prefix}: {ltype} lesson missing "walkthrough" field')

        # Source structure
        source = l.get('source', {})
        if not isinstance(source, dict):
            err(f'{prefix}: "source" must be an object')
        elif 'hex' not in source:
            err(f'{prefix}: "source" missing "hex" key')

    print(f'  curriculum.json: {len(lessons)} lessons, {len(modules)} modules OK')
    return ids, modules

# ─── introduction.json ────────────────────────────────────────────────────────

def validate_introduction(curriculum_ids):
    intro = load('introduction.json')
    assert isinstance(intro, list), 'introduction.json must be a list'

    ids = set()
    REQUIRED = ['id', 'title', 'concept', 'scenario', 'walkthrough', 'verify', 'reference']

    for i, item in enumerate(intro):
        prefix = f'introduction.json[{i}] id={item.get("id", "?")}'

        for field in REQUIRED:
            if field not in item:
                err(f'{prefix}: missing required field "{field}"')

        lid = item.get('id', '')
        if lid in ids:
            err(f'{prefix}: duplicate ID "{lid}"')
        ids.add(lid)

        ref = item.get('reference', '')
        if ref not in curriculum_ids:
            err(f'{prefix}: reference "{ref}" not found in curriculum.json')

    print(f'  introduction.json: {len(intro)} lessons OK')
    return ids

# ─── quizzes.json ─────────────────────────────────────────────────────────────

def validate_quizzes(all_lessons):
    quizzes = load('quizzes.json')
    assert isinstance(quizzes, list), 'quizzes.json must be a list'

    lesson_titles = {(l['title'], l.get('module', l.get('type', ''))) for l in all_lessons}
    # Build a broader title lookup for quiz matching
    title_map = {l['title']: l['module'] for l in all_lessons}

    ids = set()
    REQUIRED = ['id', 'module', 'lesson', 'q', 'options', 'answer', 'explain']

    for i, q in enumerate(quizzes):
        prefix = f'quizzes.json[{i}] id={q.get("id", "?")}'

        for field in REQUIRED:
            if field not in q:
                err(f'{prefix}: missing required field "{field}"')

        qid = q.get('id', '')
        if qid in ids:
            err(f'{prefix}: duplicate ID "{qid}"')
        ids.add(qid)

        options = q.get('options', [])
        answer = q.get('answer', -1)
        if not isinstance(options, list) or len(options) < 2:
            err(f'{prefix}: "options" must be a list with at least 2 items')
        elif not isinstance(answer, int) or not (0 <= answer < len(options)):
            err(f'{prefix}: "answer" {answer} out of range for {len(options)} options')

        lesson_title = q.get('lesson', '')
        if lesson_title not in title_map:
            err(f'{prefix}: lesson title "{lesson_title}" not found in curriculum or introduction')

    print(f'  quizzes.json: {len(quizzes)} quizzes OK')

# ─── challenges.json ──────────────────────────────────────────────────────────

def validate_challenges():
    data = load('challenges.json')
    assert isinstance(data, dict), 'challenges.json must be an object'
    assert 'exercises' in data, 'challenges.json missing "exercises" key'
    assert 'schema' in data, 'challenges.json missing "schema" key'

    exercises = data['exercises']
    schema = data['schema']

    REQUIRED = ['id', 'title', 'prompt', 'level', 'tables', 'sql', 'reason', 'expected', 'cols', 'ordered']
    VALID_LEVELS = {'Easy', 'Medium', 'Hard', 'Very Hard'}

    ids_seen = []
    for i, ex in enumerate(exercises):
        prefix = f'challenges.json[{i}] id={ex.get("id", "?")}'

        for field in REQUIRED:
            if field not in ex:
                err(f'{prefix}: missing required field "{field}"')

        ids_seen.append(ex.get('id'))

        level = ex.get('level', '')
        if level not in VALID_LEVELS:
            err(f'{prefix}: invalid level "{level}"')

        tables = ex.get('tables', [])
        for t in tables:
            if t not in schema:
                err(f'{prefix}: table "{t}" not in challenges.json schema')

        expected = ex.get('expected', [])
        if not isinstance(expected, list) or len(expected) != 2:
            err(f'{prefix}: "expected" must be a list of exactly 2 datasets')

    # Check sequential IDs
    if ids_seen != list(range(1, len(exercises) + 1)):
        err(f'challenges.json: exercise IDs must be sequential 1..{len(exercises)}')

    print(f'  challenges.json: {len(exercises)} exercises OK')

# ─── catalog.json ─────────────────────────────────────────────────────────────

def validate_catalog():
    data = load('catalog.json')
    assert isinstance(data, dict)
    assert 'tables' in data, 'catalog.json missing "tables" key'
    tables = data['tables']
    assert isinstance(tables, list)
    # catalog tables is a list of [name, col, ...] arrays or dicts
    if tables and isinstance(tables[0], list):
        names = [t[0] for t in tables if t]
    elif tables and isinstance(tables[0], dict):
        names = [t.get('name', '') for t in tables]
    else:
        names = []
    if len(names) != len(set(names)):
        err('catalog.json: duplicate table names')
    print(f'  catalog.json: {len(tables)} tables OK')

# ─── Main ──────────────────────────────────────────────────────────────────────

def main():
    print('Validating JSON schemas...')

    curriculum_ids, modules = validate_curriculum()
    intro_ids = validate_introduction(curriculum_ids)

    # Build combined lesson list for quiz validation
    curriculum = load('curriculum.json')
    introduction = load('introduction.json')
    curriculum_map = {l['id']: l for l in curriculum}
    all_lessons = []
    for item in introduction:
        all_lessons.append({**item, 'module': 'Introduction to EAM'})
    all_lessons.extend(curriculum)

    validate_quizzes(all_lessons)
    validate_challenges()
    validate_catalog()

    if errors:
        print(f'\n{len(errors)} schema error(s) found.')
        sys.exit(1)
    else:
        all_ids = curriculum_ids | intro_ids
        print(f'\n✓ Schema validation passed: {len(all_ids)} lessons, {len(curriculum_ids)} curriculum, {len(intro_ids)} intro')

if __name__ == '__main__':
    main()
