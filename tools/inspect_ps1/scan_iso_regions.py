#!/usr/bin/env python3
"""Scan ISO9660 file regions in-place without extracting their contents."""

from __future__ import annotations

import argparse
import json
import math
import re
from collections import Counter
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[2]
GENERATED = REPO_ROOT / "docs" / "research" / "generated"
DEFAULT_ISO_LIST = GENERATED / "iso9660_file_list.json"
DEFAULT_OUTPUT = GENERATED / "iso_region_scan.json"

ASCII_RE = re.compile(rb"[\x09\x20-\x7E]{4,}")
SJIS_RE = re.compile(rb"(?:[\x09\x20-\x7E\xA1-\xDF]|[\x81-\x9F\xE0-\xFC][\x40-\x7E\x80-\xFC]){4,}")
MAX_STRING_SCAN_BYTES = 64 * 1024 * 1024

MAGICS = [
    ("tim_image_candidate", bytes.fromhex("10000000")),
    ("xa_marker_candidate", b"CD-XA001"),
    ("str_marker_candidate", b"STR"),
    ("riff_candidate", b"RIFF"),
    ("ps_x_exe", b"PS-X EXE"),
]


def byte_entropy(data: bytes) -> float:
    if not data:
        return 0.0
    counts = Counter(data)
    total = len(data)
    return -sum((count / total) * math.log2(count / total) for count in counts.values())


def count_magic(data: bytes) -> dict[str, int]:
    return {name: data.count(needle) for name, needle in MAGICS if data.count(needle)}


def scan_strings(data: bytes) -> dict[str, Any]:
    ascii_lengths = [len(m.group(0)) for m in ASCII_RE.finditer(data)]
    sjis_count = 0
    sjis_short = 0
    sjis_profile = Counter()
    for m in SJIS_RE.finditer(data):
        raw = m.group(0)[:256]
        try:
            text = raw.decode("shift_jis")
        except UnicodeDecodeError:
            continue
        if not any(ord(ch) > 0x7F for ch in text):
            continue
        sjis_count += 1
        if len(text) <= 12:
            sjis_short += 1
        for ch in text:
            code = ord(ch)
            if 0x3040 <= code <= 0x309F:
                sjis_profile["hiragana"] += 1
            elif 0x30A0 <= code <= 0x30FF:
                sjis_profile["katakana"] += 1
            elif 0x4E00 <= code <= 0x9FFF:
                sjis_profile["kanji"] += 1
            elif ch.isascii():
                sjis_profile["ascii"] += 1
            else:
                sjis_profile["other"] += 1
    return {
        "ascii_candidate_count": len(ascii_lengths),
        "ascii_short_count_4_to_12": sum(1 for n in ascii_lengths if n <= 12),
        "shift_jis_candidate_count": sjis_count,
        "shift_jis_short_count_1_to_12": sjis_short,
        "shift_jis_profile": dict(sjis_profile),
    }


def parse_psx_exe(data: bytes) -> dict[str, Any] | None:
    if not data.startswith(b"PS-X EXE"):
        return None
    return {
        "pc0": int.from_bytes(data[0x10:0x14], "little"),
        "gp0": int.from_bytes(data[0x14:0x18], "little"),
        "text_address": int.from_bytes(data[0x18:0x1C], "little"),
        "text_size": int.from_bytes(data[0x1C:0x20], "little"),
        "sp_base": int.from_bytes(data[0x30:0x34], "little"),
        "sp_offset": int.from_bytes(data[0x34:0x38], "little"),
    }


def read_iso_payload(image_path: Path, sector_size: int, payload_offset: int, lba: int, size: int) -> bytes:
    sectors = (size + 2047) // 2048
    chunks = []
    with image_path.open("rb") as f:
        for i in range(sectors):
            f.seek((lba + i) * sector_size + payload_offset)
            chunks.append(f.read(2048))
    return b"".join(chunks)[:size]


def interesting_file(path: str, size: int) -> bool:
    upper = path.upper()
    if upper.endswith(".STR"):
        return False
    if upper in {"SYSTEM.CNF"} or "SCPS_" in upper:
        return True
    if size <= MAX_STRING_SCAN_BYTES:
        return True
    return False


def scan(iso_list_path: Path) -> dict[str, Any]:
    iso = json.loads(iso_list_path.read_text(encoding="utf-8"))
    images = []
    for image in iso.get("images", []):
        image_path = Path(image["path"])
        scanned = []
        skipped = []
        for item in image.get("files", []):
            if item.get("is_dir"):
                continue
            if not interesting_file(item["path"], item["size_bytes"]):
                skipped.append({
                    "path": item["path"],
                    "size_bytes": item["size_bytes"],
                    "reason": "large_media_or_unneeded_for_learning_scan",
                })
                continue
            data = read_iso_payload(
                image_path,
                image["sector_size"],
                image["payload_offset"],
                item["extent_lba"],
                item["size_bytes"],
            )
            head = data[:64]
            entry = {
                "path": item["path"],
                "extent_lba": item["extent_lba"],
                "data_offset": item["data_offset"],
                "size_bytes": item["size_bytes"],
                "head_hex_64": head.hex(),
                "entropy_first_64kb": round(byte_entropy(data[:65536]), 4),
                "magic_counts": count_magic(data),
                "string_summary": scan_strings(data),
            }
            psx = parse_psx_exe(data[:2048])
            if psx:
                entry["psx_exe_header"] = psx
            scanned.append(entry)
        images.append({
            "image": image["path"],
            "scanned_files": scanned,
            "skipped_files": skipped,
        })
    return {
        "input_iso_list": str(iso_list_path),
        "images": images,
        "notes": [
            "Scanned in-place from the disc image.",
            "No file contents, assets, or raw text samples were extracted.",
        ],
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--iso-list", default=str(DEFAULT_ISO_LIST))
    parser.add_argument("--output", default=str(DEFAULT_OUTPUT))
    args = parser.parse_args()

    result = scan(Path(args.iso_list))
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"wrote {output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
