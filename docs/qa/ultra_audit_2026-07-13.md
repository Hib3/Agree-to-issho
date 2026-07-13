# 統合品質監査 2026-07-13

## 開始状態

- 開始SHA: `5577435238c92a62b8c0737971231cbe586d425b`
- 作業ブランチ: `rewrite/ultra-aguri-news-language-quality`
- 元ブランチへ直接変更していない。
- 原作データ、動画フレーム、抽出テキスト、私有口調JSONをcommit対象へ入れていない。

## Baseline

確認済み:

- lint、typecheck、data validation、clean-room verification、unit test、dialogue test、build、PWA verification、Playwright 10件は開始時点で成功した。
- format checkは既存74ファイルで失敗した。品質ゲートを弱めず、Prettierによる機械整形で解消する。
- IndexedDB実体はversion 3だが、デバッグ表示はversion 2だった。
- RSSの取得タイマーはheader受信後に解除され、本文ストリームを時間制限できていなかった。
- RSS更新で`discussedAt`が失われ、削除中の更新結果が再保存される競合余地があった。
- ニュース会話は見出し、説明、カテゴリ、学習語を別々に読む構成で、事実・推測・主観の型がなかった。

不明:

- 原作内部アルゴリズムは不明。実装は動画出力から抽象化したclean-room設計であり、内部仕様の再現を断定しない。
- 開始時点の旧ニュース会話について、人手による自然さの定量評価は未実施。

## 専門監査の主要所見

1. 状態管理: malformed session、回答二重送信、学習二重確定、replace import残留、RSS競合。
2. 日本語/NLG: 語彙形態情報不足、カテゴリ確認対象不足、引用内の口調破壊、未実装スロット制約。
3. 物語: 5拍のturn欠落、400件の機構追跡不足、callback検査不足。
4. 口調: 引用語改変、感情差の消失、句読点重複。
5. RSS: 候補無検証、同意一括化、RDF/content:encoded/xml:base不足、エラー分類不足。
6. ニュース: contentLevel、根拠、主観所有者、センシティブ制御の不足。
7. QA: StrictMode、複数タブ、削除中更新、記事切替、CI監査資料の不足。

## 実装後の確認値

- 10,000会話: NarrativePlanの拍欠落0、callback不整合0、11種のオチ機構を使用。
- ニュース150件: 一般100、センシティブ50、完全重複率0、センシティブ空想0、headline-only本文断定0。
- ニュースcontentLevel: headline-only 50、feed-summary 50、article-extract 50。
- ニュース会話レンズ: learned-word 54、practical-change 86、uncertainty 10。
- 学習語接続率36%、CharacterOpinion使用率100%。
- 「気になります」だけの汎用感想率0、「元の記事」を定型末尾へ置く率0。

上記は固定合成コーパスの自動検査値であり、自然な日本語・アグリらしさを証明しない。`npm run audit:golden`の全件は`要人間確認`である。

## ロールバック単位

- `6780a1a`: 口調の意味保持
- `77625dd`: 質問と記憶更新の一致
- `f69057f`: LexicalProfileと安全な語形
- `e762b34`: 引用外句読点
- `026f90f`: NarrativePlan
- `a17dfd6`: RSS探索・更新
- `12c9bbf`: 記事Digest・ニュース会話

後続コミットは状態競合、CI、文書、機械整形を分離する。
