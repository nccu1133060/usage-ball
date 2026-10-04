import { test, expect } from 'claude-code/testing'
import { crossingAlerts } from './alerts'

test('first high reading alerts once per reset window and context rearms below threshold', () => {
  const high = { fiveHour: { percent: 80, resetsAt: '2026-10-04T02:00:00Z' }, context: 70 }
  const first = crossingAlerts({}, high, undefined, 80, 70)
  expect(first.kinds).toEqual(['5h', 'ctx'])
  expect(crossingAlerts(high, high, first.state, 80, 70).kinds).toEqual([])
  const rearmed = crossingAlerts(high, { ...high, context: 69 }, first.state, 80, 70)
  expect(crossingAlerts({ ...high, context: 69 }, high, rearmed.state, 80, 70).kinds).toEqual(['ctx'])
  const nextWindow = { ...high, fiveHour: { percent: 90, resetsAt: '2026-10-04T07:00:00Z' } }
  expect(crossingAlerts(high, nextWindow, first.state, 80, 70).kinds).toEqual(['5h'])
})

test('a quota without a reset time alerts at most once per conversation', () => {
  const high = { sevenDay: { percent: 85 } }
  const first = crossingAlerts({}, high, undefined, 80, 70)
  expect(first.kinds).toEqual(['7d'])
  const low = crossingAlerts(high, { sevenDay: { percent: 20 } }, first.state, 80, 70)
  expect(crossingAlerts({ sevenDay: { percent: 20 } }, high, low.state, 80, 70).kinds).toEqual([])
})
