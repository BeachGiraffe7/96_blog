import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
const server = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
})
after(() => server.close())
const m = await server.ssrLoadModule('/src/lib/growthState.js')
const clone = (v) => JSON.parse(JSON.stringify(v))
test('旧版 daily/weekly 保留 summary、三段复盘、评分和未知字段，不生成示例项目', () => {
  const d = {
    v: 1,
    days: {
      '2026-10-30': {
        summary: '旧笔记',
        tasks: [{ id: 'a', text: '单词', done: false }],
        extra: '保留',
      },
    },
    extra: 'root',
  }
  const w = {
    v: 1,
    weeks: {
      '2026-W43': { done: '完成', stuck: '卡点', next: '下周', score: 4 },
    },
  }
  const s = m.vaultState(d, w)
  assert.deepEqual(s.projects, [])
  assert.deepEqual(s.wins, [])
  assert.equal(s.days['2026-10-30'].summary, '旧笔记')
  assert.equal(s.weekly['2026-W43'].text, '完成\n\n卡点\n\n下周')
  assert.equal(s.weekly['2026-W43'].score, 4)
  const next = clone(s)
  next.weekly['2026-W43'].text = '新复盘'
  const out = m.patchVaultDocument(w, 'weekly', s, next)
  assert.equal(out.weeks['2026-W43'].score, 4)
  assert.equal(out.weeks['2026-W43'].done, '完成')
})
test('保存只修改编辑字段，保留另一设备新增日记录和同日其他字段', () => {
  const raw = {
    v: 1,
    days: {
      '2026-10-30': {
        tasks: [],
        learned: '旧学习',
        mood: '平静',
        extra: '保留',
      },
    },
    extra: 'root',
  }
  const base = m.vaultState(raw, {}),
    next = clone(base)
  next.days['2026-10-30'].tasks = [{ id: 'new', text: '背单词', done: true }]
  const remote = clone(raw)
  remote.days['2026-10-30'].learned = '其他设备新增学习'
  remote.days['2026-10-29'] = { summary: '昨天的新记录' }
  const out = m.patchVaultDocument(remote, 'daily', base, next)
  assert.equal(out.days['2026-10-30'].learned, '其他设备新增学习')
  assert.equal(out.days['2026-10-30'].extra, '保留')
  assert.equal(out.days['2026-10-29'].summary, '昨天的新记录')
  assert.equal(out.extra, 'root')
  assert(out.days['2026-10-30'].summary.includes('其他设备新增学习'))
})
test('同一任务列表并发修改拒绝覆盖；项目删除不删除历史任务', () => {
  const raw = {
    days: {
      '2026-10-30': {
        tasks: [
          {
            id: 'a',
            text: '旧任务',
            done: false,
            projectId: 'p',
            project: '英语',
          },
        ],
      },
    },
    projects: [{ id: 'p', name: '英语' }],
  }
  const base = m.vaultState(raw, {}),
    next = clone(base)
  next.days['2026-10-30'].tasks[0].done = true
  const other = clone(raw)
  other.days['2026-10-30'].tasks.push({
    id: 'b',
    text: '其他设备任务',
    done: false,
  })
  assert.throws(
    () => m.patchVaultDocument(other, 'daily', base, next),
    /其他设备更新/,
  )
  const deleted = clone(base)
  deleted.projects = []
  const out = m.patchVaultDocument(raw, 'daily', base, deleted)
  assert.deepEqual(out.projects, [])
  assert.equal(out.days['2026-10-30'].tasks[0].project, '英语')
})
test('保存回写只含 updatedAt/summary 差异时不产生无休止的新保存', () => {
  const a = m.vaultState(
    {
      days: {
        '2026-10-30': { learned: '内容', summary: '内容', updatedAt: 'old' },
      },
    },
    {},
  )
  const remote = clone(a)
  remote.days['2026-10-30'].updatedAt = 'server'
  assert.deepEqual(
    m.applyStateChanges(remote, a, remote, { check: false }),
    remote,
  )
  assert.equal(
    m.stateChanged(
      remote,
      m.applyStateChanges(remote, a, remote, { check: false }),
      'daily',
    ),
    false,
  )
})
test('撤销只反转该次编辑，不删除后台同步的新日期', () => {
  const before = m.vaultState({ days: { '2026-10-30': { tasks: [] } } }, {}),
    after = clone(before)
  after.days['2026-10-30'].tasks = [{ id: 'a', text: '行动' }]
  const current = clone(after)
  current.days['2026-10-29'] = { summary: '其他设备的新日期' }
  const undone = m.applyStateChanges(current, after, before)
  assert.equal(undone.days['2026-10-29'].summary, '其他设备的新日期')
  assert.deepEqual(undone.days['2026-10-30'].tasks, [])
})
test('日记录先成功、周复盘后失败时重试不会删除首次同步回来的其他日期', () => {
  const before = m.vaultState({ days: {} }, { weeks: {} }),
    snapshot = clone(before)
  snapshot.days['2026-10-30'] = { learned: '本地编辑' }
  snapshot.weekly['2026-W44'] = { text: '待保存复盘' }
  const received = m.vaultState(
    {
      days: {
        '2026-10-30': { learned: '本地编辑' },
        '2026-10-29': { learned: '其他设备新增' },
      },
    },
    { weeks: {} },
  )
  const rebased = m.applyStateChanges(received, snapshot, snapshot, {
    check: false,
  })
  const current = { ...snapshot, days: rebased.days }
  assert.equal(current.days['2026-10-29'].learned, '其他设备新增')
  assert.equal(current.weekly['2026-W44'].text, '待保存复盘')
})
