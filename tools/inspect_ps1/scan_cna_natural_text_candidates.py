#!/usr/bin/env python3
"""Find natural-language-like CNA entries without storing source text."""

from __future__ import annotations

import argparse
import json
import re
from collections import Counter
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[2]
GENERATED = REPO_ROOT / "docs" / "research" / "generated"
DEFAULT_ISO_LIST = GENERATED / "iso9660_file_list.json"
DEFAULT_OUTPUT = GENERATED / "cna_natural_text_candidates.json"

SJIS_RUN_RE = re.compile(rb"(?:[\x09\x20-\x7E\xA1-\xDF]|[\x81-\x9F\xE0-\xFC][\x40-\x7E\x80-\xFC]){6,}")


def read_iso_payload(image_path: Path, sector_size: int, payload_offset: int, lba: int, size: int) -> bytes:
    chunks = []
    sectors = (size + 2047) // 2048
    with image_path.open("rb") as f:
        for i in range(sectors):
            f.seek((lba + i) * sector_size + payload_offset)
            chunks.append(f.read(2048))
    return b"".join(chunks)[:size]


def load_cna(iso_list_path: Path) -> bytes:
    iso = json.loads(iso_list_path.read_text(encoding="utf-8"))
    for image in iso.get("images", []):
        image_path = Path(image["path"])
        for item in image.get("files", []):
            if item.get("path", "").upper() == "DOKODEMO.417":
                return read_iso_payload(
                    image_path,
                    image["sector_size"],
                    image["payload_offset"],
                    item["extent_lba"],
                    item["size_bytes"],
                )
    raise FileNotFoundError("DOKODEMO.417 not found")


def iter_cna_entries(archive: bytes):
    if not archive.startswith(b"CNA\x00"):
        return
    count = int.from_bytes(archive[8:12], "little")
    for i in range(count):
        off = 64 + i * 16
        index = int.from_bytes(archive[off:off + 4], "little")
        block = int.from_bytes(archive[off + 4:off + 8], "little")
        size = int.from_bytes(archive[off + 8:off + 12], "little")
        rel = block * 2048
        yield index, rel, size, archive[rel:rel + size]


def classify_chars(text: str) -> Counter[str]:
    c = Counter()
    for ch in text:
        code = ord(ch)
        if 0x3040 <= code <= 0x309F:
            c["hiragana"] += 1
        elif 0x30A0 <= code <= 0x30FF:
            c["katakana"] += 1
        elif 0x4E00 <= code <= 0x9FFF:
            c["kanji"] += 1
        elif ch in "。、！？!?":
            c["punctuation"] += 1
        elif ch.isascii() and ch.isalnum():
            c["ascii_alnum"] += 1
        elif ch.isspace():
            c["space"] += 1
        else:
            c["other"] += 1
    return c


def plausible_natural_text(text: str) -> bool:
    if len(text) < 4 or len(text) > 160:
        return False
    counts = classify_chars(text)
    total = sum(counts.values()) or 1
    jp = counts["hiragana"] + counts["katakana"] + counts["kanji"]
    # Conversation-like Japanese usually has kana; binary false positives often skew to kanji/other.
    kana = counts["hiragana"] + counts["katakana"]
    if jp / total < 0.35:
        return False
    if kana / total < 0.08:
        return False
    if counts["other"] / total > 0.35:
        return False
    return True


def scan_entry(data: bytes) -> dict[str, Any]:
    total_runs = 0
    natural_count = 0
    length_buckets = Counter()
    char_totals = Counter()
    offsets = []
    for match in SJIS_RUN_RE.finditer(data):
        raw = match.group(0)[:256]
        try:
            text = raw.decode("shift_jis")
        except UnicodeDecodeError:
            continue
        total_runs += 1
        if not plausible_natural_text(text):
            continue
        natural_count += 1
        char_totals.update(classify_chars(text))
        length = len(text)
        if length <= 8:
            length_buckets["4-8"] += 1
        elif length <= 16:
            length_buckets["9-16"] += 1
        elif length <= 32:
            length_buckets["17-32"] += 1
        elif length <= 64:
            length_buckets["33-64"] += 1
        else:
            length_buckets["65-160"] += 1
        if len(offsets) < 20:
            offsets.append(match.start())
    return {
        "sjis_run_count": total_runs,
        "natural_text_candidate_count": natural_count,
        "natural_length_distribution": dict(length_buckets),
        "natural_char_profile": dict(char_totals),
        "natural_offsets_sample": offsets,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--iso-list", default=str(DEFAULT_ISO_LIST))
    parser.add_argument("--output", default=str(DEFAULT_OUTPUT))
    args = parser.parse_args()

    archive = load_cna(Path(args.iso_list))
    entries = []
    for index, rel, size, data in iter_cna_entries(archive):
        summary = scan_entry(data)
        if summary["natural_text_candidate_count"] == 0:
            continue
        entries.append({
            "index": index,
            "relative_offset": rel,
            "size_bytes": size,
            **summary,
        })
    entries.sort(key=lambda item: item["natural_text_candidate_count"], reverse=True)

    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps({
        "archive": "DOKODEMO.417",
        "candidate_entry_count": len(entries),
        "entries": entries,
        "notes": [
            "No raw text is stored.",
            "Natural text detection is heuristic and may include false positives.",
        ],
    }, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"wrote {output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
