import { brailleBar, cellWidth, charWidth, usageRow } from './usage/format'
import type { UsageState, DisplayState } from '../types'

function clip(text: string, width: number): string {
  let result = ''
  let cells = 0
  for (const char of text) {
    if (char === '\uFE0F') {
      if (result) result += char
    } else if (cells + charWidth(char) <= width) {
      result += char
      cells += charWidth(char)
    } else {
      break
    }
  }
  return result
}

export function composeBand(
  width: number,
  usage: UsageState,
  now: number,
  warn = 80,
  ctxWarn = 70,
  warningVisible = true,
  display?: DisplayState,
  progress?: { air: string; ground: string; done: number; total: number; name: string },
): [string, string] {
  let showName = true
  let quotaCells = 10
  let contextCells = 5
  let showReset = true
  let showBar = true

  const make = () => {
    const five = usageRow('5h', usage.fiveHour?.percent, showReset ? usage.fiveHour?.resetsAt : undefined, now, warn, showBar ? quotaCells : 0, warningVisible, display?.fiveHour)
    const seven = usageRow('7d', usage.sevenDay?.percent, showReset ? usage.sevenDay?.resetsAt : undefined, now, warn, showBar ? quotaCells : 0, warningVisible, display?.sevenDay)
    const amountWidth = Math.max(cellWidth(five.amount), cellWidth(seven.amount))
    const row = (part: typeof five) => `${part.label}${part.bar} ${part.amount.padEnd(amountWidth + part.amount.length - cellWidth(part.amount))} ${part.reset}`
    const ctx = usage.context === undefined ? '   —' : Math.round(usage.context) >= ctxWarn
      ? `${warningVisible ? '⚠️' : '  '} ${100 - Math.round(usage.context)}% left`
      : `${Math.round(usage.context)}%`.padStart(4)
    const count = !progress ? ''
      : progress.total === 0 ? `${progress.ground}  `
      : `${progress.ground}  ${progress.done}/${progress.total}${showName && progress.name ? ' ' + progress.name : ''} · `
    const left = `  ${count}ctx ${showBar ? brailleBar(display?.context ?? usage.context ?? 0, contextCells) + ' ' : ''}${ctx}`
    const trimReset = (text: string) => showReset ? text : text.slice(0, -9)
    return { top: trimReset(row(five)), bottom: trimReset(row(seven)), left }
  }

  let parts = make()
  const fits = () => cellWidth(parts.left) + 5 + Math.max(cellWidth(parts.top), cellWidth(parts.bottom)) <= width
  if (!fits()) { showName = false; parts = make() }
  if (!fits()) { quotaCells = 5; contextCells = 3; parts = make() }
  if (!fits()) { showReset = false; parts = make() }
  if (!fits()) { showBar = false; parts = make() }

  const air = progress?.air ? `  ${progress.air}` : ''
  const topPad = Math.max(0, width - cellWidth(air) - cellWidth(parts.top))
  const bottomPad = Math.max(5, width - cellWidth(parts.left) - cellWidth(parts.bottom))
  return [
    clip(air + ' '.repeat(topPad) + parts.top, width),
    clip(parts.left + ' '.repeat(bottomPad) + parts.bottom, width),
  ]
}
