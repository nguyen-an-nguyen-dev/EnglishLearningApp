;(async () => {
  const login = await fetch('http://localhost:3000/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'test@test.com', password: '123456' }) })
  const auth = (await login.json()).data
  const res = await fetch('http://localhost:3000/api/videos/10', { headers: { Authorization: `Bearer ${auth.token}` } })
  const body = await res.json()
  const v = body.data.video
  console.log(`"${v.title.slice(0, 45)}" — ${v.segments.length} đoạn, ${v.duration_seconds}s`)
  const long = v.segments.filter((s) => s.text_en.split(' ').length > 9)
  console.log(`dòng > 9 từ: ${long.length}`)
  for (const s of v.segments) {
    const w = s.text_en.split(' ').length
    const flag = w > 9 ? ' <-- dài' : ''
    console.log(`  ${String(s.id).padStart(4)} ${((s.end_ms - s.start_ms) / 1000).toFixed(1)}s ${String(w).padStart(2)}w ${s.text_en}${flag}`)
  }
})()
