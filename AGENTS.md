# AGENTS.md

- 日本語で簡潔に回答する。
- 不明点は推測せず「不明」と書く。
- 変更は最小差分にする。
- 原作データ、抽出画像、抽出音声、抽出テキスト全文をcommitしない。
- `docs/research/generated/`、`research_private/`、`dokodemo/`、PS1イメージファイルをcommitしない。
- 原作会話文、辞書、キャラ設定、口調、イベントを実装に使わない。
- 現段階の対象は、オフライン複数ターン会話、会話履歴、言葉学習、日記、軽量な生活状態、import/export、デバッグ・シミュレーションテスト。
- 外部LLM、音声、原作イベントの再現、実画像差分、ZIPバックアップ、複数キャラは実装しない。
- 完了前に `npm run typecheck` と `npm run build` を通す。

## Dialogue quality contract

- 会話変更では `npm run test:dialogue`、`npm run test`、`npm run typecheck`、`npm run build` を実行する。
- 裸の指示語を含む発話を生成せず、指示語には構造化された参照対象を持たせる。
- 根拠のない単語ペアを関係ありとして扱わず、カテゴリ差だけを関係の根拠にしない。
- 質問意図、選択肢、記憶更新を一致させ、会話操作と意味回答を分離する。
- navigation-only回答では単語記憶を変更しない。
- relation未確認の段階で `WordRelation` を作らない。
- 口調変換層は意味スロット、否定、疑問対象、関係を変更しない。
- session保存・復元後もpropositionを保持し、legacy sessionは安全に無効化または移行する。
- 固定乱数による大量回帰テストを維持する。
- Service Workerとbuild idを確認してから公開版を評価する。
