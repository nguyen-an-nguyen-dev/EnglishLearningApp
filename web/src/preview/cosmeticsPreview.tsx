import { useEffect, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import '@fontsource/be-vietnam-pro/400.css'
import '@fontsource/be-vietnam-pro/600.css'
import '@fontsource/be-vietnam-pro/800.css'
import './cosmeticsPreview.css'
import { CARS, FRAMES } from '../components/cosmetics/garage/catalog'
import type { CarEntry, FrameEntry } from '../components/cosmetics/garage/catalog'
import { RARITY } from '../components/cosmetics/garage/designTokens'

const readyCars = CARS.filter((entry) => entry.status === 'ready' && entry.Art)
const readyFrames = FRAMES.filter((entry) => entry.status === 'ready' && entry.Art)

function Toggle({ on, onClick, children }: { on: boolean; onClick: () => void; children: string }) {
  return (
    <button type="button" className={`toggle${on ? ' is-on' : ''}`} aria-pressed={on} onClick={onClick}>
      {children}
    </button>
  )
}

function CarAnchors({ wheels = [], anchors = [], showGround, showAnchors }: {
  wheels?: readonly { cx: number; r: number }[]
  anchors?: readonly { x: number; y: number; label: string }[]
  showGround: boolean
  showAnchors: boolean
}) {
  if (!showGround && !showAnchors) return null
  return (
    <svg className="art-overlay" viewBox="0 0 240 130" aria-hidden="true">
      {showGround && (
        <line x1={0} y1={108} x2={240} y2={108} stroke="#e13b32" strokeWidth={1} strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />
      )}
      {showAnchors && (
        <g>
          <rect x={20} y={28} width={200} height={80} fill="none" stroke="#0b6bff" strokeWidth={1} strokeDasharray="3 3" vectorEffect="non-scaling-stroke" opacity={0.72} />
          <line x1={120} y1={16} x2={120} y2={124} stroke="#0b6bff" strokeWidth={1} strokeDasharray="2 3" vectorEffect="non-scaling-stroke" opacity={0.55} />
          {wheels.map((wheel) => (
            <g key={`${wheel.cx}-${wheel.r}`}>
              <circle cx={wheel.cx} cy={108 - wheel.r} r={3} fill="#0b6bff" stroke="#ffffff" strokeWidth={1} vectorEffect="non-scaling-stroke" />
              <circle cx={wheel.cx} cy={108} r={2.2} fill="#e13b32" stroke="#ffffff" strokeWidth={1} vectorEffect="non-scaling-stroke" />
            </g>
          ))}
          {anchors.map((point) => (
            <g key={`${point.label}-${point.x}-${point.y}`}>
              <rect x={point.x - 2.4} y={point.y - 2.4} width={4.8} height={4.8} fill="#ff9f2e" stroke="#ffffff" strokeWidth={1} vectorEffect="non-scaling-stroke" />
              <line x1={point.x - 5} y1={point.y} x2={point.x + 5} y2={point.y} stroke="#ff9f2e" strokeWidth={1} vectorEffect="non-scaling-stroke" opacity={0.7} />
            </g>
          ))}
        </g>
      )}
    </svg>
  )
}

function FrameAnchors({ ringOuter = 60, showGround, showAnchors }: {
  ringOuter?: number
  showGround: boolean
  showAnchors: boolean
}) {
  if (!showAnchors && !showGround) return null
  const spokes = [45, 135, 225, 315].map((angle) => {
    const rad = (angle * Math.PI) / 180
    return { angle, x: 100 + 68 * Math.cos(rad), y: 112 + 68 * Math.sin(rad) }
  })
  return (
    <svg className="art-overlay" viewBox="0 0 200 200" aria-hidden="true">
      {showAnchors && (
        <g>
          <rect x={8} y={8} width={184} height={184} fill="none" stroke="#0b6bff" strokeWidth={1} strokeDasharray="3 3" vectorEffect="non-scaling-stroke" opacity={0.55} />
          <circle cx={100} cy={112} r={46} fill="none" stroke="#e13b32" strokeWidth={1} strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />
          <circle cx={100} cy={112} r={ringOuter} fill="none" stroke="#0b6bff" strokeWidth={1} strokeDasharray="2 3" vectorEffect="non-scaling-stroke" opacity={0.75} />
          <rect x={70} y={14} width={60} height={52} fill="none" stroke="#0b6bff" strokeWidth={1} strokeDasharray="2 2" vectorEffect="non-scaling-stroke" opacity={0.55} />
          <line x1={100} y1={8} x2={100} y2={192} stroke="#0b6bff" strokeWidth={1} strokeDasharray="2 3" vectorEffect="non-scaling-stroke" opacity={0.4} />
          <line x1={8} y1={112} x2={192} y2={112} stroke="#0b6bff" strokeWidth={1} strokeDasharray="2 3" vectorEffect="non-scaling-stroke" opacity={0.4} />
          {spokes.map((spot) => (
            <circle key={spot.angle} cx={spot.x} cy={spot.y} r={3} fill="#0b6bff" stroke="#ffffff" strokeWidth={1} vectorEffect="non-scaling-stroke" />
          ))}
        </g>
      )}
    </svg>
  )
}

function Stage({ width, height, card, cell, grid, label, children }: {
  width: number
  height: number
  card: string
  cell: number
  grid: boolean
  label: string
  children: ReactNode
}) {
  return (
    <figure className="tile">
      <div
        className={`stage${grid ? ' is-grid' : ''}`}
        style={{ width, height, backgroundColor: card, '--cell': `${cell}px` } as CSSProperties}
      >
        {children}
      </div>
      <figcaption>{label}</figcaption>
    </figure>
  )
}

function CarCard({ entry, grid, anchors, ground }: { entry: CarEntry; grid: boolean; anchors: boolean; ground: boolean }) {
  const Art = entry.Art
  if (!Art) return null
  return (
    <article className={`item-card is-${entry.rarity}`}>
      <header className="item-head">
        <span className={`rarity rarity-${entry.rarity}`}>{RARITY[entry.rarity].label}</span>
        <div>
          <h3>{entry.name}</h3>
          <p>{entry.description}</p>
        </div>
      </header>
      <div className="meta-row">
        <code>{entry.visualKey}</code>
        <span>id {entry.id}</span>
        <span>dài {entry.width}</span>
        <span>{entry.wheelLabel ?? `bánh R${entry.wheelR}`}</span>
      </div>
      <div className="tile-row">
        <Stage width={240} height={130} card={RARITY[entry.rarity].card} cell={10} grid={grid} label="240 px · full">
          <Art />
          <CarAnchors wheels={entry.wheels} anchors={entry.anchors} showGround={ground} showAnchors={anchors} />
        </Stage>
        <Stage width={120} height={65} card={RARITY[entry.rarity].card} cell={5} grid={grid} label="120 px · thẻ shop">
          <Art />
          <CarAnchors wheels={entry.wheels} anchors={entry.anchors} showGround={ground} showAnchors={anchors} />
        </Stage>
        <Stage width={48} height={26} card={RARITY[entry.rarity].card} cell={2} grid={grid} label="48 px · danh sách">
          <Art />
          <CarAnchors wheels={entry.wheels} anchors={entry.anchors} showGround={ground} showAnchors={anchors} />
        </Stage>
      </div>
    </article>
  )
}

function FrameCard({ entry, grid, anchors, ground }: { entry: FrameEntry; grid: boolean; anchors: boolean; ground: boolean }) {
  const Art = entry.Art
  const Small = entry.Small
  if (!Art || !Small) return null
  const outer = entry.ringOuter ?? 60
  return (
    <article className={`item-card is-${entry.rarity}`}>
      <header className="item-head">
        <span className={`rarity rarity-${entry.rarity}`}>{RARITY[entry.rarity].label}</span>
        <div>
          <h3>{entry.name}</h3>
          <p>{entry.description}</p>
          {entry.locked && <span className="lock-note">Khoá · lớp phủ ngoài, hình giữ nguyên</span>}
        </div>
      </header>
      <div className="meta-row">
        <code>{entry.visualKey}</code>
        <span>id {entry.id}</span>
        <span>vòng {outer}/46</span>
        {entry.code === 'frame_default' && <span>dày 8</span>}
      </div>
      <div className="tile-row">
        <Stage width={240} height={240} card={RARITY[entry.rarity].card} cell={12} grid={grid} label="240 px · full">
          <Art />
          <FrameAnchors ringOuter={outer} showGround={ground} showAnchors={anchors} />
        </Stage>
        <Stage width={120} height={120} card={RARITY[entry.rarity].card} cell={6} grid={grid} label="120 px · thẻ shop">
          <Art />
          <FrameAnchors ringOuter={outer} showGround={ground} showAnchors={anchors} />
        </Stage>
        <Stage width={48} height={48} card={RARITY[entry.rarity].card} cell={2.4} grid={grid} label="48 px · small">
          <Small />
          <FrameAnchors ringOuter={outer} showGround={ground} showAnchors={anchors} />
        </Stage>
      </div>
    </article>
  )
}

const PALETTE = [
  ['ink', '#14203a'],
  ['kính', '#bfe9ff'],
  ['đèn trước', '#fff3b0'],
  ['đèn sau', '#ff5a5f'],
  ['kim loại', '#c9d6ea'],
  ['vàng', '#ffd23f'],
  ['cam', '#ff9f2e'],
  ['xanh', '#19b6f0'],
  ['xanh lá', '#38c98a'],
  ['tím', '#a78bfa'],
]

export function CosmeticsPreview() {
  const [grid, setGrid] = useState(() => new URLSearchParams(window.location.search).get('grid') !== '0')
  const [anchors, setAnchors] = useState(() => new URLSearchParams(window.location.search).get('anchors') === '1')
  const [ground, setGround] = useState(() => new URLSearchParams(window.location.search).get('ground') !== '0')

  useEffect(() => {
    if (!window.location.hash) return
    document.querySelector(window.location.hash)?.scrollIntoView({ block: 'start' })
  }, [])

  return (
    <main className="page">
      <header className="page-head">
        <div className="wordmark">Engorace <span>Gara art</span></div>
        <h1>Xe & khung avatar</h1>
        <p>
          Bộ sưu tập <strong>B2</strong>: đủ 10 xe và 10 khung, dùng chung thư viện
          parts trong <code>components/cosmetics/garage/parts</code>.
        </p>
        <div className="status-strip">
          <span><b>{readyCars.length}</b>/10 xe đã vẽ</span>
          <span><b>{readyFrames.length}</b>/10 khung đã vẽ</span>
          <span>viewBox xe 240×130</span>
          <span>viewBox khung 200×200</span>
        </div>
      </header>

      <div className="toolbar">
        <div className="toolbar-group" role="group" aria-label="Lớp kiểm tra">
          <Toggle on={grid} onClick={() => setGrid((value) => !value)}>Lưới</Toggle>
          <Toggle on={anchors} onClick={() => setAnchors((value) => !value)}>Điểm neo</Toggle>
          <Toggle on={ground} onClick={() => setGround((value) => !value)}>Đường đất</Toggle>
        </div>
        <div className="rarity-key">
          {Object.entries(RARITY).map(([key, value]) => (
            <span key={key} className={`rarity rarity-${key}`}>{value.label}</span>
          ))}
        </div>
      </div>

      <section className="palette" aria-label="Design tokens">
        {PALETTE.map(([name, hex]) => (
          <span className="swatch" key={hex}>
            <i style={{ background: hex }} />
            <span>{name}</span>
            <code>{hex}</code>
          </span>
        ))}
      </section>

      <section className="collection" id="cars">
        <div className="section-head">
          <h2>Xe</h2>
          <p>Mặt đất y=108, bánh chạm đất, mũi hướng phải, tối đa 200×80.</p>
        </div>
        <div className="cards">
          {readyCars.map((entry) => (
            <CarCard key={entry.visualKey} entry={entry} grid={grid} anchors={anchors} ground={ground} />
          ))}
        </div>
      </section>

      <section className="collection" id="frames">
        <div className="section-head">
          <h2>Khung avatar</h2>
          <p>Avatar (100,112) r=46 · vòng 46→60 · đầu mascot 60×52 tại (100,40).</p>
        </div>
        <div className="cards">
          {readyFrames.map((entry) => (
            <FrameCard key={entry.visualKey} entry={entry} grid={grid} anchors={anchors} ground={ground} />
          ))}
        </div>
      </section>

      <footer className="page-foot">
        <h2>B2 gồm</h2>
        <ul>
          <li>10 xe: Cơ bản, 3 Hiếm, 4 Sử thi, 2 Huyền thoại — đúng tỉ lệ, cùng mặt đất.</li>
          <li>10 khung: đủ mascot, vòng 46→60 và 10 bản small 48 px.</li>
          <li>Thư viện parts: wheel, wheelArch, window, door, lamp, bumper, rack, spoiler, antenna, hoverpad, ring, bead, paw, laurel, hex cage.</li>
          <li>Đã ghép vào shop, garage bay, profile, rankings và arena; id/API không đổi.</li>
        </ul>
      </footer>
    </main>
  )
}
