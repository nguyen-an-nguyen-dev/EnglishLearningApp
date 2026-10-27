import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { MILESTONES, ROUTE } from './journey-data.ts'

describe('Journey Map Redesign Specifications', () => {
  test('Route path features alternating straight and rugged curve segments', () => {
    assert.ok(ROUTE.startsWith('M 360 20'), 'Route starts at coordinate (360, 20)')
    // Checks that path contains both L (straight) and C (cubic bezier curved/rugged) commands
    const hasStraightLines = ROUTE.includes(' L ')
    const hasCurvedSegments = ROUTE.includes(' C ')
    assert.equal(hasStraightLines, true, 'Route must have straight lines')
    assert.equal(hasCurvedSegments, true, 'Route must have curved/rugged segments')
  })

  test('Milestones alternate between straight and rugged terrain', () => {
    assert.equal(MILESTONES.length, 8, 'There are 8 milestones')

    const terrains = MILESTONES.map((m) => m.terrain)
    // 1: straight, 2: rugged, 3: straight, 4: rugged, 5: straight, 6: rugged, 7: straight, 8: rugged
    assert.deepEqual(terrains, [
      'straight',
      'rugged',
      'straight',
      'rugged',
      'straight',
      'rugged',
      'straight',
      'rugged',
    ])
  })

  test('Every milestone has a valid skillType for minimalist icon signposts', () => {
    const validSkillTypes = ['listen', 'speak', 'read', 'write', 'mixed']
    for (const m of MILESTONES) {
      assert.ok(
        validSkillTypes.includes(m.skillType),
        `Milestone ${m.id} has valid skillType: ${m.skillType}`
      )
      assert.ok(m.roadX > 0 && m.roadX <= 720, `Milestone ${m.id} roadX is within SVG bounds`)
      assert.ok(m.roadY > 0 && m.roadY <= 1240, `Milestone ${m.id} roadY is within SVG bounds`)
      assert.ok(m.signX > 0 && m.signX <= 720, `Milestone ${m.id} signX is within SVG bounds`)
      assert.ok(m.signY > 0 && m.signY <= 1240, `Milestone ${m.id} signY is within SVG bounds`)
    }
  })

  test('Signposts are positioned along the shoulder without colliding directly with road center', () => {
    for (const m of MILESTONES) {
      const shoulderOffset = Math.abs(m.signX - m.roadX)
      assert.ok(
        shoulderOffset >= 50,
        `Milestone ${m.id} signpost is positioned on road shoulder with at least 50px offset (actual: ${shoulderOffset}px)`
      )
    }
  })
})
