import type { UsageState } from '../../types'

export type AlertState = { notified: string[]; ctxArmed: boolean }

export function crossingAlerts(
  previous: UsageState,
  current: UsageState,
  held: AlertState | undefined,
  warn: number,
  ctxWarn: number,
): { kinds: string[]; state: AlertState } {
  const state: AlertState = { notified: [...(held?.notified ?? [])], ctxArmed: held?.ctxArmed ?? true }
  const kinds: string[] = []
  for (const [kind, window] of [['5h', current.fiveHour], ['7d', current.sevenDay]] as const) {
    if (!window || Math.round(window.percent) < warn) continue
    const key = `${kind}:${window.resetsAt ?? 'session'}`
    if (!state.notified.includes(key)) {
      kinds.push(kind)
      state.notified.push(key)
    }
  }
  if (current.context !== undefined) {
    const high = Math.round(current.context) >= ctxWarn
    if (!high) state.ctxArmed = true
    else if (state.ctxArmed) {
      kinds.push('ctx')
      state.ctxArmed = false
    }
  }
  return { kinds, state }
}
