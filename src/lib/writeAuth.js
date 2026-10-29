// 撰写入口的口令：只是界面层的门，不是安全边界。
// 真正能不能发布由 GitHub token 决定，没 token 谁也发不出去。
const KEY = 'write_pass'
const PASS = 'try'

export const isWriteUnlocked = () => {
  try {
    return sessionStorage.getItem(KEY) === 'ok'
  } catch {
    return false
  }
}

export const unlockWrite = (input) => {
  if (String(input || '').trim().toLowerCase() !== PASS) return false
  try {
    sessionStorage.setItem(KEY, 'ok')
  } catch {
    /* 隐私模式下忽略，本次会话内仍可用 */
  }
  return true
}

export const lockWrite = () => {
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    /* 忽略 */
  }
}
