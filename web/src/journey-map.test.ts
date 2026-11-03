import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import type { Stage } from './types/learning.ts'
import {
  ROADMAP_LAYOUT,
  buildMapNodes,
  buildRoadPath,
  buildRoadmap,
  findCurrentLesson,
  flattenLessons,
  lessonY,
  markerSide,
  roadmapHeight,
  roadCenterX,
  stageTop,
} from './roadmap.ts'

function makeStages(): Stage[] {
  return ['forest', 'river', 'autumn', 'alpine', 'coast', 'sakura'].map((theme, stageIndex) => ({
    id: stageIndex + 1,
    code: `stage-${stageIndex + 1}`,
    title: `Stage ${stageIndex + 1}`,
    description: null,
    theme_key: theme,
    accent_color: '#00ABDC',
    sort_order: stageIndex + 1,
    lessons: Array.from({ length: 6 }, (_, lessonIndex) => ({
      id: stageIndex * 6 + lessonIndex + 1,
      stage_id: stageIndex + 1,
      code: `s${stageIndex + 1}-lesson-${lessonIndex + 1}`,
      title: `Lesson ${lessonIndex + 1}`,
      topic: `Topic ${lessonIndex + 1}`,
      sort_order: lessonIndex + 1,
      state: {
        status:
          stageIndex === 0 && lessonIndex < 2
            ? 'completed'
            : stageIndex === 0 && lessonIndex === 2
              ? 'unlocked'
              : 'locked',
        score: null,
      },
      total_questions: 10,
    })),
  }))
}

describe('Roadmap data', () => {
  test('groups 6 stages with 6 lessons and 10 questions each', () => {
    const stages = buildRoadmap(makeStages())
    const lessons = flattenLessons(stages)

    assert.equal(stages.length, 6)
    assert.equal(lessons.length, 36)
    assert.ok(lessons.every((lesson) => lesson.totalQuestions === 10))
    assert.deepEqual(
      stages.map((stage) => stage.lessons.length),
      [6, 6, 6, 6, 6, 6],
    )
  })

  test('maps database states to map states and counts completed lessons per stage', () => {
    const stages = buildRoadmap(makeStages())

    assert.deepEqual(
      stages[0].lessons.map((lesson) => lesson.status),
      ['done', 'done', 'current', 'locked', 'locked', 'locked'],
    )
    assert.equal(stages[0].completedCount, 2)
    assert.equal(stages[0].totalCount, 6)
    assert.equal(stages[1].completedCount, 0)
  })

  test('uses stage theme and accent from the API, with fallbacks for unknown themes', () => {
    const stages = makeStages()
    stages[0].theme_key = 'not-a-theme'
    stages[0].accent_color = ''

    const roadmap = buildRoadmap(stages)
    assert.equal(roadmap[0].theme, 'forest')
    assert.equal(roadmap[0].accent, '#3E9B5F')
    assert.equal(roadmap[5].theme, 'sakura')
  })

  test('finds the first unlocked lesson as the current one', () => {
    const stages = buildRoadmap(makeStages())
    const current = findCurrentLesson(stages)

    assert.equal(current?.id, 3)
    assert.equal(current?.stageIndex, 0)
    assert.equal(current?.lessonIndex, 2)
  })

  test('lays every stage out over its own background band', () => {
    const stageCount = 6
    const lessonsPerStage = 6
    const height = roadmapHeight(stageCount)

    assert.equal(height, ROADMAP_LAYOUT.topPad + stageCount * ROADMAP_LAYOUT.stageHeight + ROADMAP_LAYOUT.bottomPad)

    for (let stageIndex = 0; stageIndex < stageCount; stageIndex += 1) {
      const top = stageTop(stageIndex)
      const bottom = top + ROADMAP_LAYOUT.stageHeight
      for (let lessonIndex = 0; lessonIndex < lessonsPerStage; lessonIndex += 1) {
        const y = lessonY(stageIndex, lessonIndex)
        assert.ok(y > top, `lesson ${lessonIndex} starts inside stage ${stageIndex}`)
        assert.ok(y < bottom, `lesson ${lessonIndex} ends inside stage ${stageIndex}`)
      }
    }
  })

  test('alternates the road and marker sides so the route snakes down the map', () => {
    assert.equal(roadCenterX(0), 534)
    assert.equal(roadCenterX(1), 586)
    assert.equal(roadCenterX(2), 534)
    assert.equal(markerSide(0), -1)
    assert.equal(markerSide(1), 1)
  })

  test('builds the full car path with one increasing length per lesson', () => {
    const stages = buildRoadmap(makeStages())
    const nodes = buildMapNodes(stages)
    const path = buildRoadPath(nodes, stages.length)

    assert.equal(nodes.length, 36)
    assert.ok(path.d.startsWith('M'))
    assert.equal(Object.keys(path.nodeLengths).length, 36)

    const lengths = Object.values(path.nodeLengths)
    for (let index = 1; index < lengths.length; index += 1) {
      assert.ok(lengths[index] > lengths[index - 1], `length ${index} increases along the road`)
    }
    assert.ok(path.totalLength > lengths[lengths.length - 1], 'tail extends past the last lesson')
  })
})
