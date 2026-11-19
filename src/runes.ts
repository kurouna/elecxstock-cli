// elecxstock の renderer/lib/folio.ts（v0.1.13 から）が引き込む privacy.svelte.ts は、Svelte のルーン $state を使う。
// $state は Svelte のコンパイラが置き換えるもので、cli（tsx・esbuild・Vitest）にはない。読み取り専用の cli はプライバシーモードを持たない
// （常にオフ）ので、受け取った値をそのまま返すだけの代わりを置く。folio.ts を import するより前に読み込む（src/model/index.ts の先頭）
declare global {
  var $state: <T>(v: T) => T
}
globalThis.$state ??= <T>(v: T): T => v

export {}
