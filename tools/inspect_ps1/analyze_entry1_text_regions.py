#!/usr/bin/env python3
"""Cluster text-like regions in CNA entry 1 without storing raw strings."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[2]
GENERATED = REPO_ROOT / "docs" / "research" / "generated"
DEFAULT_ISO_LIST = GENERATED / "iso9660_file_list.json"
DEFAULT_OUTPUT = GENERATED / "entry1_text_regions.json"

ASCII_RE = re.compile(rb"[\x20-\x7E]{4,}")
KEYWORDS = [b"WORD", b"KOTO", b"QUEST", b"ANS", b"DIARY", b"PDA", b"CLOCK", b"LOAD", b"SAVE", b"CARD", b"MEM"]
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


def code_refs_to_range(words: list[int], text_addr: int, start_vaddr: int, end_vaddr: int) -> list[dict[str, Any]]:
    refs = []
    hi_values = {((addr + 0x8000) >> 16) & 0xFFFF for addr in (start_vaddr, end_vaddr - 1)}
    for n, word in enumerate(words):
        op = word >> 26
        rt = (word >> 16) & 31
        imm = word & 0xFFFF
        if op != 0x0F or imm not in hi_values:
            continue
        for j in range(1, 12):
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
                value = ((imm << 16) + signed16(imm2)) & 0xFFFFFFFF
                kind = "addi/addiu"
            elif op2 == 0x0D:
                value = ((imm << 16) | imm2) & 0xFFFFFFFF
                kind = "ori"
            elif op2 in (0x20, 0x21, 0x23, 0x24, 0x25, 0x28, 0x29, 0x2B):
                value = ((imm << 16) + signed16(imm2)) & 0xFFFFFFFF
                kind = "memory"
            if value is not None and start_vaddr <= value < end_vaddr:
                refs.append({
                    "code_vaddr": text_addr + n * 4,
                    "target_vaddr": value,
                    "kind": kind,
                    "distance": j,
                })
    return refs


def ascii_runs(text: bytes) -> list[dict[str, int]]:
    runs = []
    for m in ASCII_RE.finditer(text):
        runs.append({"start": m.start(), "end": m.end(), "length": m.end() - m.start()})
    return runs


def cluster_runs(runs: list[dict[str, int]], max_gap: int = 96) -> list[list[dict[str, int]]]:
    clusters: list[list[dict[str, int]]] = []
    for run in runs:
        if not clusters or run["start"] - clusters[-1][-1]["end"] > max_gap:
            clusters.append([run])
        else:
            clusters[-1].append(run)
    return clusters


def summarize_cluster(text: bytes, cluster: list[dict[str, int]], text_addr: int, words: list[int], functions: list[dict[str, int]]) -> dict[str, Any]:
    start = cluster[0]["start"]
    end = cluster[-1]["end"]
    segment = text[start:end]
    keyword_counts = {kw.decode("ascii"): segment.upper().count(kw) for kw in KEYWORDS if segment.upper().count(kw)}
    marker_counts = {mk.decode("ascii"): segment.count(mk) for mk in MARKERS if segment.count(mk)}
    refs = code_refs_to_range(words, text_addr, text_addr + start, text_addr + end)
    function_counts: dict[int, dict[str, Any]] = {}
    for ref in refs:
        fn = owner_for(ref["code_vaddr"], functions)
        if not fn:
            continue
        item = function_counts.setdefault(fn["start"], {"function_candidate": fn, "xref_count": 0})
        item["xref_count"] += 1
    return {
        "file_offset_start": 0x800 + start,
        "file_offset_end": 0x800 + end,
        "vaddr_start": text_addr + start,
        "vaddr_end": text_addr + end,
        "byte_length": end - start,
        "ascii_run_count": len(cluster),
        "ascii_total_bytes": sum(run["length"] for run in cluster),
        "keyword_counts": keyword_counts,
        "format_marker_counts": marker_counts,
        "xref_count": len(refs),
        "xrefs_sample": refs[:20],
        "xref_function_summary": sorted(function_counts.values(), key=lambda item: item["xref_count"], reverse=True)[:20],
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--iso-list", default=str(DEFAULT_ISO_LIST))
    parser.add_argument("--output", default=str(DEFAULT_OUTPUT))
    args = parser.parse_args()

    exe = load_entry_1(Path(args.iso_list))
    text_addr = int.from_bytes(exe[0x18:0x1C], "little")
    text_size = int.from_bytes(exe[0x1C:0x20], "little")
    text = exe[0x800:0x800 + text_size]
    words = words_le(text)
    functions = estimate_function_ranges(words, text_addr)
    clusters = cluster_runs(ascii_runs(text))
    summaries = [summarize_cluster(text, cluster, text_addr, words, functions) for cluster in clusters]
    interesting = [
        item for item in summaries
        if item["keyword_counts"] or item["format_marker_counts"] or item["xref_count"]
    ]
    interesting.sort(key=lambda item: (item["xref_count"], sum(item["keyword_counts"].values()), sum(item["format_marker_counts"].values())), reverse=True)

    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps({
        "entry": "DOKODEMO.417:CNA index 1",
        "text_addr": text_addr,
        "text_size": text_size,
        "cluster_count": len(clusters),
        "interesting_cluster_count": len(interesting),
        "clusters": interesting,
        "notes": [
            "No raw strings are stored.",
            "Clusters are ASCII/text-like ranges; natural Japanese text may not appear here.",
        ],
    }, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"wrote {output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
