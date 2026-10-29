import { useState } from 'react'
import { Icon } from '../Icons'

export default function TaskList({ tasks, onChange, readOnly }) {
  const [draft, setDraft] = useState('')

  const add = () => {
    const text = draft.trim()
    if (!text) return
    // 用时间戳而不是「当前条数 + 1」：删掉中间一条后再加会产生重复 id，
    // 重复 id 会让 React 的 key 冲突，勾选会串行
    const id = `t_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
    onChange([...tasks, { id, text, done: false }])
    setDraft('')
  }

  const toggle = (id) =>
    onChange(tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)))

  const remove = (id) => onChange(tasks.filter((t) => t.id !== id))

  const doneCount = tasks.filter((t) => t.done).length

  return (
    <div className="task-box">
      <div className="task-head">
        <span className="task-title">今日任务</span>
        <span className="task-progress">
          {doneCount}/{tasks.length}
        </span>
      </div>

      <ul className="task-list">
        {tasks.map((t) => (
          <li key={t.id} className={t.done ? 'task-item done' : 'task-item'}>
            <button
              type="button"
              className="task-check"
              onClick={() => !readOnly && toggle(t.id)}
              aria-label={t.done ? '标记未完成' : '标记完成'}
            >
              {t.done && <Icon.check />}
            </button>
            <span className="task-text" onDoubleClick={() => !readOnly && toggle(t.id)}>
              {t.text}
            </span>
            {!readOnly && (
              <button
                type="button"
                className="task-del"
                onClick={() => remove(t.id)}
                aria-label="删除"
              >
                <Icon.trash />
              </button>
            )}
          </li>
        ))}
        {!tasks.length && <li className="task-empty">还没有任务，先加一条</li>}
      </ul>

      {!readOnly && (
        <div className="task-add">
          <input
            className="growth-input"
            placeholder="加一条任务，回车确认"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                add()
              }
            }}
          />
          <button type="button" className="growth-btn ghost" onClick={add} disabled={!draft.trim()}>
            <Icon.plus />
          </button>
        </div>
      )}
    </div>
  )
}
