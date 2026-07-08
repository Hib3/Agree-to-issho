# Aguri Character Asset Spec

## 正本

- Base file: `public/assets/characters/main/fullbody/aguri_base_fullbody.png`
- First approved file: `public/assets/characters/main/fullbody/approved/aguri_normal.png`
- Current size: 640 x 959 px
- Current background: transparent PNG converted from the user-provided original reference.
- Transparency method: connected near-white background removed from the outside by chroma-key/flood-fill. Internal whites such as teeth, eye highlights, and ribbon must remain.

## 表示基準

- PWAで表示してよいのは `status: "approved"` の素材だけ。
- `pending`, `rejected`, `missing` は画面に出さない。
- 未承認差分や読み込み失敗時は `aguri_normal.png` へfallbackする。
- `CharacterStage` は1体だけを中央下寄せで表示する。
- CSS表示は `object-fit: contain` と `object-position: bottom center` を使う。
- 表示最大高さは画面側で制御し、素材をクロップしない。

## 差分制作ルール

- 1ファイル1ポーズ、1キャラクターのみ。
- 透明PNG、全身立ち絵、同一画角、同一余白、同一立ち位置。
- 背景つき、白背景残り、分裂、浮遊パーツ、靴だけ、顔だけ、別キャラ混入は不採用。
- スプライトシート一発生成は正式採用しない。
- 差分は1枚ずつ `pending/` へ置き、レビュー後に `approved/` へ移動する。
- Codexが画像生成しない場合は、画像を捏造せず `prompts/*.md` の作成だけを行う。

## 透明化レビュー

- 外周の白背景だけが透過されていること。
- 歯、目の白、リボン、紐などの明るいパーツが欠けていないこと。
- 輪郭周辺の白フチや除去漏れは、濃い背景と薄い背景の両方で確認すること。
- 小さな孤立ドットが目立つ場合は手作業で修正すること。
