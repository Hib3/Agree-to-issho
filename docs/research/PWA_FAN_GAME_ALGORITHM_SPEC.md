# PWA Fan Game Algorithm Spec

## Status

この文書は広域モデルの旧ドラフト。
現在の実装判断では、日記、携帯モード、ミニゲーム、イベント、部屋演出を採用しない。

実装時は次を優先する。

- `docs/research/PWA_CORE_ALGORITHM_CONTRACT.md`
- `docs/research/PWA_ALGORITHM_TRACEABILITY.md`
- `docs/research/PWA_LEARNING_SPEAKING_STATE_MACHINE.md`
- `docs/research/SAVE_LOAD_MEMORY_FLOW.md`

この文書内の `diary`, `portable`, `snapshots`, `affectionWeight`, `usableInDiary`,
`usableInWordGame` などは、原作確認済み仕様ではなく、現段階のメイン機能実装にも不要。

## 目的

原作固有の会話文、辞書、キャラクター設定を使わず、確認済み構造と推測から、ファンメイドPWAで実装できる「言葉を覚えて使う」アルゴリズムを定義する。

現在の主対象は、言葉の学習機能と、覚えた言葉を使う発言機能。
日記、携帯モード、ミニゲーム、イベント、部屋演出は主機能外。

## 設計判断

- 原作内部の完全復元ではなく、機能的再設計にする。
- `PDA/CLOCK/MEM/DIARY` が同じ処理塊に見えるため、PWAでも「携帯モード同期」「時計差分」「記憶」「日記」を同じロード/同期パイプラインで扱う。
- `LOAD` 系処理は小さな関数候補に分かれるため、PWAでもロード、マイグレーション、復元を小さな関数に分ける。
- `WORD/QUEST/ANS` はentry `1`内に構造ラベルとして存在する。
- 追加解析で`WORD/QUEST`を含む参照済み領域は確認済み。ただし学習処理本体とは断定しない。
- `ANS`を含む別の参照済み領域も確認済み。ただし回答保存処理本体とは断定しない。
- `WORD/QUEST`参照関数群と`ANS`参照関数群は、別責務だが連携する構造に見える。
- PWAでは公開機能と参照済み構造ラベルに基づき、「言葉を教える/質問する/回答する」状態として扱う。
- 大きな同期パイプラインは制御だけを行い、単語選択、日記生成、保存復元は小さな関数へ委譲する。
- `confidence`, `cooldown`, `usageCount` などは原作仕様ではなく、PWA側の最小実装フィールド。
- メイン機能から外れる日記/携帯モード/イベントは、学習・発言の理解が固まるまで実装判断に使わない。
- 文字列スロット整形は確認済みなので、PWAでもオリジナル発話文の安全なスロットへ学習語を1語入れる方式は採用可能。

## データモデル

```ts
type SaveData = {
  schemaVersion: number;
  profile: ProfileState;
  memory: MemoryState;
  conversation: ConversationState;
  diary: DiaryState;
  portable: PortableState;
  snapshots: SaveSnapshotMeta[];
};

type LearnedWord = {
  id: string;
  surface: string;
  normalized: string;
  kanaHint?: string;
  category: WordCategory;
  subcategory?: string;
  affectionWeight: number;
  confidence: number;
  usageCount: number;
  lastUsedAt?: string;
  cooldownUntil?: string;
  learnedAt: string;
  source: "main" | "portable" | "correction";
  flags: {
    usableInTalk: boolean;
    usableInDiary: boolean;
    usableInWordGame: boolean;
    needsReview: boolean;
  };
};
```

注意: `category`, `affectionWeight`, `confidence`, `cooldownUntil` は原作からフィールド確認できたものではない。
PWAで「教えた言葉について質問し、後で使う」ための実装上の近似。

## ロード/同期アルゴリズム

これは保存/復元の補助設計。メインの学習/発言アルゴリズムではない。

```ts
async function boot(now: Date): Promise<GameRuntime> {
  const raw = await loadIndexedDbSave();
  const save = migrateOrCreate(raw);
  const portableDelta = await loadPortableDelta();
  const runtime = bootSyncPipeline(save, portableDelta, now);
  await persistSave(runtime.save);
  return runtime;
}

function bootSyncPipeline(save: SaveData, portableDelta: PortableDelta, now: Date): GameRuntime {
  const restored = restoreLoadedState(save);
  const merged = mergePortableDelta(restored, portableDelta);
  const elapsed = computeClockDelta(merged.profile.lastSeenAt, now);
  const daily = applyDailyTick(merged, elapsed);
  const diaryReady = applyDailyDiaryState(daily, elapsed);
  return rebuildRuntimeCaches(diaryReady);
}
```

### 重要ルール

- 起動直後に時計差分を必ず適用する。
- 日付が変わったら、気分、日記候補、単語の再使用重みを更新する。
- 携帯モードで覚えた単語や回答は、メイン保存にマージしてから会話キューを再構築する。
- 未回答質問がある場合は、新しい会話より回答復元を優先する。

## 処理分割

```ts
function restoreLoadedState(save: SaveData): SaveData {
  return {
    ...save,
    conversation: restoreConversationState(save.conversation),
    memory: restoreMemoryIndexes(save.memory),
    portable: restorePortableState(save.portable)
  };
}

function applyDailyDiaryState(save: SaveData, elapsed: ClockDelta): SaveData {
  if (!elapsed.dayChanged) return save;
  return {
    ...save,
    diary: rotateDiaryCandidates(save.diary, save.profile.currentDay),
    profile: updateMoodFromInteractionGap(save.profile, elapsed)
  };
}
```

`bootSyncPipeline()` は原作の大きな同期/初期化処理から得た抽象で、複数サブ処理を順番に呼ぶだけにする。
`restoreLoadedState()` は原作の小さい `LOAD` 関数候補から得た抽象で、保存データをランタイムで使える形へ戻すだけにする。
`applyDailyDiaryState()` は `DIARY` 単独関数候補から得た抽象で、日記と日次状態だけを扱う。

## 単語学習アルゴリズム

原作内部の正確な単語学習処理は未確認。
ここでは、公開機能として確認できる「入力語に追加質問を行い、後の会話で使う」流れだけを実装対象にする。
質問生成と回答適用は別関数にする。
これは原作内部の参照済み領域が`WORD/QUEST`側と`ANS`側で分かれていることに合わせた設計であり、原作の回答保存形式を再現するものではない。

```ts
function teachWord(input: string, context: TeachContext): TeachResult {
  const normalized = normalizeWord(input);
  const existing = findExistingWord(normalized);
  if (existing) return askReviewQuestion(existing);

  const word = createDraftWord(normalized, input);
  const question = chooseClassificationQuestion(word, context);
  return {
    nextState: "awaiting_word_classification",
    draftWord: word,
    prompt: question
  };
}
```

分類質問で保存する属性:

- 何の種類か
- 好き/普通/苦手
- 誰・何・どこ・いつ・行動・気持ちのどれに近いか
- 会話向きか、日記向きか、言葉遊び向きか

## 単語使用アルゴリズム

原作の単語選択重みは未確認。
下記はPWA独自の近似であり、原作アルゴリズムと呼ばない。
ただし、スロット式発話自体はentry `1`内のコード参照済み`%s`により機能境界として妥当。

```ts
function pickWordForSlot(slot: WordSlot, state: GameRuntime): LearnedWord | null {
  const candidates = state.save.memory.learnedWords
    .filter((word) => isUsableForSlot(word, slot))
    .filter((word) => !isCoolingDown(word, state.now))
    .filter((word) => word.confidence >= slot.minConfidence);

  const weighted = candidates.map((word) => ({
    word,
    score:
      categoryMatchScore(word, slot) +
      freshnessScore(word, state.now) +
      affectionScore(word, state.save.profile) +
      underusedBonus(word) +
      contextTopicBonus(word, state.save.conversation.recentTopics) -
      repetitionPenalty(word, state.save.conversation.recentWordIds)
  }));

  return weightedRandom(weighted);
}
```

### 使用後更新

```ts
function markWordUsed(word: LearnedWord, context: UseContext): void {
  word.usageCount += 1;
  word.lastUsedAt = context.now.toISOString();
  word.cooldownUntil = addMinutes(context.now, context.cooldownMinutes).toISOString();
  context.conversation.recentWordIds.push(word.id);
}
```

## 会話状態機械

```text
idle
  -> choose_interaction
  -> teach_word
  -> awaiting_word_classification
  -> awaiting_preference_answer
  -> save_learned_word
  -> recall_word_in_talk
  -> diary_candidate_update
  -> persist
  -> idle
```

優先順位:

1. 未回答質問の復元
2. 携帯モード差分の反映
3. 日付変更イベント
4. 新語学習
5. 覚えた語の再利用
6. 日記候補生成

## 日記アルゴリズム

現段階では主機能外。学習/発言が固まるまで実装しない。

```ts
function updateDiaryCandidate(event: TalkEvent, save: SaveData): void {
  if (!event.canBecomeDiary) return;
  const candidate = {
    day: save.profile.currentDay,
    topicWordIds: event.usedWordIds,
    mood: save.profile.mood,
    eventKind: event.kind,
    createdAt: event.at
  };
  save.diary.candidates.push(candidate);
}
```

日記本文は原作を参考にしない。PWA側で完全新規の文生成ルールを使う。

## 携帯モード

現段階では主機能外。将来のimport/exportや軽量入力UIの参考に留める。

PocketStation相当を、PWAでは「軽量オフライン画面」として扱う。

携帯モードでできること:

- 短い質問に答える
- 新しい単語を教える
- 最近覚えた単語を確認する
- 時間経過で気分を変える

同期データ:

```ts
type PortableDelta = {
  learnedWords: LearnedWordDraft[];
  answers: PendingAnswer[];
  seenAt: string;
  localEvents: PortableEvent[];
};
```

マージ順:

1. 重複語を正規化して統合
2. 回答を `pendingQuestion` に適用
3. 携帯モード中の時刻差分を反映
4. 会話キューと日記候補を再構築
5. 同期済みdeltaを消す

## 原作から持ち込まないもの

- 原作の単語リスト
- 原作の会話文
- 原作のキャラ設定
- 原作の日記文
- 原作イベント順
- 原作バイナリ構造を再現可能なデータ

## 実装チェックリスト

- IndexedDBに `SaveData` を保存する。
- `boot()` で必ず `load -> migrate -> restore -> portable merge -> clock diff -> diary state -> cache rebuild` を通す。
- 単語使用時に `usageCount`, `lastUsedAt`, `cooldownUntil` を更新する。
- 未回答質問はリロード後も復元する。
- 日記は単語IDとイベント種別から新規生成する。
- テキストは完全オリジナルのテンプレートだけを使う。
