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
