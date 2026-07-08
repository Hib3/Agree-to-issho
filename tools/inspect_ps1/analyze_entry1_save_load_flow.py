#!/usr/bin/env python3
"""Summarize save/load-like MIPS function structure in CNA entry 1.

This records instruction counts and structural references only. It does not
write disassembly, raw strings, assets, or extracted save data.
"""

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
DEFAULT_GRAPH = GENERATED / "entry1_call_graph.json"
DEFAULT_OUTPUT = GENERATED / "entry1_save_load_flow.json"

MEMORY_OPS = {
    0x20: "lb",
    0x21: "lh",
    0x22: "lwl",
    0x23: "lw",
    0x24: "lbu",
    0x25: "lhu",
    0x26: "lwr",
    0x28: "sb",
    0x29: "sh",
    0x2A: "swl",
    0x2B: "sw",
    0x2E: "swr",
}
LOAD_OPS = {"lb", "lh", "lwl", "lw", "lbu", "lhu", "lwr"}
STORE_OPS = {"sb", "sh", "swl", "sw", "swr"}
BRANCH_OPS = {0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07}


def read_iso_payload(image_path: Path, sector_size: int, payload_offset: int, lba: int, size: int) -> bytes:
    chunks = []
    sectors = (size + 2047) // 2048
    with image_path.open("rb") as handle:
        for i in range(sectors):
            handle.seek((lba + i) * sector_size + payload_offset)
            chunks.append(handle.read(2048))
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
                if int.from_bytes(archive[off:off + 4], "little") != 1:
                    continue
                rel = int.from_bytes(archive[off + 4:off + 8], "little") * 2048
                size = int.from_bytes(archive[off + 8:off + 12], "little")
                return archive[rel:rel + size]
    raise FileNotFoundError("DOKODEMO.417 CNA entry 1 not found")


def words_le(data: bytes) -> list[int]:
    return [int.from_bytes(data[i:i + 4], "little") for i in range(0, len(data) - 3, 4)]


def signed16(value: int) -> int:
    return value - 0x10000 if value & 0x8000 else value


def jal_target(word: int, site: int) -> int | None:
    if word >> 26 != 0x03:
        return None
    return ((site + 4) & 0xF0000000) | ((word & 0x03FFFFFF) << 2)


def key_functions(refs: dict[str, Any]) -> list[dict[str, Any]]:
    by_start: dict[int, dict[str, Any]] = {}
    for region in refs.get("referenced_keyword_regions", []):
        fn = region.get("function_candidate")
        if not fn:
            continue
        start = int(fn["start"])
        item = by_start.setdefault(
            start,
            {
                "start": start,
                "end": int(fn["end"]),
                "size": int(fn["size"]),
                "keywords": set(),
                "xref_count": 0,
            },
        )
        item["keywords"].add(region.get("keyword"))
        item["xref_count"] += 1
    result = []
    for item in by_start.values():
        result.append({**item, "keywords": sorted(k for k in item["keywords"] if k)})
    return sorted(result, key=lambda item: (item["start"], item["end"]))


def summarize_function(words: list[int], text_addr: int, fn: dict[str, Any]) -> dict[str, Any]:
    op_counts = Counter()
    base_reg_counts = Counter()
    stack_loads = 0
    stack_stores = 0
    non_stack_loads = 0
    non_stack_stores = 0
    branch_count = 0
    jal_targets = Counter()
    absolute_refs = []

    start_index = max(0, (fn["start"] - text_addr) // 4)
    end_index = min(len(words), (fn["end"] - text_addr) // 4)
    for n in range(start_index, end_index):
        word = words[n]
        op = word >> 26
        site = text_addr + n * 4
        if op in BRANCH_OPS:
            branch_count += 1
        target = jal_target(word, site)
        if target is not None:
            jal_targets[target] += 1
        op_name = MEMORY_OPS.get(op)
        if not op_name:
            continue
        base = (word >> 21) & 31
        imm = signed16(word & 0xFFFF)
        op_counts[op_name] += 1
        base_reg_counts[base] += 1
        if op_name in LOAD_OPS:
            if base == 29:
                stack_loads += 1
            else:
                non_stack_loads += 1
        elif op_name in STORE_OPS:
            if base == 29:
                stack_stores += 1
            else:
                non_stack_stores += 1
        if base not in {0, 29} and len(absolute_refs) < 40:
            absolute_refs.append({"site": site, "op": op_name, "base_reg": base, "offset": imm})

    return {
        "function_start": fn["start"],
        "function_end": fn["end"],
        "function_size": fn["size"],
        "keywords": fn["keywords"],
        "keyword_xref_count": fn["xref_count"],
        "instruction_count": max(0, end_index - start_index),
        "branch_count": branch_count,
        "memory_op_counts": dict(sorted(op_counts.items())),
        "stack_load_count": stack_loads,
        "stack_store_count": stack_stores,
        "non_stack_load_count": non_stack_loads,
        "non_stack_store_count": non_stack_stores,
        "base_register_counts": {str(k): v for k, v in sorted(base_reg_counts.items())},
        "direct_call_count": sum(jal_targets.values()),
        "unique_direct_call_targets": len(jal_targets),
        "top_direct_call_targets": [
            {"target": target, "count": count}
            for target, count in jal_targets.most_common(20)
        ],
        "non_stack_memory_ref_sample": absolute_refs,
    }


def add_graph_context(summaries: list[dict[str, Any]], graph: dict[str, Any]) -> None:
    graph_items = {
        item["function_start"]: item
        for item in graph.get("graph", {}).get("top_function_summaries", [])
    }
    key_items = {
        item["function_start"]: item
        for item in graph.get("key_function_summaries", [])
    }
    for summary in summaries:
        start = summary["function_start"]
        item = key_items.get(start) or graph_items.get(start) or {}
        summary["incoming_call_count"] = item.get("incoming_call_count", 0)
        summary["unique_callers"] = item.get("unique_callers", 0)


def relationship_summary(summaries: list[dict[str, Any]]) -> dict[str, Any]:
    by_keyword: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for item in summaries:
        for keyword in item["keywords"]:
            by_keyword[keyword].append(item)
    load_functions = by_keyword.get("LOAD", [])
    sync_functions = [
        item for item in summaries
        if {"PDA", "CLOCK", "MEM", "DIARY"} & set(item["keywords"])
    ]
    return {
        "load_function_count": len(load_functions),
        "sync_or_memory_function_count": len(sync_functions),
        "load_total_non_stack_loads": sum(item["non_stack_load_count"] for item in load_functions),
        "load_total_non_stack_stores": sum(item["non_stack_store_count"] for item in load_functions),
        "sync_total_non_stack_loads": sum(item["non_stack_load_count"] for item in sync_functions),
        "sync_total_non_stack_stores": sum(item["non_stack_store_count"] for item in sync_functions),
        "functions_with_non_stack_store": [
            {
                "function_start": item["function_start"],
                "keywords": item["keywords"],
                "non_stack_store_count": item["non_stack_store_count"],
            }
            for item in summaries
            if item["non_stack_store_count"] > 0
        ],
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--iso-list", default=str(DEFAULT_ISO_LIST))
    parser.add_argument("--refs", default=str(DEFAULT_REFS))
    parser.add_argument("--graph", default=str(DEFAULT_GRAPH))
    parser.add_argument("--output", default=str(DEFAULT_OUTPUT))
    args = parser.parse_args()

    exe = load_entry_1(Path(args.iso_list))
    text_addr = int.from_bytes(exe[0x18:0x1C], "little")
    text_size = int.from_bytes(exe[0x1C:0x20], "little")
    text = exe[0x800:0x800 + text_size]
    words = words_le(text)
    refs = json.loads(Path(args.refs).read_text(encoding="utf-8"))
    graph = json.loads(Path(args.graph).read_text(encoding="utf-8")) if Path(args.graph).exists() else {}

    summaries = [summarize_function(words, text_addr, fn) for fn in key_functions(refs)]
    add_graph_context(summaries, graph)
    output_data = {
        "entry": "DOKODEMO.417:CNA index 1",
        "text_addr": text_addr,
        "text_size": text_size,
        "function_count": len(summaries),
        "key_function_summaries": summaries,
        "relationship_summary": relationship_summary(summaries),
        "notes": [
            "Function boundaries are heuristic.",
            "SAVE/LOAD labels are ASCII structural labels; exact save format is not decoded.",
            "Memory operation counts are structural evidence only, not proof of original field layout.",
            "No disassembly text, raw strings, assets, or extracted save data are stored.",
        ],
    }
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(output_data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"wrote {output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
