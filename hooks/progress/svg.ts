import type { Pose } from './track'

export const BALL = '#D97757'
const WHITE = '#FFFFFF'
const GRAY = '#8A8A8A'
export const TRACK_HEIGHT = 40
const HEIGHT = TRACK_HEIGHT
const GROUND = 29

export function trackSvg({ total, shown, pose, hop = 0 }: { total: number; shown: number; pose: Pose; hop?: number }): string {
  const step = total > 8 ? 18 : 28
  const ball = Math.min(shown, total - 1)
  const first = total > 16 ? Math.max(0, ball - 3) : 0
  const last = total > 16 ? Math.min(total - 1, ball + 4) : total - 1
  const lead = first > 0 ? 14 : 0
  const x = (i: number) => 8 + lead + (i - first) * step
  const airborne = pose.kind === 'jump' ? pose.frame : 0
  const lifted = pose.kind === 'bounce' && pose.up
  const ballX = x(ball) + airborne / 4 * step
  const ballY = airborne > 0 ? GROUND - [0, 10, 14, 10][airborne]! : lifted ? GROUND - 12 : pose.kind === 'rest' ? GROUND - hop : GROUND
  const parts: string[] = []
  for (let i = first + 1; i <= last; i++) {
    parts.push(i <= ball
      ? `<line x1="${x(i - 1)}" y1="${GROUND}" x2="${x(i)}" y2="${GROUND}" stroke="${WHITE}" stroke-width="2"/>`
      : `<line x1="${x(i - 1)}" y1="${GROUND}" x2="${x(i)}" y2="${GROUND}" stroke="${GRAY}" stroke-width="1.5" stroke-dasharray="2 3"/>`)
  }
  for (let i = first; i <= last; i++) {
    const done = i < ball || (i === ball && (airborne > 0 || lifted))
    if (done) parts.push(`<circle cx="${x(i)}" cy="${GROUND}" r="4.5" fill="${WHITE}"/>`)
    else if (i > ball) parts.push(`<circle cx="${x(i)}" cy="${GROUND}" r="4" fill="none" stroke="${GRAY}" stroke-width="1.5"/>`)
  }
  parts.push(`<circle cx="${ballX}" cy="${ballY}" r="6" fill="${BALL}"/>`)
  if (first > 0) parts.push(`<text x="0" y="${GROUND + 4}" font-size="13" fill="${GRAY}">…</text>`)
  if (last < total - 1) parts.push(`<text x="${x(last) + 8}" y="${GROUND + 4}" font-size="13" fill="${GRAY}">…</text>`)
  let width = Math.max(x(last) + (last < total - 1 ? 24 : 10), ballX + 8)
  if (pose.kind === 'rest' && pose.sleep) {
    parts.push(`<text x="${x(ball) + 8}" y="14" font-size="13" font-family="sans-serif" fill="${GRAY}">${pose.sleep}</text>`)
    width = Math.max(width, x(ball) + 36)
  }
  if (pose.kind === 'bounce' && pose.sparkle) {
    parts.push(`<text x="${x(ball) + 10}" y="${GROUND + 5}" font-size="13">✨</text>`)
    width = Math.max(width, x(ball) + 30)
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${HEIGHT}" viewBox="0 0 ${width} ${HEIGHT}">${parts.join('')}</svg>`
}

export function svgWidth(source: string): number {
  return Number(source.match(/width="([\d.]+)"/)?.[1] ?? 0)
}
