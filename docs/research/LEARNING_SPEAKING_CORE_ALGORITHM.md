# Learning and Speaking Core Algorithm

## 目的

PWAファンゲームのメイン機能である「ユーザーの言葉を覚える」「覚えた言葉を使って会話する」を、原作機能から大きく外れない範囲で整理する。

この文書では、日記、携帯モード、ミニゲーム、イベント、部屋演出は扱わない。

保存・ロードの境界は `docs/research/SAVE_LOAD_MEMORY_FLOW.md` を優先する。

## 確認済み

- 原作の主機能は、ユーザーが言葉を教え、キャラクターがその言葉を会話に使うこと。
- 言葉入力後に、その言葉が何を表すか、どれくらい好きか等の追加質問が行われる。
- entry `1` 内には `WORD`, `QUEST`, `ANS` 系のASCII構造ラベルが存在する。
- 個別ラベルのポインタ表は確認できていないが、`WORD/QUEST`を含む領域と`ANS`を含む領域はコードから参照される。
- 追加の範囲クラスタ解析では、`WORD` 5件、`QUEST` 22件を含むentry `1`内の範囲 `0x80010f4c..0x8001174b` がMIPSコードから90回参照される。
- したがって、単語/質問系の構造ラベルを含む参照済みテキスト領域は確認済み。
- `ANS` 2件を含むentry `1`内の範囲 `0x80010a50..0x80010ea7` もMIPSコードから34回参照される。
- `WORD/QUEST`領域と`ANS`領域は主な参照元関数群が分かれている。
- `WORD/QUEST`参照関数群と`ANS`参照関数群の共有関数は0件だが、直接リンク5件、共通呼び先9件がある。
- 自然文らしいShift_JIS候補はCNA entry `1` が最多で、37件。
- `DOKODEMO.417` 全体に `%s/%d/%c` などのフォーマット記号候補があり、entry `1` に143件、entry `1005` に21件が集中する。
- entry `1` 内の `%s` は42件あり、そのうち18件はMIPSコードから参照されている。
- よって、entry `1` 内で何らかの文字列スロット整形が使われていることは確認済み。

## 不明

- 原作の単語レコード構造。
- 原作の単語カテゴリ一覧。
- 原作の質問選択ロジック。
- 原作の回答保存形式。
- 原作の発言テンプレート選択ロジック。
- 原作の覚えた言葉の選択重み。
- `%s` がユーザー学習語の差し込みに使われるかどうか。
- 自然文候補が実際の会話文、質問文、デバッグ文、UI文のどれか。
- `WORD/QUEST`参照済み領域が、学習フロー本体か、表示ラベル/メニュー/デバッグ名か。
- `ANS`参照済み領域が、回答処理本体か、カード/メモリ関連の表示ラベルか。

## 採用してよい機能レベルの理解

```text
言葉を教える
  -> 言葉を保存する
  -> その言葉について追加質問する
  -> 回答を言葉の属性として保存する

会話する
  -> 会話の中で使えそうな覚えた言葉を選ぶ
  -> オリジナルの発話文にその言葉を入れる
  -> 使った履歴を更新する
```

これは原作内部コードの完全復元ではなく、公開されている機能と解析済み構造ラベルから外れない最小モデル。
ただし、`WORD/QUEST`を含む参照済み領域と、`ANS`を含む別の参照済み領域があるため、言葉学習、質問、回答に関係する状態名または表示名がentry `1`内で分かれて扱われている可能性は高い。

## PWA最小データ

```ts
type LearnedWord = {
  id: string;
  surface: string;
  normalized: string;
  meaningKind: "person" | "place" | "thing" | "action" | "feeling" | "time" | "unknown";
  preference: "like" | "neutral" | "dislike" | "unknown";
  learnedAt: string;
  lastUsedAt?: string;
  usageCount: number;
};

type LearningState = {
  pendingWord?: LearnedWordDraft;
  pendingQuestion?: LearningQuestion;
  pendingAnswer?: LearningAnswer;
  learnedWords: LearnedWord[];
};
```

注意:

- `meaningKind`, `preference`, `usageCount`, `lastUsedAt` は原作フィールド確認済みではない。
- 追加質問と後の会話利用をPWAで成立させるための最小近似。
- 原作と同じカテゴリ名、質問文、会話文は使わない。

## 学習アルゴリズム

```ts
function beginLearning(input: string, state: LearningState): LearningStep {
  const normalized = normalizeUserWord(input);
  const existing = findByNormalizedWord(state.learnedWords, normalized);

  if (existing) {
    return {
      kind: "already_known",
      wordId: existing.id,
      nextQuestion: chooseReviewQuestion(existing)
    };
  }

  const draft = createDraftWord(input, normalized);
  return {
    kind: "ask_meaning",
    pendingWord: draft,
    nextQuestion: {
      kind: "meaningKind",
      choices: ["person", "place", "thing", "action", "feeling", "time", "unknown"]
    }
  };
}
```

```ts
function answerLearningQuestion(answer: LearningAnswer, state: LearningState): LearningStep {
  const draft = applyAnswerToDraft(state.pendingWord, answer);

  if (!draft.meaningKind) {
    return askMeaningKind(draft);
  }

  if (!draft.preference) {
    return askPreference(draft);
  }

  const learned = finalizeLearnedWord(draft);
  return {
    kind: "learned",
    word: learned
  };
}
```

実装上も、質問を作る処理と回答を適用する処理は分ける。
これは原作内部で`WORD/QUEST`領域と`ANS`領域の主な参照元関数群が分かれつつ、直接リンクと共通呼び先で連携していることに合わせるため。

## 発言アルゴリズム

原作側にコード参照される `%s` があるため、文字列スロット整形は確認済み。
ただし、ユーザー語差し込み専用かは不明。
PWAでは「覚えた言葉を安全なスロットへ1語だけ入れる」最小設計に留める。

```ts
function speakWithLearnedWords(context: TalkContext, state: LearningState): TalkResult {
  const slot = chooseTalkSlot(context);
  const word = pickLearnedWord(slot, state.learnedWords);
  const utterance = renderOriginalUtterance(slot, word);

  if (word) {
    markWordUsed(word, context.now);
  }

  return { utterance, usedWordId: word?.id };
}
```

`pickLearnedWord()` は原作重みの復元ではない。
PWAでは、原作機能から外れない最小条件だけ使う。

```ts
function pickLearnedWord(slot: TalkSlot, words: LearnedWord[]): LearnedWord | null {
  const candidates = words.filter((word) => word.meaningKind === slot.meaningKind);
  if (candidates.length === 0) return null;
  return leastRecentlyUsed(candidates);
}
```

最初は複雑なスコアリングを使わない。
原作重みが未確認のため、過剰な独自性を避ける。

## 発話文生成の制約

- 原作文は使わない。
- 原作キャラ口調は使わない。
- 原作の質問文は使わない。
- 覚えたユーザー語を、PWAオリジナル文の空欄に入れる。
- 意味カテゴリが合わない場所には入れない。
- 1発話に入れる学習語は原則1語までにする。
- 未確認の複雑なスコアリングや複数語合成は使わない。
- スロット式は使ってよいが、原作テンプレートや原作文体は使わない。

## Import/Export前提

今の段階では実装しないが、保存データはJSONでimport/exportできる形にする。

```ts
type ExportData = {
  schemaVersion: number;
  learning: LearningState;
  exportedAt: string;
};
```

export対象はユーザーが教えた言葉とPWA側の学習属性だけ。
原作データ、原作文、抽出文字列は含めない。
