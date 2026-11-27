"""Validate academy content with Python's standard library."""
import json
import sqlite3
from collections import Counter
from pathlib import Path

def load(path):
    return json.loads(Path(path).read_text())

lessons = load("curriculum.json")
intro = load("introduction.json")
lesson_ids = {lesson["id"] for lesson in lessons}
assert all(item["reference"] in lesson_ids for item in intro)
all_ids = [item["id"] for item in lessons + intro]
assert len(set(all_ids)) == len(all_ids), "Duplicate lesson ID"
topics = {(item["title"], item["module"]) for item in lessons}
topics.update((item["title"], "Introduction to EAM") for item in intro)
quizzes = load("quizzes.json")
assert len({q["id"] for q in quizzes}) == len(quizzes)
for quiz in quizzes:
    assert (quiz["lesson"], quiz["module"]) in topics, quiz["id"]
    assert 0 <= quiz["answer"] < len(quiz["options"]) and quiz["explain"], quiz["id"]

bank = load("challenges.json")["exercises"]
assert [x["id"] for x in bank] == list(range(1, len(bank)+1))
for index in range(2):
    db = sqlite3.connect(f"file:data/practice-{index}.db?mode=ro", uri=True)
    for task in bank:
        cursor = db.execute(task["sql"])
        actual = cursor.fetchall()
        expected = list(map(tuple, task["expected"][index]))
        assert len(cursor.description) == task["cols"], task["id"]
        if task["ordered"]:
            assert actual == expected, task["id"]
        else:
            assert Counter(actual) == Counter(expected), task["id"]
    db.close()

worker = Path("sw.js").read_text()
assets = json.loads(worker.split("const files = ", 1)[1].split(";", 1)[0])
assert all(Path(asset).is_file() for asset in assets), "Missing offline asset"
print(f"Verified {len(all_ids)} lessons, {len(quizzes)} quizzes and {2*len(bank)} SQL results.")
