#!/usr/bin/env python3
"""Compare WORD/QUEST and ANS text-region reference functions."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[2]
GENERATED = REPO_ROOT / "docs" / "research" / "generated"
DEFAULT_TEXT_REGIONS = GENERATED / "entry1_text_regions.json"
DEFAULT_CALL_GRAPH = GENERATED / "entry1_call_graph.json"
DEFAULT_OUTPUT = GENERATED / "learning_region_links.json"


def region_kind(region: dict[str, Any]) -> str | None:
    keywords = region.get("keyword_counts", {})
    if keywords.get("WORD") and keywords.get("QUEST"):
        return "word_question_region"
    if keywords.get("ANS"):
        return "answer_region"
    return None


def function_starts(region: dict[str, Any]) -> set[int]:
    starts = set()
    for item in region.get("xref_function_summary", []):
        fn = item.get("function_candidate") or {}
        if "start" in fn:
            starts.add(fn["start"])
    return starts


def call_edges(call_graph: dict[str, Any]) -> dict[int, set[int]]:
    edges: dict[int, set[int]] = {}
    for item in call_graph.get("graph", {}).get("top_function_summaries", []):
        src = item.get("function_start")
        if src is None:
            continue
        edges.setdefault(src, set())
        for callee in item.get("top_callees", []):
            target = callee.get("target")
            if target is not None:
                edges[src].add(target)
    return edges


def direct_links(a: set[int], b: set[int], edges: dict[int, set[int]]) -> list[dict[str, int | str]]:
    links = []
    for src in sorted(a):
        for dst in sorted(edges.get(src, set()) & b):
            links.append({"from": src, "to": dst, "direction": "a_to_b"})
    for src in sorted(b):
        for dst in sorted(edges.get(src, set()) & a):
            links.append({"from": src, "to": dst, "direction": "b_to_a"})
    return links


def common_callees(a: set[int], b: set[int], edges: dict[int, set[int]]) -> list[dict[str, Any]]:
    a_callees = set()
    b_callees = set()
    for src in a:
        a_callees.update(edges.get(src, set()))
    for src in b:
        b_callees.update(edges.get(src, set()))
    common = sorted(a_callees & b_callees)
    return [{"target": target} for target in common[:80]]


def nearest_pairs(a: set[int], b: set[int]) -> list[dict[str, int]]:
    pairs = []
    for left in a:
        nearest = min(b, key=lambda right: abs(right - left)) if b else None
        if nearest is not None:
            pairs.append({"word_question_function": left, "answer_function": nearest, "distance": abs(nearest - left)})
    pairs.sort(key=lambda item: item["distance"])
    return pairs[:30]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--text-regions", default=str(DEFAULT_TEXT_REGIONS))
    parser.add_argument("--call-graph", default=str(DEFAULT_CALL_GRAPH))
    parser.add_argument("--output", default=str(DEFAULT_OUTPUT))
    args = parser.parse_args()

    text_regions = json.loads(Path(args.text_regions).read_text(encoding="utf-8"))
    graph = json.loads(Path(args.call_graph).read_text(encoding="utf-8"))
    regions = {"word_question_region": [], "answer_region": []}
    for region in text_regions.get("clusters", []):
        kind = region_kind(region)
        if kind:
            regions[kind].append(region)

    word_question_functions = set()
    answer_functions = set()
    for region in regions["word_question_region"]:
        word_question_functions.update(function_starts(region))
    for region in regions["answer_region"]:
        answer_functions.update(function_starts(region))

    edges = call_edges(graph)
    result = {
        "word_question_region_count": len(regions["word_question_region"]),
        "answer_region_count": len(regions["answer_region"]),
        "word_question_function_count": len(word_question_functions),
        "answer_function_count": len(answer_functions),
        "shared_function_count": len(word_question_functions & answer_functions),
        "shared_functions": sorted(word_question_functions & answer_functions),
        "direct_links": direct_links(word_question_functions, answer_functions, edges),
        "common_callees": common_callees(word_question_functions, answer_functions, edges),
        "nearest_function_pairs": nearest_pairs(word_question_functions, answer_functions),
        "notes": [
            "Function boundaries and call graph are heuristic.",
            "No raw strings are stored.",
            "Links indicate structural proximity, not confirmed algorithm semantics.",
        ],
    }
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"wrote {output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
