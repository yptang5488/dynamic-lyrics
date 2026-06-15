from __future__ import annotations

from typing import Any


INITIALS = (
    "g",
    "kk",
    "n",
    "d",
    "tt",
    "r",
    "m",
    "b",
    "pp",
    "s",
    "ss",
    "",
    "j",
    "jj",
    "ch",
    "k",
    "t",
    "p",
    "h",
)
INITIAL_JAMO = ("ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ")
VOWELS = ("a", "ae", "ya", "yae", "eo", "e", "yeo", "ye", "o", "wa", "wae", "oe", "yo", "u", "wo", "we", "wi", "yu", "eu", "ui", "i")
VOWEL_JAMO = ("ㅏ", "ㅐ", "ㅑ", "ㅒ", "ㅓ", "ㅔ", "ㅕ", "ㅖ", "ㅗ", "ㅘ", "ㅙ", "ㅚ", "ㅛ", "ㅜ", "ㅝ", "ㅞ", "ㅟ", "ㅠ", "ㅡ", "ㅢ", "ㅣ")
FINALS = ("", "k", "k", "k", "n", "n", "n", "t", "l", "k", "m", "l", "l", "l", "p", "l", "m", "p", "p", "t", "t", "ng", "t", "t", "k", "t", "p", "t")
FINAL_JAMO = ("", "ㄱ", "ㄲ", "ㄳ", "ㄴ", "ㄵ", "ㄶ", "ㄷ", "ㄹ", "ㄺ", "ㄻ", "ㄼ", "ㄽ", "ㄾ", "ㄿ", "ㅀ", "ㅁ", "ㅂ", "ㅄ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ")
INITIAL_ROMAN = dict(zip(INITIAL_JAMO, INITIALS, strict=True)) | {"ㆁ": "ng"}
VOWEL_ROMAN = dict(zip(VOWEL_JAMO, VOWELS, strict=True))
FINAL_ROMAN = dict(zip(FINAL_JAMO, FINALS, strict=True))
DOUBLE_FINAL_SPLIT = {
    "ㄳ": ("ㄱ", "ㅅ"),
    "ㄵ": ("ㄴ", "ㅈ"),
    "ㄶ": ("ㄴ", "ㅎ"),
    "ㄺ": ("ㄹ", "ㄱ"),
    "ㄻ": ("ㄹ", "ㅁ"),
    "ㄼ": ("ㄹ", "ㅂ"),
    "ㄽ": ("ㄹ", "ㅅ"),
    "ㄾ": ("ㄹ", "ㅌ"),
    "ㄿ": ("ㄹ", "ㅍ"),
    "ㅀ": ("ㄹ", "ㅎ"),
    "ㅄ": ("ㅂ", "ㅅ"),
}
HANGUL_BASE = 0xAC00
HANGUL_END = 0xD7A3
SYLLABLE_COUNT = 588
VOWEL_COUNT = 28


def normalize_chant_notes(notes: list[dict[str, Any]]) -> list[dict[str, Any]]:
    normalized = []
    for note in notes:
        next_note = dict(note)
        if next_note.get("type") == "chant" and isinstance(next_note.get("text"), str):
            romanized = romanize_text(next_note["text"])
            if romanized:
                next_note["romanizedText"] = romanized
            else:
                next_note.pop("romanizedText", None)
        normalized.append(next_note)
    return normalized


def normalize_lyric_notes(lyrics: list[dict[str, Any]]) -> list[dict[str, Any]]:
    normalized = []
    for line in lyrics:
        next_line = dict(line)
        notes = next_line.get("notes")
        if isinstance(notes, list):
            next_line["notes"] = normalize_chant_notes(notes)
        normalized.append(next_line)
    return normalized


def romanize_text(text: str, overrides: dict[str, str] | None = None) -> str:
    original_has_hangul = has_hangul(text)
    result = text
    for source, target in sorted((overrides or {}).items(), key=lambda item: len(item[0]), reverse=True):
        result = result.replace(source, target)
    if not original_has_hangul:
        return ""
    if not has_hangul(result):
        return result

    romanized = []
    run = []
    for char in result:
        if is_hangul_syllable(char):
            run.append(char)
            continue
        if run:
            romanized.append(romanize_hangul_run(run))
            run = []
        romanized.append(char)
    if run:
        romanized.append(romanize_hangul_run(run))
    return "".join(romanized)


def romanize_hangul_run(chars: list[str]) -> str:
    syllables = [decompose_hangul(char) for char in chars]
    apply_liaison(syllables)
    return "".join(romanize_syllable(syllable) for syllable in syllables)


def apply_liaison(syllables: list[dict[str, str]]) -> None:
    for index in range(len(syllables) - 1):
        current = syllables[index]
        next_syllable = syllables[index + 1]
        if not current["final"] or next_syllable["initial"] != "ㅇ":
            continue
        final = current["final"]
        if final in DOUBLE_FINAL_SPLIT:
            left, right = DOUBLE_FINAL_SPLIT[final]
            current["final"] = left
            next_syllable["initial"] = "ㅆ" if right == "ㅅ" else right
        else:
            current["final"] = ""
            next_syllable["initial"] = "ㆁ" if final == "ㅇ" else final


def romanize_syllable(syllable: dict[str, str]) -> str:
    return f"{INITIAL_ROMAN[syllable['initial']]}{VOWEL_ROMAN[syllable['vowel']]}{FINAL_ROMAN[syllable['final']]}"


def decompose_hangul(char: str) -> dict[str, str]:
    offset = ord(char) - HANGUL_BASE
    initial = offset // SYLLABLE_COUNT
    vowel = (offset % SYLLABLE_COUNT) // VOWEL_COUNT
    final = offset % VOWEL_COUNT
    return {"initial": INITIAL_JAMO[initial], "vowel": VOWEL_JAMO[vowel], "final": FINAL_JAMO[final]}


def has_hangul(text: str) -> bool:
    return any(is_hangul_syllable(char) for char in text)


def is_hangul_syllable(char: str) -> bool:
    return HANGUL_BASE <= ord(char) <= HANGUL_END
