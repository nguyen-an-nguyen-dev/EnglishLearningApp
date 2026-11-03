import type { Stage } from './types/learning'

export const STAGE_THEMES = ['forest', 'river', 'autumn', 'alpine', 'coast', 'sakura'] as const
export type StageThemeKey = (typeof STAGE_THEMES)[number]

export type MapLessonStatus = 'done' | 'current' | 'locked'

export interface RoadmapLesson {
  id: number
  stageId: number
  stageCode: string
  stageTitle: string
  stageIndex: number
  stageTheme: StageThemeKey
  stageAccent: string
  title: string
  topic: string
  sortOrder: number
  lessonIndex: number
  status: MapLessonStatus
  totalQuestions: number
}

export interface RoadmapStage {
  id: number
  code: string
  title: string
  description: string | null
  theme: StageThemeKey
  accent: string
  sortOrder: number
  lessons: RoadmapLesson[]
  completedCount: number
  totalCount: number
}

export interface StageVisual {
  bg: string
  ink: string
  soft: string
  appBg: string
  glow: string
}

export const STAGE_VISUALS: Record<StageThemeKey, StageVisual> = {
  forest: { bg: '#EFF8EF', ink: '#2F4F3A', soft: '#8ECF9A', appBg: '#E6F2E7', glow: 'rgba(62, 155, 95, .22)' },
  river: { bg: '#EDF7FC', ink: '#2C5C72', soft: '#7CC8E8', appBg: '#E4F3FA', glow: 'rgba(46, 156, 196, .22)' },
  autumn: { bg: '#FFF3DE', ink: '#6B3D1F', soft: '#F0B86E', appBg: '#FFF0D8', glow: 'rgba(217, 119, 6, .22)' },
  alpine: { bg: '#F2FAFF', ink: '#23425A', soft: '#A8D8EE', appBg: '#EAF6FE', glow: 'rgba(46, 125, 168, .22)' },
  coast: { bg: '#EAF7FB', ink: '#2B5666', soft: '#8FD0DF', appBg: '#E6F5FA', glow: 'rgba(42, 157, 143, .22)' },
  sakura: { bg: '#FFF1F5', ink: '#6B3B4C', soft: '#F4B8C8', appBg: '#FFE9F0', glow: 'rgba(214, 90, 134, .22)' },
}

export const ROADMAP_LAYOUT = {
  width: 1120,
  topPad: 0,
  stageHeight: 670,
  stageTopPad: 110,
  lessonGap: 96,
  bottomPad: 0,
} as const

const FALLBACK_ACCENTS: Record<StageThemeKey, string> = {
  forest: '#3E9B5F',
  river: '#2E9CC4',
  autumn: '#D97706',
  alpine: '#2E7DA8',
  coast: '#2A9D8F',
  sakura: '#D65A86',
}

function resolveTheme(themeKey: string, stageIndex: number): StageThemeKey {
  if ((STAGE_THEMES as readonly string[]).includes(themeKey)) return themeKey as StageThemeKey
  return STAGE_THEMES[stageIndex % STAGE_THEMES.length]
}

function mapStatus(status: string): MapLessonStatus {
  if (status === 'completed') return 'done'
  if (status === 'unlocked') return 'current'
  return 'locked'
}

export function buildRoadmap(stages: Stage[]): RoadmapStage[] {
  return stages
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((stage, stageIndex) => {
      const theme = resolveTheme(stage.theme_key, stageIndex)
      const accent = stage.accent_color || FALLBACK_ACCENTS[theme]
      const lessons = stage.lessons
        .slice()
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((lesson, lessonIndex): RoadmapLesson => ({
          id: lesson.id,
          stageId: stage.id,
          stageCode: stage.code,
          stageTitle: stage.title,
          stageIndex,
          stageTheme: theme,
          stageAccent: accent,
          title: lesson.title,
          topic: lesson.topic,
          sortOrder: lesson.sort_order,
          lessonIndex,
          status: mapStatus(lesson.state.status),
          totalQuestions: lesson.total_questions,
        }))

      return {
        id: stage.id,
        code: stage.code,
        title: stage.title,
        description: stage.description,
        theme,
        accent,
        sortOrder: stage.sort_order,
        lessons,
        completedCount: lessons.filter((lesson) => lesson.status === 'done').length,
        totalCount: lessons.length,
      }
    })
}

export function flattenLessons(stages: RoadmapStage[]): RoadmapLesson[] {
  return stages.flatMap((stage) => stage.lessons)
}

export function findCurrentLesson(stages: RoadmapStage[]): RoadmapLesson | undefined {
  const lessons = flattenLessons(stages)
  return (
    lessons.find((lesson) => lesson.status === 'current') ??
    [...lessons].reverse().find((lesson) => lesson.status === 'done') ??
    lessons[0]
  )
}

export function findCurrentStageIndex(stages: RoadmapStage[]): number {
  const current = findCurrentLesson(stages)
  if (!current) return 0
  const stageWithCurrent = stages.find((stage) => stage.id === current.stageId)
  return stageWithCurrent ? stages.indexOf(stageWithCurrent) : 0
}

export function stageTop(stageIndex: number): number {
  return ROADMAP_LAYOUT.topPad + stageIndex * ROADMAP_LAYOUT.stageHeight
}

export function lessonY(stageIndex: number, lessonIndex: number): number {
  return stageTop(stageIndex) + ROADMAP_LAYOUT.stageTopPad + lessonIndex * ROADMAP_LAYOUT.lessonGap
}

export function roadmapHeight(stageCount: number): number {
  return ROADMAP_LAYOUT.topPad + stageCount * ROADMAP_LAYOUT.stageHeight + ROADMAP_LAYOUT.bottomPad
}

export function roadCenterX(globalLessonIndex: number): number {
  return 560 + (globalLessonIndex % 2 === 0 ? -26 : 26)
}

export function markerSide(globalLessonIndex: number): -1 | 1 {
  return globalLessonIndex % 2 === 0 ? -1 : 1
}

export interface MapNode {
  lesson: RoadmapLesson
  stage: RoadmapStage
  stageIndex: number
  lessonIndex: number
  x: number
  y: number
  side: -1 | 1
  globalIndex: number
}

export function buildMapNodes(stages: RoadmapStage[]): MapNode[] {
  const nodes: MapNode[] = []
  let globalIndex = 0

  stages.forEach((stage, stageIndex) => {
    stage.lessons.forEach((lesson, lessonIndex) => {
      nodes.push({
        lesson,
        stage,
        stageIndex,
        lessonIndex,
        x: roadCenterX(globalIndex),
        y: lessonY(stageIndex, lessonIndex),
        side: markerSide(globalIndex),
        globalIndex,
      })
      globalIndex += 1
    })
  })

  return nodes
}

interface Point {
  x: number
  y: number
}

function cubicPoint(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  const mt = 1 - t
  const a = mt * mt * mt
  const b = 3 * mt * mt * t
  const c = 3 * mt * t * t
  const d = t * t * t
  return {
    x: a * p0.x + b * p1.x + c * p2.x + d * p3.x,
    y: a * p0.y + b * p1.y + c * p2.y + d * p3.y,
  }
}

function cubicLength(p0: Point, p1: Point, p2: Point, p3: Point): number {
  let length = 0
  let previous = p0
  const steps = 28

  for (let step = 1; step <= steps; step += 1) {
    const point = cubicPoint(p0, p1, p2, p3, step / steps)
    length += Math.hypot(point.x - previous.x, point.y - previous.y)
    previous = point
  }

  return length
}

export interface RoadPath {
  d: string
  nodeLengths: Record<number, number>
  totalLength: number
}

export function buildRoadPath(nodes: MapNode[], stageCount: number): RoadPath {
  if (nodes.length === 0) return { d: '', nodeLengths: {}, totalLength: 0 }

  const start = { x: nodes[0].x, y: ROADMAP_LAYOUT.topPad + 8 }
  const nodeLengths: Record<number, number> = {}
  let path = `M${start.x} ${start.y}`
  let previous = start
  let totalLength = 0

  for (const node of nodes) {
    const middleY = (previous.y + node.y) / 2
    const controlOne = { x: previous.x, y: middleY }
    const controlTwo = { x: node.x, y: middleY }
    path += ` C${controlOne.x} ${controlOne.y} ${controlTwo.x} ${controlTwo.y} ${node.x} ${node.y}`
    totalLength += cubicLength(previous, controlOne, controlTwo, node)
    nodeLengths[node.lesson.id] = totalLength
    previous = node
  }

  const end = {
    x: nodes[nodes.length - 1].x,
    y: stageTop(stageCount - 1) + ROADMAP_LAYOUT.stageHeight - 20,
  }
  const middleY = (previous.y + end.y) / 2
  path += ` C${previous.x} ${middleY} ${end.x} ${middleY} ${end.x} ${end.y}`
  totalLength += cubicLength(previous, { x: previous.x, y: middleY }, { x: end.x, y: middleY }, end)

  return { d: path, nodeLengths, totalLength }
}
