#!/usr/bin/env python3
"""Count format-marker-like bytes in CNA entries without storing text."""

from __future__ import annotations

import argparse
import json
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
GENERATED = REPO_ROOT / "docs" / "research" / "generated"
DEFAULT_ISO_LIST = GENERATED / "iso9660_file_list.json"
DEFAULT_OUTPUT = GENERATED / "cna_format_markers.json"

MARKERS = [b"%s", b"%d", b"%02d", b"%ld", b"%c"]


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
    count = int.from_bytes(archive[8:12], "little")
    for i in range(count):
        off = 64 + i * 16
        index = int.from_bytes(archive[off:off + 4], "little")
        rel = int.from_bytes(archive[off + 4:off + 8], "little") * 2048
        size = int.from_bytes(archive[off + 8:off + 12], "little")
        yield index, rel, size, archive[rel:rel + size]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--iso-list", default=str(DEFAULT_ISO_LIST))
    parser.add_argument("--output", default=str(DEFAULT_OUTPUT))
    args = parser.parse_args()

    archive = load_cna(Path(args.iso_list))
    archive_counts = {marker.decode("ascii"): archive.count(marker) for marker in MARKERS}
    entries = []
    for index, rel, size, data in iter_cna_entries(archive):
        counts = {marker.decode("ascii"): data.count(marker) for marker in MARKERS}
        total = sum(counts.values())
        if total:
            entries.append({
                "index": index,
                "relative_offset": rel,
                "size_bytes": size,
                "marker_total": total,
                "marker_counts": {k: v for k, v in counts.items() if v},
            })
    entries.sort(key=lambda item: item["marker_total"], reverse=True)

    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps({
        "archive": "DOKODEMO.417",
        "archive_marker_counts": archive_counts,
        "entry_count_with_markers": len(entries),
        "entries": entries,
        "notes": [
            "No surrounding strings are stored.",
            "Format markers suggest slot formatting but do not prove user-word insertion.",
        ],
    }, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"wrote {output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
