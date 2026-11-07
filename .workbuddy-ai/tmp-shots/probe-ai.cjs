;(async () => {
  const url = 'http://localhost:3000/api/translate'
  const res = await fetch('http://localhost:3000/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'test@test.com', password: '123456' }) })
  const auth = (await res.json()).data
  const started = Date.now()
  const t = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}` }, body: JSON.stringify({ text: 'How was your trip', sourceLanguage: 'en', targetLanguage: 'vi' }) })
  const body = await t.json().catch(() => ({}))
  console.log('translate status', t.status, 'ms', Date.now() - started)
  console.log(JSON.stringify(body).slice(0, 300))
})()
