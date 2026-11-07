;(async () => {
  const login = await fetch('http://localhost:3000/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'test@test.com', password: '123456' }) })
  const auth = (await login.json()).data
  const started = Date.now()
  const res = await fetch('http://localhost:3000/api/admin/videos', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}` }, body: JSON.stringify({ url: 'https://www.youtube.com/watch?v=ry9SYnV3svc', model: 'bolt' }) })
  const body = await res.json()
  console.log('status', res.status, 'elapsed', Math.round((Date.now() - started) / 1000) + 's')
  if (body.success) {
    const video = body.data.video
    console.log('created', JSON.stringify({ id: video.id, code: video.code, title: video.title, segments: video.segments.length, topic: video.topic, xp: video.xp_reward }))
    const del = await fetch(`http://localhost:3000/api/admin/videos/${video.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${auth.token}` } })
    console.log('cleanup delete ->', del.status)
  } else {
    console.log('error', body.message, JSON.stringify(body.errors))
  }
})()
