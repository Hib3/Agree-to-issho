# RSS実通信確認 2026-07-13

Windows側から実通信し、応答形式とブラウザCORS条件を確認した記録です。記事本文は保存していません。

| 入力                   |   直接HTTP | ブラウザ直接取得 | rss2json   | Reader           | 確認結果              |
| ---------------------- | ---------: | ---------------- | ---------- | ---------------- | --------------------- |
| Yahoo!ニュース 主要RSS |  200 / XML | CORS許可なし     | 422        | 200 / 見出し取得 | 第2補助が必要         |
| GIGAZINE RSS 2.0       |  200 / XML | CORS許可なし     | 200 / 10件 | 未使用           | 第1補助で取得可能     |
| Lifehacker Japan RSS   |  200 / XML | CORS許可なし     | 200 / 10件 | 未使用           | 第1補助で取得可能     |
| berss.com/feed         | 200 / HTML | RSSではない      | 500        | 対象外           | RSS検索ツールのページ |

production buildをChromiumで操作し、取得補助を有効にして登録した結果は、Yahoo 8件、GIGAZINE 10件、Lifehacker 10件でした。`https://gigazine.net/` のサイトURLから既存のGIGAZINE RSSを検出し、「登録済み」と判定するところまで確認しました。

## URL検出

- HTMLに `link rel="alternate"` がある場合はブラウザ内でRSS URLを検出する。
- CORSでサイトHTMLを読めない場合は、ユーザーが取得補助を有効にした時だけFeedsearchへサイトURLを送る。
- GIGAZINEとLifehackerのサイトURLからFeedsearchがRSS候補を返すことを確認した。
- URLだけからRSSを断定できない場合は、登録せずエラーを表示する。

## 取得補助

1. ブラウザからRSSを直接取得する。
2. 失敗時だけrss2jsonを試す。
3. rss2jsonも失敗した場合だけReaderを試し、見出し・URL・日時・短い説明だけを抽出する。
4. 全経路で失敗した場合は、成功扱いにせず各補助のエラーを表示する。

外部補助はサービスの可用性やレート制限に依存します。アプリを閉じている間の定期取得は行いません。
