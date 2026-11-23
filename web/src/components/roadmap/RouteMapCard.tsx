import { memo, useId, useLayoutEffect, useMemo, useRef } from 'react'
import type { KeyboardEvent } from 'react'
import {
  ROADMAP_LAYOUT,
  STAGE_VISUALS,
  buildMapNodes,
  buildRoadmapGeometry,
  buildRoadPath,
  stageBand,
} from '../../roadmap'
import type {
  MapNode,
  RoadmapLesson,
  RoadmapStage,
} from '../../roadmap'
import { CarArt } from '../cosmetics/CarArt'
import { StageScene, StageTransition } from './RoadmapScenery'

export type RoadmapLang = 'vi' | 'en'

interface RouteMapCardProps {
  stages: RoadmapStage[]
  selectedLessonId?: number
  onSelect?: (lesson: RoadmapLesson) => void
  lang?: RoadmapLang
  markerLabel?: (lesson: RoadmapLesson) => string
  className?: string
  fullBleed?: boolean
  /** `visual_key` of the equipped car skin; omitted falls back to the classic car. */
  carKey?: string | null
  carStyle?: Record<string, string | null> | null
}

function luminance(hex: string): number {
  const channels = hex.slice(1).match(/../g)?.map((channel) => parseInt(channel, 16) / 255) ?? [0, 0, 0]
  const [red, green, blue] = channels.map((channel) => (
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  ))
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue
}

function readableInk(background: string): string {
  return luminance(background) > 0.34 ? '#13202C' : '#FFFFFF'
}

const CAR_STOP_GAP = 36

type MarkerIconName =
  | 'chat'
  | 'person'
  | 'family'
  | 'calculator'
  | 'food'
  | 'clock'
  | 'bag'
  | 'star'
  | 'bus'
  | 'gamepad'
  | 'heart'
  | 'plane'
  | 'book'
  | 'laptop'
  | 'leaf'
  | 'phone'
  | 'mail'
  | 'briefcase'
  | 'chart'
  | 'target'
  | 'check'
  | 'megaphone'
  | 'pencil'
  | 'trophy'

const MARKER_ICONS: Record<string, MarkerIconName> = {
  Greetings: 'chat',
  Introductions: 'person',
  Numbers: 'calculator',
  Family: 'family',
  Food: 'food',
  'Time & Dates': 'clock',
  Shopping: 'bag',
  'Daily Activities': 'star',
  Transportation: 'bus',
  Hobbies: 'gamepad',
  Health: 'heart',
  Travel: 'plane',
  School: 'book',
  'Job Interview': 'person',
  Technology: 'laptop',
  Environment: 'leaf',
  'Telephone Calls': 'phone',
  Meetings: 'person',
  Emails: 'mail',
  'At the Workplace': 'briefcase',
  Negotiation: 'briefcase',
  Presentations: 'chart',
  'Sharing Opinions': 'chat',
  Storytelling: 'book',
  'Plans and Goals': 'target',
  Discussion: 'chat',
  'Everyday Review': 'check',
  'Media & Society': 'megaphone',
  Idioms: 'chat',
  Academic: 'book',
  Grammar: 'pencil',
  Rhetoric: 'megaphone',
  Masterclass: 'trophy',
  Literature: 'book',
}

function MarkerIcon({ name, color }: { name: MarkerIconName; color: string }) {
  const line = {
    fill: 'none',
    stroke: color,
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }
  switch (name) {
    case 'chat':
      return (
        <g {...line}>
          <path d="M-8-7H8C9.1-7 10-6.1 10-5V4C10 5.1 9.1 6 8 6H-1L-5 9V6H-8C-9.1 6-10 5.1-10 4V-5C-10-6.1-9.1-7-8-7Z" />
          <circle cx="-4" cy="0" r=".9" fill={color} stroke="none" />
          <circle cx="0" cy="0" r=".9" fill={color} stroke="none" />
          <circle cx="4" cy="0" r=".9" fill={color} stroke="none" />
        </g>
      )
    case 'person':
      return (
        <g {...line}>
          <circle cx="0" cy="-4.5" r="3.2" />
          <path d="M-7 8.5C-7 3-4 0.5 0 0.5C4 0.5 7 3 7 8.5" />
        </g>
      )
    case 'family':
      return (
        <g {...line}>
          <circle cx="-4" cy="-3.5" r="2.6" />
          <circle cx="4" cy="-3.5" r="2.6" />
          <circle cx="0" cy="-6.5" r="2.1" />
          <path d="M-8 8C-8 3-6 1-4 1C-2 1 0 3 0 8M0 8C0 3 2 1 4 1C6 1 8 3 8 8" />
        </g>
      )
    case 'calculator':
      return (
        <g {...line}>
          <rect x="-6" y="-9" width="12" height="18" rx="2" />
          <rect x="-4" y="-6" width="8" height="4" rx=".8" />
          <circle cx="-3" cy="1" r=".8" fill={color} stroke="none" />
          <circle cx="0" cy="1" r=".8" fill={color} stroke="none" />
          <circle cx="3" cy="1" r=".8" fill={color} stroke="none" />
          <circle cx="-3" cy="4.5" r=".8" fill={color} stroke="none" />
          <circle cx="0" cy="4.5" r=".8" fill={color} stroke="none" />
          <circle cx="3" cy="4.5" r=".8" fill={color} stroke="none" />
        </g>
      )
    case 'food':
      return (
        <g {...line}>
          <path d="M-5-8V-2M-3-8V-2M-1-8V-2M-3-2V8" />
          <path d="M3-8C5-5 5-1 3 1V8" />
        </g>
      )
    case 'clock':
      return (
        <g {...line}>
          <circle r="8" />
          <path d="M0-4V0L3 2" />
        </g>
      )
    case 'bag':
      return (
        <g {...line}>
          <path d="M-7-3H7L8 8H-8Z" />
          <path d="M-3-3V-5C-3-7-1-8 0-8C1-8 3-7 3-5V-3" />
        </g>
      )
    case 'star':
      return (
        <path
          {...line}
          d="M0-8L2.4-2.4L8-2L4 2L5 8L0 5L-5 8L-4 2L-8-2L-2.4-2.4Z"
        />
      )
    case 'bus':
      return (
        <g {...line}>
          <rect x="-7" y="-8" width="14" height="14" rx="3" />
          <path d="M-4-8V-4M4-8V-4M-7 2H7" />
          <circle cx="-4" cy="8" r="1.5" fill={color} stroke="none" />
          <circle cx="4" cy="8" r="1.5" fill={color} stroke="none" />
        </g>
      )
    case 'gamepad':
      return (
        <g {...line}>
          <rect x="-9" y="-5" width="18" height="10" rx="5" />
          <path d="M-5 0H-1M-3-2V2" />
          <circle cx="4" cy="-1" r="1" fill={color} stroke="none" />
          <circle cx="7" cy="1" r="1" fill={color} stroke="none" />
        </g>
      )
    case 'heart':
      return (
        <path
          {...line}
          d="M0 8C-8 2-9-4-4-6C-1-7 0-4 0-4C0-4 1-7 4-6C9-4 8 2 0 8Z"
        />
      )
    case 'plane':
      return (
        <g {...line}>
          <path d="M-9 2L9-8L3 8L-1 3L-9 2Z" />
          <path d="M-1 3L9-8" />
        </g>
      )
    case 'book':
      return (
        <g {...line}>
          <path d="M-9 8V-4C-6-6-3-6 0-4C3-6 6-6 9-4V8C6 6 3 6 0 8C-3 6-6 6-9 8Z" />
          <path d="M0-4V8" />
        </g>
      )
    case 'laptop':
      return (
        <g {...line}>
          <rect x="-7" y="-7" width="14" height="10" rx="1.5" />
          <path d="M-9 5H9L7 8H-7Z" />
        </g>
      )
    case 'leaf':
      return (
        <g {...line}>
          <path d="M-7 7C-7-2 0-8 9-8C9 1 2 8-7 7Z" />
          <path d="M-7 7C-2 2 2 0 6-2" />
        </g>
      )
    case 'phone':
      return (
        <g {...line}>
          <rect x="-5" y="-8" width="10" height="16" rx="2" />
          <path d="M-1 5H1" />
        </g>
      )
    case 'mail':
      return (
        <g {...line}>
          <rect x="-9" y="-6" width="18" height="12" rx="1.5" />
          <path d="M-9-6L0 1L9-6" />
        </g>
      )
    case 'briefcase':
      return (
        <g {...line}>
          <rect x="-8" y="-4" width="16" height="11" rx="2" />
          <path d="M-3-4V-6C-3-7-2-8 0-8C2-8 3-7 3-6V-4" />
          <path d="M-8 1H8" />
        </g>
      )
    case 'chart':
      return (
        <g {...line}>
          <path d="M-8 8V-2H-4V8M-1 8V-7H3V8M6 8V2H9V8" />
        </g>
      )
    case 'target':
      return (
        <g {...line}>
          <circle r="8" />
          <circle r="4.8" />
          <circle r="1.6" fill={color} stroke="none" />
        </g>
      )
    case 'check':
      return (
        <g {...line}>
          <circle r="8" />
          <path d="M-4 0L-1 3L5-4" />
        </g>
      )
    case 'megaphone':
      return (
        <g {...line}>
          <path d="M-7-3H-4L4-8V8L-4 3H-7Z" />
          <path d="M-4 3V7H-1V4" />
          <path d="M7 0H9" />
        </g>
      )
    case 'pencil':
      return (
        <g {...line}>
          <path d="M-7 7L-5 2L5-8L8-5L-2 5Z" />
          <path d="M-7 7L-2 5" />
        </g>
      )
    case 'trophy':
      return (
        <g {...line}>
          <path d="M-5-8H5V-3C5 2 2 4 0 4C-2 4-5 2-5-3Z" />
          <path d="M-5-5H-8C-8 0-6 2-3 2M5-5H8C8 0 6 2 3 2" />
          <path d="M0 4V8M-4 8H4" />
        </g>
      )
  }
}

function LessonMarker({
  node,
  isSelected,
  onSelect,
  label,
  lang,
}: {
  node: MapNode
  isSelected: boolean
  onSelect?: (lesson: RoadmapLesson) => void
  label: string
  lang: RoadmapLang
}) {
  const isDone = node.lesson.status === 'done'
  const isCurrent = node.lesson.status === 'current'
  const isNew = node.lesson.status === 'new'
  const markerX = node.x + node.side * 82
  const roadEdgeX = node.x + node.side * 27
  const markerEdgeX = markerX - node.side * 27
  const palette = STAGE_VISUALS[node.stage.theme]
  const fill = isDone ? node.stage.accent : isCurrent ? '#FFD563' : isNew ? '#FFFFFF' : '#DDE5EC'
  const iconInk = isNew ? palette.ink : readableInk(fill)
  const outline = isCurrent ? '#996510' : isNew || isDone ? palette.ink : '#62758A'

  function handleKeyDown(event: KeyboardEvent<SVGGElement>) {
    if (!onSelect) return
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    onSelect(node.lesson)
  }

  return (
    <g
      className={`roadmap-marker roadmap-marker-${node.lesson.status}${isSelected ? ' is-selected' : ''}`}
      transform={`translate(0 ${node.y})`}
      data-lesson-id={node.lesson.id}
      data-buddy-target={`lesson:${node.lesson.id}`}
      role={onSelect ? 'button' : undefined}
      tabIndex={onSelect ? 0 : undefined}
      aria-label={label}
      aria-pressed={onSelect ? isSelected : undefined}
      onClick={onSelect ? () => onSelect(node.lesson) : undefined}
      onKeyDown={onSelect ? handleKeyDown : undefined}
      style={{ color: node.stage.accent }}
    >
      <path
        d={`M${roadEdgeX} 0H${markerEdgeX}`}
        fill="none"
        stroke={outline}
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      <circle className="roadmap-marker-hit" cx={markerX} r="39" fill="transparent" />
      {isCurrent && <circle className="roadmap-marker-pulse" cx={markerX} r="36" stroke={outline} />}
      <circle className="roadmap-marker-halo" cx={markerX} r="35" />
      <circle cx={markerX} cy="4" r="27" fill={outline} opacity=".25" />
      <circle
        cx={markerX}
        r="27"
        fill={fill}
        stroke={outline}
        strokeWidth="2.5"
        strokeDasharray={isNew ? '6 4' : undefined}
      />
      <circle cx={markerX} r="23" fill="none" stroke="#FFFFFF" strokeOpacity=".36" />
      <g transform={`translate(${markerX} 0) scale(1.16)`} aria-hidden="true">
        <MarkerIcon name={MARKER_ICONS[node.lesson.topic] ?? 'star'} color={iconInk} />
      </g>
      <g transform={`translate(${markerX} 33)`}>
        <g className="roadmap-marker-caption">
          <rect x={isNew ? -52 : -33} width={isNew ? 104 : 66} height="19" rx="9.5"
            fill={isNew ? '#FFF0B8' : '#FFFFFF'} fillOpacity=".94" stroke={outline} strokeOpacity=".58" />
          <text
            y="13"
            textAnchor="middle"
            fill={palette.ink}
            fontSize="12"
            fontWeight="800"
          >
            {lang === 'en' ? 'Lesson' : 'Bài'} {node.lessonIndex + 1}
            {isNew && (lang === 'en' ? ' · NEW' : ' · MỚI')}
          </text>
        </g>
      </g>
    </g>
  )
}

function fallbackMarkerLabel(lesson: RoadmapLesson, lang: RoadmapLang): string {
  const stageNumber = lesson.stageIndex + 1
  const lessonNumber = lesson.lessonIndex + 1
  const suffix =
    lesson.status === 'locked'
      ? (lang === 'en' ? ', locked' : ', đang khóa')
      : lesson.status === 'new'
        ? (lang === 'en' ? ', new lesson' : ', bài mới')
        : ''
  if (lang === 'en') {
    return `Stage ${stageNumber}, lesson ${lessonNumber}: ${lesson.title}${suffix}`
  }
  return `Chặng ${stageNumber}, bài ${lessonNumber}: ${lesson.title}${suffix}`
}

function normalizeAngle(value: number): number {
  let angle = value
  while (angle > 180) angle -= 360
  while (angle < -180) angle += 360
  return angle
}

export const RouteMapCard = memo(function RouteMapCard({
  stages,
  selectedLessonId,
  onSelect,
  lang = 'vi',
  markerLabel,
  className,
  fullBleed = false,
  carKey,
  carStyle,
}: RouteMapCardProps) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const clipId = `roadmap-clip-${uid}`
  const roadShadowId = `roadmap-road-shadow-${uid}`
  const carGlowId = `roadmap-car-glow-${uid}`
  const fogLightId = `roadmap-fog-light-${uid}`
  const fogDenseId = `roadmap-fog-dense-${uid}`
  const fogWispId = `roadmap-fog-wisp-${uid}`
  const titleId = `roadmap-title-${uid}`
  const descriptionId = `roadmap-description-${uid}`

  const geometry = useMemo(() => buildRoadmapGeometry(stages), [stages])
  const nodes = useMemo(() => buildMapNodes(stages, geometry), [stages, geometry])
  const height = geometry.height
  const roadPath = useMemo(() => buildRoadPath(nodes, geometry), [nodes, geometry])

  // Fog of war: two stacked banks sharing one soft leading edge, anchored to the
  // learner's current stage. Anchoring to the first unfinished stage used to
  // blanket the whole map as soon as an admin inserted a lesson into stage 1.
  const fog = useMemo(() => {
    const currentIndex = stages.findIndex((stage) => (
      stage.lessons.some((lesson) => lesson.status === 'current')
    ))
    if (currentIndex < 0) return null
    const untouchedIndex = stages.findIndex((stage, index) => (
      index > currentIndex && stage.lessons.every((lesson) => lesson.status === 'locked')
    ))
    const lightStart = Math.max(0, stageBand(geometry, currentIndex).top - 140)
    const denseStart = untouchedIndex >= 0
      ? Math.max(0, stageBand(geometry, untouchedIndex).top - 140)
      : null
    const wispStart = untouchedIndex >= 0 ? untouchedIndex : currentIndex
    const wisps = stages.slice(wispStart).flatMap((stage, offset) => {
      const band = stageBand(geometry, wispStart + offset)
      return [
        { key: `${stage.id}-a`, cx: 250, cy: band.top + 210, rx: 330, ry: 62, delay: `${offset * 2.4}s` },
        { key: `${stage.id}-b`, cx: 880, cy: band.top + 490, rx: 300, ry: 54, delay: `${offset * 2.4 + 1.2}s` },
      ]
    })
    const sceneState = stages.map((_stage, index) => {
      if (untouchedIndex >= 0 && index >= untouchedIndex) return 'is-foggy'
      if (index >= currentIndex) return 'is-misty'
      return ''
    })
    return { lightStart, denseStart, wisps, sceneState }
  }, [stages, geometry])

  const currentNode = nodes.find((node) => node.lesson.status === 'current')
    ?? [...nodes].reverse().find((node) => node.lesson.status === 'done')
    ?? nodes[0]
  const selectedNode = nodes.find((node) => node.lesson.id === selectedLessonId) ?? currentNode
  const currentLength = currentNode ? roadPath.nodeLengths[currentNode.lesson.id] ?? 0 : 0
  const progressLength = Math.max(0, currentLength - CAR_STOP_GAP)

  const roadRef = useRef<SVGPathElement | null>(null)
  const carRef = useRef<SVGGElement | null>(null)
  const carLengthRef = useRef<number>(0)
  const carAnimationRef = useRef<number | null>(null)
  const hasPositionedCar = useRef(false)

  useLayoutEffect(() => {
    const road = roadRef.current
    const car = carRef.current
    if (!road || !car || !currentNode) return
    const roadEl = road
    const carEl = car

    const totalLength = roadEl.getTotalLength()
    const targetLength = Math.min(
      totalLength,
      Math.max(0, (roadPath.nodeLengths[currentNode.lesson.id] ?? 0) - CAR_STOP_GAP),
    )

    function tangentAt(length: number): number {
      const before = roadEl.getPointAtLength(Math.max(0, length - 8))
      const after = roadEl.getPointAtLength(Math.min(totalLength, length + 8))
      return Math.atan2(after.y - before.y, after.x - before.x) * 180 / Math.PI
    }

    function pose(length: number, moving: boolean) {
      const clamped = Math.min(totalLength, Math.max(0, length))
      carLengthRef.current = clamped
      const point = roadEl.getPointAtLength(clamped)
      const angle = tangentAt(clamped) + 90
      let lean = 0
      if (moving) {
        const ahead = tangentAt(clamped + 28)
        const behind = tangentAt(clamped - 28)
        lean = Math.max(-7, Math.min(7, normalizeAngle(ahead - behind) * 0.22))
      }
      carEl.setAttribute('transform', `translate(${point.x} ${point.y}) rotate(${angle + lean})`)
    }

    if (!hasPositionedCar.current) {
      carLengthRef.current = targetLength
      pose(targetLength, false)
      hasPositionedCar.current = true
      return
    }

    const from = carLengthRef.current
    const distance = Math.abs(targetLength - from)
    if (distance < 0.6) {
      carLengthRef.current = targetLength
      pose(targetLength, false)
      return
    }

    const duration = Math.min(2600, 950 + distance * 1.25)
    const startedAt = performance.now()
    carEl.classList.add('is-moving')
    if (carAnimationRef.current !== null) cancelAnimationFrame(carAnimationRef.current)

    function frame(now: number) {
      const progress = Math.min(1, (now - startedAt) / duration)
      const eased = progress < 0.5
        ? 4 * progress * progress * progress
        : 1 - ((-2 * progress + 2) ** 3) / 2
      pose(from + (targetLength - from) * eased, true)

      if (progress < 1) {
        carAnimationRef.current = requestAnimationFrame(frame)
      } else {
        pose(targetLength, false)
        carLengthRef.current = targetLength
        carEl.classList.remove('is-moving')
        carAnimationRef.current = null
      }
    }

    carAnimationRef.current = requestAnimationFrame(frame)

    return () => {
      if (carAnimationRef.current !== null) cancelAnimationFrame(carAnimationRef.current)
      carAnimationRef.current = null
      carEl.classList.remove('is-moving')
    }
  }, [roadPath, currentNode])

  const copy = lang === 'en'
    ? {
        title: 'Engorace English learning roadmap',
        description: 'Your stages and lessons. The yellow car marks the current lesson; a dashed pin with a NEW badge is a lesson added behind you that you can still study.',
      }
    : {
        title: 'Bản đồ lộ trình học tiếng Anh Engorace',
        description: 'Các chặng và bài học của bạn. Xe vàng đánh dấu bài đang học; ghim viền nét đứt có nhãn MỚI là bài mới thêm phía sau mà bạn vẫn có thể học.',
      }

  const getMarkerLabel = (lesson: RoadmapLesson) => (
    markerLabel ? markerLabel(lesson) : fallbackMarkerLabel(lesson, lang)
  )

  return (
    <div className={`roadmap-card${className ? ` ${className}` : ''}`}>
      <svg
        className="roadmap-map"
        viewBox={`0 0 ${ROADMAP_LAYOUT.width} ${height}`}
        role="group"
        aria-label={copy.title}
        aria-describedby={descriptionId}
      >
        <title id={titleId}>{copy.title}</title>
        <desc id={descriptionId}>{copy.description}</desc>
        <defs>
          <clipPath id={clipId}>
            <rect width={ROADMAP_LAYOUT.width} height={height} rx={fullBleed ? 0 : 20} />
          </clipPath>
          <filter id={roadShadowId} filterUnits="userSpaceOnUse" x="0" y="0" width={ROADMAP_LAYOUT.width} height={height}>
            <feDropShadow dx="0" dy="7" stdDeviation="6" floodColor="#526779" floodOpacity=".18" />
          </filter>
          <radialGradient id={carGlowId}>
            <stop offset="0" stopColor="#F2B544" stopOpacity=".42" />
            <stop offset=".55" stopColor="#F2B544" stopOpacity=".18" />
            <stop offset="1" stopColor="#F2B544" stopOpacity="0" />
          </radialGradient>
          <linearGradient id={fogLightId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#FFFFFF" stopOpacity="0" />
            <stop offset=".06" stopColor="#FFFFFF" stopOpacity=".22" />
            <stop offset=".55" stopColor="#FFFFFF" stopOpacity=".31" />
            <stop offset="1" stopColor="#FFFFFF" stopOpacity=".28" />
          </linearGradient>
          <linearGradient id={fogDenseId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#FFFFFF" stopOpacity="0" />
            <stop offset=".06" stopColor="#FFFFFF" stopOpacity=".28" />
            <stop offset=".55" stopColor="#FFFFFF" stopOpacity=".36" />
            <stop offset="1" stopColor="#FFFFFF" stopOpacity=".32" />
          </linearGradient>
          <radialGradient id={fogWispId}>
            <stop offset="0" stopColor="#C9DEE9" stopOpacity=".55" />
            <stop offset=".55" stopColor="#DDEDF4" stopOpacity=".3" />
            <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
          </radialGradient>
        </defs>

        <g clipPath={`url(#${clipId})`}>
          <rect width={ROADMAP_LAYOUT.width} height={height} fill="#EDF7FA" />

          {stages.map((stage, stageIndex) => {
            const sceneState = fog?.sceneState[stageIndex] ?? ''
            const band = stageBand(geometry, stageIndex)
            const sceneHeight = stageIndex === stages.length - 1 ? height - band.top : band.height
            return (
              <g key={stage.id}>
                <rect x="0" y={band.top} width={ROADMAP_LAYOUT.width} height={sceneHeight} fill={STAGE_VISUALS[stage.theme].bg} />
                <g className={`roadmap-stage-scene${sceneState ? ` ${sceneState}` : ''}`}>
                  <StageScene id={`${uid}-scene-${stageIndex}`} theme={stage.theme} y={band.top} height={sceneHeight} />
                </g>
              </g>
            )
          })}

          {stages.slice(1).map((stage, index) => (
            <StageTransition
              key={stage.id}
              id={`${uid}-transition-${index}`}
              y={stageBand(geometry, index + 1).top}
              from={stages[index].theme}
              to={stage.theme}
            />
          ))}

          <g filter={`url(#${roadShadowId})`}>
            <path d={roadPath.d} fill="none" stroke="#A9B6C3" strokeWidth="58" strokeLinecap="round" />
            <path ref={roadRef} d={roadPath.d} fill="none" stroke="#C7D1DC" strokeWidth="52" strokeLinecap="round" />
            <g>
              <path
                d={roadPath.d}
                fill="none"
                stroke="#1FB6E8"
                strokeWidth="58"
                strokeLinecap="butt"
                strokeDasharray={`${progressLength} 99999`}
              />
              <path
                d={roadPath.d}
                fill="none"
                stroke="#5FD8FF"
                strokeWidth="52"
                strokeLinecap="butt"
                strokeDasharray={`${progressLength} 99999`}
              />
            </g>
            <path
              d={roadPath.d}
              fill="none"
              stroke="#FFFFFF"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray="16 20"
            />
          </g>

          {nodes.map((node) => (
            <LessonMarker
              key={node.lesson.id}
              node={node}
              isSelected={node.lesson.id === selectedNode?.lesson.id}
              onSelect={onSelect}
              label={getMarkerLabel(node.lesson)}
              lang={lang}
            />
          ))}

          {fog && (
            <g className="roadmap-fog" pointerEvents="none" aria-hidden="true">
              <rect
                x="0"
                y={fog.lightStart}
                width={ROADMAP_LAYOUT.width}
                height={height - fog.lightStart}
                fill={`url(#${fogLightId})`}
              />
              {fog.denseStart !== null && (
                <rect
                  x="0"
                  y={fog.denseStart}
                  width={ROADMAP_LAYOUT.width}
                  height={height - fog.denseStart}
                  fill={`url(#${fogDenseId})`}
                />
              )}
              {fog.wisps.map((wisp) => (
                <ellipse
                  key={wisp.key}
                  className="roadmap-fog-wisp"
                  cx={wisp.cx}
                  cy={wisp.cy}
                  rx={wisp.rx}
                  ry={wisp.ry}
                  fill={`url(#${fogWispId})`}
                  style={{ animationDelay: wisp.delay }}
                />
              ))}
            </g>
          )}

          {currentNode && (
            <g
              ref={carRef}
              className="roadmap-car"
              aria-hidden="true"
            >
              <CarArt glowId={carGlowId} visualKey={carKey} style={carStyle} />
            </g>
          )}
        </g>
        {!fullBleed && (
          <rect x="1" y="1" width={ROADMAP_LAYOUT.width - 2} height={height - 2} rx="19" fill="none" stroke="var(--line-strong)" strokeWidth="2" />
        )}
      </svg>
    </div>
  )
})
