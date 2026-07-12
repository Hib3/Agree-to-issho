# Clean-room Decisions

## Product Boundary

- The game is an offline authored conversation game, not a general AI chat.
- Player classifications are treated as truth. Starter knowledge never overwrites a user classification.
- Controlled mismatch may alter one relation in a story, while grammar and all other roles remain coherent.
- Original game names, dialogue, dictionaries, events, UI, media, and extracted text are excluded.

## Runtime

- React and Zustand own UI state only.
- Pure TypeScript domain modules own learning, planning, grammar, memory, diary, and scheduling.
- Dexie database `aguri-cleanroom-v1` is separate from the read-only legacy database.
- Zod validates datasets, database records, and backup files at runtime.
- Seeded random sources make every planner test reproducible.

## Assets

- Only the approved `aguri_normal.png` character image is reused.
- Character mood uses CSS motion and labels until additional images are explicitly approved.
- Room, street, and rooftop are original CSS illustration scenes, not copies of existing game locations.

## Video Evidence Boundary

The supplied gameplay video was sampled privately at five-second intervals. It confirms abstract interaction patterns: contextual word prompts, typed input, category and attribute questions, person naming and relationship questions, later multi-word recall, short paged conversations, response choices, and location/time changes. Exact dialogue, vocabulary, layouts, characters, and event content are not reused.
