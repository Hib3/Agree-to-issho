# Aguri Asset Pipeline Log

## 2026-07-08

- User-provided reference image was copied into `aguri_base_fullbody.png`.
- The same design was copied into `approved/aguri_normal.png` as the only approved in-game standing asset.
- Broken or unreviewed `char_main_*.png` assets and the failed expression sheet were moved into `rejected/`.
- The old `char_main_idle_normal.jpeg` reference copy was also moved into `rejected/` after the transparent approved PNG was created.
- `aguri_base_fullbody.png` and `approved/aguri_normal.png` were converted to transparent PNG by removing only connected near-white background from the outside.
- `assetManifest.ts` was changed so only `status: "approved"` assets can render.
- 2026-07-12: identity-preserving variants were generated one file at a time and reviewed for hat, hair colors, blue eyes, zigzag teeth, hoodie, skirt, socks, both legs and both boots.
- Approved runtime variants: `aguri_talk_happy.png`, `aguri_thinking.png`, `aguri_confused.png`, `aguri_sleepy.png`.
- A magenta-key attempt was rejected because despill desaturated the purple hoodie. Approved variants use a narrowly keyed green background removal instead.
- Generated runtime backgrounds: room day/evening/night, neighborhood street, rooftop evening. Generated UI textures: dialogue paper, choice paper, primary fabric.
- Additional one-image prompts are stored under `docs/assets/imagegen-prompts/`; missing variants continue to use an approved semantic fallback.
- Image generation was attempted for a smile candidate. The generated candidates were not approved because the jagged teeth were weakened or missing, and two candidates were multi-pose sheets with text.

不明:
- 差分素材の正式品質はまだ未確認。
- 透明化後の細部は自動処理のため、最終公開前に手作業の目視確認が必要。
