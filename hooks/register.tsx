import type { CoreEngineInterface, Register, SessionUsage } from 'claude-code'
import { composeBand, layoutBand } from './band'
import type { UsageState, DisplayState } from '../types'
import { crossingAlerts } from './usage/alerts'
import { formatReset, levelColor } from './usage/format'
import { nextBarPercent, warningVisible } from './usage/animate'
import { parseChecklist, parseTasks, type Progress } from './progress/parse'
import { applyTaskTool, taskProgress } from './progress/tasks'
import { drawTrack, taskName, type Pose } from './progress/track'
import { svgWidth, trackSvg, TRACK_HEIGHT } from './progress/svg'
import { barSvg } from './usage/bar'

const usageRef = { plugin: 'usage-ball', key: 'usage' } as const
const alertRef = { plugin: 'usage-ball', key: 'alerts' } as const
const displayRef = { plugin: 'usage-ball', key: 'display' } as const
const flashRef = { plugin: 'usage-ball', key: 'flash' } as const

const progressRef = { plugin: 'usage-ball', key: 'progress' } as const
const tasksRef = { plugin: 'usage-ball', key: 'tasks' } as const

async function readText($: CoreEngineInterface, path: string): Promise<string | undefined> {
  try {
    const text = await $.fs.read(path)
    return typeof text === 'string' ? text : undefined
  } catch {
    return undefined
  }
}

async function listNames($: CoreEngineInterface, path: string): Promise<string[]> {
  try {
    return (await $.fs.list(path)).filter(entry => entry.kind === 'file').map(entry => entry.name)
  } catch {
    return []
  }
}

const ballRef = { plugin: 'usage-ball', key: 'ball' } as const
const sleepRef = { plugin: 'usage-ball', key: 'sleep' } as const
const hopRef = { plugin: 'usage-ball', key: 'hop' } as const
// Bounce heights in px, one per 100ms frame: up and down in 0.6s.
const HOP = [0, 6, 10, 12, 10, 6]

type Timer = { cancel: () => void }

function zzz(tick: number): string {
  return tick >= 10 ? 'zᶻ' : ['z', 'zᶻ', 'zᶻz'][tick % 3] ?? 'z'
}

async function refreshProgress($: CoreEngineInterface, timers: { ball?: Timer }) {
  const handoff = await readText($, 'HANDOFF.md')
  const fromFile = handoff === undefined ? undefined
    : parseChecklist(handoff) ?? parseTasks(handoff, await listNames($, 'docs/handoff-archive'))
  const progress: Progress | undefined = fromFile ?? taskProgress((await $.state.get(tasksRef)).value ?? [])
  await $.state.set(progressRef, progress ?? { done: 0, total: 0 })
  await animateBall($, timers)
}

async function animateBall($: CoreEngineInterface, timers: { ball?: Timer }) {
  const progress = (await $.state.get(progressRef)).value ?? { done: 0, total: 0 }
  const ball = (await $.state.get(ballRef)).value
  if (!ball || ball.total !== progress.total || progress.done < ball.shown) {
    timers.ball?.cancel()
    timers.ball = undefined
    await $.state.set(ballRef, { shown: progress.done, total: progress.total, phase: 'rest', step: 0, sparkle: false })
    return
  }
  if (progress.done <= ball.shown || timers.ball) return
  const advance = async () => {
    const held = (await $.state.get(ballRef)).value
    const target = (await $.state.get(progressRef)).value
    if (!held || !target) return
    if (held.phase === 'jump' && held.step < 3) {
      await $.state.set(ballRef, { ...held, step: held.step + 1 })
      timers.ball = $.clock.after(100, advance)
    } else if (held.phase === 'jump') {
      const shown = held.shown + 1
      const isFinished = shown >= held.total
      await $.state.set(ballRef, { ...held, shown, phase: isFinished ? 'bounce' : 'rest', step: 0, sparkle: isFinished })
      timers.ball = isFinished ? $.clock.after(150, advance) : target.done > shown ? $.clock.after(100, advance) : undefined
    } else if (held.phase === 'bounce' && held.step < 5) {
      await $.state.set(ballRef, { ...held, step: held.step + 1 })
      timers.ball = $.clock.after(150, advance)
    } else if (held.phase === 'bounce') {
      await $.state.set(ballRef, { ...held, phase: 'rest', step: 0 })
      timers.ball = $.clock.after(2000, advance)
    } else if (held.sparkle) {
      await $.state.set(ballRef, { ...held, sparkle: false })
      timers.ball = undefined
    } else if (target.done > held.shown) {
      await $.state.set(ballRef, { ...held, phase: 'jump', step: 1 })
      timers.ball = $.clock.after(100, advance)
    } else {
      timers.ball = undefined
    }
  }
  await advance()
}

async function recordTask($: CoreEngineInterface, tool: string, input: object, result: unknown, timers: { ball?: Timer }) {
  const list = (await $.state.get(tasksRef)).value ?? []
  await $.state.set(tasksRef, applyTaskTool(list, tool, input as Record<string, unknown>, result))
  await refreshProgress($, timers)
}

async function startSleep($: CoreEngineInterface, timers: { sleep?: Timer }) {
  timers.sleep?.cancel()
  await $.state.set(sleepRef, { tick: 0 })
  timers.sleep = $.clock.every(1000, async () => {
    const tick = ((await $.state.get(sleepRef)).value?.tick ?? 0) + 1
    await $.state.set(sleepRef, { tick })
    if (tick >= 10) {
      timers.sleep?.cancel()
      timers.sleep = undefined
    }
  })
}

async function progressView($: CoreEngineInterface, isAsleep: boolean) {
  const progress = (await $.state.get(progressRef)).value
  if (!progress || progress.total === 0) {
    const z = isAsleep ? zzz((await $.state.get(sleepRef)).value?.tick ?? 0) : undefined
    const pose: Pose = { kind: 'rest', sleep: z }
    return { air: z ? ' ' + z : '', ground: '●', done: 0, total: 0, name: '', shown: 0, pose }
  }
  const ball = (await $.state.get(ballRef)).value ?? { shown: progress.done, total: progress.total, phase: 'rest', step: 0, sparkle: false }
  const pose = ball.phase === 'jump' ? { kind: 'jump' as const, frame: Math.min(3, Math.max(1, ball.step)) as 1 | 2 | 3 }
    : ball.phase === 'bounce' ? { kind: 'bounce' as const, up: ball.step % 2 === 0, sparkle: true }
    : ball.sparkle ? { kind: 'bounce' as const, up: false, sparkle: true }
    : { kind: 'rest' as const, sleep: isAsleep ? zzz((await $.state.get(sleepRef)).value?.tick ?? 0) : undefined }
  const shown = Math.min(ball.shown, progress.total)
  const track = drawTrack(progress.total, shown, pose)
  return { air: track.air, ground: track.ground, done: progress.done, total: progress.total, name: taskName(progress.current), shown, pose: pose as Pose }
}

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
  const timers: { bar?: Timer; ball?: Timer; sleep?: Timer } = {}
  let flashTimer: { cancel: () => void } | undefined
  let minuteTimer: { cancel: () => void } | undefined
  let hopTimer: { cancel: () => void } | undefined
  on('session.start', async ($, e, next) => {
    await processReading($, await $.session.usage(), warn, ctxWarn, timers)
    await refreshProgress($, timers)
    await startSleep($, timers)
    return next(e)
  })
  on('tool.call', { tool: 'TaskCreate' }, async ($, e, next) => {
    const ran = await next(e)
    if (ran.deny === undefined && ran.isError !== true) await recordTask($, e.tool, e, ran.result, timers)
    return ran
  })
  on('tool.call', { tool: 'TaskUpdate' }, async ($, e, next) => {
    const ran = await next(e)
    if (ran.deny === undefined && ran.isError !== true) await recordTask($, e.tool, e, ran.result, timers)
    return ran
  })
  on('tool.call', { tool: 'TodoWrite' }, async ($, e, next) => {
    const ran = await next(e)
    if (ran.deny === undefined && ran.isError !== true) await recordTask($, e.tool, e, ran.result, timers)
    return ran
  })
  on('session.measure', async ($, e, next) => {
    await processReading($, e, warn, ctxWarn, timers)
    return next(e)
  })
  on('turn.start', async ($, e, next) => {
    timers.sleep?.cancel()
    timers.sleep = undefined
    return next(e)
  })
  on('turn.complete', async ($, e, next) => {
    await refreshProgress($, timers)
    await startSleep($, timers)
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
    const progress = await progressView($, !e.props.isWorking)
    const showWarning = warningVisible((flash?.tick ?? 12) * 250)
    if (e.surface !== 'terminal') {
      // Proportional fonts: bars and track are vector images; columns are boxes, never padding spaces.
      const { Box, Text, Svg } = $.ui.resolve(e)
      const width = e.props.bodyColumns
      const band = layoutBand(width, usage ?? {}, now, warn, ctxWarn, showWarning, display, progress)
      if (e.props.isWorking && !hopTimer) hopTimer = $.clock.every(100, async () => {
        await $.state.set(hopRef, { tick: ((await $.state.get(hopRef)).value?.tick ?? 0) + 1 })
      })
      if (!e.props.isWorking && hopTimer) { hopTimer.cancel(); hopTimer = undefined }
      const hopTick = (await $.state.get(hopRef)).value?.tick ?? 0
      const hop = e.props.isWorking ? HOP[hopTick % HOP.length]! : 0
      const track = trackSvg({ total: Math.max(1, progress.total), shown: progress.shown, pose: progress.pose, hop })
      const level = (percent: number | undefined, limit: number) =>
        percent === undefined ? { dimColor: true } : { color: levelColor(percent, limit) }
      const bar = (label: string, shownPercent: number, percent: number | undefined, limit: number, size: number) =>
        <Svg source={barSvg(shownPercent, size, percent === undefined ? 'success' : levelColor(percent, limit))} alt={`${label} ${percent === undefined ? 'unknown' : Math.round(percent) + '%'}`} width={size} height={8} />
      const quotaSize = band.narrowBars ? 60 : 120
      const quota = (part: typeof band.parts.five, percent: number | undefined, shownPercent: number | undefined) =>
        <Box flexDirection="row" alignItems="center" columnGap={2}>
          <Box width={3} flexShrink={0}><Text dimColor>{part.label.trim()}</Text></Box>
          {band.showBar && bar(part.label.trim(), shownPercent ?? percent ?? 0, percent, warn, quotaSize)}
          <Box width={band.parts.amountWidth} flexShrink={0} justifyContent="flex-end"><Text {...level(percent, warn)}>{part.amount.trim()}</Text></Box>
          {band.showReset && <Box width={8} flexShrink={0} justifyContent="flex-end"><Text dimColor>{part.reset.trim()}</Text></Box>}
        </Box>
      return <Box flexDirection="row" justifyContent="space-between" alignItems="flex-end" columnGap={5} width={width}>
        <Box flexDirection="row" alignItems="flex-end" flexShrink={1}>
          <Svg source={track} alt={progress.total ? `progress ${progress.done} of ${progress.total}` : 'no progress yet'} width={svgWidth(track)} height={TRACK_HEIGHT} />
          <Box flexDirection="row" alignItems="center" columnGap={1} marginLeft={1}>
            {band.parts.counter.trim() && <Text wrap="truncate-end">{band.parts.counter.trim()}</Text>}
            <Text dimColor>ctx</Text>
            {band.showBar && <Box marginLeft={1}>{bar('ctx', display?.context ?? usage?.context ?? 0, usage?.context, ctxWarn, band.narrowBars ? 36 : 64)}</Box>}
            <Text {...level(usage?.context, ctxWarn)}>{band.parts.ctx.trim()}</Text>
          </Box>
        </Box>
        <Box flexDirection="column" flexShrink={0}>
          {quota(band.parts.five, usage?.fiveHour?.percent, display?.fiveHour)}
          {quota(band.parts.seven, usage?.sevenDay?.percent, display?.sevenDay)}
        </Box>
      </Box>
    }
    const { Box, Text } = $.ui.resolve(e)
    const width = Math.max(0, e.props.bodyColumns - 4)
    const rows = composeBand(width, usage ?? {}, now, warn, ctxWarn, showWarning, display, progress)
    const paint = (line: string) => {
      const pieces = []
      const pattern = /●|[┄○…]+|ctx|5h|7d|[⣿⡇⣀]+|⚠️? \d+% left|\d+%|—|\([^)]*\)/gu
      let cursor = 0
      let section: 'ctx' | '5h' | '7d' = '5h'
      for (const match of line.matchAll(pattern)) {
        const at = match.index ?? 0
        if (at > cursor) pieces.push(line.slice(cursor, at))
        const part = match[0]
        if (/^[┄○…]+$/.test(part)) {
          pieces.push(<Text dimColor>{part}</Text>)
          cursor = at + part.length
          continue
        }
        if (part === '●') {
          pieces.push(<Text color="#D97757">{part}</Text>)
          cursor = at + part.length
          continue
        }
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
