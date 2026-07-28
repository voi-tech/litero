#!/usr/bin/env python3
"""Buduje mały słownik gry z danych Morfeusza 2/SGJP.

Morfeusz dostarcza analizy fleksyjne. wordfreq służy wyłącznie do wybrania
częstych form współczesnej polszczyzny. Wynik jest następnie ograniczany
do znaków i długości obsługiwanych przez Litero.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

import morfeusz2
from wordfreq import top_n_list

ROOT = Path(__file__).resolve().parents[1]
CATEGORIES = ROOT / "data/categories-v4.json"
OUTPUT = ROOT / "public/data/lexicon-v4.json"

WORD_RE = re.compile(r"^[a-ząćęłńóśźż]{2,8}$")
PROPER_TAGS = {
    "nazwa_geograficzna",
    "nazwa_osobowa",
    "nazwisko",
    "imię",
    "organizacja",
}
DENIED_FRAGMENTS = {
    # Konserwatywny filtr rodzinny. Lista obejmuje rdzenie wulgaryzmów
    # i najbardziej obraźliwych określeń, a nie zwykłe słowa o wielu znaczeniach.
    "chuj",
    "cip",
    "dupa",
    "jeb",
    "kurew",
    "kurw",
    "pierd",
    "pizd",
    "skurw",
}
DENIED_WORDS = {
    "gwałt",
    "gwałtu",
    "porno",
    "seks",
    "seksu",
}
DIMINUTIVES = {
    "bratek",
    "domek",
    "drzewko",
    "dziecko",
    "dziewczynka",
    "kotek",
    "kotka",
    "kwiat",
    "piesek",
    "ptaszek",
    "rybka",
    "serce",
    "słonko",
}


def coarse_part(tag: str) -> str:
    head = tag.split(":", 1)[0]
    if head in {"subst", "depr"}:
        return "rzeczownik"
    if head in {
        "fin",
        "bedzie",
        "aglt",
        "praet",
        "impt",
        "imps",
        "inf",
        "pcon",
        "pant",
        "ger",
        "pact",
        "ppas",
        "winien",
    }:
        return "czasownik"
    if head in {"adj", "adja", "adjp", "adjc"}:
        return "przymiotnik"
    if head == "adv":
        return "przysłówek"
    if head in {"num", "numcol"}:
        return "liczebnik"
    if head in {"ppron12", "ppron3", "siebie"}:
        return "zaimek"
    if head == "prep":
        return "przyimek"
    if head in {"conj", "comp"}:
        return "spójnik"
    if head in {"qub", "part"}:
        return "partykuła"
    if head == "interj":
        return "wykrzyknik"
    return "inna"


def spelling_tags(surface: str) -> list[str]:
    tags: list[str] = []
    if any(letter in surface for letter in "ąćęłńóśźż"):
        tags.append("polska-litera")
    if any(digraph in surface for digraph in ("ch", "cz", "dz", "dź", "dż", "rz", "sz")):
        tags.append("dwuznak")
    if surface == surface[::-1]:
        tags.append("palindrom")
    return tags


def target_words() -> set[str]:
    data = json.loads(CATEGORIES.read_text(encoding="utf-8"))
    return {
        item["word"].lower()
        for category in data["categories"]
        for pool_name in ("easyWords", "hardWords")
        for item in category[pool_name]
    }


def analyse_word(morfeusz: morfeusz2.Morfeusz, surface: str, target: bool) -> dict | None:
    if not WORD_RE.fullmatch(surface):
        return None
    if surface in DENIED_WORDS or any(fragment in surface for fragment in DENIED_FRAGMENTS):
        return None

    analyses = []
    for _start, _end, interpretation in morfeusz.analyse(surface):
        orth, lemma, tag, name_tags, qualifiers = interpretation
        del orth, qualifiers
        if PROPER_TAGS.intersection(name_tags):
            continue
        base = lemma.split(":", 1)[0].lower()
        features = tag.split(":")[1:]
        if base in DIMINUTIVES and "zdrobnienie" not in features:
            features.append("zdrobnienie")
        candidate = {
            "partOfSpeech": coarse_part(tag),
            "features": features,
            "properName": False,
        }
        key = json.dumps(candidate, ensure_ascii=False, sort_keys=True)
        if all(json.dumps(item, ensure_ascii=False, sort_keys=True) != key for item in analyses):
            analyses.append(candidate)

    if not analyses and target:
        analyses = [{
            "partOfSpeech": "rzeczownik",
            "features": [],
            "properName": False,
        }]
    if not analyses:
        return None

    lemmas = [
        interpretation[2][1].split(":", 1)[0].lower()
        for interpretation in morfeusz.analyse(surface)
        if not PROPER_TAGS.intersection(interpretation[2][3])
    ]
    lemma = lemmas[0] if lemmas else surface
    return {
        "surface": surface,
        "lemma": lemma,
        "analyses": analyses,
        "spellingTags": spelling_tags(surface),
    }


def main() -> None:
    targets = target_words()
    frequent = [
        word.lower()
        for word in top_n_list("pl", 40_000)
        if WORD_RE.fullmatch(word.lower())
    ]

    candidates = []
    seen = set()
    for word in [*frequent, *sorted(targets)]:
        if word in seen:
            continue
        seen.add(word)
        candidates.append(word)

    morfeusz = morfeusz2.Morfeusz()
    entries = []
    for word in candidates:
        entry = analyse_word(morfeusz, word, word in targets)
        if entry:
            entries.append(entry)
        if len(entries) >= 6_000:
            break

    existing = {entry["surface"] for entry in entries}
    for word in sorted(targets - existing):
        entry = analyse_word(morfeusz, word, True)
        if entry:
            entries.append(entry)

    entries.sort(key=lambda entry: entry["surface"])
    payload = {
        "version": 4,
        "source": "Morfeusz 2/SGJP; wybór częstości: wordfreq 3.1.1",
        "license": "Morfeusz 2/SGJP: 2-clause BSD; wordfreq: Apache 2.0",
        "sourceLinks": [
            "https://morfeusz.sgjp.pl/doc/license/",
            "https://github.com/rspeer/wordfreq/",
        ],
        "notice": "Pełne informacje o autorstwie i licencjach: THIRD_PARTY_NOTICES.md",
        "entries": entries,
    }
    OUTPUT.write_text(
        json.dumps(payload, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    print(f"Zapisano {len(entries)} form w {OUTPUT}")


if __name__ == "__main__":
    main()
