# Clean-room v1 Architecture

```text
React features -> Zustand UI store -> application services
                                -> pure domain functions
                                -> Dexie repositories
                                -> Workbox PWA shell
```

The domain layer has no React, DOM, Zustand, or Dexie imports.

## Domain Flow

1. `learningMachine` collects a normalized surface, player category, category attributes, stance, situation, and optional relation.
2. `conceptFactory` creates a validated user concept without consulting starter knowledge.
3. `planner` builds typed candidates from starter and user concepts.
4. `slotResolver` fills a semantic frame; `absurdityController` may replace at most one relation.
5. `japaneseRealizer` renders bounded pages and `repetitionGuard` applies template and concept-tuple cooldowns.
6. Player responses update relations and memory events.
7. Salience controls recall frequency without deleting important memory.
8. Diaries summarize actual persisted dialogue and memory events only.

## Persistence

The new Dexie database is `aguri-cleanroom-v1`, schema version 1. Legacy data is detected and read through a separate importer. Backup imports are parsed and checked before any write; replacement and merge occur in a transaction with a pre-import backup.
