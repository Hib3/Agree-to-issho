# RSS実通信確認 2026-07-13

Windows側のPlaywright Chromiumを公開PWAのオリジンで起動し、ブラウザ内の`fetch`で実通信した記録です。記事本文やRSS本文は保存していません。

| 入力                   |   直接HTTP | ブラウザ直接取得  | rss2json   | Reader    | 確認結果              |
| ---------------------- | ---------: | ----------------- | ---------- | --------- | --------------------- |
| Yahoo!ニュース 主要RSS |  200 / XML | `Failed to fetch` | 422 / 0件  | 200 / 8件 | Reader補助が必要      |
| GIGAZINE RSS 2.0       |  200 / XML | `Failed to fetch` | 200 / 10件 | 未使用    | rss2jsonで取得可能    |
| Lifehacker Japan RSS   |  200 / XML | `Failed to fetch` | 200 / 10件 | 未使用    | rss2jsonで取得可能    |
| berss.com/feed         | 200 / HTML | `Failed to fetch` | 未確認     | 対象外    | RSS検索ツールのページ |

公開PWAのオリジン`https://hib3.github.io/Agree-to-issho/`から取得補助へ接続した結果は、Yahoo 8件、GIGAZINE 10件、Lifehacker 10件でした。Feedsearchによる`https://gigazine.net/`の候補検出は1件でした。

この確認は取得経路のCORS・応答形式・件数を対象にしています。今回のfeature branchをGitHub Pagesへ反映した後の画面操作は、push後に別途確認します。

## URL検出

- HTMLに `link rel="alternate"` がある場合はブラウザ内でRSS URLを検出する。
- CORSでサイトHTMLを読めない場合は、ユーザーが取得補助を有効にした時だけFeedsearchへサイトURLを送る。
- GIGAZINEのサイトURLからFeedsearchがRSS候補を1件返すことを実ブラウザで確認した。
- LifehackerのサイトURLによるFeedsearch候補検出は、この実ブラウザ試験では未確認。
- URLだけからRSSを断定できない場合は、登録せずエラーを表示する。

## 取得補助

1. ブラウザからRSSを直接取得する。
2. 失敗時だけrss2jsonを試す。
3. rss2jsonも失敗した場合だけReaderを試し、見出し・URL・日時・短い説明だけを抽出する。
4. 全経路で失敗した場合は、成功扱いにせず各補助のエラーを表示する。

外部補助はサービスの可用性やレート制限に依存します。アプリを閉じている間の定期取得は行いません。

再確認コマンドは`npm run test:rss:live`です。外部サービスに依存するため、必須CIには含めません。
