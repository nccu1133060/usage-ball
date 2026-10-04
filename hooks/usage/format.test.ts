import { test, expect } from 'claude-code/testing'
import { brailleBar, levelColor, formatReset, usageRow } from './format'

test('42 percent fills eight half cells in a ten-cell bar', () => {
  expect(brailleBar(42, 10)).toBe('⣿⣿⣿⣿⣀⣀⣀⣀⣀⣀')
})

test('rounded percentages cross the warning boundary consistently', () => {
  expect(levelColor(49.4, 80)).toBe('success')
  expect(levelColor(49.5, 80)).toBe('warning')
  expect(levelColor(79.5, 80)).toBe('error')
})

test('reset countdown uses minutes, hours or days with fixed width', () => {
  const now = Date.parse('2026-10-04T00:00:00Z')
  expect(formatReset('2026-10-04T00:42:00Z', now)).toBe('(42m)   ')
  expect(formatReset('2026-10-04T02:13:00Z', now)).toBe('(2h13m) ')
  expect(formatReset('2026-10-08T06:00:00Z', now)).toBe('(4d6h)  ')
  expect(formatReset(undefined, now)).toBe('        ')
})

test('quota row aligns columns and replaces warning percent with remaining amount', () => {
  const now = Date.parse('2026-10-04T00:00:00Z')
  const normal = usageRow('5h', 42, '2026-10-04T02:13:00Z', now, 80, 10)
  expect(normal.bar).toBe('⣿⣿⣿⣿⣀⣀⣀⣀⣀⣀')
  expect(normal.amount).toBe(' 42%')
  expect(normal.text.startsWith('5h   ⣿⣿⣿⣿')).toBe(true)
  expect(normal.text.endsWith('(2h13m) ')).toBe(true)
  const warning = usageRow('7d', 91, undefined, now, 80, 10)
  expect(warning.amount).toBe('⚠️ 9% left')
  expect(warning.color).toBe('error')
  expect(usageRow('5h', undefined, undefined, now, 80, 10).amount).toBe('   —')
})

test('a growing bar can show an earlier frame while the amount shows the latest reading', () => {
  const row = usageRow('5h', 50, undefined, 0, 80, 10, true, 5)
  expect(row.bar).toBe('⡇⣀⣀⣀⣀⣀⣀⣀⣀⣀')
  expect(row.amount).toBe(' 50%')
})

test('half-cell rounding and a five-cell context bar', () => {
  expect(brailleBar(45, 10)).toBe('⣿⣿⣿⣿⡇⣀⣀⣀⣀⣀')
  expect(brailleBar(0, 5)).toBe('⣀⣀⣀⣀⣀')
  expect(brailleBar(100, 5)).toBe('⣿⣿⣿⣿⣿')
  expect(brailleBar(63, 5)).toBe('⣿⣿⣿⣀⣀')
  expect(brailleBar(2.4, 10)).toBe('⣀⣀⣀⣀⣀⣀⣀⣀⣀⣀')
  expect(brailleBar(2.5, 10)).toBe('⡇⣀⣀⣀⣀⣀⣀⣀⣀⣀')
})
