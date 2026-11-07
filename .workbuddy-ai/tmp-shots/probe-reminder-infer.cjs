;(async () => {
  const login = await fetch('http://localhost:3000/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'test@test.com', password: '123456' }) })
  const auth = (await login.json()).data
  const h = { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}` }
  for (const q of ['20 phút nữa nhắc mình ôn sổ từ', 'nhắc mình lúc 21 giờ học bài mới', 'hôm nay học gì?']) {
    const r = await fetch('http://localhost:3000/api/buddy/ask', { method: 'POST', headers: h, body: JSON.stringify({ question: q }) })
    const b = await r.json()
    console.log(`Q: ${q}`)
    console.log(`   reply: ${b.data?.reply?.slice(0, 90)}`)
    console.log(`   reminder: ${JSON.stringify(b.data?.suggestion)}`)
  }
})()
