import { test, expect, mock } from 'claude-code/testing'
import { composeBand } from './band'
import { cellWidth } from './usage/format'

test('two lines put quota rows on the right and context on line two', () => {
  const rows = composeBand(96, { fiveHour: { percent: 42 }, sevenDay: { percent: 18 }, context: 63 }, 0)
  expect(rows).toHaveLength(2)
  expect(rows[0].startsWith('  ')).toBe(true)
  expect(rows[0]).toMatch(/5h   ⣿⣿⣿⣿⣀⣀⣀⣀⣀⣀/)
  expect(rows[1]).toMatch(/^  ctx ⣿⣿⣿⣀⣀  63%/)
  expect(rows[1]).toMatch(/7d   ⣿⣿/)
  expect(rows[0].length).toBe(96)
  expect(rows[1].length).toBe(96)
})

test('normal quota has one space before reset while warning rows keep resets aligned', () => {
  const now = Date.parse('2026-10-04T00:00:00Z')
  const normal = composeBand(96, {
    fiveHour: { percent: 42, resetsAt: '2026-10-04T02:13:00Z' },
    sevenDay: { percent: 18, resetsAt: '2026-10-04T04:00:00Z' },
    context: 23,
  }, now)
  expect(normal[0]).toMatch('42% (2h13m)')
  const warning = composeBand(96, {
    fiveHour: { percent: 91, resetsAt: '2026-10-04T02:13:00Z' },
    sevenDay: { percent: 18, resetsAt: '2026-10-04T04:00:00Z' },
    context: 23,
  }, now)
  expect(warning[0].replaceAll('\uFE0F', '').indexOf('(2h13m)')).toBe(warning[1].replaceAll('\uFE0F', '').indexOf('(4h0m)'))
})

test('AbovePrompt renders the two-line band on terminal and desktop', async ($, on) => {
  mock.clock(on, { now: 0 })
  on('session.measure', ($, e) => ({ changed: e.changed }))
  on('ui.render', { component: 'AbovePrompt' }, () => <></>)
  await $.session.measure({ context: { window: 200000, percent: 63 }, rateLimits: [
    { kind: 'five_hour', percentUsed: 42 }, { kind: 'seven_day', percentUsed: 18 },
  ], changed: ['context', 'rateLimits'] })
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'usage-ball', surface, component: 'AbovePrompt', props: {
      hasSurvey: false, isWorking: false, maxRows: 2, bodyColumns: 96,
      scroll: { offset: 0, bodyRows: 2 }, view: {},
    } })
    const tree = await ui.drawn()
    expect(JSON.stringify(tree)).toMatch('ctx')
    expect(JSON.stringify(tree)).toMatch('5h')
    expect(JSON.stringify(tree)).toMatch('7d')
    expect(JSON.stringify(tree)).toMatch('"color":"warning"')
    await ui.unmount()
  }
})

test('AbovePrompt leaves four terminal columns for the collapse control', async ($, on) => {
  mock.clock(on, { now: Date.parse('2026-10-04T00:00:00Z') })
  on('session.measure', ($, e) => ({ changed: e.changed }))
  await $.session.measure({
    context: { window: 200000, percent: 23 },
    rateLimits: [
      { kind: 'five_hour', percentUsed: 21, resetsAt: '2026-10-04T02:49:00Z' },
      { kind: 'seven_day', percentUsed: 18, resetsAt: '2026-10-04T04:00:00Z' },
    ],
    changed: ['context', 'rateLimits'],
  })
  const ui = await $.ui.mount({ plugin: 'usage-ball', surface: 'terminal', component: 'AbovePrompt', props: {
    hasSurvey: false, isWorking: false, maxRows: 2, bodyColumns: 96,
    scroll: { offset: 0, bodyRows: 2 }, view: {},
  } })
  const drawn = await ui.drawn()
  const text = (node: unknown): string => {
    if (typeof node === 'string') return node
    if (Array.isArray(node)) return node.map(text).join('')
    if (node && typeof node === 'object' && 'children' in node) return text(node.children)
    return ''
  }
  const firstLine = text((drawn as { children: unknown[] }).children[0])
  const secondLine = text((drawn as { children: unknown[] }).children[1])
  expect(firstLine).toMatch('21% (2h49m)')
  expect(secondLine).toMatch('18% (4h0m)')
  expect(firstLine.length).toBeLessThanOrEqual(92)
  expect(secondLine.length).toBeLessThanOrEqual(92)
  expect(firstLine.indexOf('(')).toBe(secondLine.indexOf('('))
  await ui.unmount()
})

test('narrow widths shrink bars then hide reset and bars without wrapping', () => {
  const usage = { fiveHour: { percent: 42, resetsAt: '2026-10-04T02:13:00Z' }, sevenDay: { percent: 18 }, context: 63 }
  const medium = composeBand(55, usage, Date.parse('2026-10-04T00:00:00Z'))
  expect(medium[0]).toMatch(/⣿⣿⣀⣀⣀/)
  expect(medium[0].length).toBeLessThanOrEqual(55)
  const narrow = composeBand(40, usage, Date.parse('2026-10-04T00:00:00Z'))
  expect(narrow).toHaveLength(2)
  expect(narrow[0]).toMatch('⣿⣿⣀⣀⣀')
  expect(narrow[0]).not.toMatch('(2h13m)')
  expect(narrow[1].length).toBeLessThanOrEqual(40)
  expect(composeBand(30, usage, 0)).toHaveLength(2)
  const warnings = composeBand(40, { fiveHour: { percent: 80 }, sevenDay: { percent: 80 }, context: 70 }, 0)
  expect(warnings[0]).toMatch('⚠️ 20% left')
  expect(warnings[1]).toMatch('ctx ⚠️ 30% left')
  expect(warnings[1]).toMatch('7d')
  expect(warnings[1].replaceAll('\uFE0F', '').length).toBeLessThanOrEqual(40)
})

test('a new reading advances the visible bar with the mocked clock', async ($, on) => {
  const clock = mock.clock(on, { now: 0 })
  on('session.measure', ($, e) => ({ changed: e.changed }))
  const ui = await $.ui.mount({ plugin: 'usage-ball', surface: 'terminal', component: 'AbovePrompt', props: {
    hasSurvey: false, isWorking: false, maxRows: 2, bodyColumns: 96,
    scroll: { offset: 0, bodyRows: 2 }, view: {},
  } })
  await $.session.measure({ context: { window: 200000 }, rateLimits: [{ kind: 'five_hour', percentUsed: 50 }], changed: ['rateLimits'] })
  expect(JSON.stringify(await ui.drawn())).toMatch('50%')
  await clock.advance(100)
  expect(JSON.stringify(await ui.drawn())).toMatch('⡇⣀⣀⣀⣀⣀⣀⣀⣀⣀')
  await clock.advance(900)
  expect(JSON.stringify(await ui.drawn())).toMatch('⣿⣿⣿⣿⣿⣀⣀⣀⣀⣀')
  await ui.unmount()
})

test('idle reset countdown advances by two minutes without a new measurement', async ($, on) => {
  const clock = mock.clock(on, { now: Date.parse('2026-10-04T00:00:00Z') })
  let minuteWrites = 0
  on('state.set', ($, e, next) => {
    if (e.plugin === 'usage-ball' && e.key === 'display' && typeof (e.value as { minute?: number }).minute === 'number') minuteWrites++
    return next(e)
  })
  on('session.measure', ($, e) => ({ changed: e.changed }))
  await $.session.measure({
    context: { window: 200000 },
    rateLimits: [{ kind: 'five_hour', percentUsed: 42, resetsAt: '2026-10-04T02:13:00Z' }],
    changed: ['rateLimits'],
  })
  const ui = await $.ui.mount({ plugin: 'usage-ball', surface: 'terminal', component: 'AbovePrompt', props: {
    hasSurvey: false, isWorking: false, maxRows: 2, bodyColumns: 96,
    scroll: { offset: 0, bodyRows: 2 }, view: {},
  } })
  expect(JSON.stringify(await ui.drawn())).toMatch('(2h13m)')
  await clock.advance(120_000)
  expect(JSON.stringify(await ui.drawn())).toMatch('(2h11m)')
  expect(minuteWrites).toBe(2)
  await ui.unmount()
})

test('turn completion flashes a high warning then leaves it visible', async ($, on) => {
  const clock = mock.clock(on, { now: 0 })
  on('session.measure', ($, e) => ({ changed: e.changed }))
  on('turn.complete', ($, e) => ({ text: e.answer }))
  on('ui.toast', () => ({ value: undefined }))
  const ui = await $.ui.mount({ plugin: 'usage-ball', surface: 'terminal', component: 'AbovePrompt', props: {
    hasSurvey: false, isWorking: false, maxRows: 2, bodyColumns: 96,
    scroll: { offset: 0, bodyRows: 2 }, view: {},
  } })
  await $.session.measure({ context: { window: 200000 }, rateLimits: [{ kind: 'five_hour', percentUsed: 80 }], changed: ['rateLimits'] })
  await $.turn.complete({ answer: 'done', durationMs: 1000, isAborted: false, turnId: 't1', reason: 'answer' })
  expect(JSON.stringify(await ui.drawn())).toMatch('⚠')
  await clock.advance(250)
  expect(JSON.stringify(await ui.drawn())).not.toMatch('⚠')
  await clock.advance(2750)
  expect(JSON.stringify(await ui.drawn())).toMatch('⚠')
  await ui.unmount()
})

test('AbovePrompt yields to a survey', async ($, on) => {
  on('ui.render', { component: 'AbovePrompt' }, () => <></>)
  const ui = await $.ui.mount({ plugin: 'usage-ball', surface: 'terminal', component: 'AbovePrompt', props: {
    hasSurvey: true, isWorking: false, maxRows: 2, bodyColumns: 96,
    scroll: { offset: 0, bodyRows: 2 }, view: {},
  } })
  expect(JSON.stringify(await ui.drawn())).not.toMatch('ctx')
  await ui.unmount()
})

test('progress puts the air row on line one and track, count, name and ctx on line two', () => {
  const usage = { fiveHour: { percent: 42 }, sevenDay: { percent: 18 }, context: 63 }
  const rows = composeBand(96, usage, 0, 80, 70, true, undefined, { air: '', ground: '✓━━━━✓━━━━●┄┄┄┄○┄┄┄┄○', done: 2, total: 5, name: '小球進度' })
  expect(rows[1]).toMatch(/^  ✓━━━━✓━━━━●┄┄┄┄○┄┄┄┄○  2\/5 小球進度 · ctx ⣿⣿⣿⣀⣀  63%/)
  expect(cellWidth(rows[0])).toBe(96)
  expect(cellWidth(rows[1])).toBe(96)
  expect(cellWidth(rows[0].slice(0, rows[0].indexOf('5h')))).toBe(cellWidth(rows[1].slice(0, rows[1].indexOf('7d'))))
})

test('a narrow band hides the task name first and keeps the count', () => {
  const usage = { fiveHour: { percent: 42, resetsAt: '2026-10-04T02:13:00Z' }, sevenDay: { percent: 18 }, context: 63 }
  const rows = composeBand(84, usage, Date.parse('2026-10-04T00:00:00Z'), 80, 70, true, undefined, { air: '', ground: '✓━━━━✓━━━━●┄┄┄┄○┄┄┄┄○', done: 2, total: 5, name: 'Write the onboarding gu…' })
  expect(rows[1]).toMatch(/2\/5 · ctx/)
  expect(rows[1]).not.toMatch('Write')
  expect(rows[0]).toMatch('(2h13m)')
})

type Node = { type?: string; props?: Record<string, unknown>; children?: unknown }
const nodes = (node: unknown): Node[] => {
  if (Array.isArray(node)) return node.flatMap(nodes)
  if (!node || typeof node !== 'object') return []
  const n = node as Node
  return [n, ...nodes(n.children)]
}
const textOf = (node: unknown): string => {
  if (typeof node === 'string') return node
  if (Array.isArray(node)) return node.map(textOf).join('')
  if (node && typeof node === 'object' && 'children' in node) return textOf((node as Node).children)
  return ''
}
const desktopProps = { hasSurvey: false, isWorking: false, maxRows: 2, bodyColumns: 96, scroll: { offset: 0, bodyRows: 2 }, view: {} }

test('desktop pushes the quota block to the right edge with layout, not padding spaces', async ($, on) => {
  mock.clock(on, { now: Date.parse('2026-10-04T00:00:00Z') })
  on('session.measure', ($, e) => ({ changed: e.changed }))
  await $.session.measure({ context: { window: 200000, percent: 10 }, rateLimits: [
    { kind: 'five_hour', percentUsed: 45, resetsAt: '2026-10-04T03:02:00Z' },
    { kind: 'seven_day', percentUsed: 26, resetsAt: '2026-10-05T18:00:00Z' },
  ], changed: ['context', 'rateLimits'] })
  const ui = await $.ui.mount({ plugin: 'usage-ball', surface: 'desktop', component: 'AbovePrompt', props: desktopProps })
  const drawn = await ui.drawn()
  const spread = nodes(drawn).find(n => n.props?.justifyContent === 'space-between')
  expect(spread).toBeDefined()
  const [left, right] = spread!.children as unknown[]
  expect(textOf(left)).toMatch('ctx')
  expect(textOf(right)).toMatch('5h')
  expect(textOf(right)).toMatch('7d')
  expect(textOf(drawn)).not.toMatch(/ {6,}/)
  await ui.unmount()
})

test('desktop gives 5h and 7d the same column widths even when only one row warns', async ($, on) => {
  mock.clock(on, { now: Date.parse('2026-10-04T00:00:00Z') })
  on('session.measure', ($, e) => ({ changed: e.changed }))
  await $.session.measure({ context: { window: 200000, percent: 10 }, rateLimits: [
    { kind: 'five_hour', percentUsed: 91, resetsAt: '2026-10-04T03:02:00Z' },
    { kind: 'seven_day', percentUsed: 26 },
  ], changed: ['context', 'rateLimits'] })
  const ui = await $.ui.mount({ plugin: 'usage-ball', surface: 'desktop', component: 'AbovePrompt', props: desktopProps })
  const spread = nodes(await ui.drawn()).find(n => n.props?.justifyContent === 'space-between')!
  const right = (spread.children as unknown[])[1] as Node
  const [five = [], seven = []] = (right.children as Node[]).map(row => (row.children as Node[]).filter(Boolean).map(cell => cell.props?.width))
  expect(five).toEqual(seven)
  expect(five.every(w => typeof w === 'number')).toBe(true)
  await ui.unmount()
})

test('desktop draws the track and every bar as vector images, never braille or track glyphs', async ($, on) => {
  mock.clock(on, { now: 0 })
  on('session.measure', ($, e) => ({ changed: e.changed }))
  on('tool.call', { tool: 'TodoWrite' }, () => ({ result: {} }))
  await $.session.measure({ context: { window: 200000, percent: 17 }, rateLimits: [
    { kind: 'five_hour', percentUsed: 50 }, { kind: 'seven_day', percentUsed: 27 },
  ], changed: ['context', 'rateLimits'] })
  await $.tool.call({ tool: 'TodoWrite', todos: [
    { content: 'a', status: 'completed', activeForm: 'a' },
    { content: 'b', status: 'in_progress', activeForm: 'Write tests' },
  ] } as never)
  const ui = await $.ui.mount({ plugin: 'usage-ball', surface: 'desktop', component: 'AbovePrompt', props: { ...desktopProps, isWorking: true } })
  const drawn = await ui.drawn()
  const svgs = nodes(drawn).filter(n => n.type === 'Svg')
  expect(svgs).toHaveLength(4)
  expect(svgs.some(n => String(n.props?.source).includes('<animate') && n.props?.isInteractive === true)).toBe(true)
  expect(textOf(drawn)).not.toMatch(/[⣿⡇⣀✓━┄○●]/)
  await ui.unmount()
})
