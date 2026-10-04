export type Progress = { done: number; total: number; current?: string }

function section(md: string, heading: RegExp): string | undefined {
  const lines = md.split(/\r?\n/)
  const start = lines.findIndex(line => heading.test(line))
  if (start < 0) return undefined
  const end = lines.findIndex((line, i) => i > start && /^##\s/.test(line))
  return lines.slice(start + 1, end < 0 ? undefined : end).join('\n')
}

export function parseChecklist(md: string): Progress | undefined {
  const body = section(md, /^##\s*進度\s*$/)
  if (body === undefined) return undefined
  const items = [...body.matchAll(/^\s*[-*]\s+\[([ xX])\]\s+(.*)$/gm)].map(m => ({ done: m[1] !== ' ', text: (m[2] ?? '').trim() }))
  if (items.length === 0) return undefined
  return { done: items.filter(i => i.done).length, total: items.length, current: items.find(i => !i.done)?.text }
}

export function parseTasks(md: string, archive: string[]): Progress | undefined {
  const tasks = new Map<number, { title: string; done: boolean }>()
  for (const name of archive) {
    const match = /task-(\d+)/i.exec(name)
    if (match) tasks.set(Number(match[1]), { title: `Task ${match[1]}`, done: true })
  }
  const blocks = md.split(/^(?=##\s+Task\s*\d+)/m)
  for (const block of blocks) {
    const heading = /^##\s+(Task\s*(\d+).*)$/m.exec(block)
    if (!heading) continue
    const done = /狀態：\s*(完成|已合併)/.test(block)
    const number = Number(heading[2] ?? 0)
    tasks.set(number, { title: (heading[1] ?? '').trim(), done: done || tasks.get(number)?.done === true })
  }
  if (tasks.size === 0) return undefined
  const ordered = [...tasks.entries()].sort((a, b) => a[0] - b[0]).map(([, task]) => task)
  return { done: ordered.filter(t => t.done).length, total: ordered.length, current: ordered.find(t => !t.done)?.title }
}
