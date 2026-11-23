import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import type { Stage } from './types/learning.ts'
import {
  ROADMAP_LAYOUT,
  buildMapNodes,
  buildRoadPath,
  buildRoadmap,
  buildRoadmapGeometry,
  findCurrentLesson,
  flattenLessons,
  lessonY,
  markerSide,
  roadCenterX,
  stageBand,
  stageHeightFor,
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

  test('a lesson inserted behind the frontier renders as new, not as the current stop', () => {
    const raw = makeStages()
    // The admin appends a lesson to stage 1; the API reports it `available`
    // because the learner already cleared everything in that stage.
    raw[0].lessons.push({
      ...raw[0].lessons[0],
      id: 99,
      code: 's1-lesson-7',
      title: 'Backfilled',
      sort_order: 7,
      state: { status: 'available', score: null },
    })

    const stages = buildRoadmap(raw)
    assert.deepEqual(
      stages[0].lessons.map((lesson) => lesson.status),
      ['done', 'done', 'current', 'locked', 'locked', 'locked', 'new'],
    )
    assert.equal(findCurrentLesson(stages)?.id, 3, 'the car stays on the current lesson')
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

  test('finds the unlocked lesson as the current one', () => {
    const stages = buildRoadmap(makeStages())
    const current = findCurrentLesson(stages)

    assert.equal(current?.id, 3)
    assert.equal(current?.stageIndex, 0)
    assert.equal(current?.lessonIndex, 2)
  })

  test('keeps the six-lesson band exactly as tall as it always was', () => {
    assert.equal(stageHeightFor(6), ROADMAP_LAYOUT.minStageHeight)
    assert.equal(stageHeightFor(1), ROADMAP_LAYOUT.minStageHeight)
    assert.equal(stageHeightFor(0), ROADMAP_LAYOUT.minStageHeight)
  })

  test('a stage with a seventh lesson grows instead of spilling into the next scene', () => {
    const six = buildRoadmapGeometry([{ lessons: new Array(6).fill(null) }])
    const seven = buildRoadmapGeometry([{ lessons: new Array(7).fill(null) }])

    assert.ok(seven.bands[0].height > six.bands[0].height, 'the band grows')
    assert.ok(
      seven.height - six.height >= ROADMAP_LAYOUT.lessonGap,
      'the extra pin gets a full row of room',
    )
  })

  test('lays every stage out over its own background band', () => {
    const stages = buildRoadmap(makeStages())
    const geometry = buildRoadmapGeometry(stages)

    for (let stageIndex = 0; stageIndex < stages.length; stageIndex += 1) {
      const band = stageBand(geometry, stageIndex)
      assert.equal(band.lessonCount, 6)
      for (let lessonIndex = 0; lessonIndex < 6; lessonIndex += 1) {
        const y = lessonY(geometry, stageIndex, lessonIndex)
        assert.ok(y > band.top, `lesson ${lessonIndex} starts inside stage ${stageIndex}`)
        assert.ok(y < band.top + band.height, `lesson ${lessonIndex} ends inside stage ${stageIndex}`)
      }
    }

    const last = stageBand(geometry, stages.length - 1)
    assert.equal(last.top + last.height, geometry.height - ROADMAP_LAYOUT.bottomPad)
  })

  test('adding a lesson to an early stage pushes the later stages down', () => {
    const raw = makeStages()
    const before = buildRoadmapGeometry(buildRoadmap(raw))

    raw[0].lessons.push({
      ...raw[0].lessons[0],
      id: 99,
      code: 's1-lesson-7',
      title: 'Backfilled',
      sort_order: 7,
    })
    const stages = buildRoadmap(raw)
    const after = buildRoadmapGeometry(stages)

    assert.ok(after.height > before.height)
    assert.equal(after.bands[0].lessonCount, 7)
    assert.equal(
      after.bands[1].top,
      stageBand(before, 1).top + (after.bands[0].height - before.bands[0].height),
      'stage 2 starts lower by exactly the growth of stage 1',
    )
  })

  test('alternates the road and marker sides so the route snakes down the map', () => {
    assert.equal(roadCenterX(0), 534)
    assert.equal(roadCenterX(1), 586)
    assert.equal(roadCenterX(2), 534)
    assert.equal(markerSide(0), -1)
    assert.equal(markerSide(1), 1)
  })

  test('keeps every lesson node inside its own stage band', () => {
    const stages = buildRoadmap(makeStages())
    const geometry = buildRoadmapGeometry(stages)
    const nodes = buildMapNodes(stages, geometry)

    assert.equal(nodes.length, 36)
    assert.deepEqual(nodes.map(({ x, y }) => [x, y]), Array.from({ length: 36 }, (_, index) => [
      index % 2 === 0 ? 534 : 586,
      Math.floor(index / 6) * ROADMAP_LAYOUT.minStageHeight + 110 + (index % 6) * 96,
    ]))
    for (const node of nodes) {
      const band = stageBand(geometry, node.stageIndex)
      assert.ok(node.y > band.top && node.y < band.top + band.height)
    }
  })

  test('builds the full car path with one increasing length per lesson', () => {
    const stages = buildRoadmap(makeStages())
    const geometry = buildRoadmapGeometry(stages)
    const nodes = buildMapNodes(stages, geometry)
    const path = buildRoadPath(nodes, geometry)

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
