# Legacy Snapshot

- Archived at: 2026-07-12
- Archived commit: `cfdf6e1f778fa60bcf2957887e5302a810377641`
- Archive branch: `archive/pre-zero-rebuild-20260712`
- Archive tag: `pre-zero-rebuild-20260712`
- New work branch: `rewrite/cleanroom-v1`

The archive branch and tag were pushed to `origin` before replacing any runtime files.

## Legacy IndexedDB

- Database name: `with-agree-db`
- Version: `3`
- Stores: `profile`, `character_state`, `words`, `word_relations`, `dialogue_logs`, `conversation_sessions`, `dialogue_summaries`, `event_flags`, `diary_entries`, `settings`, `import_backups`, `asset_manifest_cache`

The clean-room app must never upgrade, clear, or delete this database. Migration is an explicit read-only preview followed by a transaction into the new database.

## Runtime Asset Inventory

- Approved character image: `public/assets/characters/main/fullbody/approved/aguri_normal.png`
- Legacy room backgrounds: not reused by the clean-room UI
- No additional expression image is approved

Video files, extracted frames, PS1 data, research dumps, and unapproved generated assets are not runtime assets and remain excluded from Git.
