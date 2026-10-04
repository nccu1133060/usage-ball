import { test, expect } from 'claude-code/testing'
import { drawTrack, taskName } from './track'

test('at rest the ball sits on the first open node', () => {
  expect(drawTrack(5, 2, { kind: 'rest' })).toEqual({ air: '', ground: '✓━━━━✓━━━━●┄┄┄┄○┄┄┄┄○', ballColumn: 10 })
})

test('mid-jump the ball rises into the air row and the track fills behind it', () => {
  expect(drawTrack(5, 2, { kind: 'jump', frame: 1 })).toEqual({ air: '           ●', ground: '✓━━━━✓━━━━✓┄┄┄┄○┄┄┄┄○', ballColumn: 11 })
  expect(drawTrack(5, 2, { kind: 'jump', frame: 2 })).toEqual({ air: '             ●', ground: '✓━━━━✓━━━━✓━━┄┄○┄┄┄┄○', ballColumn: 13 })
})

test('when everything is done the ball bounces on the last node beside a sparkle', () => {
  expect(drawTrack(3, 3, { kind: 'bounce', up: true, sparkle: true })).toEqual({ air: '          ●', ground: '✓━━━━✓━━━━✓ ✨', ballColumn: 10 })
  expect(drawTrack(3, 3, { kind: 'bounce', up: false, sparkle: true })).toEqual({ air: '', ground: '✓━━━━✓━━━━● ✨', ballColumn: 10 })
})

test('a sleeping ball shows its Z in the air row, up and to the right, leaving the track still', () => {
  expect(drawTrack(5, 2, { kind: 'rest', sleep: 'zᶻ' })).toEqual({ air: '           zᶻ', ground: '✓━━━━✓━━━━●┄┄┄┄○┄┄┄┄○', ballColumn: 10 })
})

test('more than eight tasks tighten the gaps to two cells', () => {
  expect(drawTrack(9, 1, { kind: 'rest' }).ground).toBe('✓━━●┄┄○┄┄○┄┄○┄┄○┄┄○┄┄○┄┄○')
})

test('more than sixteen tasks show three nodes behind and four ahead, with ellipses', () => {
  expect(drawTrack(20, 10, { kind: 'rest' })).toEqual({ air: '', ground: '…✓━━✓━━✓━━●┄┄○┄┄○┄┄○┄┄○…', ballColumn: 10 })
})

test('task names drop the Task N prefix and stop at 24 cells', () => {
  expect(taskName('Task 2：小球進度')).toBe('小球進度')
  expect(taskName('Task 4 Write the onboarding guide for new contributors')).toBe('Write the onboarding gu…')
  expect(taskName(undefined)).toBe('')
})

test('a long Chinese task name is cut by cells, not characters', () => {
  expect(taskName('Task 9：一二三四五六七八九十甲乙丙丁戊')).toBe('一二三四五六七八九十甲…')
})
