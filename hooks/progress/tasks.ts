import type { Progress } from './parse'

export type SessionTask = { id: string; subject: string; activeForm?: string; status: string }

export function applyTaskTool(list: SessionTask[], tool: string, input: Record<string, unknown>, result?: unknown): SessionTask[] {
  if (tool === 'TodoWrite' && Array.isArray(input.todos)) {
    return input.todos.map((todo: { content: string; status: string; activeForm?: string }, i) => ({
      id: String(i + 1), subject: todo.content, activeForm: todo.activeForm, status: todo.status,
    }))
  }
  if (tool === 'TaskCreate' && typeof input.subject === 'string') {
    const returned = (result as { task?: { id?: unknown } } | undefined)?.task?.id
    const id = typeof returned === 'string' ? returned : String(list.reduce((max, task) => Math.max(max, Number(task.id) || 0), 0) + 1)
    const activeForm = typeof input.activeForm === 'string' ? input.activeForm : undefined
    return [...list, { id, subject: input.subject, activeForm, status: 'pending' }]
  }
  if (tool === 'TaskUpdate' && typeof input.taskId === 'string') {
    if (input.status === 'deleted') return list.filter(task => task.id !== input.taskId)
    return list.map(task => task.id !== input.taskId ? task : {
      ...task,
      subject: typeof input.subject === 'string' ? input.subject : task.subject,
      activeForm: typeof input.activeForm === 'string' ? input.activeForm : task.activeForm,
      status: typeof input.status === 'string' ? input.status : task.status,
    })
  }
  return list
}

export function taskProgress(list: SessionTask[]): Progress | undefined {
  if (list.length === 0) return undefined
  const active = list.find(task => task.status === 'in_progress')
  const next = active ?? list.find(task => task.status !== 'completed')
  const current = next && (next === active ? next.activeForm ?? next.subject : next.subject)
  return { done: list.filter(task => task.status === 'completed').length, total: list.length, current }
}
