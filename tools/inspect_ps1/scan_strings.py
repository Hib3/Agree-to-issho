#!/usr/bin/env python3
"""Summarize text-like byte runs without dumping full original text."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from collections import Counter
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_OUTPUT = REPO_ROOT / "docs" / "research" / "generated" / "string_scan.json"
DISC_EXTENSIONS = {".bin", ".iso", ".img"}
CHUNK_SIZE = 512 * 1024
MAX_SAMPLES = 5
MAX_DECODE_BYTES = 512
ASCII_RE = re.compile(rb"[\x09\x20-\x7E]{4,}")
SJIS_RE = re.compile(rb"(?:[\x09\x20-\x7E\xA1-\xDF]|[\x81-\x9F\xE0-\xFC][\x40-\x7E\x80-\xFC]){4,}")


def length_bucket(length: int) -> str:
    if length <= 4:
        return "1-4"
    if length <= 8:
        return "5-8"
    if length <= 16:
        return "9-16"
    if length <= 32:
        return "17-32"
    if length <= 64:
        return "33-64"
    return "65+"


def char_profile(text: str) -> dict[str, int]:
    profile = Counter()
    for ch in text:
        code = ord(ch)
        if ch.isascii() and ch.isalpha():
            profile["ascii_alpha"] += 1
        elif ch.isascii() and ch.isdigit():
            profile["digit"] += 1
        elif 0x3040 <= code <= 0x309F:
            profile["hiragana"] += 1
        elif 0x30A0 <= code <= 0x30FF:
            profile["katakana"] += 1
        elif 0x4E00 <= code <= 0x9FFF:
            profile["kanji"] += 1
        elif ch.isspace():
            profile["space"] += 1
        else:
            profile["other"] += 1
    return dict(profile)


def safe_sample(text: str, include_raw: bool) -> dict[str, Any]:
    item: dict[str, Any] = {
        "length": len(text),
        "sha256_12": hashlib.sha256(text.encode("utf-8", errors="ignore")).hexdigest()[:12],
        "profile": char_profile(text),
    }
    if include_raw:
        item["sample"] = text[:12]
        item["truncated"] = len(text) > 12
    return item


def extract_ascii(data: bytes) -> list[str]:
    results: list[str] = []
    for match in ASCII_RE.finditer(data):
        raw = match.group(0)[:MAX_DECODE_BYTES]
        results.append(raw.decode("ascii", errors="ignore"))
    return results


def extract_shift_jis(data: bytes) -> list[str]:
    results: list[str] = []
    for match in SJIS_RE.finditer(data):
        segment = match.group(0)[:MAX_DECODE_BYTES]
        try:
            text = segment.decode("shift_jis")
            if len(text) >= 2 and any(ord(ch) > 0x7F for ch in text):
                results.append(text)
        except UnicodeDecodeError:
            pass
    return results


def new_summary() -> dict[str, Any]:
    return {
        "count": 0,
        "short_string_count_1_to_12": 0,
        "length_distribution": Counter(),
        "character_profile": Counter(),
        "samples": [],
    }


def add_string(summary: dict[str, Any], text: str, include_raw: bool) -> None:
    summary["count"] += 1
    summary["length_distribution"][length_bucket(len(text))] += 1
    summary["character_profile"].update(char_profile(text))
    if 1 <= len(text) <= 12:
        summary["short_string_count_1_to_12"] += 1
    if len(summary["samples"]) < MAX_SAMPLES and 2 <= len(text) <= 12:
        summary["samples"].append(safe_sample(text, include_raw))


def finalize_summary(summary: dict[str, Any], include_raw: bool) -> dict[str, Any]:
    return {
        "count": summary["count"],
        "short_string_count_1_to_12": summary["short_string_count_1_to_12"],
        "length_distribution": dict(sorted(summary["length_distribution"].items())),
        "character_profile": dict(summary["character_profile"]),
        "samples": summary["samples"],
        "samples_include_raw_text": include_raw,
    }


def candidate_files(input_path: Path) -> list[Path]:
    if input_path.is_file():
        return [input_path]
    if not input_path.exists():
        return []
    return sorted(p for p in input_path.rglob("*") if p.is_file() and p.suffix.lower() in DISC_EXTENSIONS)


def scan_file(path: Path, include_raw: bool) -> dict[str, Any]:
    ascii_summary = new_summary()
    sjis_summary = new_summary()
    carry = b""
    with path.open("rb") as f:
        while True:
            chunk = f.read(CHUNK_SIZE)
            if not chunk:
                break
            data = carry + chunk
            for text in extract_ascii(data):
                add_string(ascii_summary, text, include_raw)
            for text in extract_shift_jis(data):
                add_string(sjis_summary, text, include_raw)
            carry = data[-64:]

    return {
        "ascii": finalize_summary(ascii_summary, include_raw),
        "shift_jis_candidate": finalize_summary(sjis_summary, include_raw),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", nargs="?", default=str(REPO_ROOT / "dokodemo"))
    parser.add_argument("--output", default=str(DEFAULT_OUTPUT))
    parser.add_argument("--include-short-samples", action="store_true")
    args = parser.parse_args()

    input_path = Path(args.input)
    files = []
    for path in candidate_files(input_path):
        rel = path.relative_to(REPO_ROOT) if path.is_relative_to(REPO_ROOT) else path
        files.append({
            "path": str(rel),
            "size_bytes": path.stat().st_size,
            **scan_file(path, args.include_short_samples),
        })

    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps({
        "input": str(input_path),
        "file_count": len(files),
        "files": files,
        "notes": [
            "Raw text samples are disabled by default.",
            "Use only aggregate structure for fan-made design.",
        ],
    }, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"wrote {output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
