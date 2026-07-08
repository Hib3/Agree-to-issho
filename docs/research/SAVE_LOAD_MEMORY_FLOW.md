# Save/Load Memory Flow

## Scope

対象はPWAのメイン機能に必要な保存・復元だけ。

- 学習済み単語を保存する。
- 未回答の学習質問を保存する。
- 起動時に学習状態を復元する。
- import/exportで同じ構造を検証する。

対象外:

- 原作メモリカードのバイナリ形式再現。
- PocketStation通信形式の再現。
- 原作の日記、イベント、ミニゲーム状態。
- 原作の質問文、会話文、辞書、キャラ設定。

## Confirmed Evidence

- entry `1` には `SAVE`, `LOAD`, `CARD`, `MCRD`, `MEM` 系の構造ラベルがある。
- `LOAD` を参照する関数候補は2件ある。
- `LOAD`候補2件は小さい処理塊で、サイズは96 bytesと236 bytes。
- `LOAD`候補2件の直接呼び出しはそれぞれ1回と4回。
- 追加解析では、`LOAD`候補2件に非スタックload合計11件、非スタックstore合計2件がある。
- `PDA/CLOCK/MEM/DIARY`を参照する大きな候補関数が1件ある。
- その候補関数は直接呼び出し153回、分岐175件、非スタックload 74件、非スタックstore 6件を持つ。
- 別の`DIARY`候補関数は非スタックload 5件、非スタックstore 8件を持つ。
- 解析結果は `docs/research/generated/entry1_save_load_flow.json` に保存されるが、Git ignore対象。

## Unknown

- 原作セーブデータのフィールド配置は不明。
- `LOAD`候補2件が、保存データ復元、内部リソースロード、表示状態復元のどれに対応するかは不明。
- `SAVE`ラベルは存在するが、今回のMIPS参照解析では直接のコード参照は確認できていない。
- メモリカードブロック名、チェックサム、圧縮、暗号化、スロット構造は不明。
- ユーザー学習語が原作内でどの配列・構造体に入るかは不明。

## Inference

- 推測: 原作は、保存済み状態をそのまま会話へ使わず、ロード時にランタイム用状態へ復元している可能性がある。
- 推測: 大きな`PDA/CLOCK/MEM/DIARY`候補は、携帯状態、時計差分、記憶、日記系状態をまとめて同期する制御関数の可能性がある。
- 推測: 小さい`LOAD`候補は、ロード後の部分復元ステップ、またはロード済みリソース/状態の確認ステップである可能性がある。

## PWA Contract

PWAでは、原作のバイナリ形式を再現しない。
ただし機能境界として、保存・検証・復元・index再構築を分ける。

```ts
function loadLearningSave(raw: unknown): LearningSave;
function validateLearningSave(raw: unknown): ValidLearningSave;
function restoreLearningRuntime(save: ValidLearningSave): LearningRuntime;
function rebuildLearnedWordIndexes(words: LearnedWord[]): LearnedWordIndex;
function persistLearningSave(state: LearningRuntime): LearningSave;
```

Required behavior:

- `loadLearningSave()` は永続層から読むだけ。
- `validateLearningSave()` はschemaVersion、配列、必須フィールドを検証する。
- `restoreLearningRuntime()` は未回答質問とdraft wordを復元する。
- `rebuildLearnedWordIndexes()` は保存データに持たせない検索用indexを再構築する。
- `persistLearningSave()` はユーザー学習状態だけを書き出す。

## Minimal Saved Data

```ts
type LearningSave = {
  schemaVersion: number;
  learnedWords: LearnedWord[];
  pendingLearning?: {
    draftWord: LearnedWordDraft;
    pendingQuestion: LearningQuestion;
  };
  updatedAt: string;
};
```

Rules:

- `learnedWords` はユーザー入力語とPWA独自メタデータだけを含む。
- `pendingLearning` はリロード後も質問待ち状態を復元するために保存する。
- 原作由来の台詞、辞書、テンプレート、アセット参照を含めない。
- export/importはこの構造を使い、研究JSONとは混ぜない。
