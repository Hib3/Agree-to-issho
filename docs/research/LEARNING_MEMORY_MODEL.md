# Learning Memory Model

## Status

この文書は広域の記憶モデルメモ。
現在の実装判断では、メイン機能である「言葉の学習」「覚えた言葉を使う発言」「学習データのimport/export」だけを対象にする。

実装時は次を優先する。

- `docs/research/PWA_CORE_ALGORITHM_CONTRACT.md`
- `docs/research/PWA_LEARNING_SPEAKING_STATE_MACHINE.md`
- `docs/research/SAVE_LOAD_MEMORY_FLOW.md`

この文書内の profile、日記、携帯状態、イベント系の項目は参考情報であり、現段階のPWA中核仕様ではない。

## 確認済み

- PS1ディスクはISO9660として読める。
- ISO内の主要ファイルは `SCPS_100.92` と `DOKODEMO.417`。
- `DOKODEMO.417` は先頭 `CNA` の内部アーカイブ候補で、630件の内部エントリ表を持つ。
- `DOKODEMO.417` 内には文字列密度が高い内部エントリが複数ある。
- `SCPS_100.92` と `DOKODEMO.417` 内部にPS-X EXE候補がある。
- 原文テキスト、画像、音声、動画は抽出していない。

## 不明

- 原作の単語保存テーブルの正確な場所。
- 原作の単語カテゴリ、質問カテゴリ、日記、イベントのバイナリ構造。
- 原作のセーブデータ、PocketStation転送データ、メモリカード領域の正確な構造。
- `CNA` と `LPF` 候補の正式仕様。

## 推測

- `DOKODEMO.417` は、会話、UI、画像、音声制御、サブプログラムなどをまとめた内部リソースアーカイブの可能性がある。
- 文字列密度が高いCNA内部エントリは、会話、質問、日記、UI文言、辞書風データの候補。
- 内部PS-X EXE候補は、メイン実行ファイルからロードされる追加処理、またはPocketStation連携に関係する可能性がある。ただし未確認。

## PWA用の抽象データ構造

```json
{
  "schemaVersion": 1,
  "profile": {
    "createdAt": "ISO datetime",
    "currentDay": 1,
    "lastPlayedAt": "ISO datetime",
    "affinity": 0,
    "mood": "neutral"
  },
  "learnedWords": [
    {
      "id": "local id",
      "surface": "user input",
      "normalized": "normalized input",
      "category": "food/place/person/action/feeling/time/thing/unknown",
      "source": "user_taught",
      "confidence": 0.5,
      "likeScore": 0,
      "createdAt": "ISO datetime",
      "lastUsedAt": null,
      "usageCount": 0,
      "cooldownUntil": null,
      "correctionCount": 0
    }
  ],
  "conversationState": {
    "pendingQuestion": null,
    "recentTopics": [],
    "recentWordIds": [],
    "usedTemplateKindsToday": []
  },
  "dailyLog": [],
  "portableState": {
    "queuedPrompts": [],
    "offlineLearnedWordIds": [],
    "lastSyncedAt": "ISO datetime"
  }
}
```

## セーブ方式

- IndexedDBを主保存先にする。
- `schemaVersion` を必ず持つ。
- 保存単位は `profile`, `learnedWords`, `conversationState`, `dailyLog`, `portableState` に分ける。
- 会話1ターンごとに軽量保存し、日付変更や単語学習完了時に確定保存する。
- 保存時に `updatedAt` と簡易チェックサムを持たせ、破損時は直前スナップショットへ戻せるようにする。

## ロード方式

1. `schemaVersion` を確認する。
2. 必要ならマイグレーションする。
3. `profile.lastPlayedAt` と現在時刻の差分を計算する。
4. 日付が変わっていれば、日記候補、気分、親密度、未使用単語の重みを更新する。
5. `pendingQuestion` があれば回答待ち状態を復元する。
6. `portableState` に未同期の学習語があれば `learnedWords` に統合する。
7. 会話生成用の短期キャッシュを再構築する。

## 単語使用アルゴリズム

1. 現在の会話目的を選ぶ。
   - 新語を聞く
   - 覚えた語を確認する
   - 日記に使う
   - しりとり風に使う
   - 感情反応に使う
2. 候補単語をカテゴリ、最近性、信頼度、クールダウンで絞る。
3. スコアを計算する。
   - `confidence` が高いほど上げる。
   - `lastUsedAt` が近すぎる語は下げる。
   - `usageCount` が少ない語は少し上げる。
   - 現在の話題カテゴリに合う語を上げる。
   - ユーザーが好きと答えた語を上げる。
4. 最上位だけでなく、重み付きランダムで選ぶ。
5. 使用後に `usageCount`, `lastUsedAt`, `recentWordIds`, `cooldownUntil` を更新する。

## 学習フロー

1. ユーザーが単語を入力する。
2. 正規化して重複を確認する。
3. 不明カテゴリなら質問する。
4. 好き嫌い、対象、使い道などを選択肢で補足する。
5. `confidence` を初期化して保存する。
6. 後の会話で使い、ユーザー訂正があればカテゴリと信頼度を更新する。

## 転用しないもの

- 原作の会話文。
- 原作の辞書内容。
- 原作キャラクター設定。
- 原作イベント構成。
- 原文を復元できる文字列dump。
