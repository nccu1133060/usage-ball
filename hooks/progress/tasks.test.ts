import { test, expect } from 'claude-code/testing'
import { applyTaskTool, taskProgress } from './tasks'

test('TaskCreate and TaskUpdate build a session list; the in-progress task is current', () => {
  let list = applyTaskTool([], 'TaskCreate', { subject: 'Parse checklist' })
  list = applyTaskTool(list, 'TaskCreate', { subject: 'Draw track', activeForm: 'Drawing the track' })
  list = applyTaskTool(list, 'TaskCreate', { subject: 'Sleep animation' })
  list = applyTaskTool(list, 'TaskUpdate', { taskId: '1', status: 'completed' })
  list = applyTaskTool(list, 'TaskUpdate', { taskId: '2', status: 'in_progress' })
  list = applyTaskTool(list, 'TaskUpdate', { taskId: '3', status: 'deleted' })
  expect(taskProgress(list)).toEqual({ done: 1, total: 2, current: 'Drawing the track' })
})

test('TodoWrite replaces the whole list', () => {
  const list = applyTaskTool([{ id: '1', subject: 'old', status: 'pending' }], 'TodoWrite', { todos: [
    { content: 'a', status: 'completed', activeForm: 'Doing a' },
    { content: 'b', status: 'pending', activeForm: 'Doing b' },
  ] })
  expect(taskProgress(list)).toEqual({ done: 1, total: 2, current: 'b' })
})

test('an empty list has no progress', () => {
  expect(taskProgress([])).toBeUndefined()
})

test('TaskCreate uses the id the tool returned', () => {
  const list = applyTaskTool([], 'TaskCreate', { subject: 'a' }, { task: { id: '7', subject: 'a' } })
  expect(list[0]?.id).toBe('7')
})
