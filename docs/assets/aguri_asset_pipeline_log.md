# Aguri Asset Pipeline Log

## 2026-07-08

- User-provided reference image was copied into `aguri_base_fullbody.png`.
- The same design was copied into `approved/aguri_normal.png` as the only approved in-game standing asset.
- Broken or unreviewed `char_main_*.png` assets and the failed expression sheet were moved into `rejected/`.
- The old `char_main_idle_normal.jpeg` reference copy was also moved into `rejected/` after the transparent approved PNG was created.
- `aguri_base_fullbody.png` and `approved/aguri_normal.png` were converted to transparent PNG by removing only connected near-white background from the outside.
- `assetManifest.ts` was changed so only `status: "approved"` assets can render.
- All expression requests currently fallback to `aguri_normal.png` unless a reviewed expression asset is approved later.
- Image generation was attempted for a smile candidate. The generated candidates were not approved because the jagged teeth were weakened or missing, and two candidates were multi-pose sheets with text.

不明:
- 差分素材の正式品質はまだ未確認。
- 透明化後の細部は自動処理のため、最終公開前に手作業の目視確認が必要。
