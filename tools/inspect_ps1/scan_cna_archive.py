#!/usr/bin/env python3
"""Scan a CNA-like archive in-place from the PS1 disc image."""

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
DEFAULT_OUTPUT = GENERATED / "cna_archive_scan.json"

ASCII_RE = re.compile(rb"[\x09\x20-\x7E]{4,}")
SJIS_RE = re.compile(rb"(?:[\x09\x20-\x7E\xA1-\xDF]|[\x81-\x9F\xE0-\xFC][\x40-\x7E\x80-\xFC]){4,}")


def entropy(data: bytes) -> float:
    if not data:
        return 0.0
    counts = Counter(data)
    total = len(data)
    return -sum((count / total) * math.log2(count / total) for count in counts.values())


def classify_head(data: bytes) -> str:
    if data.startswith(b"PS-X EXE"):
        return "ps_x_exe"
    if data.startswith(b"LPF\x00"):
        return "lpf_container_candidate"
    if data.startswith(b"\x10\x00\x00\x00"):
        return "tim_image_candidate"
    if data.startswith(b"RIFF"):
        return "riff_candidate"
    if data[:3] == b"STR":
        return "str_marker_candidate"
    if not any(data[:64]):
        return "zero_or_padding"
    return "unknown"


def string_summary(data: bytes) -> dict[str, Any]:
    ascii_matches = list(ASCII_RE.finditer(data))
    sjis_count = 0
    sjis_short = 0
    profile = Counter()
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
                profile["hiragana"] += 1
            elif 0x30A0 <= code <= 0x30FF:
                profile["katakana"] += 1
            elif 0x4E00 <= code <= 0x9FFF:
                profile["kanji"] += 1
            elif ch.isascii():
                profile["ascii"] += 1
            else:
                profile["other"] += 1
    return {
        "ascii_candidate_count": len(ascii_matches),
        "ascii_short_count_4_to_12": sum(1 for m in ascii_matches if len(m.group(0)) <= 12),
        "shift_jis_candidate_count": sjis_count,
        "shift_jis_short_count_1_to_12": sjis_short,
        "shift_jis_profile": dict(profile),
    }


def parse_psx_exe(data: bytes) -> dict[str, Any] | None:
    if not data.startswith(b"PS-X EXE") or len(data) < 0x38:
        return None
    return {
        "pc0": int.from_bytes(data[0x10:0x14], "little"),
        "text_address": int.from_bytes(data[0x18:0x1C], "little"),
        "text_size": int.from_bytes(data[0x1C:0x20], "little"),
        "sp_base": int.from_bytes(data[0x30:0x34], "little"),
    }


def read_iso_payload(image_path: Path, sector_size: int, payload_offset: int, lba: int, size: int) -> bytes:
    chunks = []
    sectors = (size + 2047) // 2048
    with image_path.open("rb") as f:
        for i in range(sectors):
            f.seek((lba + i) * sector_size + payload_offset)
            chunks.append(f.read(2048))
    return b"".join(chunks)[:size]


def scan_cna(data: bytes) -> dict[str, Any]:
    if not data.startswith(b"CNA\x00") or len(data) < 64:
        return {"detected": False}
    version = int.from_bytes(data[4:8], "little")
    count = int.from_bytes(data[8:12], "little")
    tail_offset = int.from_bytes(data[12:16], "little")
    entries = []
    for i in range(count):
        off = 64 + i * 16
        if off + 16 > len(data):
            break
        index = int.from_bytes(data[off:off + 4], "little")
        start_block = int.from_bytes(data[off + 4:off + 8], "little")
        size = int.from_bytes(data[off + 8:off + 12], "little")
        flags = int.from_bytes(data[off + 12:off + 16], "little")
        rel_offset = start_block * 2048
        if size <= 0 or rel_offset >= len(data):
            sample = b""
            segment = b""
        else:
            segment = data[rel_offset:rel_offset + min(size, 1024 * 1024)]
            sample = data[rel_offset:rel_offset + min(size, 65536)]
        entry: dict[str, Any] = {
            "index": index,
            "table_position": i,
            "start_block_2048": start_block,
            "relative_offset": rel_offset,
            "size_bytes": size,
            "flags": flags,
            "head_class": classify_head(sample),
            "entropy_first_64kb": round(entropy(sample), 4),
            "string_summary": string_summary(segment),
        }
        psx = parse_psx_exe(sample)
        if psx:
            entry["psx_exe_header"] = psx
        entries.append(entry)
    class_counts = Counter(e["head_class"] for e in entries)
    return {
        "detected": True,
        "version": version,
        "entry_count_header": count,
        "tail_offset": tail_offset,
        "tail_padding_bytes": max(0, len(data) - tail_offset),
        "entry_count_parsed": len(entries),
        "head_class_counts": dict(class_counts),
        "entries": entries,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--iso-list", default=str(DEFAULT_ISO_LIST))
    parser.add_argument("--output", default=str(DEFAULT_OUTPUT))
    parser.add_argument("--archive-name", default="DOKODEMO.417")
    args = parser.parse_args()

    iso = json.loads(Path(args.iso_list).read_text(encoding="utf-8"))
    results = []
    for image in iso.get("images", []):
        image_path = Path(image["path"])
        for item in image.get("files", []):
            if item.get("path", "").upper() != args.archive_name.upper():
                continue
            data = read_iso_payload(
                image_path,
                image["sector_size"],
                image["payload_offset"],
                item["extent_lba"],
                item["size_bytes"],
            )
            results.append({
                "image": image["path"],
                "archive_path": item["path"],
                "archive_size_bytes": item["size_bytes"],
                "scan": scan_cna(data),
            })
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps({
        "input_iso_list": str(args.iso_list),
        "archives": results,
        "notes": [
            "CNA format is not confirmed by external documentation.",
            "Entries are summarized by offsets, sizes, magic classes, and aggregate string counts only.",
            "No internal file payloads or raw text samples were extracted.",
        ],
    }, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"wrote {output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
