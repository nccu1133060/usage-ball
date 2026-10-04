import { test, expect, mock } from 'claude-code/testing'

test('session measurement stores five-hour, seven-day and context while ignoring other windows', async ($, on) => {
  let stored: unknown
  mock.clock(on, { now: 0 })
  on('state.set', ($, e) => {
    if (e.plugin === 'usage-ball' && e.key === 'usage') stored = e.value
    return { value: { isSet: true as const, version: 1 } }
  })
  on('session.measure', ($, e) => ({ changed: e.changed }))
  await $.session.measure({
    context: { window: 200000, percent: 63 },
    rateLimits: [
      { kind: 'five_hour', percentUsed: 42, resetsAt: '2026-10-04T02:13:00Z' },
      { kind: 'seven_day', percentUsed: 18 },
      { kind: 'spend_limit', percentUsed: 90 },
    ],
    changed: ['context', 'rateLimits'],
  })
  expect(stored).toMatchObject({ fiveHour: { percent: 42 }, sevenDay: { percent: 18 }, context: 63 })
})

test('session start shows existing usage before any measurement event', async ($, on) => {
  mock.clock(on, { now: Date.parse('2026-10-04T00:00:00Z') })
  on('session.usage', () => ({ value: {
    startedAt: 0,
    context: { window: 200000, percent: 23 },
    rateLimits: [
      { kind: 'five_hour', percentUsed: 17, resetsAt: '2026-10-04T02:13:00Z' },
      { kind: 'seven_day', percentUsed: 12, resetsAt: '2026-10-08T06:00:00Z' },
    ],
  } }))
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: 'C:/usage-ball', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount({ plugin: 'usage-ball', surface: 'terminal', component: 'AbovePrompt', props: {
    hasSurvey: false, isWorking: false, maxRows: 2, bodyColumns: 96,
    scroll: { offset: 0, bodyRows: 2 }, view: {},
  } })
  const drawn = JSON.stringify(await ui.drawn())
  expect(drawn).toMatch('17%')
  expect(drawn).toMatch('12%')
  expect(drawn).toMatch('23%')
  await ui.unmount()
})

test('a threshold alert appears once for each reset window', async ($, on) => {
  mock.clock(on, { now: Date.parse('2026-10-04T00:00:00Z') })
  const toasts: string[] = []
  on('ui.toast', ($, e) => { toasts.push(e.text); return { value: undefined } })
  on('session.measure', ($, e) => ({ changed: e.changed }))
  const measure = (percentUsed: number, resetsAt: string) => $.session.measure({
    context: { window: 200000 },
    rateLimits: [{ kind: 'five_hour', percentUsed, resetsAt }], changed: ['rateLimits'],
  })
  await measure(80, '2026-10-04T02:00:00Z')
  await measure(85, '2026-10-04T02:00:00Z')
  expect(toasts).toHaveLength(1)
  expect(toasts[0]).toMatch('5h usage passed 80%')
  await measure(80, '2026-10-04T07:00:00Z')
  expect(toasts).toHaveLength(2)
})

test('custom warning percentages change quota and context alerts', { options: { warnPercent: 60, ctxWarnPercent: 50 } }, async ($, on) => {
  const toasts: string[] = []
  mock.clock(on, { now: 0 })
  on('ui.toast', ($, e) => { toasts.push(e.text); return { value: undefined } })
  on('session.measure', ($, e) => ({ changed: e.changed }))
  await $.session.measure({
    context: { window: 200000, percent: 50 },
    rateLimits: [{ kind: 'five_hour', percentUsed: 60 }],
    changed: ['context', 'rateLimits'],
  })
  expect(toasts).toEqual(['5h usage passed 60%', 'ctx usage passed 50%'])
})
