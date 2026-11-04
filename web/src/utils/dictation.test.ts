import test from 'node:test'
import assert from 'node:assert/strict'
import { matchDictation, tokenizeDictation } from './dictation.ts'

test('dictation tokens ignore case and punctuation', () => {
  assert.deepEqual(
    tokenizeDictation("But we each need to find our own inspiration... Kiki's!"),
    [
      { raw: 'But', clean: 'but' },
      { raw: 'we', clean: 'we' },
      { raw: 'each', clean: 'each' },
      { raw: 'need', clean: 'need' },
      { raw: 'to', clean: 'to' },
      { raw: 'find', clean: 'find' },
      { raw: 'our', clean: 'our' },
      { raw: 'own', clean: 'own' },
      { raw: 'inspiration', clean: 'inspiration' },
      { raw: "Kiki's", clean: 'kikis' },
    ],
  )
})

test('dictation reveals words in sentence order, including duplicates', () => {
  const script = tokenizeDictation('We do what we do, Kiki.')
  const firstTwo = matchDictation(script, tokenizeDictation('we do'))
  assert.deepEqual([...firstTwo.revealed], [0, 1])
  assert.equal(firstTwo.prefixes.size, 0)

  const all = matchDictation(script, tokenizeDictation('WE DO WHAT WE DO KIKI'))
  assert.deepEqual([...all.revealed], [0, 1, 2, 3, 4, 5])

  const outOfOrder = matchDictation(script, tokenizeDictation('do we'))
  assert.deepEqual([...outOfOrder.revealed], [])
  assert.equal(outOfOrder.prefixes.size, 0)
})

test('the current word opens letter by letter, the next words stay masked', () => {
  const script = tokenizeDictation('How are you')

  const h = matchDictation(script, tokenizeDictation('H'))
  assert.deepEqual([...h.revealed], [])
  assert.deepEqual([...h.prefixes], [[0, 1]])

  const ho = matchDictation(script, tokenizeDictation('Ho'))
  assert.deepEqual([...ho.prefixes], [[0, 2]])

  const howe = matchDictation(script, tokenizeDictation('Howe'))
  assert.deepEqual([...howe.revealed], [])
  assert.deepEqual([...howe.prefixes], [[0, 3]])

  const how = matchDictation(script, tokenizeDictation('How'))
  assert.deepEqual([...how.revealed], [0])

  const howA = matchDictation(script, tokenizeDictation('How a'))
  assert.deepEqual([...howA.revealed], [0])
  assert.deepEqual([...howA.prefixes], [[1, 1]])

  const howAre = matchDictation(script, tokenizeDictation('How are'))
  assert.deepEqual([...howAre.revealed], [0, 1])

  const howAreY = matchDictation(script, tokenizeDictation('How are y'))
  assert.deepEqual([...howAreY.revealed], [0, 1])
  assert.deepEqual([...howAreY.prefixes], [[2, 1]])

  const complete = matchDictation(script, tokenizeDictation('How are you'))
  assert.deepEqual([...complete.revealed], [0, 1, 2])
})

test('a near miss keeps the letters that were typed correctly', () => {
  const script = tokenizeDictation('We need to excute the plan')
  const match = matchDictation(script, tokenizeDictation('We need to excuta'))
  assert.deepEqual([...match.revealed], [0, 1, 2])
  assert.deepEqual([...match.prefixes], [[3, 5]])

  const drifted = matchDictation(script, tokenizeDictation('We nede'))
  assert.deepEqual([...drifted.revealed], [0])
  assert.deepEqual([...drifted.prefixes], [[1, 2]])
})

test('typing a later word first never opens it', () => {
  const script = tokenizeDictation('I have a pen')
  const strayA = matchDictation(script, tokenizeDictation('a'))
  assert.deepEqual([...strayA.revealed], [])
  assert.equal(strayA.prefixes.size, 0)

  const skipped = matchDictation(script, tokenizeDictation('I a'))
  assert.deepEqual([...skipped.revealed], [0])
  assert.equal(skipped.prefixes.size, 0)
})

test('dictation stops at the first unfinished word', () => {
  const script = tokenizeDictation('But we each need to find our own inspiration Kiki')
  const match = matchDictation(script, tokenizeDictation('but we need inspiration'))
  assert.deepEqual([...match.revealed], [0, 1])
  assert.equal(match.prefixes.size, 0)
  assert.ok(match.revealed.size < script.length)
})
