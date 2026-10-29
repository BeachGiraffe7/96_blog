// 成长专栏密文的本地工具（Node 端，用 node:crypto）
//
//   GROWTH_PASS=你的密码 npm run growth:init      首次初始化（生成空数据 + 密文）
//   GROWTH_PASS=你的密码 npm run growth:decrypt   密文 → raw/growth/*.json
//   GROWTH_PASS=你的密码 npm run growth:encrypt   raw/growth/*.json → 密文
//   GROWTH_PASS=你的密码 npm run growth:verify    校验能否解密并打印统计
//   GROWTH_PASS=旧密码 GROWTH_NEW_PASS=新密码 npm run growth:passwd   换密码（新盐全量重加密）
//
// 密码只从环境变量读，代码里不出现明文。
import { pbkdf2Sync, randomBytes, createCipheriv, createDecipheriv } from 'node:crypto'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'

const ITER = 600000
const FILES = {
  daily: { enc: 'public/growth/daily.enc.json', raw: 'raw/growth/daily.json', aad: 'growth:daily:v1' },
  weekly: { enc: 'public/growth/weekly.enc.json', raw: 'raw/growth/weekly.json', aad: 'growth:weekly:v1' },
}
const EMPTY = { daily: { v: 1, days: {} }, weekly: { v: 1, weeks: {} } }

const cmd = process.argv[2] || 'help'
const pass = process.env.GROWTH_PASS || ''
const newPass = process.env.GROWTH_NEW_PASS || ''

const derive = (pw, salt) => pbkdf2Sync(pw, Buffer.from(salt, 'base64'), ITER, 32, 'sha256')

function seal(key, obj, aad) {
  const iv = randomBytes(12)
  const c = createCipheriv('aes-256-gcm', key, iv)
  c.setAAD(Buffer.from(aad))
  const ct = Buffer.concat([c.update(JSON.stringify(obj), 'utf8'), c.final()])
  return { iv: iv.toString('base64'), ct: Buffer.concat([ct, c.getAuthTag()]).toString('base64') }
}

function open(key, env, aad) {
  const buf = Buffer.from(env.ct, 'base64')
  const tag = buf.subarray(buf.length - 16)
  const ct = buf.subarray(0, buf.length - 16)
  const d = createDecipheriv('aes-256-gcm', key, Buffer.from(env.iv, 'base64'))
  d.setAAD(Buffer.from(aad))
  d.setAuthTag(tag)
  return JSON.parse(Buffer.concat([d.update(ct), d.final()]).toString('utf8'))
}

const envelope = (data, key, salt, aad) => {
  const { iv, ct } = seal(key, data, aad)
  return JSON.stringify({
    v: 1,
    alg: 'AES-GCM-256',
    aad,
    kdf: { name: 'PBKDF2', hash: 'SHA-256', iter: ITER, salt },
    iv,
    ct,
  })
}

const readJson = async (p) => JSON.parse(await readFile(p, 'utf8'))

function needPass() {
  if (!pass) {
    console.error('缺少密码：请用 GROWTH_PASS=你的密码 运行')
    process.exit(1)
  }
}

async function ensureDirs() {
  await mkdir('public/growth', { recursive: true })
  await mkdir('raw/growth', { recursive: true })
}

async function main() {
  if (cmd === 'help' || cmd === '--help') {
    console.log(`用法：
  GROWTH_PASS=xxx npm run growth:init
  GROWTH_PASS=xxx npm run growth:decrypt
  GROWTH_PASS=xxx npm run growth:encrypt
  GROWTH_PASS=xxx npm run growth:verify
  GROWTH_PASS=旧 GROWTH_NEW_PASS=新 npm run growth:passwd`)
    return
  }

  needPass()
  await ensureDirs()

  if (cmd === 'init') {
    if (existsSync(FILES.daily.enc) && !process.argv.includes('--force')) {
      console.error('密文已存在。真要重建请加 --force（会覆盖，不可恢复）')
      process.exit(1)
    }
    const salt = randomBytes(16).toString('base64')
    for (const [kind, f] of Object.entries(FILES)) {
      const data = EMPTY[kind]
      await writeFile(f.raw, JSON.stringify(data, null, 2), 'utf8')
      await writeFile(f.enc, envelope(data, derive(pass, salt), salt, f.aad), 'utf8')
      console.log(`初始化 ${f.enc}`)
    }
    if (pass.length < 6) {
      console.log('\n⚠ 密码长度只有 ' + pass.length + ' 位。仓库是公开的，密文可被离线爆破，建议至少 6 位。')
      console.log('   改密码：GROWTH_PASS=旧 GROWTH_NEW_PASS=新 npm run growth:passwd')
    }
    return
  }

  if (cmd === 'decrypt') {
    for (const [kind, f] of Object.entries(FILES)) {
      const env = await readJson(f.enc)
      const data = open(derive(pass, env.kdf.salt), env, f.aad)
      await writeFile(f.raw, JSON.stringify(data, null, 2), 'utf8')
      console.log(`解密 ${f.enc} → ${f.raw}`)
    }
    console.log('\n改完记得跑 npm run growth:encrypt 再提交。')
    return
  }

  if (cmd === 'encrypt') {
    for (const [kind, f] of Object.entries(FILES)) {
      const data = await readJson(f.raw)
      const old = existsSync(f.enc) ? await readJson(f.enc) : null
      const salt = old?.kdf?.salt || randomBytes(16).toString('base64')
      await writeFile(f.enc, envelope(data, derive(pass, salt), salt, f.aad), 'utf8')
      console.log(`加密 ${f.raw} → ${f.enc}`)
    }
    return
  }

  if (cmd === 'verify') {
    for (const [kind, f] of Object.entries(FILES)) {
      const env = await readJson(f.enc)
      const data = open(derive(pass, env.kdf.salt), env, f.aad)
      if (kind === 'daily') {
        const days = Object.keys(data.days || {})
        const checked = days.filter((d) => (data.days[d].summary || '').trim())
        console.log(`daily: ${days.length} 天有记录，${checked.length} 天写了总结`)
      } else {
        console.log(`weekly: ${Object.keys(data.weeks || {}).length} 周`)
      }
    }
    return
  }

  if (cmd === 'passwd') {
    if (!newPass) {
      console.error('缺少新密码：GROWTH_NEW_PASS=新密码')
      process.exit(1)
    }
    if (newPass.length < 6) {
      console.log('提示：新密码不足 6 位，强度依然偏弱。')
    }
    const salt = randomBytes(16).toString('base64')
    for (const [kind, f] of Object.entries(FILES)) {
      const env = await readJson(f.enc)
      // 先解密（同时校验旧密码），再用新盐重加密
      const data = open(derive(pass, env.kdf.salt), env, f.aad)
      await writeFile(f.enc, envelope(data, derive(newPass, salt), salt, f.aad), 'utf8')
      console.log(`重加密 ${f.enc}`)
    }
    console.log('\n已完成：旧密码失效，所有设备需要重新解锁。')
    return
  }

  console.error(`未知命令：${cmd}`)
  process.exit(1)
}

main().catch((err) => {
  console.error('失败：', err.message)
  process.exit(1)
})
