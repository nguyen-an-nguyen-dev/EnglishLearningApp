import { useId, useLayoutEffect, useMemo, useRef } from 'react'
import type { KeyboardEvent } from 'react'
import {
  ROADMAP_LAYOUT,
  STAGE_VISUALS,
  buildMapNodes,
  buildRoadPath,
  roadmapHeight,
  stageTop,
} from '../../roadmap'
import type {
  MapNode,
  RoadmapLesson,
  RoadmapStage,
  StageThemeKey,
  StageVisual,
} from '../../roadmap'

export type RoadmapLang = 'vi' | 'en'

interface RouteMapCardProps {
  stages: RoadmapStage[]
  selectedLessonId?: number
  onSelect?: (lesson: RoadmapLesson) => void
  lang?: RoadmapLang
  markerLabel?: (lesson: RoadmapLesson) => string
  className?: string
  fullBleed?: boolean
}

interface ScenePalette extends StageVisual {
  skyTop: string
  skyBottom: string
  far: string
  mid: string
  near: string
  light: string
}

const SCENES: Record<StageThemeKey, ScenePalette> = {
  forest: {
    ...STAGE_VISUALS.forest,
    skyTop: '#F8FDF8',
    skyBottom: '#DCEEE0',
    far: '#CBE7D1',
    mid: '#9BD3A8',
    near: '#5E9E70',
    light: '#FFE9A8',
  },
  river: {
    ...STAGE_VISUALS.river,
    skyTop: '#F6FCFF',
    skyBottom: '#D7EEF9',
    far: '#C6E8F5',
    mid: '#86CBE3',
    near: '#3E93B4',
    light: '#FFE7B0',
  },
  autumn: {
    ...STAGE_VISUALS.autumn,
    skyTop: '#FFFDF5',
    skyBottom: '#F6D7A2',
    far: '#EBCB91',
    mid: '#DDA85A',
    near: '#8C5A2B',
    light: '#FFD27A',
  },
  alpine: {
    ...STAGE_VISUALS.alpine,
    skyTop: '#F8FDFF',
    skyBottom: '#CFEAF8',
    far: '#D4EAF6',
    mid: '#9FD2E8',
    near: '#4D7F9E',
    light: '#FFF6CF',
  },
  coast: {
    ...STAGE_VISUALS.coast,
    skyTop: '#F8FDFF',
    skyBottom: '#D9F0F7',
    far: '#D9F0F7',
    mid: '#9FD8E6',
    near: '#3E8F9E',
    light: '#FFE7A8',
  },
  sakura: {
    ...STAGE_VISUALS.sakura,
    skyTop: '#FFF9FB',
    skyBottom: '#F7DDE8',
    far: '#F5DCE4',
    mid: '#E9B6C8',
    near: '#9C5B74',
    light: '#FFE7B8',
  },
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

function Pine({ x, y, scale = 1, color, trunk = '#6B8F73' }: { x: number; y: number; scale?: number; color: string; trunk?: string }) {
  return (
    <g className="scene-prop" transform={`translate(${x} ${y}) scale(${scale})`}>
      <ellipse cx="-4" cy="18" rx="20" ry="5" fill="#0F172A" opacity=".14" />
      <path
        d="M0 -24L5 -10L18 -15L10 -3L22 5L8 8L12 21L0 12L-12 21L-8 8L-22 5L-10 -3L-18 -15L-5 -10Z"
        fill={color}
        stroke="#3F7A55"
        strokeWidth=".9"
        strokeOpacity=".4"
        strokeLinejoin="round"
      />
      <path d="M0 -24L5 -10L18 -15L10 -3L22 5L8 8L12 21L0 12Z" fill="#0F172A" opacity=".12" />
      <circle r="7" fill="#FFFFFF" opacity=".12" />
      <circle r="3" fill={trunk} opacity=".7" />
    </g>
  )
}

function TreeCluster({ x, y, scale = 1, dark = false }: { x: number; y: number; scale?: number; dark?: boolean }) {
  const base = dark ? '#3E7A55' : '#65AE79'
  const outline = dark ? '#356847' : '#4E8D62'
  return (
    <g className="scene-prop" transform={`translate(${x} ${y}) scale(${scale})`}>
      <ellipse cx="-4" cy="26" rx="24" ry="6" fill="#0F172A" opacity=".15" />
      <rect x="-3.5" y="8" width="7" height="20" rx="3" fill="#6B8F73" />
      <rect x="0" y="8" width="3.5" height="20" rx="1.5" fill="#0F172A" opacity=".12" />
      <circle cx="-12" cy="4" r="15" fill="#8ECF9A" stroke={outline} strokeWidth="1" strokeOpacity=".45" />
      <circle cx="8" cy="8" r="17" fill="#73BD86" stroke={outline} strokeWidth="1" strokeOpacity=".45" />
      <circle cx="2" cy="-9" r="18" fill={base} stroke={outline} strokeWidth="1" strokeOpacity=".5" />
      <circle cx="-17" cy="-10" r="11" fill="#9DDAA6" stroke={outline} strokeWidth="1" strokeOpacity=".4" />
      <circle cx="19" cy="-7" r="11" fill="#83C991" stroke={outline} strokeWidth="1" strokeOpacity=".4" />
      <circle cx="-9" cy="-14" r="9" fill="#FFFFFF" opacity=".16" />
      <circle cx="13" cy="10" r="13" fill="#2F6B45" opacity=".13" />
      <circle cx="0" cy="0" r="4" fill="#4B9462" opacity=".45" />
    </g>
  )
}

function Bush({ x, y, scale = 1, color }: { x: number; y: number; scale?: number; color: string }) {
  return (
    <g className="scene-prop" transform={`translate(${x} ${y}) scale(${scale})`} fill={color}>
      <circle cx="-16" cy="3" r="14" stroke="#3F7A55" strokeWidth=".9" strokeOpacity=".35" />
      <circle cx="2" cy="-4" r="18" stroke="#3F7A55" strokeWidth=".9" strokeOpacity=".35" />
      <circle cx="20" cy="4" r="13" stroke="#3F7A55" strokeWidth=".9" strokeOpacity=".35" />
      <circle cx="-8" cy="-11" r="7" fill="#FFFFFF" opacity=".13" />
      <ellipse cx="-3" cy="14" rx="30" ry="7" opacity=".2" fill="#1E3B2C" />
    </g>
  )
}

function Cloud({ x, y, scale = 1, color = '#FFFFFF', className }: { x: number; y: number; scale?: number; color?: string; className?: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <g className={className} fill={color}>
        <ellipse cx="-18" cy="0" rx="18" ry="11" opacity=".72" />
        <ellipse cx="6" cy="-7" rx="22" ry="14" opacity=".9" />
        <ellipse cx="30" cy="1" rx="16" ry="10" opacity=".72" />
        <ellipse cx="6" cy="7" rx="30" ry="8" opacity=".35" />
      </g>
    </g>
  )
}

function Bird({ x, y, color, className }: { x: number; y: number; color: string; className?: string }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <g className={className} fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" opacity=".55">
        <path d="M-9 0C-5-6 0-6 4 0" />
        <path d="M4 0C8-6 13-6 17 0" />
      </g>
    </g>
  )
}

function Boat({ x, y, rotate = 0, className }: { x: number; y: number; rotate?: number; className?: string }) {
  return (
    <g className="scene-prop" transform={`translate(${x} ${y}) rotate(${rotate})`}>
      <g className={className}>
        <ellipse cx="-4" cy="12" rx="20" ry="4" fill="#0F172A" opacity=".14" />
        <path d="M-17 0C-11-7 11-7 17 0 10 10-10 10-17 0Z" fill="#FFF8E9" stroke="#6D9AB0" strokeWidth="2" />
        <path d="M-17 0C-10 10 10 10 17 0" fill="none" stroke="#2C5C72" strokeWidth="2" opacity=".35" />
        <path d="M0-5V7" stroke="#F2B544" strokeWidth="3" strokeLinecap="round" />
      </g>
    </g>
  )
}

function TopHouse({
  x,
  y,
  width,
  height,
  color,
  rotate = 0,
  wall = '#E9D6BC',
  door = '#B54A3A',
  windowColor = '#8CCBD4',
  trim = '#7A5B45',
  grass = '#6E8C4A',
}: {
  x: number
  y: number
  width: number
  height: number
  color: string
  rotate?: number
  wall?: string
  door?: string
  windowColor?: string
  trim?: string
  grass?: string
}) {
  const w = width
  const h = height
  const half = w / 2
  const wallH = h * 0.52
  const roofH = h * 0.64
  const over = w * 0.1
  const side = w * 0.26
  const rise = h * 0.16
  const peakY = -wallH - roofH
  const doorW = w * 0.22
  const doorH = wallH * 0.66
  const winW = w * 0.18
  const winH = wallH * 0.3
  const winY = -wallH * 0.72

  return (
    <g className="scene-house" transform={`translate(${x} ${y}) rotate(${rotate})`}>
      <ellipse cx="0" cy="0.5" rx={half} ry="3.6" fill="#3A2416" opacity=".2" />
      <path
        d={`M${half} 0L${half + side} ${-rise}L${half + side} ${-rise - wallH}L${half} ${-wallH}Z`}
        fill="#C7B39A"
        stroke={trim}
        strokeWidth="1.2"
      />
      <path
        d={`M${half + 2} ${-wallH * 0.62}L${half + side - 2} ${-rise - wallH * 0.62}L${half + side - 2} ${-rise - wallH * 0.62 + winH * 0.7}L${half + 2} ${-wallH * 0.62 + winH * 0.7}Z`}
        fill={windowColor}
        opacity=".85"
        stroke="#FFFFFF"
        strokeWidth=".7"
      />
      <path d={`M${half} 0L${half} ${-wallH}L${half + side} ${-rise - wallH}L${half + side} ${-rise}Z`} fill="#0F172A" opacity=".08" />
      <path
        d={`M${half + over * 0.4} ${-wallH}L${half + side + over * 0.4} ${-rise - wallH}L${half + side + over * 0.4} ${-rise - wallH - 4}L${half + over * 0.4} ${-wallH - 4}Z`}
        fill={color}
        opacity=".78"
        stroke={trim}
        strokeWidth=".8"
      />

      <rect x={-half} y={-wallH} width={w} height={wallH} rx="2" fill={wall} stroke={trim} strokeWidth="1.2" />
      <rect x={-half} y={-4} width={w} height="4" rx="1" fill="#A4ADB2" stroke="#7C858A" strokeWidth=".8" />
      <g stroke={trim} strokeWidth=".8" opacity=".35">
        <path d={`M${-half} ${-wallH * 0.5}H${half}`} />
        <path d={`M${-half + w * 0.28} ${-wallH}V0`} />
        <path d={`M${half - w * 0.28} ${-wallH}V0`} />
      </g>

      <rect x={-doorW / 2} y={-doorH} width={doorW} height={doorH} rx="2" fill={door} stroke="#6B2D22" strokeWidth="1" />
      <rect x={-doorW / 2 + 2} y={-doorH + 2} width={doorW - 4} height={doorH - 4} rx="1.4" fill="none" stroke="#FFFFFF" strokeWidth=".7" opacity=".25" />
      <circle cx={doorW / 2 - 3.5} cy={-doorH * 0.45} r="1.2" fill="#F6E9D7" />
      <rect x={-doorW / 2 - 2} y={-2} width={doorW + 4} height="2.4" rx="1" fill="#C8B49A" />
      <rect x={-doorW / 2 - 3} y={-doorH - 2} width={doorW + 6} height="2" rx="1" fill={trim} opacity=".55" />

      {[-1, 1].map((sideSign) => {
        const wx = sideSign * (w * 0.3)
        return (
          <g key={sideSign}>
            <rect x={wx - winW / 2} y={winY} width={winW} height={winH} rx="1" fill={windowColor} stroke={trim} strokeWidth=".8" />
            <path d={`M${wx} ${winY}V${winY + winH}M${wx - winW / 2} ${winY + winH / 2}H${wx + winW / 2}`} stroke="#FFFFFF" strokeWidth=".7" opacity=".65" />
            <rect x={wx - winW / 2 - 1.5} y={winY + winH + 1} width={winW + 3} height="2.2" rx="1" fill="#A9773A" opacity=".85" />
            <g fill="#E88C9A">
              <circle cx={wx - 2} cy={winY + winH + 0.8} r="1.2" />
              <circle cx={wx + 2.5} cy={winY + winH + 0.8} r="1" />
            </g>
          </g>
        )
      })}

      <path d={`M0 ${peakY - 2}L${-half - over} ${-wallH - 2}L${-half - over} ${-wallH + 3}Z`} fill={color} stroke={trim} strokeWidth="1.2" strokeLinejoin="round" />
      <path d={`M0 ${peakY - 2}L${half + over} ${-wallH - 2}L${half + over} ${-wallH + 3}Z`} fill={color} stroke={trim} strokeWidth="1.2" strokeLinejoin="round" />
      <path d={`M0 ${peakY - 2}L${half + over} ${-wallH - 2}L${half + over} ${-wallH + 3}Z`} fill="#000000" opacity=".08" />

      <g stroke="#FFFFFF" strokeWidth="1" opacity=".24">
        <path d={`M${-half - over + 4} ${-wallH - 2}L0 ${peakY - 2}L${half + over - 4} ${-wallH - 2}`} />
        <path d={`M${-half - over + 9} ${-wallH + 3}L0 ${peakY + 8}L${half + over - 9} ${-wallH + 3}`} />
      </g>
      <path d={`M${-half - over} ${-wallH + 3}H${half + over}`} stroke="#FFFFFF" strokeWidth="1.6" opacity=".55" />

      <path d={`M${-half + 1} ${-wallH}L0 ${peakY + 8}L${half - 1} ${-wallH}Z`} fill={wall} stroke={trim} strokeWidth="1.1" strokeLinejoin="round" />
      <g>
        <rect x="-3.4" y={-wallH - roofH * 0.3} width="6.8" height="7" rx="1" fill={windowColor} stroke={trim} strokeWidth=".7" />
        <path d={`M0 ${-wallH - roofH * 0.3}V${-wallH - roofH * 0.3 + 7}M-3.4 ${-wallH - roofH * 0.3 + 3.5}H3.4`} stroke="#FFFFFF" strokeWidth=".6" opacity=".7" />
      </g>
      <path d={`M${-half + 1} ${-wallH}H${half - 1}`} stroke={trim} strokeWidth="1.2" opacity=".6" />

      <path d={`M0 ${peakY + 8}L0 ${peakY - 2}`} stroke={trim} strokeWidth="2.2" strokeLinecap="round" />
      <path d={`M${-half - over + 2} ${-wallH - 1}L0 ${peakY - 2}L${half + over - 2} ${-wallH - 1}`} fill="none" stroke="#FFFFFF" strokeWidth="1.2" opacity=".45" />

      <g transform={`translate(${half * 0.5} ${peakY + 8})`}>
        <rect x="-4" y="-12" width="8" height="13" rx="1.2" fill="#9AA7AE" stroke="#6E7C84" strokeWidth=".8" />
        <rect x="-5" y="-13" width="10" height="2.6" rx="1" fill="#7E8B92" />
        <path d="M-2-13C-3-17 1-18 0-21" fill="none" stroke="#D7E1E5" strokeWidth="1.6" strokeLinecap="round" opacity=".7" className="scene-smoke" />
      </g>

      <g stroke={grass} strokeWidth="1.5" strokeLinecap="round" fill="none" opacity=".9">
        <path d={`M${-half + 2} 1C${-half} -2 ${-half + 1} -5 ${-half + 3} -7`} />
        <path d={`M${-half + 7} 1C${-half + 6} -2 ${-half + 8} -4 ${-half + 6} -6`} />
        <path d={`M${half - 3} 1C${half - 5} -2 ${half - 4} -5 ${half - 2} -7`} />
        <path d={`M${half - 8} 1C${half - 9} -2 ${half - 7} -4 ${half - 9} -6`} />
      </g>
    </g>
  )
}

function AutumnTree({ x, y, scale = 1, tone = '#D97706' }: { x: number; y: number; scale?: number; tone?: string }) {
  return (
    <g className="scene-prop" transform={`translate(${x} ${y}) scale(${scale})`}>
      <ellipse cx="2" cy="29" rx="27" ry="6" fill="#3A2416" opacity=".18" />
      <path d="M0 6C1 17 0 24 0 31" stroke="#7A4B2A" strokeWidth="7" strokeLinecap="round" />
      <path d="M0 21C-6 15-13 12-19 10" stroke="#7A4B2A" strokeWidth="4" strokeLinecap="round" />
      <path d="M0 19C7 14 14 11 20 8" stroke="#7A4B2A" strokeWidth="4" strokeLinecap="round" />
      <circle cx="-18" cy="0" r="16" fill={tone} stroke="#9A5B16" strokeWidth="1" strokeOpacity=".35" />
      <circle cx="10" cy="4" r="19" fill={tone} stroke="#9A5B16" strokeWidth="1" strokeOpacity=".3" />
      <circle cx="2" cy="-14" r="17" fill="#F59E0B" stroke="#9A5B16" strokeWidth="1" strokeOpacity=".3" />
      <circle cx="-22" cy="-12" r="11" fill="#FBBF24" />
      <circle cx="20" cy="-10" r="12" fill="#C2410C" opacity=".85" />
      <circle cx="-6" cy="-20" r="9" fill="#FFD27A" opacity=".35" />
      <circle cx="7" cy="10" r="12" fill="#7C2D12" opacity=".16" />
    </g>
  )
}

function FallingLeaves({ y, seed }: { y: number; seed: number }) {
  const leaves: Array<[number, number, string, number]> = [
    [96, 226, '#D97706', -18],
    [188, 322, '#F59E0B', 24],
    [278, 254, '#C2410C', 12],
    [360, 438, '#FBBF24', -26],
    [796, 248, '#D97706', 20],
    [878, 360, '#C2410C', -12],
    [1010, 286, '#F59E0B', 28],
    [1048, 470, '#B45309', -20],
    [456, 386, '#FBBF24', 16],
    [664, 448, '#D97706', -24],
  ]
  return (
    <g>
      {leaves.map(([x, offsetY, color, tilt], index) => (
        <g key={`${seed}-${index}`} transform={`translate(${x} ${y + offsetY}) rotate(${tilt})`}>
          <path
            className="scene-leaf"
            d="M0 0C5 0 8 4 7 8C3 9-3 8-6 5C-8 1-4-1 0 0Z"
            fill={color}
            style={{ animationDelay: `${index * 0.7}s`, animationDuration: `${6 + (index % 3)}s` }}
          />
        </g>
      ))}
    </g>
  )
}

function HayBale({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return (
    <g className="scene-prop" transform={`translate(${x} ${y}) scale(${scale})`}>
      <ellipse cx="1" cy="14" rx="27" ry="6" fill="#5A3B1A" opacity=".18" />
      <rect x="-24" y="-12" width="48" height="24" rx="10" fill="#D9A43A" stroke="#9A6A20" strokeWidth="1.2" />
      <path d="M-16-12V12M-8-12V12M0-12V12M8-12V12M16-12V12" stroke="#B78026" strokeWidth="1.5" opacity=".8" />
      <path d="M-20-7H20M-22 0H22M-20 7H20" stroke="#F2C85B" strokeWidth="1.2" opacity=".7" />
      <path d="M-24-2H-25M24-2H25" stroke="#9A6A20" strokeWidth="1.5" strokeLinecap="round" />
      <rect x="-20" y="-10" width="40" height="4" rx="2" fill="#FFF1B8" opacity=".45" />
    </g>
  )
}

function Pumpkin({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return (
    <g className="scene-prop" transform={`translate(${x} ${y}) scale(${scale})`}>
      <ellipse cx="1" cy="12" rx="14" ry="4" fill="#5A3B1A" opacity=".18" />
      <circle cx="0" cy="0" r="12" fill="#E87928" stroke="#A64B13" strokeWidth="1" />
      <path d="M-5-11C-7 0-7 7-4 12M0-12C-1 0-1 8 0 12M5-11C7 0 7 7 4 12" fill="none" stroke="#C25B18" strokeWidth="1.1" opacity=".8" />
      <path d="M0-13C-2-18 2-20 4-22C3-18 2-15 0-13Z" fill="#4F7A32" stroke="#3A5E25" strokeWidth=".7" />
    </g>
  )
}

function SnowPine({ x, y, scale = 1, color = '#2F6F6A' }: { x: number; y: number; scale?: number; color?: string }) {
  return (
    <g className="scene-prop" transform={`translate(${x} ${y}) scale(${scale})`}>
      <ellipse cx="-4" cy="18" rx="20" ry="5" fill="#0F172A" opacity=".18" />
      <rect x="-2.5" y="7" width="5" height="14" rx="2.5" fill="#5B4636" />
      <path d="M0 -24L5 -10L18 -15L10 -3L22 5L8 8L12 21L0 12L-12 21L-8 8L-22 5L-10 -3L-18 -15L-5 -10Z" fill={color} stroke="#244B52" strokeWidth="1" strokeLinejoin="round" />
      <path d="M0 -17L4 -7L13 -10L7 -2L16 3L6 6L9 15L0 9L-9 15L-6 6L-16 3L-7 -2L-13 -10L-4 -7Z" fill="#3B7C75" opacity=".55" />
      <path d="M0 -10L3 -4L8 -6L4 0L9 2L3 3L4 8L0 4L-4 8L-3 3L-9 2L-4 0L-8 -6L-3 -4Z" fill="#FFFFFF" opacity=".26" />
      <g fill="#FFFFFF">
        <circle cx="0" cy="-24" r="2.2" />
        <circle cx="18" cy="-15" r="1.8" />
        <circle cx="22" cy="5" r="1.7" />
        <circle cx="12" cy="21" r="1.8" />
        <circle cx="-12" cy="21" r="1.8" />
        <circle cx="-22" cy="5" r="1.7" />
        <circle cx="-18" cy="-15" r="1.8" />
        <circle cx="5" cy="-10" r="1.2" />
        <circle cx="10" cy="-3" r="1.2" />
        <circle cx="-10" cy="-3" r="1.2" />
        <circle cx="-5" cy="-10" r="1.2" />
        <circle cx="8" cy="8" r="1.2" />
        <circle cx="-8" cy="8" r="1.2" />
      </g>
      <circle r="2.6" fill="#FFFFFF" opacity=".55" />
    </g>
  )
}

function SnowField({ y, seed }: { y: number; seed: number }) {
  const flakes: Array<[number, number]> = [
    [74, 118], [168, 286], [256, 86], [342, 384], [420, 168], [608, 286], [700, 98], [786, 354], [882, 168], [968, 304], [1044, 88], [1102, 408],
  ]
  return (
    <g fill="#FFFFFF">
      {flakes.map(([x, offsetY], index) => (
        <circle
          key={`${seed}-${index}`}
          cx={x}
          cy={y + offsetY}
          r={1.5 + (index % 3) * 0.6}
          className="scene-snow"
          opacity=".78"
          style={{ animationDelay: `${index * 0.6}s`, animationDuration: `${7 + (index % 4)}s` }}
        />
      ))}
    </g>
  )
}

function CoastPalm({ x, y, scale = 1, color = '#4E9B6A' }: { x: number; y: number; scale?: number; color?: string }) {
  return (
    <g className="scene-prop" transform={`translate(${x} ${y}) scale(${scale})`}>
      <ellipse cx="-4" cy="6" rx="24" ry="6" fill="#0F172A" opacity=".16" />
      <path d="M0 0C-5-24 0-48 10-66" fill="none" stroke="#9C765D" strokeWidth="7" strokeLinecap="round" />
      <path d="M4 0C-1-24 4-48 13-65" fill="none" stroke="#7A5B45" strokeWidth="3" strokeLinecap="round" opacity=".3" />
      <g fill={color} stroke="#3F7A55" strokeWidth=".8" strokeOpacity=".28">
        <path d="M10-66C-10-80-32-78-44-62C-24-66-6-56 10-66Z" />
        <path d="M10-66C0-90-20-98-36-90C-18-84-4-74 10-66Z" />
        <path d="M10-66C26-92 48-98 62-86C44-82 26-72 10-66Z" />
        <path d="M10-66C32-74 52-68 60-52C42-60 24-58 10-66Z" />
        <path d="M10-66C6-90 12-106 26-114C24-96 18-80 10-66Z" />
      </g>
      <g fill="#6B4A2F">
        <circle cx="7" cy="-62" r="3" />
        <circle cx="15" cy="-60" r="2.6" />
      </g>
    </g>
  )
}

function Lighthouse({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return (
    <g className="scene-prop" transform={`translate(${x} ${y}) scale(${scale})`}>
      <ellipse cx="2" cy="6" rx="28" ry="7" fill="#0F172A" opacity=".18" />
      <path d="M-16 0H16L11-54H-11Z" fill="#F7F2E7" stroke="#7C8B8A" strokeWidth="1.2" />
      <path d="M-14-12H14L12-25H-12Z" fill="#D65A52" opacity=".9" />
      <path d="M-12-38H12L11-50H-11Z" fill="#D65A52" opacity=".9" />
      <rect x="-14" y="-58" width="28" height="5" rx="2" fill="#5A6F70" />
      <rect x="-9" y="-70" width="18" height="12" rx="1" fill="#FFE7A8" stroke="#5A6F70" strokeWidth="1" />
      <path d="M-14-58L0-76L14-58Z" fill="#D65A52" stroke="#8A3D35" strokeWidth="1" />
      <circle cx="0" cy="-64" r="3" fill="#FFF4C7" />
      <path d="M-2-64L-82-92L-82-38Z" fill="#FFE7A8" opacity=".18" />
      <path d="M2-64L82-92L82-38Z" fill="#FFE7A8" opacity=".14" />
    </g>
  )
}

function SakuraTree({ x, y, scale = 1, tone = '#F4B8C8' }: { x: number; y: number; scale?: number; tone?: string }) {
  return (
    <g className="scene-prop" transform={`translate(${x} ${y}) scale(${scale})`}>
      <ellipse cx="3" cy="27" rx="27" ry="6" fill="#5B3B4A" opacity=".16" />
      <path d="M0 6C1 17 0 24 0 30" stroke="#7B5A53" strokeWidth="7" strokeLinecap="round" />
      <path d="M0 21C-7 15-14 12-20 9" stroke="#7B5A53" strokeWidth="4" strokeLinecap="round" />
      <path d="M0 19C7 14 14 11 20 8" stroke="#7B5A53" strokeWidth="4" strokeLinecap="round" />
      <circle cx="-18" cy="0" r="16" fill={tone} stroke="#D98BA3" strokeWidth="1" strokeOpacity=".4" />
      <circle cx="10" cy="4" r="19" fill={tone} stroke="#D98BA3" strokeWidth="1" strokeOpacity=".35" />
      <circle cx="2" cy="-14" r="17" fill="#F9D6E1" stroke="#D98BA3" strokeWidth="1" strokeOpacity=".35" />
      <circle cx="-22" cy="-12" r="11" fill="#FCE4EC" />
      <circle cx="20" cy="-10" r="12" fill="#E88FAB" opacity=".8" />
      <circle cx="-6" cy="-20" r="9" fill="#FFFFFF" opacity=".3" />
      <circle cx="7" cy="10" r="12" fill="#8B4E66" opacity=".12" />
      <g fill="#FFFFFF" opacity=".65">
        <circle cx="-24" cy="-4" r="1.6" />
        <circle cx="18" cy="-16" r="1.4" />
        <circle cx="-2" cy="-22" r="1.5" />
        <circle cx="24" cy="2" r="1.3" />
      </g>
    </g>
  )
}

function FallingPetals({ y, seed }: { y: number; seed: number }) {
  const petals: Array<[number, number, number]> = [
    [96, 238, -18], [188, 330, 24], [278, 262, 12], [360, 446, -26],
    [796, 256, 20], [878, 368, -12], [1010, 294, 28], [1048, 478, -20],
    [456, 394, 16], [664, 456, -24],
  ]
  return (
    <g>
      {petals.map(([x, offsetY, tilt], index) => (
        <g key={`${seed}-${index}`} transform={`translate(${x} ${y + offsetY}) rotate(${tilt})`}>
          <path
            className="scene-leaf"
            d="M0 0C4 1 5 5 2 7C-2 6-3 2 0 0Z"
            fill={index % 3 === 0 ? '#F9D6E1' : '#F2A9C0'}
            style={{ animationDelay: `${index * 0.7}s`, animationDuration: `${6 + (index % 3)}s` }}
          />
        </g>
      ))}
    </g>
  )
}

function Pagoda({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  const roofColor = '#355C5B'
  const wall = '#F4E3D7'
  const red = '#B24A3F'
  return (
    <g className="scene-prop" transform={`translate(${x} ${y}) scale(${scale})`}>
      <ellipse cx="2" cy="7" rx="42" ry="8" fill="#0F172A" opacity=".17" />
      <rect x="-36" y="-12" width="72" height="13" rx="2" fill="#C8B8B1" stroke="#8C7B73" strokeWidth="1" />
      <rect x="-28" y="-9" width="56" height="4" rx="1" fill="#E6D9D3" opacity=".8" />

      <rect x="-26" y="-50" width="52" height="38" rx="1" fill={wall} stroke="#8A5A4A" strokeWidth="1" />
      <path d="M-26-50H26L30-56H-30Z" fill={roofColor} stroke="#244544" strokeWidth="1" />
      <path d="M-30-56Q0-64 30-56Q0-51 -30-56Z" fill={roofColor} stroke="#244544" strokeWidth="1" />
      <path d="M-30-56Q-42-58-48-53Q-38-50-30-56Z" fill={roofColor} opacity=".9" />
      <path d="M30-56Q42-58 48-53Q38-50 30-56Z" fill={roofColor} opacity=".8" />
      <g stroke="#FFFFFF" strokeWidth="1" opacity=".2">
        <path d="M-26-50H26M-24-38H24M-24-27H24" />
      </g>
      <rect x="-6" y="-34" width="12" height="22" rx="1" fill={red} stroke="#7B2C25" strokeWidth=".8" />
      <rect x="-18" y="-44" width="4" height="32" fill={red} opacity=".8" />
      <rect x="14" y="-44" width="4" height="32" fill={red} opacity=".8" />
      <g fill="#F2C879">
        <rect x="-15" y="-40" width="5" height="6" rx="1" />
        <rect x="10" y="-40" width="5" height="6" rx="1" />
      </g>

      <rect x="-21" y="-88" width="42" height="38" rx="1" fill={wall} stroke="#8A5A4A" strokeWidth="1" />
      <path d="M-21-88H21L26-94H-26Z" fill={roofColor} stroke="#244544" strokeWidth="1" />
      <path d="M-26-94Q0-102 26-94Q0-89 -26-94Z" fill={roofColor} stroke="#244544" strokeWidth="1" />
      <path d="M-26-94Q-38-96-44-91Q-34-88-26-94Z" fill={roofColor} opacity=".9" />
      <path d="M26-94Q38-96 44-91Q34-88 26-94Z" fill={roofColor} opacity=".8" />
      <g fill="#F2C879">
        <rect x="-14" y="-81" width="5" height="7" rx="1" />
        <rect x="9" y="-81" width="5" height="7" rx="1" />
      </g>
      <rect x="-5" y="-72" width="10" height="20" rx="1" fill={red} stroke="#7B2C25" strokeWidth=".8" />

      <rect x="-16" y="-124" width="32" height="36" rx="1" fill={wall} stroke="#8A5A4A" strokeWidth="1" />
      <path d="M-16-124H16L21-130H-21Z" fill={roofColor} stroke="#244544" strokeWidth="1" />
      <path d="M-21-130Q0-138 21-130Q0-125 -21-130Z" fill={roofColor} stroke="#244544" strokeWidth="1" />
      <path d="M-21-130Q-32-132-38-127Q-28-124-21-130Z" fill={roofColor} opacity=".9" />
      <path d="M21-130Q32-132 38-127Q28-124 21-130Z" fill={roofColor} opacity=".8" />
      <rect x="-4" y="-113" width="8" height="15" rx="1" fill={red} stroke="#7B2C25" strokeWidth=".7" />
      <path d={`M0-138V-158M-5-151H5`} stroke="#B24A3F" strokeWidth="2" strokeLinecap="round" />
      <circle cx="0" cy="-159" r="3" fill="#D9A24B" />
    </g>
  )
}

function Torii({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  const red = '#C94F45'
  return (
    <g className="scene-prop" transform={`translate(${x} ${y}) scale(${scale})`}>
      <ellipse cx="2" cy="5" rx="30" ry="5" fill="#0F172A" opacity=".16" />
      <rect x="-24" y="-52" width="6" height="54" rx="2" fill={red} stroke="#8E332D" strokeWidth=".8" />
      <rect x="18" y="-52" width="6" height="54" rx="2" fill={red} stroke="#8E332D" strokeWidth=".8" />
      <path d="M-34-52Q0-62 34-52L32-46Q0-55 -32-46Z" fill={red} stroke="#8E332D" strokeWidth="1" />
      <path d="M-28-40H28L26-35H-26Z" fill={red} stroke="#8E332D" strokeWidth=".8" />
      <rect x="-7" y="-50" width="14" height="8" rx="1" fill="#F0D8B4" stroke="#8E332D" strokeWidth=".7" />
      <path d="M-34-52Q0-65 34-52" fill="none" stroke="#F2A9A0" strokeWidth="1.5" opacity=".5" />
    </g>
  )
}

function StoneLantern({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return (
    <g className="scene-prop" transform={`translate(${x} ${y}) scale(${scale})`}>
      <ellipse cx="1" cy="4" rx="16" ry="4" fill="#0F172A" opacity=".16" />
      <rect x="-12" y="-8" width="24" height="10" rx="2" fill="#B8B2AA" stroke="#7C766F" strokeWidth="1" />
      <rect x="-4" y="-28" width="8" height="21" fill="#C9C3B9" stroke="#7C766F" strokeWidth=".8" />
      <path d="M-14-28H14L10-40H-10Z" fill="#B8B2AA" stroke="#7C766F" strokeWidth="1" />
      <rect x="-8" y="-52" width="16" height="12" rx="1" fill="#F2C879" stroke="#7C766F" strokeWidth="1" />
      <path d="M-14-52H14L8-62H-8Z" fill="#A8A29A" stroke="#7C766F" strokeWidth="1" />
      <circle cx="0" cy="-46" r="2" fill="#FFF4C7" />
    </g>
  )
}

function MountainRange({ y, color, opacity = 1, width = 1120 }: { y: number; color: string; opacity?: number; width?: number }) {
  return (
    <path
      d={`M-40 ${y}L120 ${y - 230}L240 ${y - 90}L390 ${y - 300}L540 ${y - 60}L700 ${y - 250}L850 ${y - 80}L980 ${y - 210}L${width + 40} ${y}Z`}
      fill={color}
      opacity={opacity}
    />
  )
}

function Building({ x, y, width, height, color, windowColor, roofColor = color, className }: { x: number; y: number; width: number; height: number; color: string; windowColor: string; roofColor?: string; className?: string }) {
  const roofH = Math.min(16, height * 0.1)
  const side = Math.max(10, width * 0.3)
  const sideRise = Math.min(12, height * 0.06)
  const facadeTop = y + roofH
  const facadeHeight = height - roofH
  const columns = Math.max(3, Math.floor(width / 17))
  const rows = Math.max(4, Math.floor(facadeHeight / 22))
  const gapX = width / (columns + 1)
  const gapY = facadeHeight / (rows + 1)
  const winW = Math.min(8, gapX * 0.45)
  const winH = Math.min(7, gapY * 0.36)

  return (
    <g className={`scene-building${className ? ` ${className}` : ''}`}>
      <path
        d={`M${x + width} ${facadeTop}L${x + width + side} ${facadeTop - sideRise}L${x + width + side} ${y + height - sideRise}L${x + width} ${y + height}Z`}
        fill={color}
        opacity=".66"
        stroke="#171226"
        strokeWidth="1.2"
      />
      <path
        d={`M${x + width} ${facadeTop}L${x + width + side} ${facadeTop - sideRise}L${x + width + side} ${facadeTop - sideRise + 3}L${x + width} ${facadeTop + 3}Z`}
        fill="#FFFFFF"
        opacity=".08"
      />
      {Array.from({ length: Math.max(2, Math.floor(rows / 2)) }, (_, row) => (
        [0, 1].map((column) => (
          <rect
            key={`side-${row}-${column}`}
            x={x + width + 3 + column * (side * 0.38)}
            y={facadeTop - sideRise * 0.4 + row * (facadeHeight / Math.max(2, Math.floor(rows / 2)) * 0.7)}
            width={side * 0.22}
            height={Math.max(3, winH * 0.6)}
            rx="1"
            fill={windowColor}
            opacity={(row + column) % 3 === 0 ? 0.35 : 0.75}
          />
        ))
      ))}

      <rect x={x} y={facadeTop} width={width} height={facadeHeight} rx="2" fill={color} stroke="#171226" strokeWidth="1.2" />
      <path d={`M${x + 2} ${facadeTop + 2}V${y + height - 2}`} stroke="#FFFFFF" strokeWidth="1" opacity=".14" />

      {Array.from({ length: rows }, (_, row) => (
        Array.from({ length: columns }, (_, column) => (
          <rect
            key={`front-${row}-${column}`}
            x={x + gapX * (column + 1) - winW / 2}
            y={facadeTop + gapY * (row + 1) - winH / 2}
            width={winW}
            height={winH}
            rx="1"
            fill={windowColor}
            opacity={(row * 3 + column) % 5 === 0 ? 0.28 : 0.82}
          />
        ))
      ))}

      <rect x={x + width * 0.42} y={y + height - 15} width={width * 0.16} height="15" rx="1.5" fill={windowColor} opacity=".8" />
      <rect x={x + width * 0.42 - 2} y={y + height - 16} width={width * 0.16 + 4} height="2" rx="1" fill="#FFFFFF" opacity=".35" />

      <path
        d={`M${x} ${facadeTop}L${x + side} ${facadeTop - sideRise}L${x + width + side} ${facadeTop - sideRise}L${x + width} ${facadeTop}Z`}
        fill={roofColor}
        stroke="#171226"
        strokeWidth="1.2"
      />
      <path
        d={`M${x} ${facadeTop}L${x + side} ${facadeTop - sideRise}L${x + width + side} ${facadeTop - sideRise}L${x + width} ${facadeTop}`}
        fill="none"
        stroke={windowColor}
        strokeWidth="1.4"
        opacity=".62"
      />
      <rect
        x={x + width * 0.2}
        y={facadeTop - sideRise - 5}
        width={width * 0.38}
        height="4"
        rx="2"
        fill={windowColor}
        opacity=".85"
      />

      <g fill="#6E9B6A" stroke="#4F7A55" strokeWidth=".7">
        <circle cx={x + 6} cy={y + height - 1.5} r="3.4" />
        <circle cx={x + 10.5} cy={y + height - 1} r="2.6" opacity=".9" />
        <circle cx={x + width - 6} cy={y + height - 1.5} r="3.4" />
        <circle cx={x + width - 10.5} cy={y + height - 1} r="2.6" opacity=".9" />
      </g>
    </g>
  )
}

function StageScene({ theme, y, index, uid }: { theme: StageThemeKey; y: number; index: number; uid: string }) {
  const scene = SCENES[theme]
  const id = `${uid}-scene-${index}`

  return (
    <g aria-hidden="true" pointerEvents="none">
      <defs>
        <linearGradient id={`${id}-sky`} x1="0" y1={y} x2="0" y2={y + ROADMAP_LAYOUT.stageHeight} gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={scene.skyTop} />
          <stop offset="1" stopColor={scene.skyBottom} />
        </linearGradient>
        <radialGradient id={`${id}-light`} cx="82%" cy="12%" r="62%">
          <stop offset="0" stopColor={scene.light} stopOpacity=".62" />
          <stop offset="1" stopColor={scene.light} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}-edge`} x1="0" y1={y} x2="0" y2={y + 16} gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#0F172A" stopOpacity=".1" />
          <stop offset="1" stopColor="#0F172A" stopOpacity="0" />
        </linearGradient>
        {theme === 'river' && (
          <linearGradient id={`${id}-water`} x1="0" y1={y + 300} x2="0" y2={y + 520} gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#B7DDF1" />
            <stop offset="1" stopColor="#DDF1FA" />
          </linearGradient>
        )}
        {theme === 'alpine' && (
          <linearGradient id={`${id}-ice`} x1="0" y1={y + 450} x2="0" y2={y + 570} gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#CFEFFA" />
            <stop offset="1" stopColor="#EAF9FF" />
          </linearGradient>
        )}
        {theme === 'coast' && (
          <linearGradient id={`${id}-sea`} x1="0" y1={y + 250} x2="0" y2={y + 470} gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#8FD8E8" />
            <stop offset="1" stopColor="#D7F3F8" />
          </linearGradient>
        )}
        {theme === 'sakura' && (
          <linearGradient id={`${id}-pond`} x1="0" y1={y + 470} x2="0" y2={y + 610} gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#D9EEF2" />
            <stop offset="1" stopColor="#F3DFE7" />
          </linearGradient>
        )}
      </defs>

      <rect x="0" y={y} width="1120" height={ROADMAP_LAYOUT.stageHeight} fill={`url(#${id}-sky)`} />
      <rect x="0" y={y} width="1120" height={ROADMAP_LAYOUT.stageHeight} fill={`url(#${id}-light)`} />

      {theme === 'forest' && (
        <g>
          <path d={`M-40 ${y + 330}C160 ${y + 250} 330 ${y + 300} 500 ${y + 260}C680 ${y + 218} 860 ${y + 286} 1160 ${y + 224}V${y + 670}H-40Z`} transform="translate(0 10)" fill="#0F172A" opacity=".06" />
          <path d={`M-40 ${y + 330}C160 ${y + 250} 330 ${y + 300} 500 ${y + 260}C680 ${y + 218} 860 ${y + 286} 1160 ${y + 224}V${y + 670}H-40Z`} fill={scene.far} opacity=".55" />
          <path d={`M-40 ${y + 410}C180 ${y + 340} 370 ${y + 390} 570 ${y + 348}C780 ${y + 306} 960 ${y + 374} 1160 ${y + 326}V${y + 670}H-40Z`} transform="translate(0 9)" fill="#0F172A" opacity=".05" />
          <path d={`M-40 ${y + 410}C180 ${y + 340} 370 ${y + 390} 570 ${y + 348}C780 ${y + 306} 960 ${y + 374} 1160 ${y + 326}V${y + 670}H-40Z`} fill={scene.mid} opacity=".32" />
          <g fill={scene.far} opacity=".66">
            {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((treeIndex) => (
              <Pine key={treeIndex} x={36 + treeIndex * 128} y={y + 344} scale={0.5} color={scene.far} trunk={scene.far} />
            ))}
          </g>
          <TreeCluster x={122} y={y + 196} scale={1.08} />
          <TreeCluster x={984} y={y + 176} scale={0.98} />
          <Pine x={226} y={y + 600} scale={1.2} color={scene.near} />
          <Pine x={944} y={y + 592} scale={1.05} color={scene.near} />
          <TopHouse x={104} y={y + 604} width={50} height={42} color="#EFB68C" rotate={-4} />
          <TopHouse x={1002} y={y + 616} width={46} height={38} color="#9BCFD3" rotate={5} />
          <TreeCluster x={1042} y={y + 438} scale={0.74} dark />
          <Bush x={58} y={y + 638} scale={1.15} color={scene.near} />
          <Bush x={1082} y={y + 646} scale={1.08} color={scene.near} />
          <Cloud x={304} y={y + 92} scale={0.9} color="#FFFFFF" className="scene-cloud" />
          <Bird x={692} y={y + 126} color={scene.ink} />
          <Bird x={742} y={y + 154} color={scene.ink} className="scene-bird" />
        </g>
      )}

      {theme === 'river' && (
        <g>
          <path d={`M-40 ${y + 300}C180 ${y + 226} 330 ${y + 278} 520 ${y + 236}C720 ${y + 192} 900 ${y + 262} 1160 ${y + 208}V${y + 670}H-40Z`} transform="translate(0 12)" fill="#0F172A" opacity=".06" />
          <path d={`M-40 ${y + 300}C180 ${y + 226} 330 ${y + 278} 520 ${y + 236}C720 ${y + 192} 900 ${y + 262} 1160 ${y + 208}V${y + 670}H-40Z`} fill={scene.far} opacity=".6" />
          <path
            d={`M-40 ${y + 336}C170 ${y + 292} 320 ${y + 402} 548 ${y + 326}C770 ${y + 250} 930 ${y + 370} 1160 ${y + 302}V${y + 520}C960 ${y + 556} 790 ${y + 464} 590 ${y + 528}C390 ${y + 592} 190 ${y + 468} -40 ${y + 532}Z`}
            transform="translate(0 8)"
            fill="#0F172A"
            opacity=".05"
          />
          <path
            d={`M-40 ${y + 336}C170 ${y + 292} 320 ${y + 402} 548 ${y + 326}C770 ${y + 250} 930 ${y + 370} 1160 ${y + 302}V${y + 520}C960 ${y + 556} 790 ${y + 464} 590 ${y + 528}C390 ${y + 592} 190 ${y + 468} -40 ${y + 532}Z`}
            fill={`url(#${id}-water)`}
          />
          <path
            d={`M-40 ${y + 360}C170 ${y + 316} 320 ${y + 426} 548 ${y + 350}C770 ${y + 274} 930 ${y + 394} 1160 ${y + 326}`}
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="4"
            strokeLinecap="round"
            opacity=".55"
            className="scene-shimmer"
          />
          <path
            d={`M-40 ${y + 430}C190 ${y + 386} 330 ${y + 490} 560 ${y + 420}C790 ${y + 350} 950 ${y + 458} 1160 ${y + 394}`}
            fill="none"
            stroke="#EAF8FD"
            strokeWidth="8"
            strokeLinecap="round"
            opacity=".4"
            className="scene-shimmer scene-shimmer-slow"
          />
          <path d={`M-40 ${y + 538}C190 ${y + 474} 400 ${y + 570} 640 ${y + 516}C850 ${y + 468} 1000 ${y + 560} 1160 ${y + 516}V${y + 670}H-40Z`} fill={scene.mid} opacity=".2" />
          <Boat x={190} y={y + 390} rotate={-8} className="scene-boat" />
          <Boat x={906} y={y + 346} rotate={10} className="scene-boat scene-boat-slow" />
          <Boat x={760} y={y + 492} rotate={-4} className="scene-boat" />
          <TreeCluster x={108} y={y + 196} scale={0.9} />
          <TreeCluster x={1020} y={y + 214} scale={0.8} dark />
          <g stroke={scene.near} strokeWidth="3" strokeLinecap="round" opacity=".65">
            <path d={`M134 ${y + 600}V${y + 554}`} />
            <path d={`M146 ${y + 606}V${y + 548}`} />
            <path d={`M158 ${y + 600}V${y + 566}`} />
          </g>
          <Bush x={64} y={y + 640} scale={1.05} color={scene.near} />
          <Cloud x={300} y={y + 88} scale={0.85} className="scene-cloud" />
          <Bird x={742} y={y + 130} color={scene.ink} className="scene-bird" />
        </g>
      )}

      {theme === 'autumn' && (
        <g>
          <circle cx={948} cy={y + 120} r="92" fill={scene.light} opacity=".26" />
          <circle cx={948} cy={y + 120} r="44" fill="#FFD88A" opacity=".82" />
          <path d={`M-40 ${y + 330}C160 ${y + 250} 330 ${y + 300} 500 ${y + 260}C680 ${y + 218} 860 ${y + 286} 1160 ${y + 224}V${y + 670}H-40Z`} transform="translate(0 10)" fill="#5A3B1A" opacity=".07" />
          <path d={`M-40 ${y + 330}C160 ${y + 250} 330 ${y + 300} 500 ${y + 260}C680 ${y + 218} 860 ${y + 286} 1160 ${y + 224}V${y + 670}H-40Z`} fill={scene.far} opacity=".55" />
          <path d={`M-40 ${y + 410}C180 ${y + 340} 370 ${y + 390} 570 ${y + 348}C780 ${y + 306} 960 ${y + 374} 1160 ${y + 326}V${y + 670}H-40Z`} transform="translate(0 9)" fill="#5A3B1A" opacity=".06" />
          <path d={`M-40 ${y + 410}C180 ${y + 340} 370 ${y + 390} 570 ${y + 348}C780 ${y + 306} 960 ${y + 374} 1160 ${y + 326}V${y + 670}H-40Z`} fill={scene.mid} opacity=".34" />
          <path d={`M-40 ${y + 628}C200 ${y + 586} 420 ${y + 652} 640 ${y + 612}C840 ${y + 578} 1000 ${y + 646} 1160 ${y + 608}V${y + 670}H-40Z`} fill={scene.near} opacity=".2" />
          <g opacity=".58">
            {Array.from({ length: 8 }, (_, treeIndex) => (
              <AutumnTree
                key={`autumn-far-${treeIndex}`}
                x={42 + treeIndex * 138}
                y={y + 336}
                scale={0.36}
                tone={['#D97706', '#C2410C', '#F59E0B'][treeIndex % 3]}
              />
            ))}
          </g>
          <AutumnTree x={128} y={y + 300} scale={1.15} tone="#D97706" />
          <AutumnTree x={1002} y={y + 286} scale={1} tone="#C2410C" />
          <AutumnTree x={206} y={y + 606} scale={0.92} tone="#F59E0B" />
          <AutumnTree x={920} y={y + 604} scale={0.95} tone="#B45309" />
          <TopHouse x={292} y={y + 548} width={52} height={42} color="#C2410C" rotate={-4} />
          <TopHouse x={354} y={y + 566} width={44} height={36} color="#B45309" rotate={4} />
          <TopHouse x={812} y={y + 590} width={46} height={38} color="#D97706" rotate={-2} />
          <HayBale x={706} y={y + 614} scale={0.9} />
          <Pumpkin x={758} y={y + 636} scale={0.9} />
          <Pumpkin x={778} y={y + 646} scale={0.65} />
          <FallingLeaves y={y} seed={index} />
          <Cloud x={300} y={y + 90} scale={0.82} color="#FFF7E8" className="scene-cloud" />
          <Bird x={704} y={y + 120} color={scene.ink} />
          <Bird x={750} y={y + 148} color={scene.ink} className="scene-bird" />
        </g>
      )}

      {theme === 'alpine' && (
        <g>
          <circle cx={944} cy={y + 108} r="80" fill={scene.light} opacity=".38" />
          <circle cx={944} cy={y + 108} r="34" fill="#FFF8DC" opacity=".9" />
          <g transform="translate(12 14)" opacity=".12">
            <MountainRange y={y + 330} color="#3E5C72" />
          </g>
          <MountainRange y={y + 330} color={scene.far} opacity={0.65} />
          <MountainRange y={y + 454} color={scene.mid} opacity={0.7} />
          <path d={`M-40 ${y + 454}L120 ${y + 236}L250 ${y + 400}L400 ${y + 208}L548 ${y + 420}L690 ${y + 270}L820 ${y + 440}L960 ${y + 286}L1160 ${y + 454}V${y + 670}H-40Z`} fill={scene.mid} opacity=".82" />
          <g fill="#2F6A86" opacity=".16">
            <path d={`M120 ${y + 236}L250 ${y + 400}L120 ${y + 470}Z`} />
            <path d={`M400 ${y + 208}L548 ${y + 420}L400 ${y + 470}Z`} />
            <path d={`M690 ${y + 270}L820 ${y + 440}L690 ${y + 470}Z`} />
            <path d={`M960 ${y + 286}L1160 ${y + 454}L960 ${y + 470}Z`} />
          </g>
          <path d="M92 262L120 236L148 262L132 268L120 254L106 270Z" fill="#FFFFFF" opacity=".9" transform={`translate(0 ${y})`} />
          <path d="M364 244L400 208L436 244L418 252L400 234L382 254Z" fill="#FFFFFF" opacity=".9" transform={`translate(0 ${y})`} />
          <path d="M926 330L960 286L994 330L976 338L960 314L944 338Z" fill="#FFFFFF" opacity=".84" transform={`translate(0 ${y})`} />
          <path d={`M-40 ${y + 500}C90 ${y + 470} 210 ${y + 500} 320 ${y + 486}C400 ${y + 476} 448 ${y + 504} 470 ${y + 526}C420 ${y + 560} 300 ${y + 568} 180 ${y + 558}C70 ${y + 550} -20 ${y + 566} -40 ${y + 540}Z`} fill={`url(#${id}-ice)`} stroke="#BFE3F2" strokeWidth="2" />
          <path d="M60 518C100 504 140 520 180 512C220 504 250 516 280 508" fill="none" stroke="#FFFFFF" strokeWidth="2" opacity=".55" />
          <g stroke="#8FC6DC" strokeWidth="1.5" opacity=".62" fill="none">
            <path d={`M130 536L160 528L150 546`} />
            <path d={`M250 534L290 526`} />
            <path d={`M200 552L220 544`} />
          </g>
          <path d={`M-40 ${y + 540}C180 ${y + 500} 380 ${y + 570} 600 ${y + 530}C820 ${y + 492} 1000 ${y + 566} 1160 ${y + 528}V${y + 670}H-40Z`} fill={scene.near} opacity=".25" />
          <path d={`M-40 ${y + 600}C160 ${y + 566} 360 ${y + 628} 580 ${y + 596}C800 ${y + 566} 1000 ${y + 622} 1160 ${y + 590}V${y + 670}H-40Z`} fill="#F6FCFF" opacity=".86" />
          <SnowPine x={108} y={y + 556} scale={1.05} color="#2F6F6A" />
          <SnowPine x={170} y={y + 612} scale={0.82} color="#2F6F6A" />
          <SnowPine x={1006} y={y + 560} scale={0.95} color="#2F6F6A" />
          <TopHouse x={292} y={y + 596} width={52} height={44} color="#DDEFF8" rotate={-3} />
          <TopHouse x={352} y={y + 612} width={44} height={38} color="#C9E4F0" rotate={4} />
          <SnowField y={y} seed={index} />
          <Cloud x={270} y={y + 96} scale={0.8} color="#FFFFFF" className="scene-cloud" />
          <Cloud x={748} y={y + 154} scale={0.6} color="#FFFFFF" className="scene-cloud scene-cloud-slow" />
          <Bird x={700} y={y + 140} color={scene.ink} className="scene-bird" />
        </g>
      )}

      {theme === 'coast' && (
        <g>
          <circle cx={948} cy={y + 112} r="78" fill={scene.light} opacity=".35" />
          <circle cx={948} cy={y + 112} r="38" fill="#FFF4C7" opacity=".9" />
          <path d={`M-40 ${y + 292}C180 ${y + 270} 340 ${y + 300} 560 ${y + 278}C760 ${y + 258} 960 ${y + 294} 1160 ${y + 270}V${y + 330}H-40Z`} fill={scene.far} opacity=".65" />
          <path
            d={`M-40 ${y + 308}C180 ${y + 284} 340 ${y + 316} 560 ${y + 292}C760 ${y + 270} 960 ${y + 306} 1160 ${y + 282}V${y + 452}C960 ${y + 476} 760 ${y + 440} 560 ${y + 462}C360 ${y + 484} 160 ${y + 442} -40 ${y + 468}Z`}
            fill={`url(#${id}-sea)`}
          />
          <path d={`M-40 ${y + 340}C200 ${y + 306} 360 ${y + 354} 580 ${y + 322}C780 ${y + 292} 980 ${y + 344} 1160 ${y + 308}`} fill="none" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" opacity=".55" className="scene-shimmer" />
          <path d={`M-40 ${y + 390}C220 ${y + 356} 380 ${y + 404} 600 ${y + 372}C800 ${y + 342} 980 ${y + 392} 1160 ${y + 356}`} fill="none" stroke="#EAF8FD" strokeWidth="8" strokeLinecap="round" opacity=".35" className="scene-shimmer scene-shimmer-slow" />
          <Boat x={162} y={y + 342} rotate={-8} className="scene-boat" />
          <Boat x={742} y={y + 326} rotate={10} className="scene-boat scene-boat-slow" />
          <path d={`M-40 ${y + 452}C180 ${y + 420} 330 ${y + 490} 540 ${y + 456}C760 ${y + 418} 950 ${y + 488} 1160 ${y + 448}V${y + 670}H-40Z`} fill="#F7E8C8" opacity=".86" />
          <path d={`M-40 ${y + 512}C180 ${y + 474} 380 ${y + 548} 600 ${y + 510}C820 ${y + 474} 1000 ${y + 548} 1160 ${y + 512}V${y + 670}H-40Z`} fill="#A8D8C0" opacity=".35" />
          <path d={`M-40 ${y + 590}C200 ${y + 556} 420 ${y + 620} 640 ${y + 584}C840 ${y + 552} 1000 ${y + 616} 1160 ${y + 580}V${y + 670}H-40Z`} fill="#7FBFAE" opacity=".18" />

          <Building x={230} y={y + 410} width={82} height={150} color="#F7F2E7" roofColor="#C96A4A" windowColor="#2A6F97" />
          <Building x={360} y={y + 448} width={58} height={112} color="#F7F2E7" roofColor="#2A9D8F" windowColor="#7CC8E8" />
          <Building x={800} y={y + 426} width={70} height={134} color="#F7F2E7" roofColor="#D97757" windowColor="#2A6F97" />
          <TopHouse x={120} y={y + 610} width={50} height={42} color="#C96A4A" wall="#F9F4E8" door="#2A6F97" windowColor="#7CC8E8" rotate={-3} />
          <TopHouse x={182} y={y + 620} width={46} height={38} color="#2A9D8F" wall="#F9F4E8" door="#2A6F97" windowColor="#7CC8E8" rotate={4} />
          <TopHouse x={930} y={y + 606} width={48} height={40} color="#C96A4A" wall="#F9F4E8" door="#2A6F97" windowColor="#7CC8E8" rotate={3} />
          <Lighthouse x={1025} y={y + 570} scale={0.88} />
          <CoastPalm x={62} y={y + 610} scale={0.9} />
          <CoastPalm x={1070} y={y + 620} scale={0.74} color="#4F8F66" />
          <CoastPalm x={700} y={y + 620} scale={0.74} />
          <g stroke="#B88A5E" strokeWidth="2" strokeLinecap="round" opacity=".5">
            <path d={`M620 ${y + 566}H760`} />
            <path d={`M640 ${y + 566}V${y + 590}`} />
            <path d={`M680 ${y + 566}V${y + 590}`} />
            <path d={`M720 ${y + 566}V${y + 590}`} />
            <path d={`M756 ${y + 566}V${y + 590}`} />
          </g>
          <Cloud x={300} y={y + 82} scale={0.82} color="#FFFFFF" className="scene-cloud" />
          <Cloud x={760} y={y + 128} scale={0.6} color="#FFFFFF" className="scene-cloud scene-cloud-slow" />
          <Bird x={620} y={y + 150} color={scene.ink} />
          <Bird x={668} y={y + 178} color={scene.ink} className="scene-bird" />
        </g>
      )}

      {theme === 'sakura' && (
        <g>
          <circle cx={930} cy={y + 110} r="78" fill={scene.light} opacity=".3" />
          <circle cx={930} cy={y + 110} r="38" fill="#FFF6DE" opacity=".8" />
          <path d={`M-40 ${y + 352}C160 ${y + 286} 340 ${y + 340} 540 ${y + 300}C740 ${y + 262} 940 ${y + 330} 1160 ${y + 286}V${y + 670}H-40Z`} fill={scene.far} opacity=".62" />
          <path d={`M-40 ${y + 448}C180 ${y + 382} 390 ${y + 440} 610 ${y + 398}C810 ${y + 360} 1000 ${y + 428} 1160 ${y + 386}V${y + 670}H-40Z`} fill={scene.mid} opacity=".35" />
          <path d={`M-40 ${y + 548}C180 ${y + 500} 380 ${y + 566} 600 ${y + 526}C820 ${y + 488} 1000 ${y + 558} 1160 ${y + 518}V${y + 670}H-40Z`} fill="#F3DFE7" opacity=".72" />
          <path
            d={`M-40 ${y + 522}C50 ${y + 496} 120 ${y + 514} 190 ${y + 504}C240 ${y + 498} 276 ${y + 512} 300 ${y + 532}C282 ${y + 558} 240 ${y + 572} 180 ${y + 568}C100 ${y + 562} 10 ${y + 578} -40 ${y + 556}Z`}
            fill={`url(#${id}-pond)`}
            stroke="#C9A9B3"
            strokeWidth="1.5"
          />
          <g fill="none" stroke="#FFFFFF" strokeWidth="2" opacity=".5">
            <path d={`M10 ${y + 548}C80 ${y + 532} 150 ${y + 550} 220 ${y + 536}`} />
            <path d={`M30 ${y + 562}C100 ${y + 550} 170 ${y + 566} 250 ${y + 552}`} />
          </g>
          <SakuraTree x={118} y={y + 450} scale={1.05} tone="#F4B8C8" />
          <SakuraTree x={310} y={y + 620} scale={0.9} tone="#F0A6BD" />
          <SakuraTree x={996} y={y + 486} scale={1} tone="#F4B8C8" />
          <SakuraTree x={1040} y={y + 610} scale={0.8} tone="#F9D6E1" />
          <Torii x={250} y={y + 622} scale={0.9} />
          <TopHouse x={364} y={y + 620} width={48} height={40} color="#355C5B" wall="#F4E3D7" door="#B24A3F" windowColor="#F2C879" rotate={-3} />
          <TopHouse x={405} y={y + 630} width={42} height={35} color="#B24A3F" wall="#F4E3D7" door="#B24A3F" windowColor="#F2C879" rotate={3} />
          <Pagoda x={858} y={y + 620} scale={0.82} />
          <StoneLantern x={716} y={y + 620} scale={0.9} />
          <FallingPetals y={y} seed={index} />
          <Cloud x={310} y={y + 90} scale={0.8} color="#FFF6FA" className="scene-cloud" />
          <Cloud x={760} y={y + 144} scale={0.58} color="#FFF6FA" className="scene-cloud scene-cloud-slow" />
          <Bird x={620} y={y + 166} color={scene.ink} className="scene-bird" />
        </g>
      )}

      <rect x="0" y={y} width="1120" height="16" fill={`url(#${id}-edge)`} />
    </g>
  )
}

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
  const markerX = node.x + node.side * 78
  const roadEdgeX = node.x + node.side * 35
  const markerEdgeX = markerX - node.side * 25
  const fill = isDone ? node.stage.accent : isCurrent ? '#F2B544' : '#94A3B2'
  const numberInk = readableInk(fill)
  const lineStroke = isDone ? node.stage.accent : isCurrent ? '#D99A2D' : '#8092A3'

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
        stroke={lineStroke}
        strokeWidth="4"
        strokeLinecap="round"
      />
      <circle cx={markerX} r="38" fill="transparent" />
      {isCurrent && <circle className="roadmap-marker-pulse" cx={markerX} r="35" stroke={fill} />}
      <circle className="roadmap-marker-halo" cx={markerX} r="34" />
      <circle cx={markerX} r="25" fill={fill} />
      <g transform={`translate(${markerX} 0)`} aria-hidden="true">
        <MarkerIcon name={MARKER_ICONS[node.lesson.topic] ?? 'star'} color={numberInk} />
      </g>
      <text
        x={markerX}
        y="43"
        textAnchor="middle"
        fill={SCENES[node.stage.theme].ink}
        fontSize="10"
        fontWeight="700"
        opacity=".72"
      >
        {lang === 'en' ? 'Lesson' : 'Bài'} {node.lessonIndex + 1}
      </text>
    </g>
  )
}

function CarArt({ glowId }: { glowId: string }) {
  return (
    <g className="roadmap-car-body" aria-hidden="true">
      <g className="roadmap-car-trail">
        <path d="M-13 31Q0 40 13 31" fill="none" stroke="#F2B544" strokeWidth="3.5" strokeLinecap="round" opacity=".5" />
        <path d="M-19 40Q0 52 19 40" fill="none" stroke="#F2B544" strokeWidth="2.5" strokeLinecap="round" opacity=".3" />
      </g>
      <ellipse rx="37" ry="46" fill="#F2B544" opacity=".24" filter={`url(#${glowId})`} />
      <ellipse cx="0" cy="5" rx="20" ry="34" fill="#D39A2A" opacity=".22" />
      <rect x="-22" y="-34" width="44" height="68" rx="16" fill="#F2B544" stroke="#A96E13" strokeWidth="3" />
      <rect x="-17" y="-18" width="34" height="37" rx="10" fill="#FFD46A" />
      <path d="M-14-15H14L11-3H-11Z" fill="#5D8497" />
      <path d="M-11 7H11L14 17H-14Z" fill="#83A8B8" />
      <path d="M0-15V17" stroke="#FFFFFF" strokeWidth="2" opacity=".65" />
      <rect x="-25" y="-21" width="6" height="16" rx="3" fill="#42586B" />
      <rect x="19" y="-21" width="6" height="16" rx="3" fill="#42586B" />
      <rect x="-25" y="8" width="6" height="16" rx="3" fill="#42586B" />
      <rect x="19" y="8" width="6" height="16" rx="3" fill="#42586B" />
      <rect x="-12" y="-32" width="8" height="4" rx="2" fill="#FFF4C7" />
      <rect x="4" y="-32" width="8" height="4" rx="2" fill="#FFF4C7" />
    </g>
  )
}

function fallbackMarkerLabel(lesson: RoadmapLesson, lang: RoadmapLang): string {
  const stageNumber = lesson.stageIndex + 1
  const lessonNumber = lesson.lessonIndex + 1
  if (lang === 'en') {
    return `Stage ${stageNumber}, lesson ${lessonNumber}: ${lesson.title}${lesson.status === 'locked' ? ', locked' : ''}`
  }
  return `Chặng ${stageNumber}, bài ${lessonNumber}: ${lesson.title}${lesson.status === 'locked' ? ', đang khóa' : ''}`
}

function normalizeAngle(value: number): number {
  let angle = value
  while (angle > 180) angle -= 360
  while (angle < -180) angle += 360
  return angle
}

export function RouteMapCard({
  stages,
  selectedLessonId,
  onSelect,
  lang = 'vi',
  markerLabel,
  className,
  fullBleed = false,
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

  const nodes = useMemo(() => buildMapNodes(stages), [stages])
  const height = roadmapHeight(stages.length)
  const roadPath = useMemo(() => buildRoadPath(nodes, stages.length), [nodes, stages.length])

  // Fog of war. Two stacked banks with one shared soft leading edge:
  //   light  — everything from the first stage that is not fully completed;
  //   dense  — everything from the first stage whose lessons are all locked.
  // The current lesson always stays in the light layer, so it remains readable.
  const fog = useMemo(() => {
    const incompleteIndex = stages.findIndex((stage) => (
      stage.lessons.some((lesson) => lesson.status !== 'done')
    ))
    if (incompleteIndex < 0) return null
    const untouchedIndex = stages.findIndex((stage) => (
      stage.lessons.every((lesson) => lesson.status === 'locked')
    ))
    const lightStart = Math.max(0, stageTop(incompleteIndex) - 140)
    const denseStart = untouchedIndex >= 0
      ? Math.max(0, stageTop(untouchedIndex) - 140)
      : null
    const wispStart = untouchedIndex >= 0 ? untouchedIndex : incompleteIndex
    const wisps = stages.slice(wispStart).flatMap((stage, offset) => [
      { key: `${stage.id}-a`, cx: 250, cy: stageTop(wispStart + offset) + 210, rx: 330, ry: 62, delay: `${offset * 2.4}s` },
      { key: `${stage.id}-b`, cx: 880, cy: stageTop(wispStart + offset) + 490, rx: 300, ry: 54, delay: `${offset * 2.4 + 1.2}s` },
    ])
    const sceneState = stages.map((_stage, index) => {
      if (untouchedIndex >= 0 && index >= untouchedIndex) return 'is-foggy'
      if (index >= incompleteIndex) return 'is-misty'
      return ''
    })
    return { lightStart, denseStart, wisps, sceneState }
  }, [stages])

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
        title: 'Engorace six-stage English learning roadmap',
        description: 'Six stages with six lessons each and ten questions per lesson. The yellow car marks the current lesson.',
      }
    : {
        title: 'Bản đồ lộ trình học tiếng Anh Engorace',
        description: 'Sáu chặng, mỗi chặng sáu bài, mỗi bài mười câu hỏi. Xe vàng đánh dấu bài đang học.',
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
          <filter id={carGlowId} x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="11" />
          </filter>
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
            return (
            <g key={stage.id}>
              <rect x="0" y={stageTop(stageIndex)} width={ROADMAP_LAYOUT.width} height={ROADMAP_LAYOUT.stageHeight} fill={SCENES[stage.theme].bg} />
              <g className={`roadmap-stage-scene${sceneState ? ` ${sceneState}` : ''}`}>
                <StageScene theme={stage.theme} y={stageTop(stageIndex)} index={stageIndex} uid={uid} />
              </g>
              {stageIndex > 0 && (
                <g>
                  <path d={`M0 ${stageTop(stageIndex) + 6}C180 ${stageTop(stageIndex) - 4} 360 ${stageTop(stageIndex) + 16} 560 ${stageTop(stageIndex) + 4}C760 ${stageTop(stageIndex) - 8} 940 ${stageTop(stageIndex) + 14} 1120 ${stageTop(stageIndex) + 2}`} transform="translate(0 7)" fill="none" stroke="#0F172A" strokeWidth="6" opacity=".08" />
                  <path d={`M0 ${stageTop(stageIndex) + 6}C180 ${stageTop(stageIndex) - 4} 360 ${stageTop(stageIndex) + 16} 560 ${stageTop(stageIndex) + 4}C760 ${stageTop(stageIndex) - 8} 940 ${stageTop(stageIndex) + 14} 1120 ${stageTop(stageIndex) + 2}`} transform="translate(0 -1)" fill="none" stroke="#FFFFFF" strokeWidth="1.5" opacity=".25" />
                  <path d={`M0 ${stageTop(stageIndex) + 6}C180 ${stageTop(stageIndex) - 4} 360 ${stageTop(stageIndex) + 16} 560 ${stageTop(stageIndex) + 4}C760 ${stageTop(stageIndex) - 8} 940 ${stageTop(stageIndex) + 14} 1120 ${stageTop(stageIndex) + 2}`} fill="none" stroke={SCENES[stage.theme].soft} strokeWidth="3" opacity=".45" />
                </g>
              )}
            </g>
            )
          })}

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
              <CarArt glowId={carGlowId} />
            </g>
          )}
        </g>
        {!fullBleed && (
          <rect x="1" y="1" width={ROADMAP_LAYOUT.width - 2} height={height - 2} rx="19" fill="none" stroke="var(--line-strong)" strokeWidth="2" />
        )}
      </svg>
    </div>
  )
}
