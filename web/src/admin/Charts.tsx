import { useEffect, useRef, useState } from 'react'
import { palette } from './palette'

type Point = { label: string; value: number }

function fmtVi(n: number): string {
  return n.toLocaleString('vi-VN')
}

function shortDate(label: string): string {
  const match = /^(\d{2})-(\d{2})$/.exec(label)
  return match ? `${match[2]}/${match[1]}` : label
}

/** SVG ring (donut) - stroke based, accessible. */
export function Donut({
  percent,
  size = 100,
  color = palette.primary,
  label,
  sub,
}: {
  percent: number
  size?: number
  color?: string
  label: string
  sub: string
}) {
  const p = Math.max(0, Math.min(100, percent))
  const r = 46
  const c = 2 * Math.PI * r
  const off = c - (p / 100) * c
  return (
    <div className="admin-donut-wrap">
      <div className="admin-donut" style={{ width: size, height: size }} role="img" aria-label={`${label}: ${sub}`}>
        <svg viewBox="0 0 110 110" width={size} height={size} aria-hidden="true">
          <circle cx="55" cy="55" r={r} fill="none" stroke={palette.track} strokeWidth="9" />
          <circle
            cx="55"
            cy="55"
            r={r}
            fill="none"
            stroke={color}
            strokeWidth="9"
            strokeDasharray={c}
            strokeDashoffset={off}
            transform="rotate(-90 55 55)"
          />
        </svg>
        <div className="admin-donut-hole">
          <strong>{label}</strong>
          <span>{sub}</span>
        </div>
      </div>
    </div>
  )
}

/** Multi-segment donut - segments sum to 100. */
export function MultiDonut({
  segments,
  size = 136,
}: {
  segments: Array<{ label: string; value: number; color: string }>
  size?: number
}) {
  const total = Math.max(0, segments.reduce((a, s) => a + s.value, 0))
  const safeTotal = Math.max(1, total)
  const stops = segments.reduce<{ cursor: number; stops: string[] }>(
    ({ cursor, stops: currentStops }, segment) => {
      const start = (cursor / safeTotal) * 360
      const nextCursor = cursor + segment.value
      const end = (nextCursor / safeTotal) * 360
      return {
        cursor: nextCursor,
        stops: [...currentStops, `${segment.color} ${start}deg ${end}deg`],
      }
    },
    { cursor: 0, stops: [] },
  ).stops
  return (
    <div className="admin-multidonut-row">
      <div
        className="admin-donut"
        style={{
          width: size,
          height: size,
          background: stops.length > 0 ? `conic-gradient(${stops.join(', ')})` : palette.track,
        }}
        role="img"
        aria-label={segments.map((s) => `${s.label}: ${s.value}`).join(', ')}
      >
        <div className="admin-donut-hole">
          <strong>{fmtVi(total)}</strong>
          <span>người</span>
        </div>
      </div>
      <ul className="admin-legend-list">
        {segments.map((s) => (
          <li key={s.label}>
            <i style={{ background: s.color }} />
            <span>{s.label}</span>
            <strong>{fmtVi(s.value)}</strong>
            <span className="admin-legend-pct">{Math.round((s.value / safeTotal) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * SVG area + line chart. The width is measured so the drawing is never
 * stretched, which keeps dots round and labels aligned with the plot.
 */
export function AreaChart({
  data,
  color = palette.primary,
  height = 150,
  showDots = true,
}: {
  data: Point[]
  color?: string
  height?: number
  showDots?: boolean
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const [width, setWidth] = useState(640)

  useEffect(() => {
    const el = wrapRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver((entries) => {
      const next = entries[0]?.contentRect.width
      if (next && next > 0) setWidth(Math.round(next))
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  if (data.length === 0) {
    return <div className="admin-empty-state">Chưa có dữ liệu trong khoảng này.</div>
  }

  const padX = 8
  const padTop = 12
  const padBottom = 10
  const max = Math.max(1, ...data.map((d) => d.value))
  const innerW = Math.max(1, width - padX * 2)
  const innerH = Math.max(1, height - padTop - padBottom)
  const stepX = data.length <= 1 ? 0 : innerW / (data.length - 1)
  const points = data.map((d, i) => ({
    x: data.length <= 1 ? width / 2 : padX + i * stepX,
    y: padTop + (1 - d.value / max) * innerH,
    ...d,
  }))
  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  const area = `${line} L ${points[points.length - 1]?.x ?? padX} ${padTop + innerH} L ${padX} ${padTop + innerH} Z`

  const tickCount = Math.min(5, data.length)
  const tickIndexes = Array.from({ length: tickCount }, (_, i) =>
    tickCount === 1 ? 0 : Math.round((i * (data.length - 1)) / (tickCount - 1)),
  ).filter((value, index, all) => all.indexOf(value) === index)

  return (
    <div className="admin-area-wrap" ref={wrapRef}>
      <svg
        className="admin-area-chart"
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={data.map((d) => `${shortDate(d.label)}: ${d.value} người`).join(', ')}
      >
        {[0.25, 0.5, 0.75].map((ratio) => (
          <line
            key={ratio}
            x1={padX}
            x2={width - padX}
            y1={padTop + innerH * ratio}
            y2={padTop + innerH * ratio}
            stroke={palette.track}
            strokeDasharray="3 5"
          />
        ))}
        <line x1={padX} x2={width - padX} y1={padTop + innerH} y2={padTop + innerH} stroke={palette.line} />
        <path d={area} fill={color} fillOpacity="0.07" />
        <path
          d={line}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        {showDots &&
          points.map((p, index) => (
            <circle key={`${p.label}-${index}`} cx={p.x} cy={p.y} r="3" fill={palette.surface} stroke={color} strokeWidth="1.8">
              <title>{`${shortDate(p.label)}: ${fmtVi(p.value)} người`}</title>
            </circle>
          ))}
      </svg>
      <div className="admin-axis" aria-hidden="true">
        {tickIndexes.map((index) => (
          <span key={index}>{shortDate(data[index].label)}</span>
        ))}
      </div>
    </div>
  )
}

/** Horizontal bar row. */
export function HBar({
  label,
  display,
  percent,
  color = palette.primary,
}: {
  label: string
  display: string
  percent: number
  color?: string
}) {
  return (
    <div className="admin-hbar">
      <div className="admin-hbar-top">
        <span>{label}</span>
        <strong>{display}</strong>
      </div>
      <div className="admin-progress-track">
        <div
          className="admin-progress-fill"
          style={{ width: `${Math.max(0, Math.min(100, percent))}%`, background: color }}
        />
      </div>
    </div>
  )
}

/** Stacked 100% bar with a shared legend. */
export function StackedBar({ segments }: { segments: Array<{ label: string; value: number; color: string }> }) {
  const total = Math.max(1, segments.reduce((a, s) => a + s.value, 0))
  return (
    <div className="admin-stacked-wrap">
      <div
        className="admin-stacked"
        role="img"
        aria-label={segments.map((s) => `${s.label}: ${Math.round((s.value / total) * 100)}%`).join(', ')}
      >
        {segments.map((s) => (
          <span key={s.label} style={{ width: `${(s.value / total) * 100}%`, background: s.color }} title={`${s.label}: ${fmtVi(s.value)}`} />
        ))}
      </div>
      <ul className="admin-legend-list">
        {segments.map((s) => (
          <li key={s.label}>
            <i style={{ background: s.color }} />
            <span>{s.label}</span>
            <strong>{fmtVi(s.value)}</strong>
            <span className="admin-legend-pct">{Math.round((s.value / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Heatmap - one cell per day, intensity is relative to the busiest day. */
export function Heatmap({ data }: { data: Array<{ label: string; value: number }> }) {
  const max = Math.max(1, ...data.map((d) => d.value))
  return (
    <div className="admin-heatmap-wrap">
      <div className="admin-heatmap" role="img" aria-label={data.map((d) => `${shortDate(d.label)}: ${d.value} người`).join(', ')}>
        {data.map((d, index) => {
          const ratio = d.value / max
          const background =
            ratio <= 0 ? palette.surfaceSoft : `color-mix(in srgb, ${palette.primary} ${Math.round(16 + ratio * 84)}%, ${palette.surfaceSoft})`
          return (
            <div
              key={`${d.label}-${index}`}
              className={`admin-heat-cell${ratio >= 0.7 ? ' is-strong' : ''}`}
              style={{ background }}
              title={`${shortDate(d.label)}: ${fmtVi(d.value)} người`}
            >
              <span>{d.value}</span>
            </div>
          )
        })}
      </div>
      <div className="admin-heat-scale" aria-hidden="true">
        <span>Ít</span>
        <i style={{ background: palette.surfaceSoft }} />
        <i style={{ background: `color-mix(in srgb, ${palette.primary} 40%, ${palette.surfaceSoft})` }} />
        <i style={{ background: `color-mix(in srgb, ${palette.primary} 70%, ${palette.surfaceSoft})` }} />
        <i style={{ background: palette.primary }} />
        <span>Nhiều</span>
      </div>
    </div>
  )
}

/** Grouped vertical columns (2-3 series side by side). */
export function GroupedBars({
  labels,
  series,
  height = 170,
}: {
  labels: string[]
  series: Array<{ name: string; color: string; data: number[] }>
  height?: number
}) {
  const max = Math.max(1, ...series.flatMap((s) => s.data))
  return (
    <div>
      <div
        className="admin-grouped"
        style={{ height, gridTemplateColumns: `repeat(${Math.max(1, labels.length)}, minmax(0, 1fr))` }}
      >
        {labels.map((label, index) => (
          <div className="admin-group" key={`${label}-${index}`}>
            <div className="admin-group-bars">
              {series.map((s) => (
                <div className="admin-group-track" key={s.name} title={`${shortDate(label)} · ${s.name}: ${fmtVi(s.data[index] ?? 0)}`}>
                  <div
                    className="admin-group-fill"
                    style={{ height: `${Math.max(3, ((s.data[index] ?? 0) / max) * 100)}%`, background: s.color }}
                  />
                </div>
              ))}
            </div>
            <span className="admin-bar-label">{shortDate(label)}</span>
          </div>
        ))}
      </div>
      <div className="admin-legend">
        {series.map((s) => (
          <span key={s.name}>
            <i style={{ background: s.color }} /> {s.name}
          </span>
        ))}
      </div>
    </div>
  )
}
