# PS1 Data Inspection Tools

Clean-room oriented helpers for observing PS1 disc images without extracting
original assets or committing copyrighted data.

## Safety Rules

- Do not commit `.bin`, `.iso`, `.cue`, `.img`, `.sub`, `.ccd`, `.chd`, or files
  under `research_private/` or `dokodemo/`.
- These tools do not modify input files.
- These tools do not extract images, audio, video, or full text dumps.
- Generated outputs go under `docs/research/generated/`, which is ignored by Git.
- Reports should preserve only structural observations and abstract design ideas.

## Typical Workflow

From the repository root:

```powershell
python tools/inspect_ps1/inspect_disc_image.py dokodemo
python tools/inspect_ps1/list_iso9660_files.py dokodemo
python tools/inspect_ps1/scan_magic_numbers.py dokodemo
python tools/inspect_ps1/scan_strings.py dokodemo
python tools/inspect_ps1/scan_iso_regions.py
python tools/inspect_ps1/scan_cna_archive.py
python tools/inspect_ps1/scan_cna_natural_text_candidates.py
python tools/inspect_ps1/scan_cna_format_markers.py
python tools/inspect_ps1/analyze_entry1_format_xrefs.py
python tools/inspect_ps1/analyze_entry1_text_regions.py
python tools/inspect_ps1/analyze_learning_region_links.py
python tools/inspect_ps1/analyze_entry1_mips_refs.py
python tools/inspect_ps1/analyze_entry1_call_graph.py
python tools/inspect_ps1/analyze_entry1_pointer_tables.py
python tools/inspect_ps1/analyze_entry1_save_load_flow.py
python tools/inspect_ps1/analyze_speech_slot_links.py
python tools/inspect_ps1/summarize_findings.py
```

The final report is written to:

```text
docs/research/OBSERVATIONS.md
```

PWA implementation guidance is written to:

```text
docs/research/PWA_FAN_GAME_ALGORITHM_SPEC.md
docs/research/PWA_MAIN_ALGORITHM_BLUEPRINT.md
docs/research/SAVE_LOAD_MEMORY_FLOW.md
docs/research/SPEECH_SLOT_MODEL.md
```

## Notes

`scan_strings.py` stores counts, length distributions, encoding candidates, and
redacted sample metadata by default. Use `--include-short-samples` only for
private, local inspection when you are sure the result will not be committed.
