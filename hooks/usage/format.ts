export function brailleBar(percent: number, cells: number): string {
  const halves = Math.round(Math.max(0, Math.min(100, percent)) / 100 * cells * 2)
  return Array.from({ length: cells }, (_, i) => {
    const filled = halves - i * 2
    return filled >= 2 ? '⣿' : filled === 1 ? '⡇' : '⣀'
  }).join('')
}

export function levelColor(percent: number, warn: number): 'success' | 'warning' | 'error' {
  const rounded = Math.round(percent)
  return rounded < 50 ? 'success' : rounded < warn ? 'warning' : 'error'
}

export function formatReset(resetsAt: string | undefined, now: number): string {
  if (!resetsAt) return ' '.repeat(8)
  const minutes = Math.max(0, Math.ceil((Date.parse(resetsAt) - now) / 60_000))
  const text = minutes < 60
    ? `(${minutes}m)`
    : minutes < 1440
      ? `(${Math.floor(minutes / 60)}h${minutes % 60}m)`
      : `(${Math.floor(minutes / 1440)}d${Math.floor(minutes % 1440 / 60)}h)`
  return text.padEnd(8)
}

const WIDE = /[\u1100-\u115F\u2E80-\u303E\u3041-\u33FF\u3400-\u4DBF\u4E00-\u9FFF\uA000-\uA4CF\uAC00-\uD7A3\uF900-\uFAFF\uFE30-\uFE4F\uFF00-\uFF60\uFFE0-\uFFE6]/

export function charWidth(char: string): number {
  return char === '\uFE0F' ? 0 : WIDE.test(char) ? 2 : 1
}

export function cellWidth(text: string): number {
  return Array.from(text).reduce((sum, char) => sum + charWidth(char), 0)
}

export function usageRow(
  label: string,
  percent: number | undefined,
  resetsAt: string | undefined,
  now: number,
  warn: number,
  cells: number,
  warningVisible = true,
  barPercent = percent,
) {
  const rounded = percent === undefined ? undefined : Math.round(percent)
  const color = rounded === undefined ? 'success' : levelColor(rounded, warn)
  const bar = brailleBar(barPercent ?? 0, cells)
  const amount = rounded === undefined
    ? '   —'
    : rounded >= warn
      ? `${warningVisible ? '⚠️' : '  '} ${100 - rounded}% left`
      : `${rounded}%`.padStart(4)
  const reset = formatReset(resetsAt, now)
  const labelField = label.padEnd(3) + '  '
  const amountField = amount.padEnd(12 + amount.length - cellWidth(amount))
  const text = `${labelField}${bar} ${amountField} ${reset}`
  return { label: labelField, bar, amount, amountField, reset, color, text }
}
