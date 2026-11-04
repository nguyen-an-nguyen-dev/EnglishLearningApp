/**
 * Retry the four words the first downloader could not resolve, using simpler
 * queries and extra public-domain sources. Merges results into the manifest.
 */
import fs from 'node:fs/promises'
import path from 'node:path'

const ROOT = 'C:/Users/ADMIN/Desktop/DoAn/EnglishLearningApp'
const OUT = path.join(ROOT, 'web/public/arena')
const MANIFEST = path.join(ROOT, '.workbuddy-ai/tmp-shots/arena-manifest.json')
const UA = 'EngoraceArenaBuilder/1.0 (educational vocabulary illustrations)'
const MAX_BYTES = 6 * 1024 * 1024

const TARGETS = {
  borrow: ['library books', 'library bookshelf', 'books lending library', 'library'],
  travel: ['suitcase', 'airport luggage', 'travel luggage', 'airport'],
  early: ['sunrise', 'dawn sunrise', 'early morning sun', 'morning'],
  knowledge: ['books', 'library', 'encyclopedia books', 'bookstack'],
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)) }

async function getJson(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': UA, Accept: 'application/json' },
        signal: AbortSignal.timeout(20000),
      })
      if (res.status === 429) { await sleep(1500 * (i + 1)); continue }
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return await res.json()
    } catch {
      if (i === tries - 1) return null
      await sleep(600 * (i + 1))
    }
  }
  return null
}

function looksLikeImage(url) {
  return /\.(jpe?g|png)(?:\?|$)/i.test(url) && !/svg|logo|icon|map/i.test(url)
}

async function openverse(query) {
  const url = `https://api.openverse.org/v1/images/?q=${encodeURIComponent(query)}&page_size=20&license=cc0,pdm`
  const data = await getJson(url)
  if (!data?.results) return []
  return data.results
    .flatMap((r) => [r.url, r.thumbnail])
    .filter((u) => typeof u === 'string' && looksLikeImage(u))
    .slice(0, 14)
}

async function commons(query) {
  const url = `https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrsearch=${encodeURIComponent(query + ' filetype:bitmap')}&gsrnamespace=6&gsrlimit=12&prop=imageinfo&iiprop=url&iiurlwidth=960`
  const data = await getJson(url)
  if (!data?.query?.pages) return []
  return Object.values(data.query.pages)
    .flatMap((p) => [p.imageinfo?.[0]?.thumburl, p.imageinfo?.[0]?.url])
    .filter((u) => typeof u === 'string' && looksLikeImage(u))
    .slice(0, 14)
}

async function download(url) {
  for (let i = 0; i < 2; i++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': UA, Accept: 'image/*,*/*;q=0.8' },
        signal: AbortSignal.timeout(25000),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const buf = Buffer.from(await res.arrayBuffer())
      if (buf.length < 3000 || buf.length > MAX_BYTES) throw new Error(`bad size ${buf.length}`)
      const jpeg = buf[0] === 0xff && buf[1] === 0xd8
      const png = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47
      if (!jpeg && !png) throw new Error('not a jpeg/png')
      return { buf, ext: jpeg ? 'jpg' : 'png' }
    } catch {
      if (i === 1) return null
      await sleep(400)
    }
  }
  return null
}

async function main() {
  const manifest = JSON.parse(await fs.readFile(MANIFEST, 'utf8'))
  const byWord = new Map(manifest.map((r) => [r.word, r]))

  for (const [word, queries] of Object.entries(TARGETS)) {
    if (byWord.has(word)) continue
    const seen = new Set()
    let saved = null
    for (const q of queries) {
      const candidates = [...await openverse(q), ...await commons(q)]
      for (const url of candidates) {
        if (seen.has(url)) continue
        seen.add(url)
        const image = await download(url)
        if (!image) continue
        const file = `${word}.${image.ext}`
        await fs.writeFile(path.join(OUT, file), image.buf)
        saved = { word, file: `/arena/${file}`, source: url, cached: false }
        break
      }
      if (saved) break
    }
    if (saved) {
      byWord.set(word, saved)
      console.log(`OK ${word}: ${saved.file} <- ${saved.source}`)
    } else {
      console.log(`FAILED ${word}`)
    }
  }

  const merged = [...byWord.values()].sort((a, b) => a.word.localeCompare(b.word))
  await fs.writeFile(MANIFEST, JSON.stringify(merged, null, 2))
  console.log(`\nMANIFEST ${merged.length}/100`)
}
await main()
