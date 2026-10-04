export type UsageWindow = { percent: number; resetsAt?: string }
export type UsageState = {
  fiveHour?: UsageWindow
  sevenDay?: UsageWindow
  context?: number
}
export type AlertState = { notified: string[]; ctxArmed: boolean }
export type DisplayState = { fiveHour?: number; sevenDay?: number; context?: number; startedAt: number; minute?: number }
export type FlashState = { tick: number }
export type BallState = { shown: number; total: number; phase: 'rest' | 'jump' | 'bounce'; step: number; sparkle: boolean }
export type ProgressState = { done: number; total: number; current?: string }
export type SessionTaskState = { id: string; subject: string; activeForm?: string; status: string }

declare module 'claude-code' {
  interface PluginState {
    'usage-ball': { usage: UsageState; alerts: AlertState; display: DisplayState; flash: FlashState; progress: ProgressState; tasks: SessionTaskState[]; ball: BallState; sleep: { tick: number }; hop: { tick: number } }
  }
}
