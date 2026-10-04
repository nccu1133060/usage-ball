import { test, expect } from 'claude-code/testing'
import { nextBarPercent, warningVisible } from './animate'

test('bar advances one half-cell per 100ms and settles by one second', () => {
  expect(nextBarPercent(0, 50, 10, 100)).toBe(5)
  expect(nextBarPercent(5, 50, 10, 200)).toBe(10)
  expect(nextBarPercent(45, 50, 10, 300)).toBe(50)
  expect(nextBarPercent(0, 90, 10, 1000)).toBe(90)
})

test('warning glyph alternates every 250ms for three seconds', () => {
  expect(warningVisible(0)).toBe(true)
  expect(warningVisible(250)).toBe(false)
  expect(warningVisible(500)).toBe(true)
  expect(warningVisible(2750)).toBe(false)
  expect(warningVisible(3000)).toBe(true)
})
