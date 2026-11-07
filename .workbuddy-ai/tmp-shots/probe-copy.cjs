;(async () => {
  const login = await fetch('http://localhost:3000/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'test@test.com', password: '123456' }) })
  const auth = (await login.json()).data
  const h = { Authorization: `Bearer ${auth.token}` }
  const r = await fetch('http://localhost:3000/api/buddy/nudges', { headers: h })
  const b = await r.json()
  console.log('nudges:')
  for (const n of b.data.nudges) console.log(`  [${n.kind}] ${n.title} :: ${n.body}`)
})()
