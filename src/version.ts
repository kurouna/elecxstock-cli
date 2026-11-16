// 版（package.json から。ビルドで 1 本にまとめるときに埋め込まれる）
import pkg from '../package.json' with { type: 'json' }

export const VERSION: string = pkg.version
/** 対応する elecxstock の版（vendor/elecxstock のタグ） */
export const ELECXSTOCK_VERSION: string = pkg.elecxstock.version
