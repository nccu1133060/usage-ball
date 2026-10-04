export type UsageWindow = { percent: number; resetsAt?: string }
export type UsageState = {
  fiveHour?: UsageWindow
  sevenDay?: UsageWindow
  context?: number
}
export type AlertState = { notified: string[]; ctxArmed: boolean }
export type DisplayState = { fiveHour?: number; sevenDay?: number; context?: number; startedAt: number; minute?: number }
export type FlashState = { tick: number }

declare module 'claude-code' {
  interface PluginState {
    'usage-ball': { usage: UsageState; alerts: AlertState; display: DisplayState; flash: FlashState }
  }
}
