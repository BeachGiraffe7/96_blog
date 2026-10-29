// 成长专栏的“保险箱”：解锁、读取、保存
// 密钥只在内存里，密码只放 sessionStorage（关掉标签页即失效）
import { GROWTH } from '../data/growth'
import { deriveKey, seal, open, b64, unb64, encode, decode } from './crypto'
import { gh, readFile, writeFile } from './github'

const PW_KEY = 'growth_pw'

let KEY = null
let SALT = null

export const isUnlocked = () => Boolean(KEY)
export const hasToken = () => Boolean(gh.getToken())

export function lock() {
  KEY = null
  SALT = null
  try {
    sessionStorage.removeItem(PW_KEY)
  } catch {
    /* 隐私模式下不可用，忽略 */
  }
}

const conf = (kind) => GROWTH.files[kind]

async function fetchEnvelopeText(kind) {
  const token = gh.getToken()
  const c = conf(kind)
  if (token) {
    const f = await readFile({ repo: GROWTH.repo, branch: GROWTH.branch, path: c.path, token })
    if (!f) throw new Error('还没有数据文件，先用脚本初始化')
    return f.text
  }
  const opts = { cache: 'no-store' }
  if (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) opts.signal = AbortSignal.timeout(15000)
  const res = await fetch(`${c.url}?t=${Date.now()}`, opts)
  if (!res.ok) throw new Error('读取数据失败，检查网络后重试')
  return res.text()
}

export async function unlock(password) {
  const env = JSON.parse(await fetchEnvelopeText('daily'))
  if (!env?.kdf?.salt) throw new Error('数据文件损坏，建议用脚本重建')
  const key = await deriveKey(password, env.kdf.salt, env.kdf.iter || GROWTH.iter)
  // 用 daily 试解一次：GCM 认证失败 = 密码不对
  await open(key, env, conf('daily').aad)
  KEY = key
  SALT = env.kdf.salt
  try {
    sessionStorage.setItem(PW_KEY, b64(encode(password)))
  } catch {
    /* 忽略 */
  }
  return true
}

// 刷新后免重输：只在同一个标签页会话里有效
export async function tryRestore() {
  let raw = ''
  try {
    raw = sessionStorage.getItem(PW_KEY) || ''
  } catch {
    return false
  }
  if (!raw) return false
  try {
    await unlock(decode(unb64(raw)))
    return true
  } catch {
    return false
  }
}

const emptyData = (kind) => (kind === 'daily' ? { v: 1, days: {} } : { v: 1, weeks: {} })

export async function loadData(kind) {
  if (!KEY) throw new Error('未解锁')
  const env = JSON.parse(await fetchEnvelopeText(kind))
  return open(KEY, env, conf(kind).aad)
}

// 读-改-写：mutator 必须是纯函数，409 重试时会在最新数据上重放
export async function saveData(kind, mutator) {
  if (!KEY) throw new Error('未解锁')
  if (!hasToken()) throw new Error('未连接 GitHub，只能查看')

  const token = gh.getToken()
  const c = conf(kind)

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const file = await readFile({ repo: GROWTH.repo, branch: GROWTH.branch, path: c.path, token })
    const env = file ? JSON.parse(file.text) : null
    const base = env ? await open(KEY, env, c.aad) : emptyData(kind)
    const next = mutator(structuredClone ? structuredClone(base) : JSON.parse(JSON.stringify(base)))

    const { iv, ct } = await seal(KEY, next, c.aad)
    const envelope = {
      v: GROWTH.v,
      alg: 'AES-GCM-256',
      aad: c.aad,
      kdf: {
        name: 'PBKDF2',
        hash: 'SHA-256',
        iter: env?.kdf?.iter || GROWTH.iter,
        salt: env?.kdf?.salt || SALT,
      },
      iv,
      ct,
    }

    try {
      await writeFile({
        repo: GROWTH.repo,
        branch: GROWTH.branch,
        path: c.path,
        token,
        text: JSON.stringify(envelope),
        sha: file?.sha,
        message: 'growth: update',
      })
      return next
    } catch (err) {
      // 另一台设备刚写过：重试一次会在新数据上重放 mutator
      if (attempt === 1) throw err
    }
  }
}
