import { useState } from 'react'
import {
  BookOpenText,
  Flame,
  Headphones,
  House,
  Lightning,
  Microphone,
  PencilLine,
  SignOut,
  Sparkle,
  Trophy,
  UserCircle,
  Medal,
  Play,
  ArrowRight,
  ShieldCheck,
  CheckCircle,
  Gear,
  MapPin,
  LockSimple,
  Compass,
} from '@phosphor-icons/react'
import { useAuth } from './context/AuthContext'
import { LandingPage } from './components/landing/LandingPage'
import type { AuthUser } from './types/auth'
import { MILESTONES } from './journey-data'

export type DashboardTab = 'study' | 'compete' | 'rankings' | 'profile'

interface SidebarProps {
  user: AuthUser | null
  activeTab: DashboardTab
  onSelectTab: (tab: DashboardTab) => void
  onLogout: () => void
  onViewLanding: () => void
}

function Sidebar({ user, activeTab, onSelectTab, onLogout, onViewLanding }: SidebarProps) {
  const initial = user?.name ? user.name.trim()[0].toUpperCase() : 'A'
  const displayName = user?.name || 'An Nguyễn'
  const streakDays = user?.streak ?? 4

  return (
    <aside className="sidebar">
      <button className="brand-button" type="button" onClick={onViewLanding} aria-label="Engorace trang chủ">
        <img src="/logo.png" alt="Engorace Logo" className="brand-logo-img" />
        <span className="brand-name"><span className="brand-eng">Eng</span><span className="brand-o">o</span><span className="brand-race">race</span></span>
      </button>

      <div className="sidebar-label">ĐIỀU HƯỚNG</div>
      <nav className="sidebar-nav" aria-label="Điều hướng chính">
        <button
          type="button"
          className={`nav-item ${activeTab === 'study' ? 'nav-item-active' : ''}`}
          onClick={() => onSelectTab('study')}
        >
          <BookOpenText size={20} weight={activeTab === 'study' ? 'fill' : 'regular'} />
          <span>Học Tập</span>
          {activeTab === 'study' && <span className="nav-dot" />}
        </button>

        <button
          type="button"
          className={`nav-item ${activeTab === 'compete' ? 'nav-item-active' : ''}`}
          onClick={() => onSelectTab('compete')}
        >
          <Lightning size={20} weight={activeTab === 'compete' ? 'fill' : 'regular'} />
          <span>Thi Đua</span>
          {activeTab === 'compete' && <span className="nav-dot" />}
        </button>

        <button
          type="button"
          className={`nav-item ${activeTab === 'rankings' ? 'nav-item-active' : ''}`}
          onClick={() => onSelectTab('rankings')}
        >
          <Trophy size={20} weight={activeTab === 'rankings' ? 'fill' : 'regular'} />
          <span>Bảng Xếp Hạng</span>
          {activeTab === 'rankings' && <span className="nav-dot" />}
        </button>

        <button
          type="button"
          className={`nav-item ${activeTab === 'profile' ? 'nav-item-active' : ''}`}
          onClick={() => onSelectTab('profile')}
        >
          <UserCircle size={20} weight={activeTab === 'profile' ? 'fill' : 'regular'} />
          <span>Profile</span>
          {activeTab === 'profile' && <span className="nav-dot" />}
        </button>

        <button className="nav-item nav-item-action" type="button" onClick={onViewLanding}>
          <Sparkle size={20} />
          <span>Trang giới thiệu</span>
        </button>
      </nav>

      <div className="sidebar-spacer" />

      <div className="streak-card">
        <span className="streak-icon"><Flame size={19} weight="fill" /></span>
        <div>
          <strong>{streakDays} ngày liên tiếp</strong>
          <small>Giữ nhịp học mỗi ngày nhé!</small>
        </div>
      </div>

      <div className="profile-container">
        <div className="profile-row" onClick={() => onSelectTab('profile')} role="button" tabIndex={0}>
          <span className="avatar">{initial}</span>
          <span className="profile-copy">
            <strong>{displayName}</strong>
            <small>{user?.email || 'Người khám phá'}</small>
          </span>
          <button
            type="button"
            className="logout-icon-btn"
            onClick={(e) => {
              e.stopPropagation()
              onLogout()
            }}
            title="Đăng xuất"
            aria-label="Đăng xuất tài khoản"
          >
            <SignOut size={18} />
          </button>
        </div>
      </div>
    </aside>
  )
}

interface TopBarProps {
  user: AuthUser | null
  onViewLanding: () => void
  onOpenProfile: () => void
}

function TopBar({ user, onViewLanding, onOpenProfile }: TopBarProps) {
  const initial = user?.name ? user.name.trim()[0].toUpperCase() : 'A'
  const firstName = user?.name ? user.name.trim().split(' ').slice(-1)[0] : 'An'
  const streak = user?.streak ?? 4
  const xp = user?.xp ?? 240

  return (
    <header className="topbar">
      <div className="mobile-brand" onClick={onViewLanding} role="button" tabIndex={0}>
        <img src="/logo.png" alt="Engorace Logo" className="brand-logo-img" />
        <strong className="brand-name"><span className="brand-eng">Eng</span><span className="brand-o">o</span><span className="brand-race">race</span></strong>
      </div>
      <div className="welcome-copy">
        <span>Mỗi ngày một bước tiến</span>
        <strong>Chào buổi sáng, {firstName} <span aria-hidden="true">✦</span></strong>
      </div>
      <div className="topbar-stats">
        <div className="stat-pill streak-pill">
          <Flame size={18} weight="fill" />
          <strong>{streak}</strong>
          <span>ngày</span>
        </div>
        <div className="stat-pill xp-pill">
          <Lightning size={18} weight="fill" />
          <strong>{xp} XP</strong>
        </div>
        <button
          type="button"
          className="top-avatar"
          onClick={onOpenProfile}
          title={user?.name || 'Hồ sơ cá nhân'}
          aria-label="Xem hồ sơ cá nhân"
        >
          {initial}
        </button>
      </div>
    </header>
  )
}

/* ------------------------------------------------------------- */
/* TAB 1: HỌC TẬP (Study View - Middle Section Ready for Redesign)*/
/* ------------------------------------------------------------- */
function StudyView({ user }: { user: AuthUser | null }) {
  const firstName = user?.name ? user.name.trim().split(' ').slice(-1)[0] : 'An'
  const [selectedStop, setSelectedStop] = useState(MILESTONES.find((stop) => stop.status === 'current') ?? MILESTONES[0])
  const completedStops = MILESTONES.filter((stop) => stop.status === 'done').length
  const skillIcons = { listen: Headphones, speak: Microphone, read: BookOpenText, write: PencilLine, mixed: Sparkle }
  const SelectedIcon = skillIcons[selectedStop.skillType]

  return (
    <div className="tab-view-container">
      <section className="study-intro">
        <div className="study-intro-copy">
          <span className="page-eyebrow">NHẬT KÝ HÀNH TRÌNH</span>
          <h1>Chào {firstName},<br /><span>mình đi tiếp nhé.</span></h1>
          <p>Mỗi chặng là một tình huống tiếng Anh bạn có thể dùng ngay ngoài đời.</p>
          <div className="study-quick-stats" aria-label="Tiến độ học tập">
            <span><strong>{completedStops}/{MILESTONES.length}</strong> chặng đã hoàn thành</span>
            <span className="study-stat-divider" />
            <span><strong>{user?.streak ?? 4} ngày</strong> giữ nhịp</span>
            <span className="study-stat-divider" />
            <span><strong>{user?.xp ?? 240} XP</strong> tích lũy</span>
          </div>
        </div>
        <div className="study-postcard" aria-hidden="true">
          <div className="postcard-sun" />
          <div className="postcard-hill postcard-hill-back" />
          <div className="postcard-hill postcard-hill-front" />
          <div className="postcard-route" />
          <img src="/car.png" alt="" />
          <span>ĐƯỜNG ĐANG MỞ</span>
        </div>
      </section>

      <section className="journey-section" aria-labelledby="journey-title">
        <div className="journey-section-heading">
          <div>
            <span className="section-kicker">BẢN ĐỒ CỦA BẠN</span>
            <h2 id="journey-title">Từng chặng, từng bước tiến.</h2>
          </div>
          <span className="journey-progress-note">{completedStops} chặng đã hoàn thành</span>
        </div>
        <div className="journey-layout">
          <div className="journey-map" aria-label="Bản đồ tám chặng học tiếng Anh">
            <div className="map-sky-label map-sky-label-top"><MapPin size={15} weight="fill" /> BẮT ĐẦU TỪ ĐÂY</div>
            <div className="map-landmark map-landmark-one">ĐỒI THÔNG</div>
            <div className="map-landmark map-landmark-two">BỜ SÔNG</div>
            <div className="journey-route" aria-hidden="true" />
            {MILESTONES.map((stop) => {
              const Icon = skillIcons[stop.skillType]
              const isSelected = selectedStop.id === stop.id
              const stopClass = 'journey-stop journey-stop-' + stop.status + (isSelected ? ' journey-stop-selected' : '')
              return (
                <button
                  type="button"
                  key={stop.id}
                  className={stopClass}
                  style={{ left: (stop.roadX / 720) * 100 + '%', top: (stop.roadY / 1240) * 100 + '%' }}
                  onClick={() => setSelectedStop(stop)}
                  aria-pressed={isSelected}
                  aria-label={'Chặng ' + stop.id + ': ' + stop.title + (stop.status === 'locked' ? ', đang khóa' : '')}
                >
                  <span className="stop-marker">
                    {stop.status === 'locked' ? <LockSimple size={17} weight="fill" /> : <Icon size={19} weight="fill" />}
                  </span>
                  <span className="stop-number">{String(stop.id).padStart(2, '0')}</span>
                </button>
              )
            })}
            <div className="map-sky-label map-sky-label-bottom">ĐÍCH ĐẾN TIẾP THEO <ArrowRight size={14} /></div>
            <div className="map-legend"><span><i className="legend-done" /> Đã đi qua</span><span><i className="legend-current" /> Chặng hiện tại</span><span><i className="legend-locked" /> Sắp mở</span></div>
          </div>

          <aside className="stop-detail" aria-live="polite">
            <div className="stop-detail-art">
              <span className="stop-detail-index">CHẶNG {String(selectedStop.id).padStart(2, '0')}</span>
              <span className="stop-detail-icon">{selectedStop.status === 'locked' ? <LockSimple size={28} weight="fill" /> : <SelectedIcon size={29} weight="fill" />}</span>
              <span className="stop-detail-terrain">{selectedStop.terrainName}</span>
            </div>
            <div className="stop-detail-content">
              <span className={'stop-status-label status-' + selectedStop.status}>
                {selectedStop.status === 'done' ? 'ĐÃ HOÀN THÀNH' : selectedStop.status === 'current' ? 'CHẶNG ĐANG MỞ' : 'CHẶNG ĐANG KHÓA'}
              </span>
              <h3>{selectedStop.title}</h3>
              <p className="stop-detail-english">{selectedStop.subtitle}</p>
              <div className="stop-detail-rule" />
              <div className="stop-detail-skill"><span>KỸ NĂNG</span><strong>{selectedStop.skill}</strong></div>
              <div className="stop-learning-note" role="status">
                <Compass size={16} weight="fill" />
                <span>{selectedStop.status === 'locked' ? 'Hoàn thành chặng đang mở để khám phá đoạn đường này.' : 'Nội dung bài luyện tập của chặng này sẽ có tại đây.'}</span>
              </div>
            </div>
          </aside>
        </div>
      </section>

      <section className="skills-ribbon" aria-label="Bốn kỹ năng trong hành trình">
        <div><Headphones size={19} weight="fill" /><span>Nghe</span></div>
        <div><Microphone size={19} weight="fill" /><span>Nói</span></div>
        <div><BookOpenText size={19} weight="fill" /><span>Đọc</span></div>
        <div><PencilLine size={19} weight="fill" /><span>Viết</span></div>
        <p>Học tiếng Anh qua tình huống thật, theo nhịp của riêng bạn.</p>
      </section>
    </div>
  )
}
/* TAB 2: THI ĐUA (Compete / Arena View)                         */
/* ------------------------------------------------------------- */
function CompeteView() {
  const challenges = [
    {
      title: 'Thử Thách Phản Xạ 60 Giây',
      category: 'Tốc độ phản xạ',
      reward: '+30 XP',
      players: '840 người đang chơi',
      color: 'arena-orange',
      icon: Lightning,
    },
    {
      title: 'Đấu Trường 1v1 Trực Tuyến',
      category: 'Đối kháng trực tiếp',
      reward: '+50 XP',
      players: '312 người đang chờ',
      color: 'arena-blue',
      icon: Trophy,
    },
    {
      title: 'Giải Đua Tốc Độ Cuối Tuần',
      category: 'Sự kiện giải đấu',
      reward: '+100 XP',
      players: 'Khởi tranh sau 2 ngày',
      color: 'arena-purple',
      icon: Medal,
    },
  ]

  return (
    <div className="tab-view-container">
      <div className="page-heading">
        <div>
          <span className="page-eyebrow">ĐẤU TRƯỜNG THI ĐUA</span>
          <h1>So tài & Thử thách phản xạ</h1>
          <p>Tranh tài cùng cộng đồng học viên để kiểm tra phản xạ và bứt phá điểm số.</p>
        </div>
      </div>

      <div className="arena-grid">
        {challenges.map((item, idx) => {
          const Icon = item.icon
          return (
            <div key={idx} className={`arena-card ${item.color}`}>
              <div className="arena-card-top">
                <span className="arena-icon-box">
                  <Icon size={26} weight="fill" />
                </span>
                <span className="arena-reward-tag">{item.reward}</span>
              </div>
              <h3>{item.title}</h3>
              <small>{item.category}</small>
              <div className="arena-status-row">
                <span className="status-live-dot" />
                <span>{item.players}</span>
              </div>
              <button type="button" className="arena-play-btn">
                <Play size={16} weight="fill" />
                <span>Bắt đầu ngay</span>
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------- */
/* TAB 3: BẢNG XẾP HẠNG (Leaderboard / Rankings View)            */
/* ------------------------------------------------------------- */
function RankingsView({ user }: { user: AuthUser | null }) {
  const currentName = user?.name || 'An Nguyễn'

  const leaderboard = [
    { rank: 1, name: 'Minh Triết', streak: 42, xp: 1250, badge: '🥇 Vàng' },
    { rank: 2, name: 'Thu Thảo', streak: 31, xp: 980, badge: '🥈 Bạc' },
    { rank: 3, name: 'Hoàng Nam', streak: 28, xp: 840, badge: '🥉 Đồng' },
    { rank: 4, name: currentName, streak: user?.streak ?? 4, xp: user?.xp ?? 240, isMe: true },
    { rank: 5, name: 'Hải Đăng', streak: 12, xp: 210 },
    { rank: 6, name: 'Bảo Ngọc', streak: 9, xp: 190 },
    { rank: 7, name: 'Thanh Hằng', streak: 7, xp: 160 },
  ]

  return (
    <div className="tab-view-container">
      <div className="page-heading">
        <div>
          <span className="page-eyebrow">BẢNG XẾP HẠNG TUẦN</span>
          <h1>Giải Đấu Bạc • Bảng 12</h1>
          <p>Top 10 học viên có điểm XP cao nhất sẽ thăng hạng vào Chủ Nhật tuần này.</p>
        </div>
      </div>

      <div className="leaderboard-card">
        <div className="leaderboard-table-header">
          <span className="col-rank">Thứ hạng</span>
          <span className="col-user">Học viên</span>
          <span className="col-streak">Chuỗi ngày</span>
          <span className="col-xp">Điểm XP</span>
        </div>

        <div className="leaderboard-rows">
          {leaderboard.map((item) => (
            <div
              key={item.rank}
              className={`leaderboard-row ${item.isMe ? 'leaderboard-row-me' : ''}`}
            >
              <div className="col-rank">
                {item.rank === 1 && <span className="rank-badge rank-1">1</span>}
                {item.rank === 2 && <span className="rank-badge rank-2">2</span>}
                {item.rank === 3 && <span className="rank-badge rank-3">3</span>}
                {item.rank > 3 && <span className="rank-num">#{item.rank}</span>}
              </div>
              <div className="col-user">
                <span className="table-avatar">{item.name[0]}</span>
                <div>
                  <strong>{item.name}</strong>
                  {item.isMe && <span className="me-badge">Bạn</span>}
                </div>
              </div>
              <div className="col-streak">
                <Flame size={15} weight="fill" className="text-orange-500" />
                <span>{item.streak} ngày</span>
              </div>
              <div className="col-xp">
                <strong>{item.xp} XP</strong>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------- */
/* TAB 4: PROFILE (User Profile & Account Settings View)         */
/* ------------------------------------------------------------- */
function ProfileView({ user, onLogout }: { user: AuthUser | null; onLogout: () => void }) {
  const initial = user?.name ? user.name.trim()[0].toUpperCase() : 'A'
  const displayName = user?.name || 'An Nguyễn'
  const email = user?.email || 'an.nguyen@example.com'
  const streak = user?.streak ?? 4
  const xp = user?.xp ?? 240

  return (
    <div className="tab-view-container">
      <div className="page-heading">
        <div>
          <span className="page-eyebrow">HỒ SƠ CÁ NHÂN</span>
          <h1>Quản lý tài khoản & Tiến độ</h1>
          <p>Xem tổng quan hành trình học tập và cài đặt cá nhân của bạn.</p>
        </div>
      </div>

      <div className="profile-dashboard-grid">
        {/* User Card */}
        <div className="profile-main-card">
          <div className="profile-hero-banner">
            <span className="profile-large-avatar">{initial}</span>
            <div className="profile-hero-info">
              <h2>{displayName}</h2>
              <p>{email}</p>
              <span className="role-tag">
                <ShieldCheck size={16} weight="fill" /> Học viên tích cực
              </span>
            </div>
          </div>

          <div className="profile-stats-grid">
            <div className="p-stat-box">
              <span className="p-stat-icon text-orange-500"><Flame size={24} weight="fill" /></span>
              <strong>{streak} ngày</strong>
              <small>Chuỗi ngày bền bỉ</small>
            </div>
            <div className="p-stat-box">
              <span className="p-stat-icon text-cyan-600"><Lightning size={24} weight="fill" /></span>
              <strong>{xp} XP</strong>
              <small>Tổng điểm kinh nghiệm</small>
            </div>
            <div className="p-stat-box">
              <span className="p-stat-icon text-emerald-600"><CheckCircle size={24} weight="fill" /></span>
              <strong>12 bài</strong>
              <small>Bài học hoàn thành</small>
            </div>
            <div className="p-stat-box">
              <span className="p-stat-icon text-purple-600"><Medal size={24} weight="fill" /></span>
              <strong>Hạng 4</strong>
              <small>Giải đấu Bạc tuần này</small>
            </div>
          </div>
        </div>

        {/* Account Settings Card */}
        <div className="profile-settings-card">
          <h3>Tùy chọn tài khoản</h3>
          <ul className="settings-list">
            <li>
              <button type="button" className="setting-btn">
                <Gear size={18} />
                <span>Cài đặt thông báo & Nhắc nhở</span>
                <ArrowRight size={16} />
              </button>
            </li>
            <li>
              <button type="button" className="setting-btn">
                <UserCircle size={18} />
                <span>Chỉnh sửa thông tin cá nhân</span>
                <ArrowRight size={16} />
              </button>
            </li>
          </ul>

          <div className="settings-divider" />

          <button type="button" className="profile-logout-btn" onClick={onLogout}>
            <SignOut size={18} />
            <span>Đăng xuất khỏi tài khoản</span>
          </button>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------- */
/* MAIN APP COMPONENT                                            */
/* ------------------------------------------------------------- */
function App() {
  const { user, isAuthenticated, logout } = useAuth()
  const [userNavigatedToLanding, setUserNavigatedToLanding] = useState<boolean>(false)
  const [activeTab, setActiveTab] = useState<DashboardTab>('study')

  // Screen selection
  const currentView = (() => {
    if (userNavigatedToLanding) {
      return 'landing'
    }
    return isAuthenticated ? 'dashboard' : 'landing'
  })()

  function handleLogout() {
    logout()
    setUserNavigatedToLanding(true)
  }

  if (currentView === 'landing') {
    return (
      <LandingPage
        onEnterDashboard={() => setUserNavigatedToLanding(false)}
      />
    )
  }

  return (
    <div className="app-shell" id="home">
      <Sidebar
        user={user}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onLogout={handleLogout}
        onViewLanding={() => setUserNavigatedToLanding(true)}
      />
      <div className="app-main">
        <TopBar
          user={user}
          onViewLanding={() => setUserNavigatedToLanding(true)}
          onOpenProfile={() => setActiveTab('profile')}
        />
        <main className="learning-page">
          {activeTab === 'study' && <StudyView user={user} />}
          {activeTab === 'compete' && <CompeteView />}
          {activeTab === 'rankings' && <RankingsView user={user} />}
          {activeTab === 'profile' && <ProfileView user={user} onLogout={handleLogout} />}

          <footer className="page-footer">
            <span>Engorace · Học một chút, xa thêm một đoạn.</span>
            <span>Chúc bạn học vui mỗi ngày!</span>
          </footer>
        </main>
      </div>

      <nav className="mobile-nav" aria-label="Điều hướng trên điện thoại">
        <button
          type="button"
          className={activeTab === 'study' ? 'mobile-nav-active' : ''}
          onClick={() => setActiveTab('study')}
        >
          <BookOpenText size={21} weight={activeTab === 'study' ? 'fill' : 'regular'} />
          <span>Học Tập</span>
        </button>
        <button
          type="button"
          className={activeTab === 'compete' ? 'mobile-nav-active' : ''}
          onClick={() => setActiveTab('compete')}
        >
          <Lightning size={21} weight={activeTab === 'compete' ? 'fill' : 'regular'} />
          <span>Thi Đua</span>
        </button>
        <button
          type="button"
          className={activeTab === 'rankings' ? 'mobile-nav-active' : ''}
          onClick={() => setActiveTab('rankings')}
        >
          <Trophy size={21} weight={activeTab === 'rankings' ? 'fill' : 'regular'} />
          <span>Xếp Hạng</span>
        </button>
        <button
          type="button"
          className={activeTab === 'profile' ? 'mobile-nav-active' : ''}
          onClick={() => setActiveTab('profile')}
        >
          <UserCircle size={21} weight={activeTab === 'profile' ? 'fill' : 'regular'} />
          <span>Profile</span>
        </button>
        <button
          type="button"
          className="mobile-nav-btn"
          onClick={() => setUserNavigatedToLanding(true)}
        >
          <House size={21} />
          <span>Trang chủ</span>
        </button>
      </nav>
    </div>
  )
}

export default App
