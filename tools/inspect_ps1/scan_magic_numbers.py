#!/usr/bin/env python3
"""Scan for known magic numbers without extracting embedded assets."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_OUTPUT = REPO_ROOT / "docs" / "research" / "generated" / "magic_number_scan.json"
DISC_EXTENSIONS = {".bin", ".iso", ".img"}
CHUNK_SIZE = 1024 * 1024
OVERLAP = 64
MAX_HITS_PER_MAGIC = 200

MAGICS = [
    {"name": "TIM image candidate", "bytes": bytes.fromhex("10000000"), "extension_hint": ".tim"},
    {"name": "XA audio sector text marker candidate", "bytes": b"CD-XA001", "extension_hint": ".xa"},
    {"name": "STR video sector marker candidate", "bytes": b"STR", "extension_hint": ".str"},
    {"name": "RIFF container candidate", "bytes": b"RIFF", "extension_hint": ".wav/.avi"},
    {"name": "ISO9660 volume descriptor", "bytes": b"CD001", "extension_hint": ".iso"},
    {"name": "PlayStation executable", "bytes": b"PS-X EXE", "extension_hint": ".exe"},
]


def candidate_files(input_path: Path) -> list[Path]:
    if input_path.is_file():
        return [input_path]
    if not input_path.exists():
        return []
    return sorted(p for p in input_path.rglob("*") if p.is_file() and p.suffix.lower() in DISC_EXTENSIONS)


def scan_file(path: Path) -> list[dict[str, Any]]:
    hits: dict[str, dict[str, Any]] = {
        m["name"]: {**m, "count": 0, "offsets": []}
        for m in MAGICS
    }
    base_offset = 0
    carry = b""
    with path.open("rb") as f:
        while True:
            chunk = f.read(CHUNK_SIZE)
            if not chunk:
                break
            data = carry + chunk
            carry_offset = base_offset - len(carry)
            for magic in MAGICS:
                needle = magic["bytes"]
                start = 0
                item = hits[magic["name"]]
                while True:
                    found = data.find(needle, start)
                    if found < 0:
                        break
                    absolute = carry_offset + found
                    item["count"] += 1
                    if len(item["offsets"]) < MAX_HITS_PER_MAGIC:
                        item["offsets"].append(absolute)
                    start = found + 1
            carry = data[-OVERLAP:]
            base_offset += len(chunk)

    return [
        {
            "name": item["name"],
            "extension_hint": item["extension_hint"],
            "magic_hex": item["bytes"].hex(),
            "count": item["count"],
            "offsets_sample": item["offsets"],
            "offsets_truncated": item["count"] > len(item["offsets"]),
        }
        for item in hits.values()
        if item["count"]
    ]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", nargs="?", default=str(REPO_ROOT / "dokodemo"))
    parser.add_argument("--output", default=str(DEFAULT_OUTPUT))
    args = parser.parse_args()

    input_path = Path(args.input)
    files = []
    for path in candidate_files(input_path):
        rel = path.relative_to(REPO_ROOT) if path.is_relative_to(REPO_ROOT) else path
        files.append({
            "path": str(rel),
            "size_bytes": path.stat().st_size,
            "hits": scan_file(path),
        })

    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps({
        "input": str(input_path),
        "file_count": len(files),
        "files": files,
        "notes": ["No image, audio, or video extraction was performed."],
    }, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"wrote {output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
