#!/usr/bin/env python3
"""Find pointer-table style references to structural labels in CNA entry 1."""

from __future__ import annotations

import argparse
import json
from collections import defaultdict
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[2]
GENERATED = REPO_ROOT / "docs" / "research" / "generated"
DEFAULT_ISO_LIST = GENERATED / "iso9660_file_list.json"
DEFAULT_OUTPUT = GENERATED / "entry1_pointer_tables.json"

KEYWORDS = [
    "WORD",
    "KOTO",
    "QUEST",
    "ANS",
    "DIARY",
    "PDA",
    "CLOCK",
    "LOAD",
    "SAVE",
    "CARD",
    "MEM",
]


def read_iso_payload(image_path: Path, sector_size: int, payload_offset: int, lba: int, size: int) -> bytes:
    chunks = []
    sectors = (size + 2047) // 2048
    with image_path.open("rb") as f:
        for i in range(sectors):
            f.seek((lba + i) * sector_size + payload_offset)
            chunks.append(f.read(2048))
    return b"".join(chunks)[:size]


def load_entry_1(iso_list_path: Path) -> bytes:
    iso = json.loads(iso_list_path.read_text(encoding="utf-8"))
    for image in iso.get("images", []):
        image_path = Path(image["path"])
        for item in image.get("files", []):
            if item.get("path", "").upper() != "DOKODEMO.417":
                continue
            archive = read_iso_payload(
                image_path,
                image["sector_size"],
                image["payload_offset"],
                item["extent_lba"],
                item["size_bytes"],
            )
            count = int.from_bytes(archive[8:12], "little")
            for i in range(count):
                off = 64 + i * 16
                index = int.from_bytes(archive[off:off + 4], "little")
                if index == 1:
                    rel = int.from_bytes(archive[off + 4:off + 8], "little") * 2048
                    size = int.from_bytes(archive[off + 8:off + 12], "little")
                    return archive[rel:rel + size]
    raise FileNotFoundError("entry 1 not found")


def words_le(data: bytes) -> list[int]:
    return [int.from_bytes(data[i:i + 4], "little") for i in range(0, len(data) - 3, 4)]


def signed16(value: int) -> int:
    return value - 0x10000 if value & 0x8000 else value


def find_keyword_addresses(exe: bytes, text_addr: int, text_file_off: int, text_size: int) -> dict[str, list[dict[str, int]]]:
    upper = exe.upper()
    text_start = text_file_off
    text_end = text_file_off + text_size
    hits: dict[str, list[dict[str, int]]] = {}
    for keyword in KEYWORDS:
        needle = keyword.encode("ascii")
        start = 0
        items = []
        while True:
            pos = upper.find(needle, start)
            if pos < 0:
                break
            if text_start <= pos < text_end:
                items.append({"file_offset": pos, "vaddr": text_addr + pos - text_file_off})
            start = pos + 1
        if items:
            hits[keyword] = items
    return hits


def find_value_offsets(data: bytes, value: int) -> list[int]:
    needle = value.to_bytes(4, "little")
    offsets = []
    start = 0
    while True:
        pos = data.find(needle, start)
        if pos < 0:
            break
        if pos % 4 == 0:
            offsets.append(pos)
        start = pos + 1
    return offsets


def code_refs_to_address(words: list[int], text_addr: int, target: int) -> list[dict[str, int | str]]:
    refs = []
    hi = ((target + 0x8000) >> 16) & 0xFFFF
    for n, word in enumerate(words):
        op = word >> 26
        rt = (word >> 16) & 31
        imm = word & 0xFFFF
        if op != 0x0F or imm != hi:
            continue
        for j in range(1, 10):
            k = n + j
            if k >= len(words):
                break
            w = words[k]
            op2 = w >> 26
            rs = (w >> 21) & 31
            imm2 = w & 0xFFFF
            if rs != rt:
                continue
            value = None
            kind = ""
            if op2 in (0x08, 0x09):
                value = ((hi << 16) + signed16(imm2)) & 0xFFFFFFFF
                kind = "addi/addiu"
            elif op2 == 0x0D:
                value = ((hi << 16) | imm2) & 0xFFFFFFFF
                kind = "ori"
            elif op2 in (0x20, 0x21, 0x23, 0x24, 0x25, 0x28, 0x29, 0x2B):
                value = ((hi << 16) + signed16(imm2)) & 0xFFFFFFFF
                kind = "memory"
            if value == target:
                refs.append({
                    "code_vaddr": text_addr + n * 4,
                    "kind": kind,
                    "distance": j,
                })
    return refs


def nearby_pointer_run(words: list[int], index: int, text_addr: int, text_size: int) -> dict[str, Any]:
    start = index
    while start > 0 and text_addr <= words[start - 1] < text_addr + text_size:
        start -= 1
    end = index
    while end + 1 < len(words) and text_addr <= words[end + 1] < text_addr + text_size:
        end += 1
    return {
        "run_start_file_offset": start * 4,
        "run_end_file_offset": (end + 1) * 4,
        "run_count": end - start + 1,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--iso-list", default=str(DEFAULT_ISO_LIST))
    parser.add_argument("--output", default=str(DEFAULT_OUTPUT))
    args = parser.parse_args()

    exe = load_entry_1(Path(args.iso_list))
    if not exe.startswith(b"PS-X EXE"):
        raise ValueError("entry 1 is not a PS-X EXE candidate")
    text_addr = int.from_bytes(exe[0x18:0x1C], "little")
    text_size = int.from_bytes(exe[0x1C:0x20], "little")
    text_file_off = 0x800
    text = exe[text_file_off:text_file_off + text_size]
    words = words_le(text)
    keyword_hits = find_keyword_addresses(exe, text_addr, text_file_off, text_size)

    results = []
    pointer_table_groups: dict[int, dict[str, Any]] = defaultdict(lambda: {
        "pointer_file_offset": None,
        "pointer_vaddr": None,
        "keywords": set(),
        "target_count": 0,
        "code_ref_count": 0,
        "code_refs": [],
        "run": None,
    })

    for keyword, hits in keyword_hits.items():
        for hit in hits:
            offsets = find_value_offsets(text, hit["vaddr"])
            pointer_items = []
            for offset in offsets:
                pointer_vaddr = text_addr + offset
                refs = code_refs_to_address(words, text_addr, pointer_vaddr)
                run = nearby_pointer_run(words, offset // 4, text_addr, text_size)
                pointer_items.append({
                    "pointer_file_offset": text_file_off + offset,
                    "pointer_vaddr": pointer_vaddr,
                    "code_ref_count": len(refs),
                    "code_refs": refs[:20],
                    "pointer_run": run,
                })
                group = pointer_table_groups[run["run_start_file_offset"]]
                group["pointer_file_offset"] = text_file_off + run["run_start_file_offset"]
                group["pointer_vaddr"] = text_addr + run["run_start_file_offset"]
                group["keywords"].add(keyword)
                group["target_count"] += 1
                group["code_ref_count"] += len(refs)
                group["code_refs"].extend(refs[:20])
                group["run"] = run
            results.append({
                "keyword": keyword,
                "string_file_offset": hit["file_offset"],
                "string_vaddr": hit["vaddr"],
                "pointer_count": len(pointer_items),
                "pointers": pointer_items[:40],
            })

    table_groups = []
    for group in pointer_table_groups.values():
        table_groups.append({
            "pointer_file_offset": group["pointer_file_offset"],
            "pointer_vaddr": group["pointer_vaddr"],
            "keywords": sorted(group["keywords"]),
            "target_count": group["target_count"],
            "code_ref_count": group["code_ref_count"],
            "code_refs": group["code_refs"][:40],
            "run": group["run"],
        })
    table_groups.sort(key=lambda item: (-(item["code_ref_count"] or 0), -(item["target_count"] or 0)))

    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps({
        "entry": "DOKODEMO.417:CNA index 1",
        "text_addr": text_addr,
        "text_size": text_size,
        "keyword_pointer_results": results,
        "pointer_table_groups": table_groups,
        "notes": [
            "No raw strings are stored.",
            "Pointer-table detection is heuristic and only records offsets/counts.",
        ],
    }, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"wrote {output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
