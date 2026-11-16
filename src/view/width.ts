// 文字の幅（全角は 2）。幅の数え方はここ 1 か所で決める（Ink と同じ string-width）。
// 幅が曖昧な字（★◆🔔 など）は端末とずれるので使わない（docs/design.md §3.1）
import stringWidth from 'string-width'

export const textWidth = (s: string): number => stringWidth(s)

/** 幅 w に収める（はみ出す分は … にする） */
export function fit(s: string, w: number): string {
  if (textWidth(s) <= w) return s
  let out = ''
  for (const ch of s) {
    if (textWidth(`${out}${ch}…`) > w) break
    out += ch
  }
  return `${out}…`
}
