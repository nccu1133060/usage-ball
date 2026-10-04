import { test, expect } from 'claude-code/testing'
import { barSvg, LEVEL_HEX } from './bar'

test('a bar fills its share of the width in the level color over a gray track', () => {
  const svg = barSvg(50, 120, 'warning')
  const rects = [...svg.matchAll(/<rect [^>]*>/g)].map(m => m[0])
  expect(rects).toHaveLength(2)
  expect(rects[0]).toMatch('width="120"')
  expect(rects[1]).toMatch('width="60"')
  expect(rects[1]).toMatch(`fill="${LEVEL_HEX.warning}"`)
  expect(barSvg(0, 120, 'success')).not.toMatch(LEVEL_HEX.success)
  expect(barSvg(130, 120, 'error')).toMatch('width="120" height="8" rx="4" fill="' + LEVEL_HEX.error)
})
