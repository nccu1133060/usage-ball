import { test, expect } from 'claude-code/testing'
import { trackSvg } from './svg'

const circles = (svg: string) => [...svg.matchAll(/<circle [^>]*>/g)].map(m => m[0])

test('finished nodes are solid white, the current one orange, the rest hollow', () => {
  const svg = trackSvg({ total: 4, shown: 2, pose: { kind: 'rest' }, hop: 0 })
  const nodes = circles(svg)
  expect(nodes.filter(c => c.includes('fill="#FFFFFF"'))).toHaveLength(2)
  expect(nodes.filter(c => c.includes('fill="#D97757"'))).toHaveLength(1)
  expect(nodes.filter(c => c.includes('fill="none"'))).toHaveLength(1)
})

test('walked segments are solid white and the segments ahead are dashed gray', () => {
  const lines = [...trackSvg({ total: 4, shown: 2, pose: { kind: 'rest' }, hop: 0 }).matchAll(/<line [^>]*>/g)].map(m => m[0])
  expect(lines).toHaveLength(3)
  expect(lines.slice(0, 2).every(l => l.includes('stroke="#FFFFFF"') && !l.includes('dasharray'))).toBe(true)
  expect(lines[2]).toMatch('stroke-dasharray')
})

test('a resting ball is drawn lifted by the bounce height of the current frame, never self-animating', () => {
  const cy = (svg: string) => Number(circles(svg).find(c => c.includes('#D97757'))!.split('cy="')[1]!.split('"')[0])
  const lifted = trackSvg({ total: 4, shown: 2, pose: { kind: 'rest' }, hop: 10 })
  expect(cy(lifted)).toBe(19)
  expect(cy(trackSvg({ total: 4, shown: 2, pose: { kind: 'rest' }, hop: 0 }))).toBe(29)
  expect(lifted).not.toMatch('<animate')
})

test('a jump lifts the ball between nodes and leaves its old node white', () => {
  const svg = trackSvg({ total: 4, shown: 1, pose: { kind: 'jump', frame: 2 }, hop: 0 })
  const nodes = circles(svg)
  const ball = nodes.find(c => c.includes('#D97757'))!
  const at = (c: string, key: string) => Number(c.split(`${key}="`)[1]!.split('"')[0])
  expect(nodes.filter(c => c.includes('fill="#FFFFFF"'))).toHaveLength(2)
  expect(at(ball, 'cx')).toBeGreaterThan(36)
  expect(at(ball, 'cx')).toBeLessThan(64)
  expect(at(ball, 'cy')).toBeLessThan(29)
  expect(svg).not.toMatch('<animate')
})

test('a sleeping ball shows its Z above and to the right', () => {
  const svg = trackSvg({ total: 4, shown: 2, pose: { kind: 'rest', sleep: 'zᶻ' }, hop: 0 })
  const text = svg.match(/<text [^>]*>zᶻ<\/text>/)?.[0]
  expect(text).toBeDefined()
  expect(Number(text!.split('x="')[1]!.split('"')[0])).toBeGreaterThan(64)
  expect(Number(text!.split('y="')[1]!.split('"')[0])).toBeLessThan(29)
})

test('finishing bounces the ball over the last node with a sparkle beside it', () => {
  const up = trackSvg({ total: 3, shown: 3, pose: { kind: 'bounce', up: true, sparkle: true }, hop: 0 })
  const ball = circles(up).find(c => c.includes('#D97757'))!
  expect(Number(ball.split('cy="')[1]!.split('"')[0])).toBeLessThan(29)
  expect(circles(up).filter(c => c.includes('fill="#FFFFFF"'))).toHaveLength(3)
  expect(up).toMatch('✨')
  const down = trackSvg({ total: 3, shown: 3, pose: { kind: 'bounce', up: false, sparkle: true }, hop: 0 })
  expect(Number(circles(down).find(c => c.includes('#D97757'))!.split('cy="')[1]!.split('"')[0])).toBe(29)
  expect(down).toMatch('✨')
})

test('more than sixteen tasks shows three before and four after the ball with ellipses', () => {
  const svg = trackSvg({ total: 20, shown: 10, pose: { kind: 'rest' }, hop: 0 })
  const nodes = circles(svg)
  expect(nodes.filter(c => c.includes('fill="#FFFFFF"'))).toHaveLength(3)
  expect(nodes.filter(c => c.includes('fill="none"'))).toHaveLength(4)
  expect(svg.match(/…/g)).toHaveLength(2)
})

test('the final completion jump stays inside the drawing', () => {
  const svg = trackSvg({ total: 4, shown: 3, pose: { kind: 'jump', frame: 3 }, hop: 0 })
  const ball = circles(svg).find(c => c.includes('#D97757'))!
  const width = Number(svg.split('width="')[1]!.split('"')[0])
  expect(Number(ball.split('cx="')[1]!.split('"')[0]) + 6).toBeLessThanOrEqual(width)
})
