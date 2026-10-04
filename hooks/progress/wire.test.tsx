import { test, expect, mock } from 'claude-code/testing'

const props = { hasSurvey: false, isWorking: true, maxRows: 2, bodyColumns: 100, scroll: { offset: 0, bodyRows: 2 }, view: {} }

type Body = Extract<Parameters<typeof test>[1], (...args: never[]) => unknown>
type Engine = Parameters<Body>[0]
type Hooks = Parameters<Body>[1]

function textOf(node: unknown): string {
  if (typeof node === 'string') return node
  if (Array.isArray(node)) return node.map(textOf).join('')
  if (node && typeof node === 'object') {
    const children = (node as { children?: unknown; props?: { children?: unknown } }).children ?? (node as { props?: { children?: unknown } }).props?.children
    return textOf(children)
  }
  return ''
}

function files(on: Hooks, handoff: string | undefined, archive: string[] = []) {
  on('fs.read', ($, e) => handoff !== undefined && e.path.endsWith('HANDOFF.md') ? { value: handoff } : { deny: 'missing' })
  on('fs.list', ($, e) => e.path?.includes('handoff-archive') ? { value: archive.map(name => ({ name, kind: 'file' as const, size: 1, mtimeMs: 0, isLink: false })) } : { deny: 'missing' })
}

async function start($: Engine, on: Hooks) {
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 200000, percent: 23 }, rateLimits: [] } }))
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: 'C:/project', surface: 'terminal', isInteractive: true })
}

test('session start reads the HANDOFF checklist and draws the track with count and name', async ($, on) => {
  mock.clock(on, { now: 0 })
  files(on, '# HANDOFF\n\n## 進度\n\n- [x] Task 0 準備\n- [x] Task 1 額度區\n- [ ] Task 2 小球進度\n- [ ] Task 3 收尾\n')
  await start($, on)
  const ui = await $.ui.mount({ plugin: 'usage-ball', surface: 'terminal', component: 'AbovePrompt', props })
  expect(textOf(await ui.drawn())).toMatch('✓━━━━✓━━━━●┄┄┄┄○  2/4 小球進度 · ctx')
  await ui.unmount()
})

test('without a HANDOFF file the session task list drives the track', async ($, on) => {
  const clock = mock.clock(on, { now: 0 })
  files(on, undefined)
  let created = 0
  on('tool.call', ($, e) => e.tool === 'TaskCreate'
    ? { result: { task: { id: String(++created), subject: String(e.subject) } } }
    : { result: { success: true, taskId: 'taskId' in e ? String(e.taskId) : '', updatedFields: ['status'] } })
  await start($, on)
  await $.tool.call({ tool: 'TaskCreate', subject: 'Parse checklist', description: '' })
  await $.tool.call({ tool: 'TaskCreate', subject: 'Draw track', description: '' })
  await $.tool.call({ tool: 'TaskUpdate', taskId: '1', status: 'completed' })
  await clock.advance(300)
  const ui = await $.ui.mount({ plugin: 'usage-ball', surface: 'terminal', component: 'AbovePrompt', props })
  expect(textOf(await ui.drawn())).toMatch('✓━━━━●  1/2 Draw track · ctx')
  await ui.unmount()
})

test('turn completion re-reads HANDOFF so a newly checked item moves the count', async ($, on) => {
  const clock = mock.clock(on, { now: 0 })
  let handoff = '## 進度\n\n- [x] a\n- [ ] b\n- [ ] c\n'
  on('fs.read', ($, e) => e.path.endsWith('HANDOFF.md') ? { value: handoff } : { deny: 'missing' })
  on('fs.list', () => ({ deny: 'missing' }))
  on('turn.complete', ($, e) => ({ text: e.answer }))
  await start($, on)
  handoff = '## 進度\n\n- [x] a\n- [x] b\n- [ ] c\n'
  await $.turn.complete({ answer: 'done', durationMs: 1000, isAborted: false, turnId: 't1', reason: 'answer' })
  await clock.advance(2000)
  const ui = await $.ui.mount({ plugin: 'usage-ball', surface: 'terminal', component: 'AbovePrompt', props })
  expect(textOf(await ui.drawn())).toMatch('2/3 c · ctx')
  await ui.unmount()
})

test('a newly finished task makes the ball jump through the air row and land 300ms later', async ($, on) => {
  const clock = mock.clock(on, { now: 0 })
  let handoff = '## 進度\n\n- [x] a\n- [ ] b\n- [ ] c\n'
  on('fs.read', ($, e) => e.path.endsWith('HANDOFF.md') ? { value: handoff } : { deny: 'missing' })
  on('fs.list', () => ({ deny: 'missing' }))
  on('turn.complete', ($, e) => ({ text: e.answer }))
  await start($, on)
  const ui = await $.ui.mount({ plugin: 'usage-ball', surface: 'terminal', component: 'AbovePrompt', props })
  handoff = '## 進度\n\n- [x] a\n- [x] b\n- [ ] c\n'
  await $.turn.complete({ answer: 'done', durationMs: 1000, isAborted: false, turnId: 't1', reason: 'answer' })
  const airborne = textOf(await ui.drawn())
  expect(airborne).toMatch(/^ {8}●/)
  expect(airborne).toMatch('✓━━━━✓┄┄┄┄○  2/3')
  await clock.advance(300)
  expect(textOf(await ui.drawn())).toMatch('✓━━━━✓━━━━●  2/3')
  await ui.unmount()
})

test('finishing the last task bounces the ball at the end with a sparkle that fades after two seconds', async ($, on) => {
  const clock = mock.clock(on, { now: 0 })
  let handoff = '## 進度\n\n- [x] a\n- [ ] b\n'
  on('fs.read', ($, e) => e.path.endsWith('HANDOFF.md') ? { value: handoff } : { deny: 'missing' })
  on('fs.list', () => ({ deny: 'missing' }))
  on('turn.complete', ($, e) => ({ text: e.answer }))
  await start($, on)
  const ui = await $.ui.mount({ plugin: 'usage-ball', surface: 'terminal', component: 'AbovePrompt', props })
  handoff = '## 進度\n\n- [x] a\n- [x] b\n'
  await $.turn.complete({ answer: 'done', durationMs: 1000, isAborted: false, turnId: 't1', reason: 'answer' })
  await clock.advance(300)
  const landed = textOf(await ui.drawn())
  expect(landed).toMatch('✨')
  expect(landed).toMatch(/^ {7}●/)
  await clock.advance(150)
  expect(textOf(await ui.drawn())).toMatch('✓━━━━● ✨  2/2')
  await clock.advance(750 + 2000)
  const after = textOf(await ui.drawn())
  expect(after).not.toMatch('✨')
  expect(after).toMatch('✓━━━━●  2/2')
  await ui.unmount()
})

test('while Claude waits the ball sleeps: Z cycles each second, settles on zᶻ after ten, and vanishes while working', async ($, on) => {
  const clock = mock.clock(on, { now: 0 })
  files(on, '## 進度\n\n- [x] a\n- [ ] b\n')
  await start($, on)
  const ui = await $.ui.mount({ plugin: 'usage-ball', surface: 'terminal', component: 'AbovePrompt', props: { ...props, isWorking: false } })
  expect(textOf(await ui.drawn())).toMatch(/^ {8}z /)
  await clock.advance(1000)
  expect(textOf(await ui.drawn())).toMatch(/^ {8}zᶻ /)
  await clock.advance(1000)
  expect(textOf(await ui.drawn())).toMatch(/^ {8}zᶻz /)
  await clock.advance(8000)
  expect(textOf(await ui.drawn())).toMatch(/^ {8}zᶻ /)
  await clock.advance(5000)
  expect(textOf(await ui.drawn())).toMatch(/^ {8}zᶻ /)
  await ui.redraw({ ...props, isWorking: true })
  expect(textOf(await ui.drawn())).not.toMatch('z')
  await ui.unmount()
})

test('each finished turn starts a fresh sleep cycle', async ($, on) => {
  const clock = mock.clock(on, { now: 0 })
  files(on, '## 進度\n\n- [x] a\n- [ ] b\n')
  on('turn.start', ($, e) => ({ turnId: 't2' }))
  on('turn.complete', ($, e) => ({ text: e.answer }))
  await start($, on)
  const ui = await $.ui.mount({ plugin: 'usage-ball', surface: 'terminal', component: 'AbovePrompt', props: { ...props, isWorking: false } })
  await clock.advance(12_000)
  expect(textOf(await ui.drawn())).toMatch(/^ {8}zᶻ /)
  await $.turn.start({ turnId: 't2', text: 'go' })
  await $.turn.complete({ answer: 'done', durationMs: 1000, isAborted: false, turnId: 't2', reason: 'answer' })
  expect(textOf(await ui.drawn())).toMatch(/^ {8}z /)
  await clock.advance(2000)
  expect(textOf(await ui.drawn())).toMatch(/^ {8}zᶻz /)
  await ui.unmount()
})

test('with no progress source at all, a lone ball sleeps before ctx', async ($, on) => {
  mock.clock(on, { now: 0 })
  files(on, undefined)
  await start($, on)
  const ui = await $.ui.mount({ plugin: 'usage-ball', surface: 'terminal', component: 'AbovePrompt', props: { ...props, isWorking: false } })
  const drawn = textOf(await ui.drawn())
  expect(drawn).toMatch(/^ {3}z /)
  expect(drawn).toMatch('  ●  ctx ')
  expect(drawn).not.toMatch('0/0')
  await ui.unmount()
})

test('the ball is drawn in its own orange on terminal and desktop', async ($, on) => {
  mock.clock(on, { now: 0 })
  files(on, '## 進度\n\n- [x] a\n- [ ] b\n')
  await start($, on)
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'usage-ball', surface, component: 'AbovePrompt', props })
    expect(JSON.stringify(await ui.drawn())).toMatch('{"color":"#D97757"},"children":["●"]')
    await ui.unmount()
  }
})

test('the track still ahead is dim', async ($, on) => {
  mock.clock(on, { now: 0 })
  files(on, '## 進度\n\n- [x] a\n- [ ] b\n- [ ] c\n')
  await start($, on)
  const ui = await $.ui.mount({ plugin: 'usage-ball', surface: 'terminal', component: 'AbovePrompt', props })
  expect(JSON.stringify(await ui.drawn())).toMatch('{"dimColor":true},"children":["┄┄┄┄○"]')
  await ui.unmount()
})
