/**
 * End-to-end check: two real accounts enter the arena queue, a match starts,
 * and the first game:question must carry a non-null imageUrl that resolves to
 * an actual file in web/public/arena/.
 */
const { io } = require('C:/Users/ADMIN/Desktop/DoAn/EnglishLearningApp/web/node_modules/socket.io-client')
const fs = require('fs')
const path = require('path')

const BASE = 'http://localhost:3000'
const ARENA = 'C:/Users/ADMIN/Desktop/DoAn/EnglishLearningApp/web/public/arena'

async function login(email, password) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const json = await res.json()
  if (!json?.data?.token) throw new Error(`login failed for ${email}: ${JSON.stringify(json).slice(0, 200)}`)
  return json.data
}

async function main() {
  const [a, b] = await Promise.all([
    login('test@test.com', '123456'),
    login('temp@engorace.dev', 'temp123456'),
  ])
  console.log('logged in users', a.user?.id, b.user?.id)

  const questions = []
  const sockets = [a, b].map((user, i) => {
    const s = io(BASE, { auth: { token: user.token }, reconnection: false, transports: ['websocket'] })
    s.on('connect', () => {
      console.log(`client ${i} connected (${s.id}), joining queue`)
      s.emit('match:join')
    })
    s.on('connect_error', (e) => console.log(`client ${i} connect_error`, e.message))
    s.on('match:found', (p) => console.log(`client ${i} match:found`, p.matchId))
    s.on('game:start', (p) => console.log(`client ${i} game:start`, JSON.stringify(p).slice(0, 120)))
    s.on('game:question', (p) => {
      questions.push(p)
      console.log(`client ${i} game:question round=${p.round} imageUrl=${p.imageUrl}`)
    })
    s.on('game:error', (p) => console.log(`client ${i} game:error`, JSON.stringify(p)))
    return s
  })

  await new Promise((resolve) => {
    const timer = setTimeout(() => resolve(), 15000)
    const poll = setInterval(() => {
      if (questions.length >= 2) { clearInterval(poll); clearTimeout(timer); resolve() }
    }, 200)
  })

  sockets.forEach((s) => s.disconnect())

  if (!questions.length) {
    console.log('RESULT: FAIL — no game:question received')
    process.exitCode = 1
    return
  }
  const urls = questions.map((q) => q.imageUrl)
  const checks = urls.map((u) => {
    if (!u) return { url: u, ok: false, reason: 'null imageUrl' }
    const file = path.join(ARENA, path.basename(u))
    const ok = fs.existsSync(file)
    return { url: u, ok, size: ok ? fs.statSync(file).size : 0 }
  })
  console.log('RESULT:', checks.every((c) => c.ok) ? 'PASS' : 'FAIL', JSON.stringify(checks))
  if (!checks.every((c) => c.ok)) process.exitCode = 1
}

main().catch((e) => { console.error(e); process.exit(1) })
