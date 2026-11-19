# CLAUDE.md

AI エージェント（と人）がこのリポジトリで作業するときの手引き。

elecxstock-cli は、[elecxstock](https://github.com/kurouna/elecxstock)（日本株と J-REIT のデスクトップアプリ）が手元に貯めたデータを、
ターミナルで `top` のように眺める**読み取り専用**の CUI。Ink 6 + React 19 + TypeScript、MIT。Windows で開発し、Node.js SEA の単一実行ファイルで配布する。

- 設計と決めたこと: [docs/design.md](docs/design.md)
- elecxstock の文書（サブモジュールの中）: `vendor/elecxstock/CLAUDE.md`・`vendor/elecxstock/docs/requirements.md`

## コマンド

```bash
git submodule update --init   # vendor/elecxstock（clone のときは --recurse-submodules）
npm ci
npm run fixture               # 架空のデータを .fixture/data に作る（elecxstock のスタブのプロバイダ）
npm run dev -- --data .fixture/data   # 動かす（ELECXSTOCK_NOW=2026-11-13T18:00:00+09:00 で時刻を固定できる）
npm run verify                # lint（Biome）+ 型検査（tsc）+ テスト（Vitest。キー操作の E2E を含む）
npm run sea                   # dist/elecxstock-cli.exe（Node 25.5 以降が要る）と dist/THIRD_PARTY_NOTICES.txt
npm run shots                 # README のスクリーンショット（Windows Terminal で架空のデータを撮る。撮っている間はキーに触らない）
npm run gen:card              # public/elecxstock_repo_card.svg（README のバナー）を build/icon.svg から作る
```

## 構成

| 場所                 | 役割                                                                                                                           |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `src/main.ts`        | 入口。データの場所・版の確かめ・代替画面への切り替えと、どう終わっても端末を元に戻すこと                                       |
| `src/args.ts`        | 引数（純粋な関数）                                                                                                             |
| `src/app.ts`         | 全体: 状態の行・タブ・画面・キーの案内。checkMs ごとに変わったかを確かめて読み直す                                             |
| `src/state.ts`       | キー操作（純粋な関数 `reduce`）。選択は行の位置ではなく行のキーで持つ                                                          |
| `src/source/`        | 読み口: 場所（`paths.ts`）・読み取り専用の DB（`db.ts`）・利用者のデータ（`user.ts`）・`Reader`（変わったかの確認と覚えた値）  |
| `src/model/`         | 画面のモデル（行・数・予定）。アプリと同じ数え方                                                                               |
| `src/view/`          | 描画の部品の計算（文字の幅・点字やブロックのグラフ・目盛り・列の選び方・書式）                                                 |
| `src/ui/`            | Ink の画面（`parts.ts` の部品と色、`screens.ts` の 5 つの画面・詳細・キーの一覧）                                              |
| `vendor/elecxstock/` | elecxstock のサブモジュール（リリースのタグに固定。今は v0.1.14）。`@shared`・`@core` の別名で import する                     |
| `tests/`             | `e2e`（キー操作・端末の大きさ・読み直し・読み取り専用）・`unit`（純粋な関数・アプリとの突き合わせ）・`support`（種と仮の端末） |

## 守ること

- **書かない**。`market.db` は `node:sqlite` の `readOnly` で開き、利用者のデータ（`user\*.json`）も読むだけ。壊れたファイルを移したり
  作り直したりもしない（それはアプリの仕事）。elecxstock の部品のうち、開くと書くもの（`Db`・`CoreService`・`UserStore`・`FolioBook`・`AlertBook`）は
  `src/` で使わない（テストの種と突き合わせでは `CoreService` を使ってよい）。`Repo` には読むメソッドだけを呼ぶ。通信もしない。
- **elecxstock のコードは変えない**。使ってよいのは `src/shared/`・開いても書かない `src/core/` の関数・`src/renderer/lib/folio.ts`（純粋な関数）だけ。
  `CoreService` の中にある材料の組み立て（`folioMarket`・保有・`alertViews`・スクリーナーの入力・`bars`）は `src/source/reader.ts` に写し、
  写したものは `tests/unit/parity.test.ts` で `CoreService` と同じ値になることを確かめる。保有・ポートフォリオの数はアプリの画面と同じ数え方にする
  （`src/model/` のコメント）。`folio.ts` は v0.1.13 からプライバシーモードの `privacy.svelte.ts`（Svelte のルーン `$state`）を引き込むので、
  `src/runes.ts`（値をそのまま返す `$state` の代わり。cli のプライバシーモードは常にオフ）を `src/model/index.ts` の先頭で読む。
- **elecxstock の版を上げるとき**: `git -C vendor/elecxstock checkout v<版>`、`package.json` の `elecxstock.version`、DB の版が変わったら
  `src/source/db.ts` の `DB_VERSION`。変わった表・JSON・関数に合わせて読み口を直し、`npm run verify`（とくに突き合わせ）を通す。
  動いている間にアプリが DB の版を上げたら、落とさずに知らせて読み直しを止める（`Reader.changed` が `DbVersionError`）。
- **日付は日本時間の `YYYY-MM-DD`**（`@shared/calendar` の `jstNow`・`lastClosedSession`）。PC の時刻帯や UTC の日付で数えない。
- **キー**は `src/state.ts` の `reduce` に足す（IME の確定のようにまとめて届く文字・全角の数字も考える）。足したら `?` の一覧
  （`src/ui/screens.ts` の `Help`）・最下行の案内（`src/app.ts`）・README のキーの表も直す。マウスは使わない。
- **描画（`src/ui/`）に計算を書かない**。`src/model/`・`src/view/`・`src/state.ts` の関数にしてテストする。
- **幅と高さ**: どの行も端末の幅を超えない・全体は行数 − 1 を超えない（Ink が全体を描き直してちらつかないように）。幅は `src/view/width.ts`
  （string-width）で数える。1 行の `Box` には `flexShrink: 0` を付ける（収まらないと Yoga が行を縮めて重ねる）。★◆●のように端末で幅が
  ぶれる記号を文字の位置合わせに頼らない。
- **色**は `src/ui/parts.ts` のトークン（elecxstock の app.css から）。陽線・上げは赤、陰線・下げは青（日本式）。`NO_COLOR`・`--no-color` で色を付けない。
- 依存はすべて `devDependencies`（esbuild で 1 本にまとめる）。まとめたものに入る OSS のライセンスは `npm run build` が
  `dist/THIRD_PARTY_NOTICES.txt` に書き出し、GPL 系が入ると止まる。

## テスト

- **実装を足す・直すときはテストを足す**。不具合を直すときは、**先に再現するテストを書いて落ちることを確かめてから**直す。
- E2E（`tests/e2e/`）は実際の `Reader` と `App` を仮の端末（`tests/support/terminal.ts`。幅と高さを決められる）で動かし、キーを流して画面の文字で確かめる。
  固定の待ちを足さず、`until` で出てくる文字を待つ。
- 種（`tests/support/fixture.ts`）は elecxstock の `CoreService` とスタブのプロバイダで、基準日時 `TEST_NOW` に作る。テストは種の写しを使い、種は変えない。
- **テスト・スクリーンショット・バナーのデータはすべて架空**。実際の市場データや利用者の実際のデータ（`%APPDATA%\elecxstock`）を使わない・コミットしない。
  スクリーンショットは `.fixture/data` だけを `--data` で渡して撮る（`scripts/shots.ps1`）。
- 画面を変えたら `npm run sea` のあと exe でも動かして確かめ、README のスクリーンショットが古くなったら `npm run shots` で撮り直して目で確かめる。

## リリース

- **版は、追従している elecxstock の版と同じにする**（v0.1.14 から。`package.json` の `version` = `elecxstock.version` = サブモジュールのタグ）。
  elecxstock の版に追従したらこの版も同じ番号に上げる（番号が飛んでよい）。そろっていることは `tests/unit/source.test.ts` が確かめる。
- `package.json` の `version` を上げてコミットし、`v<版>` のタグを push すると、`.github/workflows/release.yml` が検査を通したうえで
  exe・zip（exe・ライセンス・README）・`SHA256SUMS.txt` を GitHub Releases に公開する（タグと `version` が違うと止まる）。
- exe は署名していない（初回に SmartScreen が警告する）。

## コミット

- commitlint の形式（`type(scope): subject`）で、英語と日本語を `/` で区切って併記する。`[` `]` とファイルのリンクは使わない。
- `main` への push で CI（`.github/workflows/ci.yml`）が走る。
