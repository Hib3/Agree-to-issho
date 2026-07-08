#!/usr/bin/env python3
"""List ISO9660 directory entries from PS1 images without extracting files."""

from __future__ import annotations

import argparse
import json
from collections import deque
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_OUTPUT = REPO_ROOT / "docs" / "research" / "generated" / "iso9660_file_list.json"
DISC_EXTENSIONS = {".bin", ".iso", ".img"}


def read_sector_payload(f, lba: int, sector_size: int, payload_offset: int) -> bytes:
    f.seek(lba * sector_size + payload_offset)
    return f.read(2048)


def find_primary_volume_descriptor(path: Path) -> dict[str, int] | None:
    with path.open("rb") as f:
        for sector_size, payload_offset in ((2048, 0), (2352, 24), (2352, 16)):
            for sector in range(16, 32):
                payload = read_sector_payload(f, sector, sector_size, payload_offset)
                if len(payload) >= 2048 and payload[0] == 1 and payload[1:6] == b"CD001":
                    root = parse_dir_record(payload[156:])
                    if root:
                        return {
                            "sector_size": sector_size,
                            "payload_offset": payload_offset,
                            "pvd_lba": sector,
                            "root_extent_lba": root["extent_lba"],
                            "root_size": root["size_bytes"],
                        }
    return None


def parse_dir_record(data: bytes) -> dict[str, Any] | None:
    if not data or data[0] == 0 or len(data) < data[0]:
        return None
    length = data[0]
    record = data[:length]
    name_len = record[32]
    name_raw = record[33:33 + name_len]
    try:
        name = name_raw.decode("ascii", errors="replace")
    except UnicodeDecodeError:
        name = ""
    return {
        "record_length": length,
        "extent_lba": int.from_bytes(record[2:6], "little"),
        "size_bytes": int.from_bytes(record[10:14], "little"),
        "flags": record[25],
        "name": name,
        "is_dir": bool(record[25] & 0x02),
    }


def clean_name(name: str) -> str:
    if name == "\x00":
        return "."
    if name == "\x01":
        return ".."
    return name.split(";")[0]


def iter_directory_records(data: bytes):
    offset = 0
    while offset < len(data):
        length = data[offset]
        if length == 0:
            offset = ((offset // 2048) + 1) * 2048
            continue
        record = parse_dir_record(data[offset:offset + length])
        if record:
            yield record
        offset += length


def list_files(path: Path) -> dict[str, Any]:
    pvd = find_primary_volume_descriptor(path)
    if not pvd:
        return {"path": str(path), "iso9660_detected": False, "files": []}

    files = []
    seen_dirs = set()
    queue = deque([("", pvd["root_extent_lba"], pvd["root_size"])])
    with path.open("rb") as f:
        while queue:
            prefix, extent, size = queue.popleft()
            key = (extent, size)
            if key in seen_dirs:
                continue
            seen_dirs.add(key)

            chunks = []
            sectors = (size + 2047) // 2048
            for i in range(sectors):
                chunks.append(read_sector_payload(f, extent + i, pvd["sector_size"], pvd["payload_offset"]))
            directory_data = b"".join(chunks)[:size]

            for record in iter_directory_records(directory_data):
                name = clean_name(record["name"])
                if name in {".", ".."}:
                    continue
                full_path = f"{prefix}/{name}" if prefix else name
                item = {
                    "path": full_path,
                    "extent_lba": record["extent_lba"],
                    "data_offset": record["extent_lba"] * pvd["sector_size"] + pvd["payload_offset"],
                    "size_bytes": record["size_bytes"],
                    "is_dir": record["is_dir"],
                    "flags": record["flags"],
                }
                files.append(item)
                if record["is_dir"]:
                    queue.append((full_path, record["extent_lba"], record["size_bytes"]))

    return {
        "path": str(path),
        "iso9660_detected": True,
        "sector_size": pvd["sector_size"],
        "payload_offset": pvd["payload_offset"],
        "pvd_lba": pvd["pvd_lba"],
        "file_count": len(files),
        "files": sorted(files, key=lambda x: x["data_offset"]),
    }


def candidate_files(input_path: Path) -> list[Path]:
    if input_path.is_file():
        return [input_path]
    if not input_path.exists():
        return []
    return sorted(p for p in input_path.rglob("*") if p.is_file() and p.suffix.lower() in DISC_EXTENSIONS)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", nargs="?", default=str(REPO_ROOT / "dokodemo"))
    parser.add_argument("--output", default=str(DEFAULT_OUTPUT))
    args = parser.parse_args()

    input_path = Path(args.input)
    images = [list_files(path) for path in candidate_files(input_path)]
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps({
        "input": str(input_path),
        "image_count": len(images),
        "images": images,
        "notes": ["Directory records only. No file contents were extracted."],
    }, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"wrote {output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
