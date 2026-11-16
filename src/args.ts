// 引数を読む（純粋な関数。誤りは Error で返し、入口が終了コード 2 で終える）
export interface Args {
  data?: string
  where?: boolean
  tab?: number
  theme?: 'dark' | 'light'
  color: boolean
  version?: boolean
  help?: boolean
}

export function parseArgs(argv: string[], env: { NO_COLOR?: string } = {}): Args {
  const o: Args = { color: !env.NO_COLOR }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!
    const value = (name: string) => {
      const v = argv[++i]
      if (v == null || v.startsWith('--')) throw new Error(`${name} の値がありません（--help で説明）`)
      return v
    }
    if (a === '--data') o.data = value('--data')
    else if (a.startsWith('--data=')) o.data = a.slice(7)
    else if (a === '--where') o.where = true
    else if (a === '--tab' || a.startsWith('--tab=')) {
      const v = a === '--tab' ? value('--tab') : a.slice(6)
      const n = Number(v.normalize('NFKC'))
      if (!Number.isInteger(n) || n < 1 || n > 5) throw new Error(`--tab は 1〜5 です（${v}）`)
      o.tab = n
    } else if (a === '--theme' || a.startsWith('--theme=')) {
      const v = a === '--theme' ? value('--theme') : a.slice(8)
      if (v !== 'dark' && v !== 'light') throw new Error(`--theme は dark か light です（${v}）`)
      o.theme = v
    } else if (a === '--no-color') o.color = false
    else if (a === '-v' || a === '--version') o.version = true
    else if (a === '-h' || a === '--help') o.help = true
    else throw new Error(`知らないオプション: ${a}（--help で説明）`)
  }
  return o
}
