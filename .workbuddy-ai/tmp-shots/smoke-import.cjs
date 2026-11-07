;(async () => {
  const login = await fetch('http://localhost:3000/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'test@test.com', password: '123456' }) })
  const auth = (await login.json()).data
  const started = Date.now()
  // Small Talk is already in the library under its own code, so importing it as a
  // shared video exercises the full pipeline and then gets cleaned up.
  const res = await fetch('http://localhost:3000/api/admin/videos', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}` }, body: JSON.stringify({ url: 'https://www.youtube.com/watch?v=ry9SYnV3svc', model: 'gemini' }) })
  const body = await res.json()
  console.log('status', res.status, 'elapsed', Math.round((Date.now() - started) / 1000) + 's')
  if (!body.success) { console.log('error', body.message, JSON.stringify(body.errors)); process.exit(0) }
  const v = body.data.video
  const lines = v.segments.map((s) => s.text_en)
  const long = lines.filter((l) => l.split(' ').length > 9).length
  console.log(`imported: ${lines.length} dòng, ${Math.round(lines.join(' ').split(' ').length / lines.length)} từ/dòng, ${long} dòng dài`)
  console.log(lines.slice(0, 5).map((l) => '  • ' + l).join('\n'))
  const del = await fetch(`http://localhost:3000/api/admin/videos/${v.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${auth.token}` } })
  console.log('cleanup ->', del.status)
})()
