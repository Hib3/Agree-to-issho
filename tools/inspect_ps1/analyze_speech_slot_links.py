#!/usr/bin/env python3
"""Relate slot-format references to learning-related text regions.

This consumes generated structural JSON only. It does not read disc images,
dump strings, or infer original dialogue/templates.
"""

from __future__ import annotations

import argparse
import json
from collections import Counter
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[2]
GENERATED = REPO_ROOT / "docs" / "research" / "generated"
DEFAULT_FORMAT_XREFS = GENERATED / "entry1_format_xrefs.json"
DEFAULT_TEXT_REGIONS = GENERATED / "entry1_text_regions.json"
DEFAULT_CALL_GRAPH = GENERATED / "entry1_call_graph.json"
DEFAULT_OUTPUT = GENERATED / "speech_slot_links.json"


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}


def format_functions(format_xrefs: dict[str, Any]) -> dict[int, dict[str, Any]]:
    result: dict[int, dict[str, Any]] = {}
    for item in format_xrefs.get("function_summary", []):
        markers = tuple(item.get("markers", []))
        if "%s" not in markers:
            continue
        fn = item.get("function_candidate") or {}
        if "start" not in fn:
            continue
        start = int(fn["start"])
        result[start] = {
            "function_start": start,
            "function_size": fn.get("size"),
            "markers": list(markers),
            "xref_count": item.get("xref_count", 0),
        }
    return result


def region_functions(text_regions: dict[str, Any], wanted_keywords: set[str]) -> dict[int, dict[str, Any]]:
    result: dict[int, dict[str, Any]] = {}
    for cluster in text_regions.get("clusters", []):
        keywords = set((cluster.get("keyword_counts") or {}).keys())
        if not (keywords & wanted_keywords):
            continue
        for item in cluster.get("xref_function_summary", []):
            fn = item.get("function_candidate") or {}
            if "start" not in fn:
                continue
            start = int(fn["start"])
            current = result.setdefault(
                start,
                {
                    "function_start": start,
                    "function_size": fn.get("size"),
                    "keywords": Counter(),
                    "region_xref_count": 0,
                },
            )
            current["region_xref_count"] += item.get("xref_count", 0)
            current["keywords"].update({key: cluster["keyword_counts"][key] for key in keywords & wanted_keywords})
    for item in result.values():
        item["keywords"] = dict(sorted(item["keywords"].items()))
    return result


def call_edges(call_graph: dict[str, Any]) -> set[tuple[int, int]]:
    edges: set[tuple[int, int]] = set()
    for item in call_graph.get("graph", {}).get("top_function_summaries", []):
        src = int(item["function_start"])
        for callee in item.get("top_callees", []):
            edges.add((src, int(callee["target"])))
    for item in call_graph.get("key_function_summaries", []):
        src = int(item["function_start"])
        for callee in item.get("direct_range_top_callees", []):
            edges.add((src, int(callee["target"])))
    return edges


def graph_relations(a: set[int], b: set[int], edges: set[tuple[int, int]]) -> dict[str, Any]:
    direct = []
    for src, dst in sorted(edges):
        if src in a and dst in b:
            direct.append({"from": src, "to": dst, "direction": "a_to_b"})
        elif src in b and dst in a:
            direct.append({"from": src, "to": dst, "direction": "b_to_a"})

    outgoing: dict[int, set[int]] = {}
    for src, dst in edges:
        outgoing.setdefault(src, set()).add(dst)
    common = sorted(set().union(*(outgoing.get(x, set()) for x in a)) & set().union(*(outgoing.get(x, set()) for x in b)))
    return {
        "direct_link_count": len(direct),
        "direct_links": direct[:50],
        "common_callee_count": len(common),
        "common_callees": [{"target": target} for target in common[:50]],
    }


def nearest_pairs(a: set[int], b: set[int], limit: int = 20) -> list[dict[str, int]]:
    pairs = []
    for left in a:
        for right in b:
            pairs.append({
                "format_function": left,
                "learning_function": right,
                "distance": abs(left - right),
            })
    return sorted(pairs, key=lambda item: item["distance"])[:limit]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--format-xrefs", default=str(DEFAULT_FORMAT_XREFS))
    parser.add_argument("--text-regions", default=str(DEFAULT_TEXT_REGIONS))
    parser.add_argument("--call-graph", default=str(DEFAULT_CALL_GRAPH))
    parser.add_argument("--output", default=str(DEFAULT_OUTPUT))
    args = parser.parse_args()

    fmt = format_functions(load_json(Path(args.format_xrefs)))
    regions = load_json(Path(args.text_regions))
    wq = region_functions(regions, {"WORD", "QUEST"})
    ans = region_functions(regions, {"ANS"})
    edges = call_edges(load_json(Path(args.call_graph)))

    fmt_set = set(fmt)
    wq_set = set(wq)
    ans_set = set(ans)
    learning_set = wq_set | ans_set
    output_data = {
        "format_s_function_count": len(fmt_set),
        "word_question_function_count": len(wq_set),
        "answer_function_count": len(ans_set),
        "learning_function_count": len(learning_set),
        "shared_with_word_question_count": len(fmt_set & wq_set),
        "shared_with_answer_count": len(fmt_set & ans_set),
        "shared_with_any_learning_count": len(fmt_set & learning_set),
        "shared_with_word_question": sorted(fmt_set & wq_set),
        "shared_with_answer": sorted(fmt_set & ans_set),
        "shared_with_any_learning": sorted(fmt_set & learning_set),
        "format_to_learning_graph": graph_relations(fmt_set, learning_set, edges),
        "nearest_format_learning_pairs": nearest_pairs(fmt_set, learning_set),
        "format_functions": sorted(fmt.values(), key=lambda item: item["function_start"]),
        "notes": [
            "%s code references show slot-style formatting, not learned-word insertion.",
            "Function relations are heuristic structural evidence only.",
            "No raw strings, dialogue text, or templates are stored.",
        ],
    }
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(output_data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"wrote {output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
