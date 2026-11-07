;(async () => {
  const login = await fetch('http://localhost:3000/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'test@test.com', password: '123456' }) })
  const auth = (await login.json()).data
  const h = { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}` }

  const feedRes = await fetch('http://localhost:3000/api/buddy/nudges', { headers: h })
  const feed = await feedRes.json()
  console.log('GET /api/buddy/nudges ->', feedRes.status)
  if (feed.success) {
    console.log('greeting:', feed.data.greeting)
    console.log('summary:', JSON.stringify(feed.data.summary))
    for (const n of feed.data.nudges) console.log(`  [${n.kind}/${n.tone}] ${n.title} :: ${n.body} -> ${n.action.label}${n.highlight ? ` (${n.highlight})` : ''}`)
  } else console.log(JSON.stringify(feed))

  const askRes = await fetch('http://localhost:3000/api/buddy/ask', { method: 'POST', headers: h, body: JSON.stringify({ question: '20 phút nữa nhắc mình ôn sổ từ nhé', context: { tab: 'videos' } }) })
  const ask = await askRes.json()
  console.log('\nPOST /api/buddy/ask ->', askRes.status)
  if (ask.success) {
    console.log('reply:', ask.data.reply)
    console.log('reminder:', JSON.stringify(ask.data.suggestion))
    console.log('action:', JSON.stringify(ask.data.action))
    console.log('followups:', JSON.stringify(ask.data.followups))
  } else console.log(JSON.stringify(ask))
})()
