import { cellWidth } from '../usage/format'

export type Pose = { kind: 'rest'; sleep?: string } | { kind: 'jump'; frame: 1 | 2 | 3 } | { kind: 'bounce'; up: boolean; sparkle: boolean }

function gapFor(total: number): number {
  return total > 8 ? 2 : 4
}

export function jumpOffset(gap: number, frame: number): number {
  return Math.round(frame * (gap + 1) / 4)
}

export function drawTrack(total: number, done: number, pose: Pose): { air: string; ground: string; ballColumn: number } {
  const gap = gapFor(total)
  const ball = Math.min(done, total - 1)
  const first = total > 16 ? Math.max(0, ball - 3) : 0
  const last = total > 16 ? Math.min(total - 1, ball + 4) : total - 1
  const lead = first > 0 ? '…' : ''
  const nodeColumn = lead.length + (ball - first) * (gap + 1)
  const airborne = pose.kind === 'jump' ? jumpOffset(gap, pose.frame) : 0
  const cells: string[] = [lead]
  for (let i = first; i <= last; i++) {
    if (i > first) {
      const filled = i <= ball ? gap : i === ball + 1 && airborne > 0 ? airborne - 1 : 0
      cells.push('━'.repeat(filled) + '┄'.repeat(gap - filled))
    }
    cells.push(i < ball || (i === ball && airborne > 0) ? '✓' : i === ball ? '●' : '○')
  }
  if (last < total - 1) cells.push('…')
  const ballColumn = nodeColumn + airborne
  if (pose.kind === 'bounce') {
    if (pose.up) cells[cells.length - 1] = '✓'
    return {
      air: pose.up ? ' '.repeat(ballColumn) + '●' : '',
      ground: cells.join('') + (pose.sparkle ? ' ✨' : ''),
      ballColumn,
    }
  }
  const air = airborne > 0 ? ' '.repeat(ballColumn) + '●'
    : pose.kind === 'rest' && pose.sleep ? ' '.repeat(ballColumn + 1) + pose.sleep
    : ''
  return { air, ground: cells.join(''), ballColumn }
}

export function taskName(title: string | undefined): string {
  const name = (title ?? '').replace(/^Task\s*\d+\s*[：:]?\s*/i, '').trim()
  if (cellWidth(name) <= 24) return name
  let cut = ''
  for (const char of name) {
    if (cellWidth(cut + char) > 23) break
    cut += char
  }
  return cut + '…'
}
