import assert from 'node:assert/strict'
import test from 'node:test'
import {
  DEFAULT_LEAGUE_RULES,
  demotionCount,
  leagueZone,
  nextTier,
  previousTier,
  promotionCount,
  promotionEnd,
  stayCount,
  tierIndex,
} from './league'

test('the league ladder runs coal to diamond and clamps at both ends', () => {
  assert.equal(tierIndex('coal'), 0)
  assert.equal(tierIndex('diamond'), 6)
  assert.equal(tierIndex('unknown'), 0)
  assert.equal(nextTier('coal'), 'copper')
  assert.equal(nextTier('lapis'), 'diamond')
  assert.equal(nextTier('diamond'), null)
  assert.equal(previousTier('copper'), 'coal')
  assert.equal(previousTier('coal'), null)
})

test('the top three promote, the bottom three demote, and the middle stays', () => {
  const total = 25
  for (let rank = 1; rank <= total; rank += 1) {
    const zone = leagueZone(rank, total, 'copper')
    if (rank <= 3) assert.equal(zone, 'promote', `rank ${rank}`)
    else if (rank >= 23) assert.equal(zone, 'demote', `rank ${rank}`)
    else assert.equal(zone, 'stay', `rank ${rank}`)
  }
  assert.equal(promotionCount(total, 'copper'), 3)
  assert.equal(demotionCount(total, 'copper'), 3)
  assert.equal(stayCount(total, 'copper'), 19)
})

test('coal only has a promotion zone because nobody can fall below it', () => {
  const total = 25
  assert.equal(promotionCount(total, 'coal'), 3)
  assert.equal(demotionCount(total, 'coal'), 0)
  assert.equal(stayCount(total, 'coal'), 22)
  for (let rank = 23; rank <= 25; rank += 1) {
    assert.equal(leagueZone(rank, total, 'coal'), 'stay', `rank ${rank}`)
  }
})

test('diamond only has a demotion zone because nobody can climb above it', () => {
  const total = 25
  assert.equal(promotionCount(total, 'diamond'), 0)
  assert.equal(demotionCount(total, 'diamond'), 3)
  assert.equal(stayCount(total, 'diamond'), 22)
  for (let rank = 1; rank <= 3; rank += 1) {
    assert.equal(leagueZone(rank, total, 'diamond'), 'stay', `rank ${rank}`)
  }
  assert.equal(leagueZone(23, total, 'diamond'), 'demote')
})

test('a twelve-person board keeps six learners in the middle', () => {
  const total = 12
  assert.equal(promotionEnd(total), 3)
  assert.equal(demotionCount(total, 'gold'), 3)
  assert.equal(stayCount(total, 'gold'), 6)
  assert.equal(leagueZone(3, total, 'gold'), 'promote')
  assert.equal(leagueZone(10, total, 'gold'), 'demote')
})

test('short boards use available slots without overlapping movement zones', () => {
  assert.equal(promotionCount(2, 'coal'), 2)
  assert.equal(demotionCount(2, 'coal'), 0)
  assert.equal(stayCount(2, 'coal'), 0)
  for (let rank = 1; rank <= 2; rank += 1) {
    assert.equal(leagueZone(rank, 2, 'coal'), 'promote', `rank ${rank}`)
  }
  assert.equal(promotionCount(5, 'copper'), 3)
  assert.equal(demotionCount(5, 'copper'), 2)
  assert.equal(leagueZone(4, 5, 'copper'), 'demote')
  assert.equal(leagueZone(5, 5, 'copper'), 'demote')

  // The middle rank stays when both three-person movement zones fit.
  assert.equal(promotionCount(7, 'copper'), 3)
  assert.equal(demotionCount(7, 'copper'), 3)
  assert.equal(leagueZone(3, 7, 'copper'), 'promote')
  assert.equal(leagueZone(4, 7, 'copper'), 'stay')
  assert.equal(leagueZone(5, 7, 'copper'), 'demote')
})

test('the ladder ends keep their short-board safety', () => {
  // Seven coal learners: three climb and four stay at the floor.
  assert.equal(leagueZone(4, 7, 'coal'), 'stay')
  // Seven diamond learners: the top four stay, the bottom three drop.
  assert.equal(leagueZone(1, 7, 'diamond'), 'stay')
  assert.equal(leagueZone(4, 7, 'diamond'), 'stay')
  assert.equal(leagueZone(5, 7, 'diamond'), 'demote')
  assert.equal(demotionCount(7, 'diamond'), 3)
  assert.equal(stayCount(7, 'diamond'), 4)
})

test('the week leader is never demoted, even on a tiny diamond board', () => {
  // Diamond has no promotion block to shield its top, so a naive bottom-three
  // rule would demote the whole board — including whoever just won the week.
  for (const total of [1, 2, 5, 6]) {
    const demoted = Math.min(3, total - 1)
    assert.equal(demotionCount(total, 'diamond'), demoted, `diamond board of ${total}`)
    assert.equal(stayCount(total, 'diamond'), total - demoted, `diamond board of ${total}`)
    assert.equal(leagueZone(1, total, 'diamond'), 'stay', `winner on ${total}`)
    for (let rank = 2; rank <= total; rank += 1) {
      assert.equal(leagueZone(rank, total, 'diamond'), rank > total - demoted ? 'demote' : 'stay', `rank ${rank} of ${total}`)
    }
  }
})

test('server-owned rules can resize the zones', () => {
  const rules = { promotion_slots: 3, demotion_slots: 2 }
  assert.equal(promotionCount(10, 'gold', rules), 3)
  assert.equal(demotionCount(10, 'gold', rules), 2)
  assert.equal(stayCount(10, 'gold', rules), 5)
  assert.equal(leagueZone(3, 10, 'gold', rules), 'promote')
  assert.equal(leagueZone(4, 10, 'gold', rules), 'stay')
  assert.equal(leagueZone(9, 10, 'gold', rules), 'demote')
})

test('the fallback rules stay aligned with settlement', () => {
  assert.deepEqual(DEFAULT_LEAGUE_RULES, { promotion_slots: 3, demotion_slots: 3 })
})
