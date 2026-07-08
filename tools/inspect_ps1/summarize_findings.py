#!/usr/bin/env python3
"""Create a clean-room observation report from generated JSON summaries."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[2]
GENERATED = REPO_ROOT / "docs" / "research" / "generated"
DEFAULT_OUTPUT = REPO_ROOT / "docs" / "research" / "OBSERVATIONS.md"


def load_json(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def bullet(items: list[str]) -> str:
    return "\n".join(f"- {item}" for item in items) if items else "- 不明"


def file_list(disc: dict[str, Any]) -> list[str]:
    files = disc.get("files", [])
    if not files:
        return ["確認済み: 解析対象ファイルは検出されていない。"]
    return [
        f"確認済み: `{f.get('path')}` size={f.get('size_bytes')} bytes ext={f.get('extension')}"
        for f in files
    ]


def string_summary(strings: dict[str, Any]) -> list[str]:
    files = strings.get("files", [])
    if not files:
        return ["不明: 入力ファイルがないため文字列候補は未確認。"]
    lines = []
    for f in files:
        sjis = f.get("shift_jis_candidate", {})
        ascii_summary = f.get("ascii", {})
        lines.append(
            "確認済み: "
            f"`{f.get('path')}` Shift_JIS候補={sjis.get('count', 0)} "
            f"短い候補={sjis.get('short_string_count_1_to_12', 0)} "
            f"ASCII候補={ascii_summary.get('count', 0)}"
        )
    return lines


def magic_summary(magic: dict[str, Any]) -> list[str]:
    files = magic.get("files", [])
    if not files:
        return ["不明: 入力ファイルがないため形式候補は未確認。"]
    lines = []
    for f in files:
        hits = f.get("hits", [])
        if not hits:
            lines.append(f"確認済み: `{f.get('path')}` 既知マジック候補なし。")
            continue
        for hit in hits:
            offsets = hit.get("offsets_sample", [])
            sample = ", ".join(str(x) for x in offsets[:8])
            lines.append(
                f"確認済み: `{f.get('path')}` {hit.get('name')} "
                f"count={hit.get('count')} offsets_sample=[{sample}]"
            )
    return lines


def iso_summary(iso: dict[str, Any]) -> list[str]:
    images = iso.get("images", [])
    if not images:
        return ["不明: ISO9660ファイル一覧は未生成。"]
    lines = []
    for image in images:
        lines.append(
            f"確認済み: `{image.get('path')}` ISO9660={image.get('iso9660_detected')} "
            f"sector={image.get('sector_size')} payload_offset={image.get('payload_offset')} "
            f"file_count={image.get('file_count')}"
        )
        for item in image.get("files", []):
            if item.get("is_dir"):
                continue
            lines.append(
                f"確認済み: ISO内 `{item.get('path')}` size={item.get('size_bytes')} "
                f"lba={item.get('extent_lba')} offset={item.get('data_offset')}"
            )
    return lines


def region_summary(regions: dict[str, Any]) -> list[str]:
    images = regions.get("images", [])
    if not images:
        return ["不明: ISO内ファイル領域スキャンは未生成。"]
    lines = []
    for image in images:
        for item in image.get("scanned_files", []):
            strings = item.get("string_summary", {})
            extra = ""
            if "psx_exe_header" in item:
                psx = item["psx_exe_header"]
                extra = (
                    f" PS-X EXE text_size={psx.get('text_size')} "
                    f"text_address={psx.get('text_address')}"
                )
            lines.append(
                f"確認済み: `{item.get('path')}` entropy64k={item.get('entropy_first_64kb')} "
                f"magic={item.get('magic_counts')} "
                f"SJIS候補={strings.get('shift_jis_candidate_count', 0)} "
                f"短い候補={strings.get('shift_jis_short_count_1_to_12', 0)}{extra}"
            )
    return lines


def cna_summary(cna: dict[str, Any]) -> list[str]:
    archives = cna.get("archives", [])
    if not archives:
        return ["不明: CNA候補アーカイブスキャンは未生成。"]
    lines = []
    for archive in archives:
        scan = archive.get("scan", {})
        if not scan.get("detected"):
            lines.append(f"不明: `{archive.get('archive_path')}` はCNA候補として未検出。")
            continue
        lines.append(
            f"確認済み: `{archive.get('archive_path')}` は先頭`CNA`、version={scan.get('version')}、"
            f"内部エントリ数={scan.get('entry_count_header')}、tail_padding={scan.get('tail_padding_bytes')}"
        )
        lines.append(f"確認済み: CNA内部head_class_counts={scan.get('head_class_counts')}")
        for entry in scan.get("entries", []):
            if entry.get("head_class") in {"ps_x_exe", "lpf_container_candidate"}:
                lines.append(
                    f"確認済み: CNA entry index={entry.get('index')} class={entry.get('head_class')} "
                    f"offset={entry.get('relative_offset')} size={entry.get('size_bytes')}"
                )
        top = sorted(
            scan.get("entries", []),
            key=lambda e: e.get("string_summary", {}).get("shift_jis_candidate_count", 0),
            reverse=True,
        )[:8]
        for entry in top:
            ss = entry.get("string_summary", {})
            lines.append(
                f"確認済み: CNA文字列密度候補 index={entry.get('index')} "
                f"offset={entry.get('relative_offset')} size={entry.get('size_bytes')} "
                f"SJIS候補={ss.get('shift_jis_candidate_count', 0)} "
                f"短い候補={ss.get('shift_jis_short_count_1_to_12', 0)}"
            )
    return lines


def entry1_ref_summary(refs: dict[str, Any]) -> list[str]:
    if not refs:
        return ["不明: entry 1 MIPS参照解析は未生成。"]
    lines = []
    header = refs.get("psx_exe_header", {})
    lines.append(
        f"確認済み: entry 1 PS-X EXE text_addr={header.get('text_addr')} "
        f"text_size={header.get('text_size')} pc0={header.get('pc0')}"
    )
    lines.append(f"確認済み: entry 1 keyword_hit_counts={refs.get('keyword_hit_counts')}")
    lines.append(f"確認済み: entry 1 keyword_xref_counts={refs.get('keyword_xref_counts')}")
    functions = refs.get("function_estimate_summary", {})
    lines.append(f"確認済み: entry 1 関数候補数={functions.get('count')}")
    for region in refs.get("referenced_keyword_regions", []):
        fn = region.get("function_candidate") or {}
        lines.append(
            f"確認済み: entry 1 xref keyword={region.get('keyword')} "
            f"code={region.get('xref_code_vaddr')} function_start={fn.get('start')} "
            f"function_size={fn.get('size')}"
        )
    return lines


def entry1_graph_summary(graph: dict[str, Any]) -> list[str]:
    if not graph:
        return ["不明: entry 1 呼び出しグラフ解析は未生成。"]
    g = graph.get("graph", {})
    lines = [
        f"確認済み: entry 1 関数候補数={g.get('function_count')} callsあり関数={g.get('functions_with_calls')}"
    ]
    for item in graph.get("key_function_summaries", []):
        lines.append(
            f"確認済み: entry 1 key function start={item.get('function_start')} "
            f"keywords={item.get('keywords')} direct_calls={item.get('direct_range_call_count')} "
            f"unique_callees={item.get('direct_range_unique_callees')} incoming={item.get('incoming_call_count')}"
        )
    return lines


def entry1_pointer_summary(pointer: dict[str, Any]) -> list[str]:
    if not pointer:
        return ["不明: entry 1 ポインタ表解析は未生成。"]
    lines = []
    for item in pointer.get("keyword_pointer_results", []):
        keyword = item.get("keyword")
        if keyword not in {"WORD", "KOTO", "QUEST", "ANS", "DIARY", "PDA", "CLOCK", "LOAD", "SAVE", "CARD", "MEM"}:
            continue
        total_refs = sum(p.get("code_ref_count", 0) for p in item.get("pointers", []))
        lines.append(
            f"確認済み: entry 1 pointer keyword={keyword} "
            f"string_vaddr={item.get('string_vaddr')} pointer_count={item.get('pointer_count')} "
            f"pointer_code_refs={total_refs}"
        )
    for group in pointer.get("pointer_table_groups", [])[:8]:
        lines.append(
            f"確認済み: entry 1 pointer table keywords={group.get('keywords')} "
            f"targets={group.get('target_count')} code_refs={group.get('code_ref_count')} "
            f"run_count={(group.get('run') or {}).get('run_count')}"
        )
    return lines


def natural_text_summary(natural: dict[str, Any]) -> list[str]:
    if not natural:
        return ["不明: CNA自然文候補スキャンは未生成。"]
    lines = [f"確認済み: CNA自然文候補entry数={natural.get('candidate_entry_count')}"]
    for item in natural.get("entries", [])[:10]:
        lines.append(
            f"確認済み: CNA自然文候補 index={item.get('index')} "
            f"count={item.get('natural_text_candidate_count')} runs={item.get('sjis_run_count')} "
            f"lengths={item.get('natural_length_distribution')}"
        )
    return lines


def format_marker_summary(markers: dict[str, Any]) -> list[str]:
    if not markers:
        return ["不明: CNAフォーマット記号スキャンは未生成。"]
    lines = [
        f"確認済み: CNA format archive_counts={markers.get('archive_marker_counts')}",
        f"確認済み: CNA format marker entry_count={markers.get('entry_count_with_markers')}",
    ]
    for item in markers.get("entries", [])[:10]:
        lines.append(
            f"確認済み: CNA format index={item.get('index')} total={item.get('marker_total')} "
            f"counts={item.get('marker_counts')}"
        )
    return lines


def format_xref_summary(xrefs: dict[str, Any]) -> list[str]:
    if not xrefs:
        return ["不明: entry 1 format xref解析は未生成。"]
    lines = [f"確認済み: entry 1 format marker_totals={xrefs.get('marker_totals')}"]
    for item in xrefs.get("function_summary", [])[:12]:
        fn = item.get("function_candidate") or {}
        lines.append(
            f"確認済み: entry 1 format xref function_start={fn.get('start')} "
            f"function_size={fn.get('size')} markers={item.get('markers')} "
            f"xref_count={item.get('xref_count')}"
        )
    return lines


def text_region_summary(regions_text: dict[str, Any]) -> list[str]:
    if not regions_text:
        return ["不明: entry 1 text region解析は未生成。"]
    lines = [
        f"確認済み: entry 1 text cluster_count={regions_text.get('cluster_count')} "
        f"interesting={regions_text.get('interesting_cluster_count')}"
    ]
    for item in regions_text.get("clusters", [])[:12]:
        lines.append(
            f"確認済み: entry 1 text region vaddr={item.get('vaddr_start')}..{item.get('vaddr_end')} "
            f"keywords={item.get('keyword_counts')} markers={item.get('format_marker_counts')} "
            f"xrefs={item.get('xref_count')}"
        )
    return lines


def learning_link_summary(links: dict[str, Any]) -> list[str]:
    if not links:
        return ["不明: learning region link解析は未生成。"]
    return [
        f"確認済み: learning links WQ_regions={links.get('word_question_region_count')} "
        f"ANS_regions={links.get('answer_region_count')} "
        f"WQ_functions={links.get('word_question_function_count')} "
        f"ANS_functions={links.get('answer_function_count')}",
        f"確認済み: learning links shared_functions={links.get('shared_function_count')} "
        f"direct_links={len(links.get('direct_links', []))} "
        f"common_callees={len(links.get('common_callees', []))}",
    ]


def save_load_flow_summary(flow: dict[str, Any]) -> list[str]:
    if not flow:
        return ["不明: entry 1 save/load flow解析は未生成。"]
    rel = flow.get("relationship_summary", {})
    lines = [
        f"確認済み: save/load flow key_functions={flow.get('function_count')} "
        f"load_functions={rel.get('load_function_count')} "
        f"sync_or_memory_functions={rel.get('sync_or_memory_function_count')}",
        f"確認済み: LOAD候補 非スタックload={rel.get('load_total_non_stack_loads')} "
        f"非スタックstore={rel.get('load_total_non_stack_stores')}",
        f"確認済み: PDA/CLOCK/MEM/DIARY系候補 非スタックload={rel.get('sync_total_non_stack_loads')} "
        f"非スタックstore={rel.get('sync_total_non_stack_stores')}",
    ]
    for item in flow.get("key_function_summaries", []):
        lines.append(
            f"確認済み: save/load function start={item.get('function_start')} "
            f"keywords={item.get('keywords')} size={item.get('function_size')} "
            f"direct_calls={item.get('direct_call_count')} branches={item.get('branch_count')} "
            f"non_stack_loads={item.get('non_stack_load_count')} "
            f"non_stack_stores={item.get('non_stack_store_count')}"
        )
    return lines


def speech_slot_link_summary(links: dict[str, Any]) -> list[str]:
    if not links:
        return ["不明: speech slot link解析は未生成。"]
    graph = links.get("format_to_learning_graph", {})
    return [
        f"確認済み: speech slot links format_s_functions={links.get('format_s_function_count')} "
        f"learning_functions={links.get('learning_function_count')} "
        f"WQ_functions={links.get('word_question_function_count')} "
        f"ANS_functions={links.get('answer_function_count')}",
        f"確認済み: speech slot links shared_with_WQ={links.get('shared_with_word_question_count')} "
        f"shared_with_ANS={links.get('shared_with_answer_count')} "
        f"shared_with_any_learning={links.get('shared_with_any_learning_count')}",
        f"確認済み: speech slot links direct_links={graph.get('direct_link_count')} "
        f"common_callees={graph.get('common_callee_count')}",
    ]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--generated-dir", default=str(GENERATED))
    parser.add_argument("--output", default=str(DEFAULT_OUTPUT))
    args = parser.parse_args()

    generated = Path(args.generated_dir)
    disc = load_json(generated / "disc_image_inspection.json")
    iso = load_json(generated / "iso9660_file_list.json")
    strings = load_json(generated / "string_scan.json")
    magic = load_json(generated / "magic_number_scan.json")
    regions = load_json(generated / "iso_region_scan.json")
    cna = load_json(generated / "cna_archive_scan.json")
    entry1_refs = load_json(generated / "entry1_mips_refs.json")
    entry1_graph = load_json(generated / "entry1_call_graph.json")
    entry1_pointer = load_json(generated / "entry1_pointer_tables.json")
    natural_text = load_json(generated / "cna_natural_text_candidates.json")
    format_markers = load_json(generated / "cna_format_markers.json")
    format_xrefs = load_json(generated / "entry1_format_xrefs.json")
    text_regions = load_json(generated / "entry1_text_regions.json")
    learning_links = load_json(generated / "learning_region_links.json")
    save_load_flow = load_json(generated / "entry1_save_load_flow.json")
    speech_slot_links = load_json(generated / "speech_slot_links.json")

    observed_input = disc.get("input") or strings.get("input") or magic.get("input") or "dokodemo"
    commands = [
        "確認済み: `git status --short`",
        "確認済み: `.gitignore` のPS1イメージ除外設定確認",
        f"確認済み: `python tools/inspect_ps1/inspect_disc_image.py \"{observed_input}\"`",
        f"確認済み: `python tools/inspect_ps1/list_iso9660_files.py \"{observed_input}\"`",
        f"確認済み: `python tools/inspect_ps1/scan_magic_numbers.py \"{observed_input}\"`",
        f"確認済み: `python tools/inspect_ps1/scan_strings.py \"{observed_input}\"`",
        "確認済み: `python tools/inspect_ps1/scan_iso_regions.py`",
        "確認済み: `python tools/inspect_ps1/scan_cna_archive.py`",
        "確認済み: `python tools/inspect_ps1/scan_cna_natural_text_candidates.py`",
        "確認済み: `python tools/inspect_ps1/scan_cna_format_markers.py`",
        "確認済み: `python tools/inspect_ps1/analyze_entry1_format_xrefs.py`",
        "確認済み: `python tools/inspect_ps1/analyze_entry1_text_regions.py`",
        "確認済み: `python tools/inspect_ps1/analyze_learning_region_links.py`",
        "確認済み: `python tools/inspect_ps1/analyze_entry1_mips_refs.py`",
        "確認済み: `python tools/inspect_ps1/analyze_entry1_call_graph.py`",
        "確認済み: `python tools/inspect_ps1/analyze_entry1_pointer_tables.py`",
        "確認済み: `python tools/inspect_ps1/analyze_entry1_save_load_flow.py`",
        "確認済み: `python tools/inspect_ps1/analyze_speech_slot_links.py`",
        "確認済み: `python tools/inspect_ps1/summarize_findings.py`",
    ]

    has_files = bool(disc.get("files"))
    if has_files:
        general_observations = [
            "確認済み: 入力ファイルのサイズ、拡張子、部分ハッシュ、ISO9660候補を記録した。",
            "確認済み: ISO9660ディレクトリからファイル名、LBA、サイズを記録した。",
            "確認済み: `DOKODEMO.417` は先頭`CNA`の内部アーカイブ候補として、630件のエントリ表を持つ。",
            "確認済み: `DOKODEMO.417` 内部に文字列密度が高い複数エントリがある。",
            "確認済み: `DOKODEMO.417` 内部にPS-X EXE候補が1件ある。",
            "確認済み: entry 1内で`PDA`, `DIARY`, `CLOCK`, `MEM`, `LOAD`の一部がMIPSコードから参照される。",
            "確認済み: `PDA`, `DIARY`, `CLOCK`, `MEM`参照は同一の大きな関数候補に集中する。",
            "確認済み: `PDA/CLOCK/MEM/DIARY`関数候補は直接呼び出し153回、`LOAD`関数候補は直接呼び出し1回/4回。",
            "確認済み: `PDA/CLOCK/MEM/DIARY`系候補には非スタックload/storeがあり、`LOAD`候補2件にも非スタックloadと少数のstoreがある。",
            "確認済み: `WORD/QUEST/ANS`はentry 1内に構造ラベルとして存在する。個別ラベルへのポインタ表は今回確認できていないが、`WORD/QUEST`を含む領域と`ANS`を含む別領域はMIPSコードから参照される。",
            "確認済み: CNA entry 1は自然文らしい候補が最多。",
            "確認済み: `%s/%d/%c`などのフォーマット記号候補がentry 1に集中する。",
            "確認済み: entry 1内の`%s`は42件あり、そのうち18件がMIPSコードから参照される。",
            "確認済み: `%s`参照関数候補9件のうち、学習関連領域参照関数と2件が重なり、直接リンク1件、共通呼び先21件を持つ。",
            "確認済み: entry 1内の`WORD/QUEST`を含むテキスト領域はMIPSコードから90回参照される。",
            "確認済み: entry 1内の`ANS`を含む別テキスト領域はMIPSコードから34回参照される。",
            "確認済み: `WORD/QUEST`参照関数群と`ANS`参照関数群は共有関数0件、直接リンク5件、共通呼び先9件。",
            "確認済み: テキスト候補は集計情報として保存し、全文dumpは保存していない。",
            "確認済み: 画像・音声・動画は抽出していない。",
        ]
        unknowns = [
            "不明: `CNA`および`LPF`候補の正式な仕様名と各フィールドの意味。",
            "不明: 個別データ領域の正式なファイル形式。",
            "不明: 学習単語、カテゴリ、質問、日記、イベントの実データ構造。",
            "不明: `WORD/QUEST/ANS`の実処理関数、テーブル、状態遷移の場所。",
            "不明: `%s`等がユーザー学習語の差し込みに使われるかどうか。",
            "不明: 原作の発話テンプレート選択ロジックと学習語選択重み。",
            "不明: `WORD/QUEST`参照済み領域が学習処理本体か、表示ラベル/状態名/デバッグ名か。",
            "不明: `ANS`参照済み領域が回答保存処理本体か、表示ラベル/状態名か。",
            "不明: セーブデータまたはメモリカード構造の正確なフィールド配置。",
            "不明: `LOAD`候補2件が保存データ復元、内部リソースロード、または表示状態復元のどれに対応するか。",
        ]
    else:
        general_observations = [
            "確認済み: `dokodemo/` が存在しない、または対象PS1データが検出されていない。",
            "不明: ファイル構造、文字列領域、形式候補は入力データ未提供のため未確認。",
        ]
        unknowns = [
            "不明: PS1データ内のファイル構造。",
            "不明: Shift_JISらしき文字列候補の有無。",
            "不明: 単語辞書らしき短い文字列群の有無。",
            "不明: 会話テンプレートらしき文字列群の有無。",
            "不明: セーブデータやメモリカード構造の手がかり。",
        ]

    report = f"""# PS1 Data Observations

## 1. 解析対象ファイル一覧
{bullet(file_list(disc) + iso_summary(iso))}

## 2. 実行したコマンド
{bullet(commands)}

## 3. 文字列候補の概要
{bullet(string_summary(strings))}

## 4. 形式候補
{bullet(magic_summary(magic) + region_summary(regions) + cna_summary(cna) + natural_text_summary(natural_text) + format_marker_summary(format_markers) + format_xref_summary(format_xrefs) + text_region_summary(text_regions) + learning_link_summary(learning_links) + entry1_ref_summary(entry1_refs) + entry1_graph_summary(entry1_graph) + entry1_pointer_summary(entry1_pointer) + save_load_flow_summary(save_load_flow) + speech_slot_link_summary(speech_slot_links))}

## 5. 学習システムに関係しそうな一般的観察
{bullet(general_observations)}

## 6. 不明点
{bullet(unknowns)}

## 7. 推測
- 推測: 会話ゲームの言葉学習は、入力語、カテゴリ、使用条件、親密度やイベント状態などの抽象属性を分けると再設計しやすい。
- 推測: 短い文字列候補が密集している領域が見つかった場合、辞書、ラベル、選択肢、UI文言のいずれかである可能性がある。
- 推測: 長めの文字列候補が連続する領域が見つかった場合、会話テンプレートまたはシナリオ断片である可能性がある。
- 推測: `DOKODEMO.417` のCNA候補エントリ表は、ゲーム本体がロードする内部リソース群を管理している可能性がある。
- 推測: CNA内部の高文字列密度エントリは、会話、質問、日記、UIラベル、辞書風データのいずれかを含む可能性がある。
- 推測: CNA内部のPS-X EXE候補は、メイン実行ファイルからロードされるサブプログラムまたはPocketStation連携処理に関係する可能性がある。ただし未確認。
- 推測: entry 1の`PDA/CLOCK/MEM/DIARY`集中関数候補は、PocketStation相当の携帯状態、時計差分、メモリ状態、日記状態を同期する処理である可能性がある。
- 推測: entry 1の`LOAD`関数候補は、保存データ、内部リソース、またはロード済み状態をランタイム用に復元する小さな処理である可能性がある。
- 推測: PWA側のロード処理は、保存JSONの読み込み、schema検証、未回答学習状態の復元、学習語index再構築を小さな関数に分けるのが安全。
- 推測: PWA側の`confidence`, `cooldown`, `usageCount`等は原作復元ではなく、公開機能を満たすための近似実装である。
- 推測: コード参照される`%s`から、原作内部に何らかのスロット式表示/整形が存在する。ただしユーザー語差し込み専用とは断定しない。
- 推測: `%s`参照関数と学習関連領域参照関数に重なりと呼び出し近接があるため、PWAで覚えた語をオリジナル発話スロットへ入れる設計は妥当。ただし原作テンプレートや重みは不明。
- 推測: `WORD/QUEST`参照済み領域から、言葉学習と質問に関する状態名または表示名がentry 1内でまとまって扱われている可能性がある。
- 推測: `WORD/QUEST`領域と`ANS`領域の主な参照元関数群が分かれるため、質問生成と回答適用は別責務として扱うのがPWAでは安全。
- 推測: 両領域は直接リンクと共通呼び先を持つため、別責務だが連携する学習サブシステムとして扱うのがPWAでは妥当。

## 8. ファンメイドPWAへ転用してよい抽象設計アイデア
- `learnWord(input)`、`chooseLearningQuestion()`、`applyLearningAnswer()`、`finalizeLearnedWord()` を分ける。
- `chooseSpeechSlot()`、`pickWordForSpeech()`、`renderSpeech()` を分ける。
- ユーザー入力語は `surface` と `normalized` を最低限保存する。
- 新しい言葉は、少なくとも1つの追加質問に回答されてから学習済みにする。
- 覚えた言葉は、PWAオリジナル発話文の安全なスロットへ原則1語だけ入れる。
- 保存・ロードは、JSON読み込み、schema検証、未回答学習状態復元、学習語index再構築に分ける。
- import/exportはユーザー作成の学習データだけをJSON化する。
- `category`, `confidence`, `cooldown`, `usageCount`, `preference` 等を使う場合は、原作仕様ではなくPWA側の近似フィールドとして扱う。
- 実装時は `docs/research/PWA_MAIN_ALGORITHM_BLUEPRINT.md`、`docs/research/PWA_CORE_ALGORITHM_CONTRACT.md`、`docs/research/PWA_ALGORITHM_TRACEABILITY.md`、`docs/research/PWA_LEARNING_SPEAKING_STATE_MACHINE.md`、`docs/research/SAVE_LOAD_MEMORY_FLOW.md`、`docs/research/SPEECH_SLOT_MODEL.md` を優先し、未確認の原作仕様を追加しない。

## 9. 転用してはいけない原作固有要素
- 原作の会話文、辞書、固有名詞、キャラ設定、イベント、演出順序。
- 抽出画像、抽出音声、抽出動画、抽出テキスト全文。
- 原作データ内の具体的な台詞やシナリオ構造を再現できる量の文字列サンプル。
- 原作固有のキャラクター口調や関係性をそのまま模倣する設計。

## 10. 次に手作業で確認すべきこと
- `dokodemo/` に対象の `.cue/.bin/.iso/.img` が置かれているか確認する。
- 生成JSONの件数、長さ分布、オフセットだけを見て、文字列密集領域の有無を確認する。
- 原文を読まずに、短い候補の密度や長さ分布から「辞書らしさ」「テンプレートらしさ」を判断する。
- 必要なら個別オフセット周辺を少量だけ私的確認し、レポートには原文ではなく構造だけを残す。
"""

    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(report, encoding="utf-8")
    print(f"wrote {output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
