#!/usr/bin/env python3
"""Inspect PS1 input files without extracting original assets."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_OUTPUT = REPO_ROOT / "docs" / "research" / "generated" / "disc_image_inspection.json"
DISC_EXTENSIONS = {".cue", ".bin", ".iso", ".img", ".sub", ".ccd", ".chd"}


def partial_sha256(path: Path, limit: int = 1024 * 1024) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        h.update(f.read(limit))
    return h.hexdigest()


def read_iso9660_volume_descriptors(path: Path) -> list[dict[str, Any]]:
    descriptors: list[dict[str, Any]] = []
    if path.suffix.lower() not in {".iso", ".bin", ".img"}:
        return descriptors

    sector_sizes = (2048, 2352)
    with path.open("rb") as f:
        for sector_size in sector_sizes:
            for sector in range(16, 32):
                offset = sector * sector_size
                f.seek(offset)
                block = f.read(2048 if sector_size == 2048 else 2352)
                if sector_size == 2352 and len(block) >= 24 + 6:
                    payload = block[24:24 + 2048]
                else:
                    payload = block[:2048]
                if len(payload) < 7:
                    continue
                if payload[1:6] == b"CD001":
                    descriptors.append({
                        "sector_size_candidate": sector_size,
                        "sector": sector,
                        "offset": offset,
                        "type": payload[0],
                        "identifier": "CD001",
                        "version": payload[6],
                    })
    return descriptors


def parse_cue(path: Path) -> dict[str, Any]:
    result: dict[str, Any] = {"referenced_files": [], "tracks": []}
    try:
        text = path.read_text(encoding="utf-8", errors="replace")
    except OSError as exc:
        return {"error": str(exc)}

    for raw_line in text.splitlines():
        line = raw_line.strip()
        upper = line.upper()
        if upper.startswith("FILE "):
            parts = line.split('"')
            if len(parts) >= 3:
                result["referenced_files"].append(parts[1])
            else:
                result["referenced_files"].append(line[5:].strip())
        elif upper.startswith("TRACK "):
            result["tracks"].append(line)
    return result


def inspect_path(input_path: Path) -> dict[str, Any]:
    files = []
    if input_path.is_file():
        candidates = [input_path]
    elif input_path.exists():
        candidates = [p for p in input_path.rglob("*") if p.is_file() and p.suffix.lower() in DISC_EXTENSIONS]
    else:
        candidates = []

    for path in sorted(candidates):
        rel = path.relative_to(REPO_ROOT) if path.is_relative_to(REPO_ROOT) else path
        entry: dict[str, Any] = {
            "path": str(rel),
            "extension": path.suffix.lower(),
            "size_bytes": path.stat().st_size,
            "partial_sha256_first_1mb": partial_sha256(path),
            "iso9660_volume_descriptors": read_iso9660_volume_descriptors(path),
        }
        if path.suffix.lower() == ".cue":
            entry["cue"] = parse_cue(path)
        files.append(entry)

    return {
        "input": str(input_path),
        "file_count": len(files),
        "files": files,
        "notes": [
            "Partial hashes are for local identity checks only.",
            "No asset extraction was performed.",
        ],
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", nargs="?", default=str(REPO_ROOT / "dokodemo"))
    parser.add_argument("--output", default=str(DEFAULT_OUTPUT))
    args = parser.parse_args()

    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    data = inspect_path(Path(args.input))
    output.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"wrote {output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
