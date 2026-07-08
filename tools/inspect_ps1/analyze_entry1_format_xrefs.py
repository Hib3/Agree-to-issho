#!/usr/bin/env python3
"""Analyze code references to format-marker-like strings in CNA entry 1."""

from __future__ import annotations

import argparse
import json
from collections import defaultdict
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[2]
GENERATED = REPO_ROOT / "docs" / "research" / "generated"
DEFAULT_ISO_LIST = GENERATED / "iso9660_file_list.json"
DEFAULT_OUTPUT = GENERATED / "entry1_format_xrefs.json"

MARKERS = [b"%s", b"%d", b"%02d", b"%ld", b"%c"]


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
                if int.from_bytes(archive[off:off + 4], "little") == 1:
                    rel = int.from_bytes(archive[off + 4:off + 8], "little") * 2048
                    size = int.from_bytes(archive[off + 8:off + 12], "little")
                    return archive[rel:rel + size]
    raise FileNotFoundError("entry 1 not found")


def words_le(data: bytes) -> list[int]:
    return [int.from_bytes(data[i:i + 4], "little") for i in range(0, len(data) - 3, 4)]


def signed16(value: int) -> int:
    return value - 0x10000 if value & 0x8000 else value


def estimate_function_ranges(words: list[int], text_addr: int) -> list[dict[str, int]]:
    starts = set()
    ends = set()
    for n, word in enumerate(words):
        op = word >> 26
        rs = (word >> 21) & 31
        rt = (word >> 16) & 31
        imm = word & 0xFFFF
        if op == 0x09 and rs == 29 and rt == 29 and imm & 0x8000:
            starts.add(text_addr + n * 4)
        if word == 0x03E00008:
            ends.add(text_addr + n * 4)
    ranges = []
    sorted_ends = sorted(ends)
    for start in sorted(starts):
        end = next((item for item in sorted_ends if item >= start), None)
        if end is None:
            continue
        size = end + 8 - start
        if 0 < size < 0x10000:
            ranges.append({"start": start, "end": end + 8, "size": size})
    return ranges


def owner_for(vaddr: int, functions: list[dict[str, int]]) -> dict[str, int] | None:
    candidates = [fn for fn in functions if fn["start"] <= vaddr < fn["end"]]
    if not candidates:
        return None
    return min(candidates, key=lambda fn: fn["size"])


def code_refs_to_address(words: list[int], text_addr: int, target: int) -> list[dict[str, Any]]:
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
                refs.append({"code_vaddr": text_addr + n * 4, "kind": kind, "distance": j})
    return refs


def find_markers(text: bytes, text_addr: int, text_file_off: int) -> list[dict[str, Any]]:
    items = []
    for marker in MARKERS:
        start = 0
        while True:
            pos = text.find(marker, start)
            if pos < 0:
                break
            items.append({
                "marker": marker.decode("ascii"),
                "string_file_offset": text_file_off + pos,
                "string_vaddr": text_addr + pos,
            })
            start = pos + 1
    return sorted(items, key=lambda item: item["string_file_offset"])


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
    functions = estimate_function_ranges(words, text_addr)

    marker_items = []
    marker_totals: dict[str, dict[str, int]] = defaultdict(lambda: {"count": 0, "xref_count": 0})
    function_groups: dict[int, dict[str, Any]] = {}
    for item in find_markers(text, text_addr, text_file_off):
        refs = code_refs_to_address(words, text_addr, item["string_vaddr"])
        marker_totals[item["marker"]]["count"] += 1
        marker_totals[item["marker"]]["xref_count"] += len(refs)
        ref_items = []
        for ref in refs[:20]:
            fn = owner_for(ref["code_vaddr"], functions)
            ref_item = {
                **ref,
                "function_candidate": fn,
            }
            ref_items.append(ref_item)
            if fn:
                group = function_groups.setdefault(fn["start"], {
                    "function_candidate": fn,
                    "markers": set(),
                    "xref_count": 0,
                })
                group["markers"].add(item["marker"])
                group["xref_count"] += 1
        marker_items.append({
            **item,
            "xref_count": len(refs),
            "xrefs": ref_items,
        })

    function_summary = []
    for group in function_groups.values():
        function_summary.append({
            "function_candidate": group["function_candidate"],
            "markers": sorted(group["markers"]),
            "xref_count": group["xref_count"],
        })
    function_summary.sort(key=lambda item: item["xref_count"], reverse=True)

    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps({
        "entry": "DOKODEMO.417:CNA index 1",
        "text_addr": text_addr,
        "text_size": text_size,
        "marker_totals": dict(marker_totals),
        "marker_items": marker_items,
        "function_summary": function_summary,
        "notes": [
            "No surrounding strings are stored.",
            "Marker xrefs suggest format strings are used by code, but not what values are inserted.",
        ],
    }, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"wrote {output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
