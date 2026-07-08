#!/usr/bin/env python3
"""Build a structural call graph summary for CNA entry 1."""

from __future__ import annotations

import argparse
import json
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[2]
GENERATED = REPO_ROOT / "docs" / "research" / "generated"
DEFAULT_ISO_LIST = GENERATED / "iso9660_file_list.json"
DEFAULT_REFS = GENERATED / "entry1_mips_refs.json"
DEFAULT_OUTPUT = GENERATED / "entry1_call_graph.json"


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
    # Use the nearest containing function; ranges can overlap in heuristic detection.
    candidates = [fn for fn in functions if fn["start"] <= vaddr < fn["end"]]
    if not candidates:
        return None
    return min(candidates, key=lambda fn: fn["size"])


def jal_target(word: int, site: int) -> int | None:
    if word >> 26 != 0x03:
        return None
    return ((site + 4) & 0xF0000000) | ((word & 0x03FFFFFF) << 2)


def build_graph(words: list[int], text_addr: int, functions: list[dict[str, int]]) -> dict[str, Any]:
    outgoing: dict[int, Counter[int]] = defaultdict(Counter)
    incoming: dict[int, Counter[int]] = defaultdict(Counter)
    external_targets = Counter()
    for n, word in enumerate(words):
        site = text_addr + n * 4
        target = jal_target(word, site)
        if target is None:
            continue
        owner = owner_for(site, functions)
        target_owner = owner_for(target, functions)
        if not owner:
            external_targets[target] += 1
            continue
        src = owner["start"]
        dst = target_owner["start"] if target_owner else target
        outgoing[src][dst] += 1
        incoming[dst][src] += 1

    summaries = []
    function_by_start = {fn["start"]: fn for fn in functions}
    for start, calls in outgoing.items():
        fn = function_by_start.get(start, {"start": start, "end": start, "size": 0})
        summaries.append({
            "function_start": start,
            "function_end": fn["end"],
            "function_size": fn["size"],
            "call_count": sum(calls.values()),
            "unique_callees": len(calls),
            "top_callees": [
                {"target": target, "count": count, "target_is_function": target in function_by_start}
                for target, count in calls.most_common(20)
            ],
            "incoming_call_count": sum(incoming.get(start, Counter()).values()),
            "unique_callers": len(incoming.get(start, Counter())),
        })
    summaries.sort(key=lambda item: item["call_count"], reverse=True)
    return {
        "function_count": len(functions),
        "functions_with_calls": len(summaries),
        "top_function_summaries": summaries[:120],
    }


def direct_calls_for_range(words: list[int], text_addr: int, start: int, end: int) -> Counter[int]:
    calls: Counter[int] = Counter()
    for site in range(start, end, 4):
        n = (site - text_addr) // 4
        if not (0 <= n < len(words)):
            continue
        target = jal_target(words[n], site)
        if target is not None:
            calls[target] += 1
    return calls


def key_function_summaries(refs: dict[str, Any], graph: dict[str, Any], words: list[int], text_addr: int) -> list[dict[str, Any]]:
    by_start = {item["function_start"]: item for item in graph["top_function_summaries"]}
    result = []
    seen = set()
    for region in refs.get("referenced_keyword_regions", []):
        fn = region.get("function_candidate")
        if not fn or fn["start"] in seen:
            continue
        seen.add(fn["start"])
        summary = by_start.get(fn["start"], {
            "function_start": fn["start"],
            "function_end": fn["end"],
            "function_size": fn["size"],
            "call_count": 0,
            "unique_callees": 0,
            "top_callees": [],
            "incoming_call_count": 0,
            "unique_callers": 0,
        })
        keywords = sorted({
            item["keyword"]
            for item in refs.get("referenced_keyword_regions", [])
            if (item.get("function_candidate") or {}).get("start") == fn["start"]
        })
        direct_calls = direct_calls_for_range(words, text_addr, fn["start"], fn["end"])
        result.append({
            **summary,
            "keywords": keywords,
            "direct_range_call_count": sum(direct_calls.values()),
            "direct_range_unique_callees": len(direct_calls),
            "direct_range_top_callees": [
                {"target": target, "count": count}
                for target, count in direct_calls.most_common(20)
            ],
        })
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--iso-list", default=str(DEFAULT_ISO_LIST))
    parser.add_argument("--refs", default=str(DEFAULT_REFS))
    parser.add_argument("--output", default=str(DEFAULT_OUTPUT))
    args = parser.parse_args()

    exe = load_entry_1(Path(args.iso_list))
    text_addr = int.from_bytes(exe[0x18:0x1C], "little")
    text_size = int.from_bytes(exe[0x1C:0x20], "little")
    text = exe[0x800:0x800 + text_size]
    words = words_le(text)
    functions = estimate_function_ranges(words, text_addr)
    graph = build_graph(words, text_addr, functions)
    refs = json.loads(Path(args.refs).read_text(encoding="utf-8"))

    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps({
        "entry": "DOKODEMO.417:CNA index 1",
        "text_addr": text_addr,
        "text_size": text_size,
        "graph": graph,
        "key_function_summaries": key_function_summaries(refs, graph, words, text_addr),
        "notes": [
            "Function boundaries are heuristic MIPS prologue/epilogue ranges.",
            "No disassembly text or raw game strings are stored.",
        ],
    }, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"wrote {output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
