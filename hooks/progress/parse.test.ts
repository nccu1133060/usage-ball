import { test, expect } from 'claude-code/testing'
import { parseChecklist, parseTasks } from './parse'

test('a 進度 checklist gives done, total and the first open item', () => {
  const md = '# HANDOFF\n\n## 進度\n\n- [x] Task 0 開工前準備\n- [x] Task 1 額度區\n- [ ] Task 2 小球進度\n- [ ] Task 3 開源收尾\n\n## 目前狀態\n\n- [ ] not a progress item\n'
  expect(parseChecklist(md)).toEqual({ done: 2, total: 4, current: 'Task 2 小球進度' })
})

test('without a checklist, Task headings with 狀態：完成 or archived files count as done', () => {
  const md = '# HANDOFF\n\n## Task 2：期限\n\n- 狀態：已合併 `main`\n\n## Task 3：提醒\n\n### Codex 填寫\n\n狀態：完成\n\n## Task 4：匯出\n\n狀態：\n\n## Task 5：分享\n'
  expect(parseTasks(md, ['2026-10-02-task-1.md', 'notes.md'])).toEqual({ done: 3, total: 5, current: 'Task 4：匯出' })
})

test('a file with neither a checklist nor Task headings has no progress', () => {
  expect(parseTasks('# Notes\n\nnothing here\n', [])).toBeUndefined()
})
