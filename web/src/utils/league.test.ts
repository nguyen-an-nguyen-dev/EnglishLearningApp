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

test('the league ladder runs bronze to diamond and clamps at both ends', () => {
  assert.equal(tierIndex('bronze'), 0)
  assert.equal(tierIndex('diamond'), 3)
  assert.equal(tierIndex('unknown'), 0)
  assert.equal(nextTier('bronze'), 'silver')
  assert.equal(nextTier('diamond'), null)
  assert.equal(previousTier('silver'), 'bronze')
  assert.equal(previousTier('bronze'), null)
})

test('the top six promote, the bottom six demote, and the middle stays', () => {
  const total = 25
  for (let rank = 1; rank <= total; rank += 1) {
    const zone = leagueZone(rank, total, 'silver')
    if (rank <= 6) assert.equal(zone, 'promote', `rank ${rank}`)
    else if (rank >= 20) assert.equal(zone, 'demote', `rank ${rank}`)
    else assert.equal(zone, 'stay', `rank ${rank}`)
  }
  assert.equal(promotionCount(total, 'silver'), 6)
  assert.equal(demotionCount(total, 'silver'), 6)
  assert.equal(stayCount(total, 'silver'), 13)
})

test('bronze only has a promotion zone because nobody can fall below it', () => {
  const total = 25
  assert.equal(promotionCount(total, 'bronze'), 6)
  assert.equal(demotionCount(total, 'bronze'), 0)
  assert.equal(stayCount(total, 'bronze'), 19)
  for (let rank = 20; rank <= 25; rank += 1) {
    assert.equal(leagueZone(rank, total, 'bronze'), 'stay', `rank ${rank}`)
  }
})

test('diamond only has a demotion zone because nobody can climb above it', () => {
  const total = 25
  assert.equal(promotionCount(total, 'diamond'), 0)
  assert.equal(demotionCount(total, 'diamond'), 6)
  assert.equal(stayCount(total, 'diamond'), 19)
  for (let rank = 1; rank <= 6; rank += 1) {
    assert.equal(leagueZone(rank, total, 'diamond'), 'stay', `rank ${rank}`)
  }
  assert.equal(leagueZone(20, total, 'diamond'), 'demote')
})

test('a twelve-person board has no middle because the zones meet', () => {
  const total = 12
  assert.equal(promotionEnd(total), 6)
  assert.equal(demotionCount(total, 'gold'), 6)
  assert.equal(stayCount(total, 'gold'), 0)
  assert.equal(leagueZone(6, total, 'gold'), 'promote')
  assert.equal(leagueZone(7, total, 'gold'), 'demote')
})

test('a short board promotes everyone before anyone can demote', () => {
  assert.equal(promotionCount(5, 'bronze'), 5)
  assert.equal(demotionCount(5, 'bronze'), 0)
  assert.equal(stayCount(5, 'bronze'), 0)
  for (let rank = 1; rank <= 5; rank += 1) {
    assert.equal(leagueZone(rank, 5, 'bronze'), 'promote', `rank ${rank}`)
  }

  // Seven learners: the sixth promotion still wins the overlap with the single
  // demotion slot, exactly like settlement.
  assert.equal(promotionCount(7, 'silver'), 6)
  assert.equal(demotionCount(7, 'silver'), 1)
  assert.equal(leagueZone(6, 7, 'silver'), 'promote')
  assert.equal(leagueZone(7, 7, 'silver'), 'demote')
})

test('the ladder ends keep their short-board safety', () => {
  // Seven bronze learners: six climb, the seventh has nowhere to fall.
  assert.equal(leagueZone(7, 7, 'bronze'), 'stay')
  // Seven diamond learners: the leader defends the top, the other six drop.
  assert.equal(leagueZone(1, 7, 'diamond'), 'stay')
  assert.equal(leagueZone(2, 7, 'diamond'), 'demote')
  assert.equal(demotionCount(7, 'diamond'), 6)
  assert.equal(stayCount(7, 'diamond'), 1)
})

test('the week leader is never demoted, even on a tiny diamond board', () => {
  // Diamond has no promotion block to shield its top, so a naive bottom-six
  // rule would demote the whole board — including whoever just won the week.
  for (const total of [1, 2, 5, 6]) {
    assert.equal(demotionCount(total, 'diamond'), total - 1, `diamond board of ${total}`)
    assert.equal(stayCount(total, 'diamond'), 1, `diamond board of ${total}`)
    assert.equal(leagueZone(1, total, 'diamond'), 'stay', `winner on ${total}`)
    for (let rank = 2; rank <= total; rank += 1) {
      assert.equal(leagueZone(rank, total, 'diamond'), 'demote', `rank ${rank} of ${total}`)
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
  assert.deepEqual(DEFAULT_LEAGUE_RULES, { promotion_slots: 6, demotion_slots: 6 })
})
