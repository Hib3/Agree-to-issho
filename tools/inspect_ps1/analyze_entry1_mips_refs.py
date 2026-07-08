#!/usr/bin/env python3
"""Analyze structural MIPS references in CNA entry 1 without dumping text."""

from __future__ import annotations

import argparse
import json
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[2]
GENERATED = REPO_ROOT / "docs" / "research" / "generated"
DEFAULT_ISO_LIST = GENERATED / "iso9660_file_list.json"
DEFAULT_OUTPUT = GENERATED / "entry1_mips_refs.json"

KEYWORDS = [
    "SAVE",
    "LOAD",
    "CARD",
    "MCRD",
    "MEM",
    "DIARY",
    "WORD",
    "KOTO",
    "QUEST",
    "ANS",
    "EVENT",
    "DAY",
    "TIME",
    "CLOCK",
    "PDA",
    "TALK",
    "IR",
    "PAD",
]


def read_iso_payload(image_path: Path, sector_size: int, payload_offset: int, lba: int, size: int) -> bytes:
    chunks = []
    sectors = (size + 2047) // 2048
    with image_path.open("rb") as f:
        for i in range(sectors):
            f.seek((lba + i) * sector_size + payload_offset)
            chunks.append(f.read(2048))
    return b"".join(chunks)[:size]


def load_cna_entry_1(iso_list_path: Path, archive_name: str = "DOKODEMO.417") -> bytes:
    iso = json.loads(iso_list_path.read_text(encoding="utf-8"))
    for image in iso.get("images", []):
        image_path = Path(image["path"])
        for item in image.get("files", []):
            if item.get("path", "").upper() != archive_name.upper():
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
                if index != 1:
                    continue
                rel = int.from_bytes(archive[off + 4:off + 8], "little") * 2048
                size = int.from_bytes(archive[off + 8:off + 12], "little")
                return archive[rel:rel + size]
    raise FileNotFoundError("CNA entry 1 not found")


def words_le(data: bytes) -> list[int]:
    return [int.from_bytes(data[i:i + 4], "little") for i in range(0, len(data) - 3, 4)]


def signed16(value: int) -> int:
    return value - 0x10000 if value & 0x8000 else value


def find_keyword_hits(exe: bytes, text_addr: int, text_file_off: int, text_size: int) -> dict[str, list[dict[str, Any]]]:
    text_range = range(text_file_off, text_file_off + text_size)
    hits: dict[str, list[dict[str, Any]]] = {}
    upper = exe.upper()
    for keyword in KEYWORDS:
        needle = keyword.encode("ascii")
        start = 0
        found_items = []
        while True:
            pos = upper.find(needle, start)
            if pos < 0:
                break
            if pos in text_range:
                found_items.append({
                    "file_offset": pos,
                    "vaddr": text_addr + (pos - text_file_off),
                })
            start = pos + 1
        if found_items:
            hits[keyword] = found_items
    return hits


def code_xrefs_to_values(text_words: list[int], text_addr: int, targets: dict[int, str]) -> dict[int, list[dict[str, Any]]]:
    xrefs: dict[int, list[dict[str, Any]]] = defaultdict(list)
    lui_positions = []
    for n, word in enumerate(text_words):
        op = word >> 26
        rt = (word >> 16) & 31
        imm = word & 0xFFFF
        if op == 0x0F:
            lui_positions.append((n, rt, imm))

    for n, rt, hi in lui_positions:
        code_vaddr = text_addr + n * 4
        for j in range(1, 10):
            k = n + j
            if k >= len(text_words):
                break
            word = text_words[k]
            op = word >> 26
            rs = (word >> 21) & 31
            imm = word & 0xFFFF
            if rs != rt:
                continue
            value = None
            kind = None
            if op in (0x08, 0x09):
                value = ((hi << 16) + signed16(imm)) & 0xFFFFFFFF
                kind = "addi/addiu"
            elif op == 0x0D:
                value = ((hi << 16) | imm) & 0xFFFFFFFF
                kind = "ori"
            elif op in (0x20, 0x21, 0x23, 0x24, 0x25, 0x28, 0x29, 0x2B):
                value = ((hi << 16) + signed16(imm)) & 0xFFFFFFFF
                kind = "memory"
            if value in targets:
                xrefs[value].append({
                    "code_vaddr": code_vaddr,
                    "instruction_distance": j,
                    "kind": kind,
                    "target_label": targets[value],
                })
    return xrefs


def analyze_calls(text_words: list[int], text_addr: int) -> dict[str, Any]:
    jal_targets = Counter()
    jal_sites = []
    for n, word in enumerate(text_words):
        op = word >> 26
        if op == 0x03:
            target = ((text_addr + n * 4 + 4) & 0xF0000000) | ((word & 0x03FFFFFF) << 2)
            jal_targets[target] += 1
            if len(jal_sites) < 500:
                jal_sites.append({"site": text_addr + n * 4, "target": target})
    return {
        "unique_jal_targets": len(jal_targets),
        "top_jal_targets": [
            {"target": target, "count": count}
            for target, count in jal_targets.most_common(40)
        ],
        "jal_site_sample": jal_sites[:80],
    }


def estimate_function_ranges(text_words: list[int], text_addr: int) -> list[dict[str, int]]:
    starts = set()
    ends = set()
    for n, word in enumerate(text_words):
        op = word >> 26
        rs = (word >> 21) & 31
        rt = (word >> 16) & 31
        imm = word & 0xFFFF
        # addiu sp, sp, -N is a common MIPS function prologue.
        if op == 0x09 and rs == 29 and rt == 29 and imm & 0x8000:
            starts.add(text_addr + n * 4)
        # jr ra is a common function epilogue.
        if word == 0x03E00008:
            ends.add(text_addr + n * 4)

    ranges = []
    sorted_starts = sorted(starts)
    sorted_ends = sorted(ends)
    for start in sorted_starts:
        end = next((e for e in sorted_ends if e >= start), None)
        if end is None:
            continue
        if 0 < end - start < 0x10000:
            ranges.append({"start": start, "end": end + 8, "size": end + 8 - start})
    return ranges


def annotate_regions_with_functions(regions: list[dict[str, Any]], functions: list[dict[str, int]]) -> None:
    for region in regions:
        code = region["xref_code_vaddr"]
        owner = next((fn for fn in functions if fn["start"] <= code < fn["end"]), None)
        if owner:
            region["function_candidate"] = owner


def infer_regions(keyword_hits: dict[str, list[dict[str, Any]]], xrefs: dict[int, list[dict[str, Any]]]) -> list[dict[str, Any]]:
    regions = []
    for keyword, hits in keyword_hits.items():
        for hit in hits:
            refs = xrefs.get(hit["vaddr"], [])
            if not refs:
                continue
            for ref in refs:
                regions.append({
                    "keyword": keyword,
                    "string_vaddr": hit["vaddr"],
                    "string_file_offset": hit["file_offset"],
                    "xref_code_vaddr": ref["code_vaddr"],
                    "xref_kind": ref["kind"],
                    "xref_window": ref["instruction_distance"],
                })
    regions.sort(key=lambda item: (item["xref_code_vaddr"], item["keyword"]))
    return regions


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--iso-list", default=str(DEFAULT_ISO_LIST))
    parser.add_argument("--output", default=str(DEFAULT_OUTPUT))
    args = parser.parse_args()

    exe = load_cna_entry_1(Path(args.iso_list))
    if not exe.startswith(b"PS-X EXE"):
        raise ValueError("entry 1 is not a PS-X EXE candidate")

    text_addr = int.from_bytes(exe[0x18:0x1C], "little")
    text_size = int.from_bytes(exe[0x1C:0x20], "little")
    text_file_off = 0x800
    text = exe[text_file_off:text_file_off + text_size]
    text_words = words_le(text)

    keyword_hits = find_keyword_hits(exe, text_addr, text_file_off, text_size)
    targets = {
        hit["vaddr"]: keyword
        for keyword, hits in keyword_hits.items()
        for hit in hits
    }
    xrefs = code_xrefs_to_values(text_words, text_addr, targets)
    inferred_regions = infer_regions(keyword_hits, xrefs)
    function_ranges = estimate_function_ranges(text_words, text_addr)
    annotate_regions_with_functions(inferred_regions, function_ranges)

    result = {
        "entry": "DOKODEMO.417:CNA index 1",
        "psx_exe_header": {
            "text_addr": text_addr,
            "text_size": text_size,
            "pc0": int.from_bytes(exe[0x10:0x14], "little"),
            "sp_base": int.from_bytes(exe[0x30:0x34], "little"),
        },
        "keyword_hit_counts": {keyword: len(hits) for keyword, hits in keyword_hits.items()},
        "keyword_xref_counts": {
            keyword: sum(len(xrefs.get(hit["vaddr"], [])) for hit in hits)
            for keyword, hits in keyword_hits.items()
        },
        "referenced_keyword_regions": inferred_regions,
        "function_estimate_summary": {
            "count": len(function_ranges),
            "referenced_function_candidates": [
                region.get("function_candidate")
                for region in inferred_regions
                if region.get("function_candidate")
            ],
        },
        "call_summary": analyze_calls(text_words, text_addr),
        "notes": [
            "No raw strings are stored.",
            "Keyword names are ASCII structural labels only.",
            "Xrefs are heuristic LUI plus immediate-use matches.",
        ],
    }

    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"wrote {output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
