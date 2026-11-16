# elecxstock-cli

<p align="center">
  <a href="https://github.com/kurouna/elecxstock-cli/releases/latest"><img src="https://img.shields.io/github/v/release/kurouna/elecxstock-cli?include_prereleases&label=release" alt="Release"></a>
  <a href="https://github.com/kurouna/elecxstock-cli/actions/workflows/ci.yml"><img src="https://github.com/kurouna/elecxstock-cli/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT"></a>
  <img src="https://img.shields.io/badge/platform-Windows%2010%20%2F%2011-0078D6?logo=windows" alt="Windows">
  <a href="https://claude.com/claude-code"><img src="https://img.shields.io/badge/Created%20with-Claude%20Code-D97757?logo=claude" alt="Created with Claude Code"></a>
</p>

[日本語](#日本語) | [English](#english)

```text
  elecxstock-cli   11/13(金) 18:00   大引け後    データ 11/13 18:00（たった今）   アラート 1   次の予定 12/27 決算 7203

  1 マーケット  2 スクリーナー  3 ウォッチリスト  4 保有  5 ポートフォリオ
                               ▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔
 お気に入り 8  売買候補 3  高配当 5  監視 0                                                                 [ ]  リスト
╭──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────╮
│ お気に入り 8 銘柄                                                                                     1 / 8 · 登録順 │
│  コード 銘柄                                 終値   前日比  利回り 4%水準まで  52週の位置      権利月 1年            │
│ ▌8951   日本ビルファンド投資法人          105,000   +0.77%   5.66%     +41.5%  ──────────●─   4・10月 ⠓⠒⠲⠤⢤⣄⣠⡤⠤⠴⠒⠛⠉  │
│  8058   三菱商事                           12,900   +0.00%   4.78%     +19.6%  ──────────●─    3・9月 ⠻⠲⠶⠦⠤⣄⣀⣤⠴⠚⠋⠙⠋  │
```

<p align="center">値はすべて架空です（elecxstock のテスト用のスタブのデータ） / All values are fictitious (elecxstock's stub test data)</p>

---

## 日本語

[elecxstock](https://github.com/kurouna/elecxstock)（日本株と J-REIT のデスクトップアプリ）が手元の PC に貯めたデータを、
ターミナルで `top` のように眺め続けるための **読み取り専用** の CUI です。アプリを開かなくても、ターミナルの片隅で
市場・監視銘柄・保有・予定を横目で見られます。

- **画面は 5 つ**: `1` マーケット・`2` スクリーナー・`3` ウォッチリスト・`4` 保有・`5` ポートフォリオ。どの画面からも `Enter` で銘柄の**詳細**（推移のチャート・指標・目標利回り・保有・アラート）に入ります。
- **読むだけ**: データの取得（Yahoo・JPX への通信）はしません。DB は読み取り専用で開き、利用者のデータ（★・ウォッチリスト・保有・アラートなど）も書きません。値は elecxstock が取得したときのもので、リアルタイムではありません。
- **データが変わったら自動で読み直す**: 2 秒ごとに、DB と利用者のデータが変わったかだけを確かめます。アプリで更新すると、こちらの表示も追いつきます。
- **計算はアプリと同じ**: elecxstock のソース（指標・スクリーナー・保有・資産推移の計算）をそのまま使っています。

> **注意**
>
> - elecxstock を一度起動して、初回の取り込みを済ませてから使ってください。
> - 本ツールは投資助言ではありません。投資の判断はご自身の責任で行ってください。
> - 表示しているデータは elecxstock が取得したもので、その利用条件に従います（個人の利用の範囲で。再配布しないでください）。

### インストール

[Releases](https://github.com/kurouna/elecxstock-cli/releases/latest) から `elecxstock-cli.exe`（または zip）を取り、PATH の通ったフォルダに置きます。
Node.js は要りません（実行ファイルに含まれています）。

- コードに署名していないので、初回は Windows の SmartScreen が警告することがあります。
- 対応する elecxstock の版は `elecxstock-cli --version` で出ます。アプリの DB の版が違うときは、起動せずに知らせます。

### 使い方

Windows Terminal などで:

```bash
elecxstock-cli
```

| オプション              | 意味                                                                                        |
| ----------------------- | ------------------------------------------------------------------------------------------- |
| `--data <フォルダ>`     | `market.db` と `user\` のある data フォルダ（既定はアプリと同じ場所。下の「データの場所」） |
| `--where`               | 使う data フォルダ・DB の版・最終更新を出して終わる                                         |
| `--tab <1〜5>`          | はじめの画面（既定は 3 ウォッチリスト）                                                     |
| `--theme <dark\|light>` | 端末の地が明るいときは `light`                                                              |
| `--no-color`            | 色を使わない（`NO_COLOR` でも同じ）                                                         |

幅 80 桁 × 24 行から動きます（狭いときは列を減らします）。120 桁 × 40 行くらいが見やすい大きさです。

### キー

| キー                   | 操作                                                             |
| ---------------------- | ---------------------------------------------------------------- |
| `1`〜`5`・`Tab`        | 画面を切り替える（全角の数字でも）                               |
| `↑` `↓`・`PgUp` `PgDn` | 行を選ぶ                                                         |
| `Enter`                | 選んだ銘柄の詳細                                                 |
| `Backspace`・`Esc`     | 詳細から戻る（元の画面の同じ行に戻る）                           |
| `n` `N`                | 詳細で、元の一覧の次・前の銘柄                                   |
| `,` `.`                | 期間（3M・6M・1Y・5Y）                                           |
| `t`                    | 詳細の時間軸（日足・週足・月足）                                 |
| `[` `]`                | ウォッチリスト・保存したスクリーンを切り替える                   |
| `v`                    | ウォッチリスト・スクリーナーを格子（小さなチャートの並び）にする |
| `s`                    | 並べ替え（選んだ銘柄はそのまま）                                 |
| `c`                    | ポートフォリオの損益寄与の期間（今日・今月・今年）               |
| `/`                    | コードを打って詳細を開く                                         |
| `m`                    | 金額を隠す（画面を見せるとき）                                   |
| `r`                    | 読み直す                                                         |
| `?`                    | キーの一覧                                                       |
| `q`・`Ctrl+C`          | 終わる                                                           |

### データの場所

アプリと同じ決め方で探します。

1. `--data <フォルダ>`
2. 環境変数 `ELECXSTOCK_USER_DATA` があれば `<それ>\data`
3. Windows: `%APPDATA%\elecxstock\data`（macOS: `~/Library/Application Support/elecxstock/data`、Linux: `~/.config/elecxstock/data`）

`elecxstock-cli --where` で、どこを読んでいるかを確かめられます。

### 画面の例

いずれも架空のデータです。

<details>
<summary>詳細（Enter）</summary>

```text
  elecxstock-cli   11/13(金) 18:00   大引け後    データ 11/13 18:00（たった今）   アラート 1   次の予定 12/27 決算 7203

  1 マーケット  2 スクリーナー  3 ウォッチリスト  4 保有  5 ポートフォリオ  › 8306 三菱UFJフィナンシャル・グループ
                               ▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔
╭──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────╮
│ 8306  三菱UFJフィナンシャル・グループ                                                           銀行業 · 権利 3・9月 │
│ 19,700  +0（+0.00%）   確定   11/13    お気に入り    日足 · 1Y の騰落 +9.4%   範囲の外: 4% 10,800  5.5% 7,855        │
│                                                                                                    │                 │
│                                                                                  █   ▄█            ┤ 20,000          │
│                                                                                ▄▄██▄█████   ▄ ██▄▄ ◀ 19,700          │
│                                                                               █████████████▄█▄████ │                 │
│                                                                  ▄█       ▄▄██████████████████████ │                 │
│                                                              ▄   █████▄   ████████████████████████ │                 │
│ ▄▄█ ▄▄█▄█                                                 ▄███▄████████▄██████████████████████████ ┤ 18,000          │
│ ████████████▄                                         ▄▄██████████████████████████████████████████ │                 │
│ ███████████████▄                               ▄   ▄ ▄████████████████████████████████████████████ │                 │
│ █████████████████▄▄▄                         ▄▄██ ▄███████████████████████████████████████████████ │                 │
│ ████████████████████▄█▄▄▄▄▄                 ▄█████████████████████████████████████████████████████ │                 │
│ ████████████████████████████▄              ▄██████████████████████████████████████████████████████ ┤ 16,000          │
│ █████████████████████████████▄▄▄       ▄▄▄████████████████████████████████████████████████████████ │                 │
│ ███████████████████████████████████   ▄███████████████████████████████████████████████████████████ │                 │
│ ██████████████████████████████████████████████████████████████████████████████████████████████████ │                 │
│ ├─────────────┬──────────────┬────────┬───────┬──────┬────────┬────────┬───────┬──────┬────────┬───┘                 │
│ 2025/11       2026年1月      3月      4月     5月    6月      7月      8月     9月    10月     11                    │
╰──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────╯
╭────────────────────────────────────────────────────────────────────────╮╭────────────────────────────────────────────╮
│ 指標                                                                   ││ 保有・アラート                             │
│ 実績利回り 2.19%   配当(12か月) 432円   PER 17.8   PBR 0.71   連続増配…││  NISA成長  300 取得 15,000  +31.3% +1,410… │
│ 目標利回り  4% 10,800（-45.2%） 5.5% 7,855（-60.1%）                   ││  アラート  成立中 price.close >= 1         │
│ 52週 14,800 ────────────────●─── 20,600   25日線 +0.2%  75日線 +1.6%   ││                                            │
│ 配当    2025/09 205 2026/03 214 2026/09 218                            ││                                            │
╰────────────────────────────────────────────────────────────────────────╯╰────────────────────────────────────────────╯
  Backspace  戻る   n N  次・前   , .  期間   t  時間軸                   /  コード   m  金額を隠す   ?  キー   q  終了
```

</details>

<details>
<summary>4 保有</summary>

```text
  elecxstock-cli   11/13(金) 18:00   大引け後    データ 11/13 18:00（たった今）   アラート 1   次の予定 12/27 決算 7203

  1 マーケット  2 スクリーナー  3 ウォッチリスト  4 保有  5 ポートフォリオ
                                                 ▔▔▔▔▔▔▔
╭──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────╮
│ 保有                                                             9 銘柄 · 配当/年は特定・一般は税引後 · 1–12 / 12 行 │
│  コード 銘柄           数量 取得単価    現在値      評価額      今日   含み損益      率  構成比   配当/年 取得利回り │
│  NISA成長   4 銘柄                               7,222,500    -9,400   +872,500  +13.7%     48%   164,828      2.60% │
│ ▌8306   三菱UFJフィ…    300   15,000    19,700   5,910,000        +0 +1,410,000  +31.3%   39.0%   129,600      2.88% │
│  8766   東京海上ホ…     100   13,000     7,755     775,500   -12,200   -524,500  -40.3%    5.1%    10,030      0.77% │
│  3462   野村不動産…       3  120,000   109,000     327,000    +1,200    -33,000   -9.2%    2.2%    13,308      3.70% │
│  8951   日本ビルフ…       2   95,000   105,000     210,000    +1,600    +20,000  +10.5%    1.4%    11,890      6.26% │
│  つみたて   1 銘柄                                 932,100    -5,100   +152,100  +19.5%      6%    24,300      3.12% │
│  1306   NEXT FUNDS…     300    2,600     3,107     932,100    -5,100   +152,100  +19.5%    6.1%    24,300      3.12% │
│  特定   4 銘柄                                   7,008,400   -37,200   -171,600   -2.4%     46%   194,670      3.40% │
│  8058   三菱商事        200   11,000    12,900   2,580,000        +0   +380,000  +17.3%   17.0%    98,331      5.61% │
│  7203   トヨタ自動…     100   15,000    18,600   1,860,000        +0   +360,000  +24.0%   12.3%    40,321      3.37% │
│  2914   日本たばこ…     100   14,000    16,800   1,680,000   -30,000   +280,000  +20.0%   11.1%    26,535      2.38% │
│  9434   ソフトバン…     400    5,200     2,221     888,400    -7,200 -1,191,600  -57.3%    5.9%    29,483      1.78% │
│ ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────── │
│  合計  9 銘柄                                   15,163,000   -51,700   +853,000   +6.0%    100%   383,798      3.03% │
│                                                                                                                      │
│                                                                                                                      │
│                                                                                                                      │
│                                                                                                                      │
│                                                                                                                      │
│                                                                                                                      │
│                                                                                                                      │
│                                                                                                                      │
│                                                                                                                      │
│                                                                                                                      │
╰──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────╯
  ↑↓  選ぶ   Enter  詳細                                                  /  コード   m  金額を隠す   ?  キー   q  終了
```

</details>

<details>
<summary>1 マーケット</summary>

```text
  elecxstock-cli   11/13(金) 18:00   大引け後    データ 11/13 18:00（たった今）   アラート 1   次の予定 12/27 決算 7203

  1 マーケット  2 スクリーナー  3 ウォッチリスト  4 保有  5 ポートフォリオ
 ▔▔▔▔▔▔▔▔▔▔▔▔▔
╭──────────────────────────────────────────────────────────────────────╮╭──────────────────────────────────────────────╮
│ マーケット                        取得時の値・日付は各市場の最後の足 ││ 騰落                            基準日 11/13 │
│                                   値   前日比   1か月  年初来   日付 ││            上げ  下げ 新高値 新安値 売買代金 │
│ 日本                                                                 ││ プライム      9    11      1      0  4,811億 │
│   日経平均                 38,000.00   +1.04%   +1.3%   +0.3%  11/13 ││          ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│   TOPIX 連動ETF                3,107   -0.54%   -0.6%   +0.2%  11/13 ││ J-REIT        5     2      1      0     94億 │
│   JPX日経400 連動ETF          28,200   +0.36%   +1.1%   +5.6%  11/13 ││          ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│   グロース250 連動ETF          640.0   -0.36%   -1.3%   -6.4%  11/13 │╰──────────────────────────────────────────────╯
│   東証REIT 連動ETF             2,010   -0.05%   -2.0%  +15.3%  11/13 │╭──────────────────────────────────────────────╮
│   日経平均先物（CME …         42,410   +0.82%   +3.3%   -7.3%  11/13 ││ 値上がり率                                   │
│ 米国                                                                 ││ ▌7974 任天堂                           +1.9% │
│   NYダウ                   38,831.20   -0.39%   +0.6%   +8.8%  11/13 ││  8591 オリックス                       +1.4% │
│   S&P500                    4,999.27   -0.59%   +0.3%   +2.8%  11/13 ││  5401 日本製鉄                         +1.4% │
│   NASDAQ総合               17,543.03   -0.31%   -1.1%   +6.3%  11/13 │╰──────────────────────────────────────────────╯
│   SOX指数                   4,618.80   -1.35%   -8.2%   -9.8%  11/13 │╭──────────────────────────────────────────────╮
│   VIX指数                      17.20   +3.30%   +5.7%  -44.1%  11/13 ││ 値下がり率                                   │
│ アジア                                                               ││  2914 日本たばこ産業                   -1.8% │
│   香港ハンセン             20,398.51   +0.95%   +2.7%   -0.5%  11/13 ││  8766 東京海上ホールディングス         -1.5% │
│   上海総合                  2,952.26   +0.22%   +5.2%   +3.3%  11/13 ││  6758 ソニーグループ                   -1.0% │
│ 為替・金利                                                           │╰──────────────────────────────────────────────╯
│   ドル/円                    138.642   -0.09%   +0.5%   +2.6%  11/13 │╭──────────────────────────────────────────────╮
│   ユーロ/円                  173.039   +0.11%   +0.0%   -6.6%  11/13 ││ 売買代金                                     │
│   米国債10年利回り             3.812   -0.16%   +2.8%  +17.2%  11/13 ││  8031 三井物産                         377億 │
│ 商品                                                                 ││  6501 日立製作所                       355億 │
│   原油（WTI）                  71.40   -0.40%   +2.2%   +4.9%  11/13 ││  8002 丸紅                             321億 │
│   金                         2,206.8   -0.16%   +0.9%   +6.2%  11/13 │╰──────────────────────────────────────────────╯
│   銀                          28.634   -0.61%   -3.7%   -4.0%  11/13 │
╰──────────────────────────────────────────────────────────────────────╯
  ↑↓  選ぶ   Enter  詳細                                                  /  コード   m  金額を隠す   ?  キー   q  終了
```

</details>

### 開発

```bash
git clone --recurse-submodules https://github.com/kurouna/elecxstock-cli
cd elecxstock-cli
npm ci
npm run fixture                              # 架空のデータを .fixture/data に作る
npm run dev -- --data .fixture/data          # 動かす
npm run verify                               # lint・型検査・テスト（キー操作の E2E を含む）
npm run sea                                  # 単一実行ファイル dist/elecxstock-cli.exe
```

- Node.js 25.5 以降（`node --build-sea` と `node:sqlite` を使います）。
- elecxstock のソースは git のサブモジュール（`vendor/elecxstock`）で、リリースのタグに固定しています。
- 設計: [docs/design.md](docs/design.md)。
- `v*` のタグを付けてプッシュすると、GitHub Actions がテストを通したうえで exe を Releases に公開します。

### ライセンス

[MIT](LICENSE)。配布物に同梱した OSS のライセンスは、zip の `THIRD_PARTY_NOTICES.txt` にあります。

---

## English

A **read-only**, `top`-like terminal UI for the data that [elecxstock](https://github.com/kurouna/elecxstock)
(a desktop app for Japanese stocks and J-REITs) keeps on your PC. Keep an eye on the market, your watchlists,
holdings and upcoming events in a corner of your terminal without opening the app.

- **Five screens**: `1` Market, `2` Screener, `3` Watchlist, `4` Holdings, `5` Portfolio. Press `Enter` on any row to open the **detail** view (price chart, metrics, target yields, holdings and alerts).
- **Read-only**: it never fetches data (no network) and never writes. The database is opened read-only and your user data (stars, watchlists, holdings, alerts) is left untouched. Values are as of the app's last update, not real-time.
- **Follows the app**: every 2 seconds it checks whether the database or the user data changed and reloads only then.
- **Same numbers as the app**: it reuses elecxstock's own source for metrics, screening, holdings and portfolio history.

> **Notes**
>
> - Run elecxstock once and finish the initial import first.
> - This is not investment advice.
> - The data was fetched by elecxstock and is subject to its terms (personal use only, do not redistribute).

### Install

Download `elecxstock-cli.exe` (or the zip) from [Releases](https://github.com/kurouna/elecxstock-cli/releases/latest) and put it on your PATH.
No Node.js installation is needed. The binary is not code-signed, so Windows SmartScreen may warn on first run.

### Usage

```bash
elecxstock-cli
```

Options: `--data <folder>` (the app's `data` folder), `--where` (print the folder and database version), `--tab <1-5>`,
`--theme <dark|light>`, `--no-color`, `--version`, `--help`. Works from 80 × 24; about 120 × 40 looks best.

Keys: `1`–`5`/`Tab` screens, `↑↓`/`PgUp`/`PgDn` select, `Enter` detail, `Backspace`/`Esc` back, `n`/`N` next/previous,
`,`/`.` period, `t` timeframe, `[`/`]` lists and screens, `v` grid, `s` sort, `c` contribution period, `/` open by code,
`m` hide amounts, `r` reload, `?` help, `q` quit. The UI is in Japanese.

Data folder lookup: `--data`, then `%ELECXSTOCK_USER_DATA%\data`, then `%APPDATA%\elecxstock\data`
(macOS `~/Library/Application Support/elecxstock/data`, Linux `~/.config/elecxstock/data`).

### Development

Node.js 25.5+. Clone with `--recurse-submodules` (elecxstock's source is a submodule pinned to a release tag), then
`npm ci`, `npm run fixture` (fictitious data), `npm run dev -- --data .fixture/data`, `npm run verify`, `npm run sea`.
Pushing a `v*` tag builds, tests and publishes the exe to GitHub Releases.

### License

[MIT](LICENSE). Licenses of bundled open-source software are in `THIRD_PARTY_NOTICES.txt` in the zip.
