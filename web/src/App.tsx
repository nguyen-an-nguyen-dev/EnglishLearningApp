import { useState } from 'react'
import {
  BookOpenText,
  CarProfile,
  Check,
  CheckCircle,
  Compass,
  FlagPennant,
  Flame,
  Headphones,
  Heart,
  House,
  Lightning,
  LockKey,
  MapTrifold,
  Microphone,
  PencilLine,
  Play,
  Sparkle,
  TreeEvergreen,
  Trophy,
} from '@phosphor-icons/react'

type LessonStatus = 'done' | 'current' | 'locked'

type Lesson = {
  id: number
  title: string
  subtitle: string
  skill: string
  status: LessonStatus
  left: string
  top: string
}

const LESSONS: Lesson[] = [
  { id: 1, title: 'Chào hỏi nhé', subtitle: 'Hello, how are you?', skill: 'Nghe & nói', status: 'done', left: '59%', top: '9.3%' },
  { id: 2, title: 'Tên mình là…', subtitle: 'My name is An', skill: 'Nghe & nói', status: 'done', left: '70%', top: '20.1%' },
  { id: 3, title: 'Bạn đến từ đâu?', subtitle: 'Where are you from?', skill: 'Đọc', status: 'done', left: '59%', top: '30.6%' },
  { id: 4, title: 'Gặp gỡ lần đầu', subtitle: 'Nice to meet you', skill: 'Nghe · nói · viết', status: 'current', left: '47.5%', top: '41.5%' },
  { id: 5, title: 'Giới thiệu bạn bè', subtitle: 'This is my friend', skill: 'Nói', status: 'locked', left: '59%', top: '52.4%' },
  { id: 6, title: 'Một ngày của mình', subtitle: 'A day in my life', skill: 'Nghe & đọc', status: 'locked', left: '71%', top: '63.1%' },
  { id: 7, title: 'Đi đâu cuối tuần?', subtitle: 'Where shall we go?', skill: 'Đọc', status: 'locked', left: '36%', top: '74.8%' },
  { id: 8, title: 'Bưu thiếp đầu tiên', subtitle: 'Write a postcard', skill: 'Viết', status: 'locked', left: '66%', top: '87.2%' },
]

const SKILLS = [
  { id: 'listen', title: 'Listen', label: 'Nghe', Icon: Headphones, left: '9%', top: '16%', tone: 'coral' },
  { id: 'speak', title: 'Speak', label: 'Nói', Icon: Microphone, left: '82%', top: '37%', tone: 'blue' },
  { id: 'read', title: 'Read', label: 'Đọc', Icon: BookOpenText, left: '9%', top: '61%', tone: 'yellow' },
  { id: 'write', title: 'Write', label: 'Viết', Icon: PencilLine, left: '82%', top: '79%', tone: 'lavender' },
]

const ROUTE = 'M 360 0 C 360 125 525 105 505 235 C 488 330 320 328 335 455 C 350 560 565 560 518 690 C 500 792 230 770 250 895 C 270 1005 470 965 478 1090 C 480 1140 420 1190 385 1220'

function Sidebar() {
  return (
    <aside className="sidebar">
      <a className="brand" href="#home" aria-label="EngLearn trang chủ">
        <span className="brand-mark"><Compass size={24} weight="fill" /></span>
        <span>eng<span className="brand-accent">learn</span></span>
      </a>

      <div className="sidebar-label">KHÔNG GIAN HỌC</div>
      <nav className="sidebar-nav" aria-label="Điều hướng chính">
        <a className="nav-item nav-item-active" href="#journey"><MapTrifold size={20} weight="fill" /> <span>Hành trình</span><span className="nav-dot" /></a>
        <a className="nav-item" href="#skills"><BookOpenText size={20} /> <span>Luyện kỹ năng</span></a>
        <a className="nav-item" href="#rank"><Trophy size={20} /> <span>Bảng xếp hạng</span></a>
      </nav>

      <div className="sidebar-spacer" />
      <div className="streak-card">
        <span className="streak-icon"><Flame size={19} weight="fill" /></span>
        <div><strong>4 ngày liên tiếp</strong><small>Giữ nhịp học mỗi ngày nhé!</small></div>
        <Sparkle className="streak-spark" size={16} weight="fill" />
      </div>
      <button className="profile-row" type="button">
        <span className="avatar">A</span>
        <span className="profile-copy"><strong>An Nguyễn</strong><small>Người khám phá</small></span>
        <span className="profile-more" aria-hidden="true">•••</span>
      </button>
    </aside>
  )
}

function TopBar() {
  return (
    <header className="topbar">
      <div className="mobile-brand"><span className="brand-mark"><Compass size={22} weight="fill" /></span><strong>eng<span className="brand-accent">learn</span></strong></div>
      <div className="welcome-copy"><span>Mỗi ngày một bước tiến</span><strong>Chào buổi sáng, An <span aria-hidden="true">✦</span></strong></div>
      <div className="topbar-stats">
        <div className="stat-pill streak-pill"><Flame size={18} weight="fill" /><strong>4</strong><span>ngày</span></div>
        <div className="stat-pill heart-pill"><Heart size={18} weight="fill" /><strong>5</strong></div>
        <div className="stat-pill xp-pill"><Lightning size={18} weight="fill" /><strong>240 XP</strong></div>
        <span className="top-avatar">A</span>
      </div>
    </header>
  )
}

function RoadScene() {
  return (
    <svg className="road-art" viewBox="0 0 720 1240" preserveAspectRatio="none" aria-hidden="true">
      <path d="M 0 730 C 140 690 185 785 318 733 S 530 718 720 765" className="river" />
      <path d="M 0 755 C 145 715 190 810 320 758 S 530 743 720 790" className="river-ripple" />
      <path d={ROUTE} className="road-shadow" />
      <path d={ROUTE} className="road-edge" />
      <path d={ROUTE} className="road-bed" />
      <path d="M 335 455 C 350 560 565 560 538 660" className="bridge-deck" />
      <path d="M 335 455 C 350 560 565 560 538 660" className="bridge-line" />
      <path d={ROUTE} className="road-center" />
      <path d="M 35 950 C 115 935 160 978 226 984" className="trail" />
    </svg>
  )
}

function RoadMap({ selectedId, onSelect, driving }: { selectedId: number; onSelect: (lesson: Lesson) => void; driving: boolean }) {
  return (
    <section className="map-card" id="journey" aria-labelledby="map-title">
      <div className="map-heading">
        <div>
          <span className="stage-chip"><span className="stage-chip-dot" /> STAGE 01 <span className="stage-chip-divider">/</span> CHẶNG ĐANG HỌC</span>
          <h2 id="map-title">Thị trấn lời chào</h2>
          <p>8 điểm dừng để bắt đầu nói tiếng Anh tự tin.</p>
        </div>
        <div className="stage-completion"><span><strong>3</strong> / 8 bài</span><div className="stage-track"><i /></div></div>
      </div>

      <div className="map-world">
        <div className="biome biome-hills" aria-hidden="true" />
        <div className="biome biome-meadow" aria-hidden="true" />
        <div className="biome biome-river" aria-hidden="true" />
        <div className="biome biome-grove" aria-hidden="true" />
        <span className="map-sun" aria-hidden="true" />
        <span className="landmark landmark-hill"><TreeEvergreen size={31} weight="fill" /><small>Đồi từ vựng</small></span>
        <span className="landmark landmark-river"><span className="landmark-bridge" /><small>Cầu phát âm</small></span>
        <span className="landmark landmark-grove"><TreeEvergreen size={30} weight="fill" /><small>Rừng câu chuyện</small></span>
        <RoadScene />

        <div className="route-start"><span><FlagPennant size={18} weight="fill" /></span><small>Xuất phát</small></div>

        {SKILLS.map(({ id, title, label, Icon, left, top, tone }) => (
          <div className={`skill-sign skill-sign-${tone}`} key={id} style={{ left, top }} title={`${title} • ${label}`}>
            <span className="sign-board"><Icon size={20} weight="fill" /><span className="sign-english">{title}</span><span className="sign-vietnamese">{label}</span></span>
            <span className="sign-post" />
          </div>
        ))}

        {LESSONS.map((lesson) => {
          const isSelected = selectedId === lesson.id
          const isLocked = lesson.status === 'locked'
          return (
            <div key={lesson.id} className={`lesson-stop lesson-stop-${lesson.status}${isSelected ? ' lesson-stop-selected' : ''}`} style={{ left: lesson.left, top: lesson.top }}>
              <button
                className="lesson-marker"
                type="button"
                onClick={() => !isLocked && onSelect(lesson)}
                disabled={isLocked}
                aria-label={`${isLocked ? 'Bài đang khóa' : 'Chọn bài'} ${lesson.id}: ${lesson.title}`}
                aria-current={lesson.status === 'current' ? 'step' : undefined}
                title={isLocked ? 'Hoàn thành bài trước để mở khóa' : lesson.title}
              >
                {lesson.status === 'done' && <Check size={21} weight="bold" />}
                {lesson.status === 'current' && <span className={`vehicle${driving ? ' vehicle-driving' : ''}`}><span className="vehicle-glow" /><span className="vehicle-body"><CarProfile size={22} weight="fill" /></span></span>}
                {lesson.status === 'locked' && <LockKey size={17} weight="fill" />}
              </button>
              <span className="stop-number">{String(lesson.id).padStart(2, '0')}</span>
              {isSelected && <span className="current-tag">BẠN ĐANG Ở ĐÂY</span>}
            </div>
          )
        })}

        <div className="route-finish"><span><FlagPennant size={16} weight="fill" /></span><small>Đích đến</small></div>
        <div className="map-caption"><span className="caption-dot" /> Đường học của An <span className="caption-divider">·</span> 3 điểm đã qua</div>
      </div>
    </section>
  )
}

function LessonPanel({ lesson, onContinue, driving }: { lesson: Lesson; onContinue: () => void; driving: boolean }) {
  const activeLesson = lesson.status === 'current'
  const completed = lesson.status === 'done'
  return (
    <aside className="lesson-panel" id="skills">
      <div className="panel-label"><span className="panel-label-icon"><Sparkle size={15} weight="fill" /></span> ĐIỂM DỪNG TIẾP THEO</div>
      <div className="lesson-illustration">
        <span className="illustration-sun" />
        <span className="illustration-cloud illustration-cloud-one" />
        <span className="illustration-cloud illustration-cloud-two" />
        <span className="illustration-road" />
        <span className="illustration-sign sign-one"><Headphones size={16} weight="fill" /></span>
        <span className="illustration-sign sign-two"><BookOpenText size={15} weight="fill" /></span>
        <span className="illustration-car"><CarProfile size={25} weight="fill" /></span>
        <span className="illustration-flower flower-one" /><span className="illustration-flower flower-two" />
        <span className="illustration-label">SẮP TỚI RỒI!</span>
      </div>

      <span className="lesson-kicker">BÀI {String(lesson.id).padStart(2, '0')} <span>•</span> {lesson.skill.toUpperCase()}</span>
      <h3>{lesson.title}</h3>
      <p className="lesson-subtitle">{lesson.subtitle}</p>
      <div className="lesson-detail-row"><span className="detail-icon"><BookOpenText size={17} weight="fill" /></span><span>6 hoạt động nhỏ</span><span className="detail-dot">·</span><span>Khoảng 8 phút</span></div>

      <div className="lesson-progress-label"><span>Tiến độ chặng</span><strong>3 / 8</strong></div>
      <div className="lesson-progress-track"><span /></div>
      <div className="panel-checklist">
        <span className="checklist-item checklist-done"><CheckCircle size={18} weight="fill" /> Từ vựng chào hỏi</span>
        <span className="checklist-item checklist-done"><CheckCircle size={18} weight="fill" /> Làm quen câu đơn</span>
        <span className={`checklist-item${activeLesson ? ' checklist-current' : ''}`}><span className="checklist-ring" /> Gặp gỡ lần đầu</span>
      </div>

      <button className={`continue-button${driving ? ' continue-button-active' : ''}`} type="button" onClick={onContinue}>
        <span>{driving ? 'Đang trên đường!' : completed ? 'Ôn lại bài này' : 'Tiếp tục hành trình'}</span>
        <span className="button-play"><Play size={15} weight="fill" /></span>
      </button>
      <div className="panel-footnote"><LockKey size={13} weight="fill" /> Hoàn thành bài này để mở chặng tiếp</div>
    </aside>
  )
}

function App() {
  const [selectedLesson, setSelectedLesson] = useState(LESSONS[3])
  const [driving, setDriving] = useState(false)

  function handleContinue() {
    setDriving(true)
    window.setTimeout(() => setDriving(false), 2100)
  }

  return (
    <div className="app-shell" id="home">
      <Sidebar />
      <div className="app-main">
        <TopBar />
        <main className="learning-page">
          <div className="page-heading">
            <div><span className="page-eyebrow">HÀNH TRÌNH CỦA BẠN</span><h1>Mỗi ngày, đi thêm một chút.</h1><p>Chọn một điểm dừng trên đường và bắt đầu học nhé.</p></div>
            <div className="map-legend"><span className="legend-current"><i /> Bạn đang ở đây</span><span><i /> Bài đã hoàn thành</span></div>
          </div>
          <div className="learning-layout">
            <RoadMap selectedId={selectedLesson.id} onSelect={setSelectedLesson} driving={driving} />
            <LessonPanel lesson={selectedLesson} onContinue={handleContinue} driving={driving} />
          </div>
          <footer className="page-footer" id="rank"><span>Học một chút, xa thêm một đoạn.</span><span><Heart size={14} weight="fill" /> Chúc bạn học vui!</span></footer>
        </main>
      </div>
      <nav className="mobile-nav" aria-label="Điều hướng trên điện thoại">
        <a className="mobile-nav-active" href="#journey"><MapTrifold size={21} weight="fill" /><span>Hành trình</span></a>
        <a href="#skills"><BookOpenText size={21} /><span>Kỹ năng</span></a>
        <a href="#rank"><Trophy size={21} /><span>Xếp hạng</span></a>
        <a href="#home"><House size={21} /><span>Cá nhân</span></a>
      </nav>
    </div>
  )
}

export default App
