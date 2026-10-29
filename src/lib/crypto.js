// WebCrypto：PBKDF2 派生 + AES-GCM 加解密
// 只在 HTTPS / localhost 下可用（pages.dev 与 npm run dev 都满足）

const enc = new TextEncoder()
const dec = new TextDecoder()

export const encode = (s) => enc.encode(s)
export const decode = (b) => dec.decode(b)

// 大数组不能直接 spread 进 fromCharCode，分块处理
export const b64 = (buf) => {
  const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  let s = ''
  for (let i = 0; i < u8.length; i += 0x8000) {
    s += String.fromCharCode(...u8.subarray(i, i + 0x8000))
  }
  return btoa(s)
}

export const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))

export const newSalt = () => b64(crypto.getRandomValues(new Uint8Array(16)))

export async function deriveKey(password, saltB64, iter = 600000) {
  const base = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, [
    'deriveKey',
  ])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: unb64(saltB64), iterations: iter, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false, // 不可导出：即使网页被注入脚本也拿不到密钥
    ['encrypt', 'decrypt'],
  )
}

export async function seal(key, obj, aad) {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: enc.encode(aad), tagLength: 128 },
    key,
    enc.encode(JSON.stringify(obj)),
  )
  return { iv: b64(iv), ct: b64(ct) }
}

// 密码错误或文件损坏都会抛错
export async function open(key, env, aad) {
  const pt = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: unb64(env.iv), additionalData: enc.encode(aad), tagLength: 128 },
    key,
    unb64(env.ct),
  )
  return JSON.parse(dec.decode(pt))
}
