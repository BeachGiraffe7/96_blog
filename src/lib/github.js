// 浏览器直连 GitHub API：读取 / 提交单个文件
// 不需要服务器，token 存在本机 localStorage，不会进仓库、不会发给第三方

const API = 'https://api.github.com'

export const gh = {
  tokenKey: 'moments_pat',

  getToken() {
    try {
      return localStorage.getItem(this.tokenKey) || ''
    } catch {
      return ''
    }
  },

  setToken(token) {
    localStorage.setItem(this.tokenKey, token.trim())
  },

  clearToken() {
    localStorage.removeItem(this.tokenKey)
  },
}

const headers = (token) => ({
  Authorization: `Bearer ${token}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
})

// UTF-8 安全的 base64
const encodeB64 = (str) => {
  const bytes = new TextEncoder().encode(str)
  let bin = ''
  bytes.forEach((b) => {
    bin += String.fromCharCode(b)
  })
  return btoa(bin)
}

const decodeB64 = (b64) => {
  const bin = atob(b64.replace(/\s/g, ''))
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

// 统一超时：网络卡住时不要把界面永久挂在“加载中”
const TIMEOUT = 15000
const request = (url, options = {}) => {
  const opt = { ...options }
  if (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) {
    opt.signal = AbortSignal.timeout(TIMEOUT)
  }
  return fetch(url, opt)
}

async function handle(res) {
  if (res.ok) return res.json()
  let detail = ''
  try {
    const j = await res.json()
    detail = j.message || ''
  } catch {
    detail = res.statusText
  }
  if (res.status === 401) throw new Error('token 无效或已过期，请重新生成')
  if (res.status === 403) throw new Error('没有权限：确认 token 勾选了该仓库的 Contents 读写')
  if (res.status === 404) throw new Error('找不到仓库或文件：检查仓库名和 token 权限')
  if (res.status === 409) throw new Error('冲突：文件刚被改过，请重试一次')
  throw new Error(detail || `请求失败（${res.status}）`)
}

// 校验 token，返回仓库信息
export async function checkRepo({ repo, token }) {
  const res = await request(`${API}/repos/${repo}`, { headers: headers(token) })
  const data = await handle(res)
  return { fullName: data.full_name, private: data.private }
}

// 读取文件，返回 { sha, text }；文件不存在返回 null
export async function readFile({ repo, branch, path, token }) {
  const res = await request(`${API}/repos/${repo}/contents/${path}?ref=${branch}`, {
    headers: headers(token),
  })
  if (res.status === 404) return null
  const data = await handle(res)
  return { sha: data.sha, text: decodeB64(data.content) }
}

// 写入文件（带 sha 为更新，不带为新建）
export async function writeFile({ repo, branch, path, token, text, sha, message }) {
  const res = await request(`${API}/repos/${repo}/contents/${path}`, {
    method: 'PUT',
    headers: { ...headers(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      content: encodeB64(text),
      branch,
      ...(sha ? { sha } : {}),
    }),
  })
  const data = await handle(res)
  return { commitUrl: data.commit?.html_url || '', sha: data.content?.sha }
}

// 删除文件（需要 sha）
export async function deleteFile({ repo, branch, path, token, sha, message }) {
  const res = await request(`${API}/repos/${repo}/contents/${path}`, {
    method: 'DELETE',
    headers: { ...headers(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, sha, branch }),
  })
  const data = await handle(res)
  return { commitUrl: data.commit?.html_url || '' }
}

// 带 409 重试的「读-改-写」：手机上连着写两条时容易撞车
export async function updateText({ repo, branch, path, token, message, update, retries = 2 }) {
  let attempt = 0
  for (;;) {
    const file = await readFile({ repo, branch, path, token })
    const before = file ? file.text : ''
    const after = update(before)
    if (after === null) throw new Error('没有找到要修改的内容（可能已被改动，刷新重试）')
    try {
      return await writeFile({ repo, branch, path, token, text: after, sha: file?.sha, message })
    } catch (err) {
      attempt += 1
      if (attempt >= retries) throw err
    }
  }
}
