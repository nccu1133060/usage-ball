import type { CoreEngineInterface, Register, SessionUsage } from 'claude-code'
import { composeBand } from './band'
import type { UsageState, DisplayState } from '../types'
import { crossingAlerts } from './usage/alerts'
import { formatReset, levelColor } from './usage/format'
import { nextBarPercent, warningVisible } from './usage/animate'

const usageRef = { plugin: 'usage-ball', key: 'usage' } as const
const alertRef = { plugin: 'usage-ball', key: 'alerts' } as const
const displayRef = { plugin: 'usage-ball', key: 'display' } as const
const flashRef = { plugin: 'usage-ball', key: 'flash' } as const

async function processReading(
  $: CoreEngineInterface,
  reading: Pick<SessionUsage, 'context' | 'rateLimits'>,
  warn: number,
  ctxWarn: number,
  timers: { bar?: { cancel: () => void } },
) {
  const previous = (await $.state.get(usageRef)).value ?? {}
  const fiveHour = reading.rateLimits.find(item => item.kind === 'five_hour')
  const sevenDay = reading.rateLimits.find(item => item.kind === 'seven_day')
  const current: UsageState = {
    fiveHour: fiveHour && { percent: fiveHour.percentUsed, resetsAt: fiveHour.resetsAt },
    sevenDay: sevenDay && { percent: sevenDay.percentUsed, resetsAt: sevenDay.resetsAt },
    context: reading.context.percent,
  }
  await $.state.set(usageRef, current)
  const { kinds, state } = crossingAlerts(previous, current, (await $.state.get(alertRef)).value, warn, ctxWarn)
  await $.state.set(alertRef, state)
  const now = await $.clock.now()
  for (const kind of kinds) {
    const window = kind === '5h' ? current.fiveHour : kind === '7d' ? current.sevenDay : undefined
    const reset = window?.resetsAt ? ` — resets in ${formatReset(window.resetsAt, now).trim().slice(1, -1)}` : ''
    $.ui.toast(`${kind} usage passed ${kind === 'ctx' ? ctxWarn : warn}%${reset}`)
  }
  const changed = previous.fiveHour?.percent !== current.fiveHour?.percent
    || previous.sevenDay?.percent !== current.sevenDay?.percent
    || previous.context !== current.context
  if (changed) {
    timers.bar?.cancel()
    const prior = (await $.state.get(displayRef)).value
    const display: DisplayState = {
      fiveHour: prior?.fiveHour ?? previous.fiveHour?.percent ?? 0,
      sevenDay: prior?.sevenDay ?? previous.sevenDay?.percent ?? 0,
      context: prior?.context ?? previous.context ?? 0,
      startedAt: now,
    }
    await $.state.set(displayRef, display)
    const step = async () => {
      const target = (await $.state.get(usageRef)).value ?? {}
      const held = (await $.state.get(displayRef)).value
      if (!held) return
      const elapsed = (await $.clock.now()) - held.startedAt
      const frame: DisplayState = {
        fiveHour: nextBarPercent(held.fiveHour ?? 0, target.fiveHour?.percent ?? 0, 10, elapsed),
        sevenDay: nextBarPercent(held.sevenDay ?? 0, target.sevenDay?.percent ?? 0, 10, elapsed),
        context: nextBarPercent(held.context ?? 0, target.context ?? 0, 5, elapsed),
        startedAt: held.startedAt,
      }
      await $.state.set(displayRef, frame)
      if (elapsed < 1000 && (frame.fiveHour !== target.fiveHour?.percent || frame.sevenDay !== target.sevenDay?.percent || frame.context !== target.context)) {
        timers.bar = $.clock.after(100, step)
      }
    }
    timers.bar = $.clock.after(100, step)
  }
}

export const register: Register = (on, options) => {
  const warn = typeof options.warnPercent === 'number' ? options.warnPercent : 80
  const ctxWarn = typeof options.ctxWarnPercent === 'number' ? options.ctxWarnPercent : 70
  const timers: { bar?: { cancel: () => void } } = {}
  let flashTimer: { cancel: () => void } | undefined
  let minuteTimer: { cancel: () => void } | undefined
  on('session.start', async ($, e, next) => {
    await processReading($, await $.session.usage(), warn, ctxWarn, timers)
    return next(e)
  })
  on('session.measure', async ($, e, next) => {
    await processReading($, e, warn, ctxWarn, timers)
    return next(e)
  })
  on('turn.complete', async ($, e, next) => {
    const usage = (await $.state.get(usageRef)).value
    const high = usage && [usage.fiveHour?.percent, usage.sevenDay?.percent].some(p => p !== undefined && Math.round(p) >= warn)
      || usage?.context !== undefined && Math.round(usage.context) >= ctxWarn
    if (high) {
      flashTimer?.cancel()
      await $.state.set(flashRef, { tick: 0 })
      const tick = async () => {
        const current = (await $.state.get(flashRef)).value?.tick ?? 0
        const following = current + 1
        await $.state.set(flashRef, { tick: following })
        if (following < 12) flashTimer = $.clock.after(250, tick)
      }
      flashTimer = $.clock.after(250, tick)
    }
    return next(e)
  })
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    if (!minuteTimer) minuteTimer = $.clock.every(60_000, async () => {
      const display = (await $.state.get(displayRef)).value
      await $.state.set(displayRef, { ...display, startedAt: display?.startedAt ?? 0, minute: Math.floor((await $.clock.now()) / 60_000) })
    })
    const usage = (await $.state.get(usageRef)).value as UsageState | undefined
    const display = (await $.state.get(displayRef)).value
    const flash = (await $.state.get(flashRef)).value
    const now = await $.clock.now()
    const rows = composeBand(Math.max(0, e.props.bodyColumns - 4), usage ?? {}, now, warn, ctxWarn, warningVisible((flash?.tick ?? 12) * 250), display)
    const { Box, Text } = $.ui.resolve(e)
    const paint = (line: string) => {
      const pieces = []
      const pattern = /ctx|5h|7d|[⣿⡇⣀]+|⚠️? \d+% left|\d+%|—|\([^)]*\)/gu
      let cursor = 0
      let section: 'ctx' | '5h' | '7d' = '5h'
      for (const match of line.matchAll(pattern)) {
        const at = match.index ?? 0
        if (at > cursor) pieces.push(line.slice(cursor, at))
        const part = match[0]
        if (part === 'ctx' || part === '5h' || part === '7d') section = part
        const percent = section === 'ctx' ? usage?.context : section === '5h' ? usage?.fiveHour?.percent : usage?.sevenDay?.percent
        const themed = part.startsWith('⣿') || part.startsWith('⡇') || part.startsWith('⣀') || part.includes('%')
        pieces.push(themed && percent !== undefined
          ? <Text color={levelColor(percent, section === 'ctx' ? ctxWarn : warn)}>{part}</Text>
          : <Text dimColor>{part}</Text>)
        cursor = at + part.length
      }
      if (cursor < line.length) pieces.push(line.slice(cursor))
      return pieces
    }
    return <Box flexDirection="column">
      <Text wrap="truncate-end">{paint(rows[0])}</Text>
      <Text wrap="truncate-end">{paint(rows[1])}</Text>
    </Box>
  })
}
