import { createRoot } from 'react-dom/client'
import {
  BookOpenText,
  CarProfile,
  DotsThree,
  Flame,
  Headphones,
  Heart,
  House,
  Lightning,
  MapTrifold,
  Microphone,
  PencilLine,
  Trophy,
} from '@phosphor-icons/react'
import './roadtrip-mobile-preview.css'

const stops = [
  { number: '04', title: 'Chào hỏi nhé', skill: 'NGHE', label: 'Listen', Icon: Headphones, kind: 'current', side: 'left' },
  { number: '05', title: 'Tên mình là…', skill: 'NÓI', label: 'Speak', Icon: Microphone, kind: 'next', side: 'right' },
  { number: '06', title: 'Bạn đến từ đâu?', skill: 'ĐỌC', label: 'Read', Icon: BookOpenText, kind: 'next', side: 'left' },
  { number: '07', title: 'Gặp gỡ lần đầu', skill: 'VIẾT', label: 'Write', Icon: PencilLine, kind: 'locked', side: 'right' },
]

function RoadIllustration() {
  return (
    <main className="road-scroll">
      <div className="road-map">
        <div className="map-glow map-glow-one" />
        <div className="map-glow map-glow-two" />
        <svg className="curvy-road" viewBox="0 0 400 600" preserveAspectRatio="none" aria-hidden="true">
          <path d="M 202 -28 C 202 50 305 48 299 127 C 294 210 96 188 97 280 C 98 367 303 344 304 425 C 305 510 112 486 109 580 C 108 610 155 625 202 640" className="road-shadow" />
          <path d="M 202 -28 C 202 50 305 48 299 127 C 294 210 96 188 97 280 C 98 367 303 344 304 425 C 305 510 112 486 109 580 C 108 610 155 625 202 640" className="road-outline" />
          <path d="M 202 -28 C 202 50 305 48 299 127 C 294 210 96 188 97 280 C 98 367 303 344 304 425 C 305 510 112 486 109 580 C 108 610 155 625 202 640" className="road-surface" />
          <path d="M 202 -28 C 202 50 305 48 299 127 C 294 210 96 188 97 280 C 98 367 303 344 304 425 C 305 510 112 486 109 580 C 108 610 155 625 202 640" className="road-centerline" />
        </svg>

        <div className="route-start"><span className="flagpole"><i /></span><span>ĐIỂM XUẤT PHÁT</span></div>

        {stops.map(({ number, title, skill, label, Icon, kind, side }, index) => {
          const positions = [
            { x: '73%', y: '14%' },
            { x: '40%', y: '36%' },
            { x: '68%', y: '58%' },
            { x: '44%', y: '80%' },
          ]
          const pos = positions[index]
          return (
            <div className={`stop-group stop-${kind} stop-${side}`} key={number} style={{ left: pos.x, top: pos.y }}>
              <span className="road-dot" aria-hidden="true">{kind === 'locked' ? <span /> : number}</span>
              <article className="skill-sign">
                <span className="sign-post" />
                <span className="sign-icon"><Icon size={23} weight="fill" /></span>
                <span className="sign-copy"><small>BÀI {number} <i>·</i> {skill}</small><strong>{title}</strong><em>{label}</em></span>
                {kind === 'current' && <span className="sign-current">ĐANG HỌC</span>}
                {kind === 'locked' && <span className="sign-lock">•••</span>}
              </article>
            </div>
          )
        })}

        <span className="car-on-road" aria-label="Xe đang trên đường"><CarProfile size={27} weight="fill" /></span>
        <div className="route-finish"><span className="finish-flag"><i /></span><span>CÒN NHIỀU ĐIỀU HAY</span></div>
        <p className="map-note"><span /> Chạm vào biển hiệu để chọn kỹ năng</p>
      </div>
    </main>
  )
}

function App() {
  return (
    <div className="preview-stage">
      <div className="mobile-screen">
        <header className="mobile-topbar">
          <a className="mobile-logo" href="#top" aria-label="EngLearn"><span><MapTrifold size={19} weight="fill" /></span><b>eng<span>learn</span></b></a>
          <div className="mobile-stats"><span className="mobile-streak"><Flame size={16} weight="fill" />4</span><span className="mobile-hearts"><Heart size={16} weight="fill" />5</span><span className="mobile-xp"><Lightning size={16} weight="fill" />240</span></div>
          <span className="mobile-avatar">A</span>
        </header>

        <section className="mobile-stage-card">
          <div><small>STAGE 1 <i>·</i> CHẶNG ĐANG HỌC</small><h1>Những lời chào đầu tiên</h1><div className="mobile-progress"><span /><span /><span /><i /><em>3/8</em></div></div>
          <button type="button" aria-label="Danh sách chặng"><DotsThree size={23} weight="bold" /></button>
        </section>

        <RoadIllustration />

        <nav className="mobile-tabs" aria-label="Điều hướng">
          <a href="#home"><House size={21} weight="fill" /><span>Trang chủ</span></a>
          <a className="tab-active" href="#path"><MapTrifold size={21} weight="fill" /><span>Lộ trình</span></a>
          <a href="#ranking"><Trophy size={21} weight="fill" /><span>Ranking</span></a>
          <a href="#practice"><BookOpenText size={21} weight="fill" /><span>Luyện tập</span></a>
          <a href="#more"><DotsThree size={22} weight="bold" /><span>Thêm</span></a>
        </nav>
      </div>
      <p className="preview-caption">BẢN PHÁC THẢO MOBILE <span>·</span> ROADMAP + SKILL SIGNS</p>
    </div>
  )
}

createRoot(document.getElementById('road-preview-root')!).render(<App />)
