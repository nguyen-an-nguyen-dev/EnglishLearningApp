/**
 * One-off tool: fetch a free (CC0 / public-domain) illustration for every
 * battle_words entry into web/public/arena/. Emits a JSON manifest that a
 * second step uses to populate battle_words.image_url.
 */
import fs from 'node:fs/promises'
import path from 'node:path'

const ROOT = 'C:/Users/ADMIN/Desktop/DoAn/EnglishLearningApp'
const OUT = path.join(ROOT, 'web/public/arena')
const MANIFEST = path.join(ROOT, '.workbuddy-ai/tmp-shots/arena-manifest.json')

const WORDS = `apple,water,house,friend,book,school,mother,dog,red,big,small,eat,drink,sleep,run,weather,ticket,holiday,bridge,crowded,expensive,cheap,borrow,travel,listen,early,usually,money,window,happy,advice,habit,journey,opportunity,confident,dangerous,popular,improve,arrange,refuse,agree,recently,carefully,environment,knowledge,experience,achieve,compare,decide,patient,behavior,consequence,pressure,achievement,responsible,significant,reluctant,accurate,persuade,postpone,evaluate,maintain,occasionally,apparently,budget,colleague,equipment,purpose,complain,recommend,ambiguity,constraint,incentive,criterion,comprehensive,controversial,inevitable,subtle,accumulate,diminish,facilitate,undermine,explicitly,reluctantly,threshold,meticulous,ubiquitous,eloquent,pragmatic,resilient,alleviate,exacerbate,scrutinize,hypothesize,speculate,consensus,dilemma,paradigm,tenacity,nostalgia`.split(',')

// Concrete nouns can be searched verbatim; abstract / grammar words get a
// visual metaphor so the arena frame shows a real photo rather than a diagram.
const QUERY = {
  apple: 'red apple fruit', water: 'glass of drinking water', house: 'house home exterior',
  friend: 'friends together smiling', book: 'open book pages', school: 'school classroom building',
  mother: 'mother and child', dog: 'dog portrait', red: 'bright red color',
  big: 'very large building', small: 'tiny small object', eat: 'person eating a meal',
  drink: 'person drinking water', sleep: 'sleeping in bed', run: 'running athlete',
  weather: 'cloudy sky weather', ticket: 'train ticket', holiday: 'beach holiday',
  bridge: 'stone bridge architecture', crowded: 'crowded city street people',
  expensive: 'luxury expensive watch', cheap: 'sale price tag cheap', borrow: 'borrowing books library',
  travel: 'travel suitcase airport', listen: 'listening with headphones', early: 'sunrise early morning',
  usually: 'daily routine calendar', money: 'banknotes money', window: 'window with sunlight',
  happy: 'happy smiling face', advice: 'giving advice conversation', habit: 'daily habit routine',
  journey: 'road trip journey', opportunity: 'open door opportunity', confident: 'confident person portrait',
  dangerous: 'danger warning sign', popular: 'concert crowd popular', improve: 'plant growing improvement',
  arrange: 'arranging flowers', refuse: 'no stop sign refusal', agree: 'handshake agreement',
  recently: 'calendar date recent', carefully: 'careful hands craft', environment: 'green forest nature',
  knowledge: 'library books knowledge', experience: 'traveler experience', achieve: 'winner trophy achievement',
  compare: 'balance scale comparison', decide: 'decision crossroads sign', patient: 'waiting patiently bench',
  behavior: 'children classroom behavior', consequence: 'domino effect chain', pressure: 'pressure gauge',
  achievement: 'gold medal award', responsible: 'taking responsibility work', significant: 'large growth chart',
  reluctant: 'hesitant reluctant person', accurate: 'bullseye target accurate', persuade: 'people talking persuasion',
  postpone: 'calendar rescheduled date', evaluate: 'checklist evaluation', maintain: 'repair maintenance tools',
  occasionally: 'calendar marked days', apparently: 'optical illusion apparent', budget: 'coins calculator budget',
  colleague: 'colleagues office meeting', equipment: 'tools equipment workbench', purpose: 'arrow hitting target purpose',
  complain: 'customer complaint', recommend: 'thumbs up recommendation', ambiguity: 'foggy crossroads',
  constraint: 'chain tied constraint', incentive: 'reward gift incentive', criterion: 'checklist criteria',
  comprehensive: 'encyclopedia bookshelf', controversial: 'heated debate discussion', inevitable: 'approaching storm clouds',
  subtle: 'soft shadow subtle light', accumulate: 'stack of coins growing', diminish: 'melting ice shrinking',
  facilitate: 'helping hand assistance', undermine: 'cracked foundation wall', explicitly: 'clear instruction sign',
  reluctantly: 'hesitant step doorway', threshold: 'doorway threshold', meticulous: 'watchmaker fine detail',
  ubiquitous: 'street signs everywhere', eloquent: 'public speaker microphone', pragmatic: 'toolbox practical tools',
  resilient: 'plant growing through concrete', alleviate: 'comforting hand care', exacerbate: 'wildfire flames',
  scrutinize: 'magnifying glass inspection', hypothesize: 'scientist in laboratory', speculate: 'chess player thinking',
  consensus: 'team meeting agreement', dilemma: 'fork in the road choice', paradigm: 'blueprint new model',
  tenacity: 'rock climber determination', nostalgia: 'old family photographs',
}

const UA = 'EngoraceArenaBuilder/1.0 (educational vocabulary illustrations)'
const MAX_BYTES = 6 * 1024 * 1024

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)) }

async function getJson(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': UA, Accept: 'application/json' },
        signal: AbortSignal.timeout(20000),
      })
      if (res.status === 429) { await sleep(1200 * (i + 1)); continue }
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return await res.json()
    } catch (err) {
      if (i === tries - 1) return null
      await sleep(500 * (i + 1))
    }
  }
  return null
}

function looksLikeImage(url) {
  return /\.(jpe?g|png)(?:\?|$)/i.test(url) && !/svg|logo|icon|map/i.test(url)
}

async function openverseCandidates(query) {
  const url = `https://api.openverse.org/v1/images/?q=${encodeURIComponent(query)}&page_size=12&license=cc0,pdm`
  const data = await getJson(url)
  if (!data?.results) return []
  return data.results
    .map((r) => r.url)
    .filter((u) => typeof u === 'string' && looksLikeImage(u))
    .slice(0, 6)
}

async function commonsCandidates(query) {
  const url = `https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrsearch=${encodeURIComponent(query + ' filetype:bitmap')}&gsrnamespace=6&gsrlimit=8&prop=imageinfo&iiprop=url&iiurlwidth=960`
  const data = await getJson(url)
  if (!data?.query?.pages) return []
  return Object.values(data.query.pages)
    .map((p) => p.imageinfo?.[0]?.thumburl || p.imageinfo?.[0]?.url)
    .filter((u) => typeof u === 'string' && looksLikeImage(u))
    .slice(0, 6)
}

async function download(url) {
  for (let i = 0; i < 2; i++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': UA, Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8' },
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

async function handleWord(word) {
  const destJpg = path.join(OUT, `${word}.jpg`)
  const destPng = path.join(OUT, `${word}.png`)
  for (const p of [destJpg, destPng]) {
    try { await fs.access(p); return { word, file: `/arena/${path.basename(p)}`, cached: true } } catch { /* missing */ }
  }

  const query = QUERY[word] || word
  const candidates = [
    ...await openverseCandidates(query),
    ...await commonsCandidates(query),
    ...await commonsCandidates(word),
  ]
  // A second, simpler Openverse pass often rescues abstract terms.
  if (candidates.length < 3) candidates.push(...await openverseCandidates(word))

  const seen = new Set()
  for (const url of candidates) {
    if (seen.has(url)) continue
    seen.add(url)
    const image = await download(url)
    if (!image) continue
    const file = `${word}.${image.ext}`
    await fs.writeFile(path.join(OUT, file), image.buf)
    return { word, file: `/arena/${file}`, source: url, cached: false }
  }
  return { word, file: null }
}

async function main() {
  await fs.mkdir(OUT, { recursive: true })
  const results = []
  const CONCURRENCY = 5
  let cursor = 0
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (cursor < WORDS.length) {
      const index = cursor++
      const word = WORDS[index]
      const result = await handleWord(word)
      results.push(result)
      console.log(`${index + 1}/${WORDS.length} ${word}: ${result.file ?? 'FAILED'}`)
    }
  }))
  const ok = results.filter((r) => r.file)
  await fs.writeFile(MANIFEST, JSON.stringify(ok, null, 2))
  console.log(`\nDONE ${ok.length}/${WORDS.length} images -> ${OUT}`)
  console.log('FAILED:', results.filter((r) => !r.file).map((r) => r.word).join(', ') || 'none')
}

await main()
