import { ArrowRight, Plus } from '@phosphor-icons/react'
import type { AdminViewId } from './AdminLayout'
import { AreaChart, Donut, HBar, Heatmap, MultiDonut } from './Charts'
import { palette } from './palette'
import { useAdminOverview } from './useAdminStats'
import { useI18n } from '../i18n'

function fmt(n: number): string {
  return n.toLocaleString('vi-VN')
}

function Delta({ value }: { value: number | null }) {
  if (value === null) return <span className="admin-delta is-flat">—</span>
  if (value === 0) return <span className="admin-delta is-flat">0%</span>
  const up = value > 0
  return (
    <span className={`admin-delta ${up ? 'is-up' : 'is-down'}`}>
      {up ? '+' : ''}
      {value.toFixed(1)}%
    </span>
  )
}

export function AdminOverview({ onNavigate }: { onNavigate: (view: AdminViewId) => void }) {
  const { t } = useI18n()
  const { overview, trend, stageStats, loading, error, refresh } = useAdminOverview()

  if (loading && !overview) {
    return (
      <div className="admin-card">
        <div className="admin-loading-state">{t.consoleLoading}</div>
      </div>
    )
  }

  if (error && !overview) {
    return (
      <div className="admin-error-state" role="alert">
        <span>{error}</span>
        <button type="button" className="admin-btn" onClick={refresh}>
          {t.retry}
        </button>
      </div>
    )
  }

  if (!overview) return null

  const totalLessons = stageStats.reduce((acc, stage) => acc + stage.lessonCount, 0)
  const areaData = trend.map((d) => ({ label: d.date.slice(5), value: d.activeUsers }))
  const activePct = overview.totalLearners > 0 ? (overview.active7d / overview.totalLearners) * 100 : 0

  const composition = [
    { label: 'Học 7 ngày qua', value: overview.active7d, color: palette.primary },
    { label: 'Học 8–30 ngày trước', value: Math.max(0, overview.active30d - overview.active7d), color: palette.primarySoft },
    { label: 'Vắng hơn 30 ngày', value: Math.max(0, overview.inactive30d - overview.neverActive), color: palette.warningChart },
    { label: 'Chưa từng học', value: overview.neverActive, color: palette.neutral },
  ].filter((segment) => segment.value > 0)

  const funnelMax = Math.max(1, overview.totalLearners)
  const funnel = [
    { label: 'Tổng học viên', value: overview.totalLearners, color: palette.ink },
    { label: 'Hoạt động 30 ngày', value: overview.active30d, color: palette.primary },
    { label: 'Hoạt động 7 ngày', value: overview.active7d, color: palette.primaryMid },
    { label: 'Hoạt động hôm nay', value: overview.activeToday, color: palette.primarySoft },
  ]

  const signals = [
    { label: 'Video đã xong', value: fmt(overview.videosCompletedTotal), foot: `${fmt(overview.videosSharedCount)} video chung` },
    { label: 'Tổng XP', value: fmt(overview.totalXp), foot: `TB ${fmt(overview.avgXp)} XP` },
    { label: 'Chuỗi ngày TB', value: overview.avgStreak.toFixed(1), foot: `Cao nhất ${fmt(overview.maxStreak)} ngày` },
    { label: 'Trận đấu', value: fmt(overview.matchesTotal), foot: `${fmt(overview.matchesToday)} trận hôm nay` },
    { label: 'Bản dịch', value: fmt(overview.translationsTotal), foot: `${fmt(overview.savedWordsTotal)} từ đã lưu` },
    { label: 'Nội dung học', value: fmt(totalLessons), foot: `${fmt(stageStats.length)} chặng đang mở` },
  ]

  return (
    <div className="admin-page">
      <section className="admin-summary" aria-label="Tóm tắt hoạt động hôm nay">
        <div className="admin-summary-main">
          <span className="admin-summary-label">Hoạt động hôm nay</span>
          <div className="admin-summary-value">
            <strong>{fmt(overview.activeToday)}</strong>
            <Delta value={overview.retentionTodayVsYesterdayPct} />
            <span className="admin-summary-compare">so với {fmt(overview.activeYesterday)} người hôm qua</span>
          </div>
          <p className="admin-summary-desc">
            {fmt(overview.newToday)} đăng ký mới và {fmt(overview.returningToday)} học viên quay lại trong hôm nay.
            Tuần này có {fmt(overview.active7d)} người hoạt động, tháng này có {fmt(overview.active30d)} người.
          </p>
          <div className="admin-summary-actions">
            <button type="button" className="admin-btn is-primary" onClick={() => onNavigate('stats')}>
              Xem thống kê <ArrowRight size={15} />
            </button>
            <button type="button" className="admin-btn" onClick={() => onNavigate('content')}>
              <Plus size={15} /> Thêm nội dung
            </button>
          </div>
        </div>

        <div className="admin-summary-side">
          <div className="admin-summary-side-head">
            <span>Người hoạt động · 14 ngày</span>
            <span>DAU</span>
          </div>
          <AreaChart data={areaData} color={palette.primary} height={112} />
          <div className="admin-summary-facts">
            <div>
              <strong>{fmt(overview.newThisWeek)}</strong>
              <span>Mới trong 7 ngày</span>
            </div>
            <div>
              <strong>{fmt(overview.active7d)}</strong>
              <span>Hoạt động 7 ngày</span>
            </div>
            <div>
              <strong>{fmt(overview.inactive7d)}</strong>
              <span>Vắng 7 ngày</span>
            </div>
          </div>
        </div>
      </section>

      <section className="admin-metrics" aria-label="Chỉ số chính">
        <article className="admin-metric">
          <span className="admin-metric-label">Tổng học viên</span>
          <strong className="admin-metric-value">{fmt(overview.totalLearners)}</strong>
          <p className="admin-metric-foot">
            +{fmt(overview.newToday)} hôm nay · +{fmt(overview.newThisMonth)} trong 30 ngày
          </p>
        </article>

        <article className="admin-metric">
          <span className="admin-metric-label">Giữ chân 7 ngày</span>
          <strong className="admin-metric-value">{activePct.toFixed(0)}%</strong>
          <p className="admin-metric-foot">
            {fmt(overview.active7d)} / {fmt(overview.totalLearners)} người · mục tiêu 50%
          </p>
        </article>

        <article className="admin-metric">
          <span className="admin-metric-label">Hoàn thành bài học</span>
          <strong className="admin-metric-value">{overview.lessonCompletionRatePct}%</strong>
          <p className="admin-metric-foot">
            {fmt(overview.lessonsCompletedTotal)} lượt xong · {fmt(overview.lessonsInProgressActive)} đang học
          </p>
        </article>

        <article className="admin-metric">
          <span className="admin-metric-label">Trả lời chính xác</span>
          <strong className="admin-metric-value">{overview.answerCorrectRatePct}%</strong>
          <p className="admin-metric-foot">
            {fmt(overview.answersTotal)} lượt trả lời · {fmt(overview.savedWordsTotal)} từ đã lưu
          </p>
        </article>
      </section>

      <section className="admin-signals" aria-label="Tín hiệu học tập">
        {signals.map((signal) => (
          <div className="admin-signal" key={signal.label}>
            <span>{signal.label}</span>
            <strong>{signal.value}</strong>
            <small>{signal.foot}</small>
          </div>
        ))}
      </section>

      <div className="admin-grid-2 admin-grid-main">
        <section className="admin-card">
          <header className="admin-card-head">
            <div>
              <h3>Nhịp hoạt động 14 ngày</h3>
              <p>Người hoạt động mỗi ngày và mật độ học tập</p>
            </div>
            <span className="admin-card-meta">14 ngày</span>
          </header>
          <div className="admin-card-body">
            <AreaChart data={areaData} color={palette.primary} height={168} />
            <div className="admin-subhead">
              <span>Mật độ theo ngày</span>
              <span className="admin-muted">14 ngày gần nhất</span>
            </div>
            <Heatmap data={areaData} />
            <p className="admin-chart-foot">
              Mới: <strong>{fmt(trend.reduce((acc, d) => acc + d.newUsers, 0))}</strong> · Bài xong:{' '}
              <strong>{fmt(trend.reduce((acc, d) => acc + d.lessonsCompleted, 0))}</strong> · Video xong:{' '}
              <strong>{fmt(trend.reduce((acc, d) => acc + d.videosCompleted, 0))}</strong> · Lượt làm:{' '}
              <strong>{fmt(trend.reduce((acc, d) => acc + d.attempts, 0))}</strong>
            </p>
          </div>
        </section>

        <section className="admin-card">
          <header className="admin-card-head">
            <div>
              <h3>Cơ cấu học viên</h3>
              <p>Tỉ trọng nhóm hoạt động và mức độ quay lại</p>
            </div>
          </header>
          <div className="admin-card-body">
            <MultiDonut segments={composition} />
            <div className="admin-divider" />
            <div className="admin-subhead">
              <span>Phễu quay lại</span>
              <span className="admin-muted">So với tổng học viên</span>
            </div>
            <div className="admin-progress-list">
              {funnel.map((step) => (
                <HBar
                  key={step.label}
                  label={step.label}
                  display={`${fmt(step.value)} · ${funnelMax > 0 ? Math.round((step.value / funnelMax) * 100) : 0}%`}
                  percent={funnelMax > 0 ? (step.value / funnelMax) * 100 : 0}
                  color={step.color}
                />
              ))}
            </div>
            <p className="admin-chart-foot">
              Vắng 14 ngày: <strong>{fmt(overview.inactive14d)}</strong> · Vắng 30 ngày:{' '}
              <strong>{fmt(overview.inactive30d)}</strong> · Chưa từng học: <strong>{fmt(overview.neverActive)}</strong>
            </p>
          </div>
        </section>
      </div>

      <div className="admin-grid-2 admin-grid-main">
        <section className="admin-card">
          <header className="admin-card-head">
            <div>
              <h3>Tiến độ theo chặng</h3>
              <p>
                {fmt(totalLessons)} bài học · {fmt(overview.lessonsCompletedTotal)} lượt hoàn thành
              </p>
            </div>
            <button type="button" className="admin-btn is-quiet" onClick={() => onNavigate('stats')}>
              Xem chi tiết <ArrowRight size={14} />
            </button>
          </header>
          <div className="admin-card-body admin-progress-list">
            {stageStats.length === 0 ? (
              <p className="admin-muted">Chưa có chặng học nào.</p>
            ) : (
              stageStats.map((stage) => {
                const completionPct = Math.max(0, Math.min(100, stage.completionRatePct))
                return (
                  <div className="admin-progress-row" key={stage.stageId}>
                    <div className="admin-progress-top">
                      <strong>
                        {String(stage.sortOrder).padStart(2, '0')} · {stage.stageTitle}
                      </strong>
                      <span>
                        {fmt(stage.completions)} lượt xong · {fmt(stage.learnersStarted)} người
                      </span>
                    </div>
                    <div className="admin-progress-track">
                      <div className="admin-progress-fill" style={{ width: `${completionPct}%`, background: palette.primary }} />
                    </div>
                    <div className="admin-progress-meta">
                      <span>{fmt(stage.lessonCount)} bài</span>
                      <span>{completionPct}% hoàn thành</span>
                      {stage.avgScore !== null && <span>Điểm TB {stage.avgScore.toFixed(1)}</span>}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </section>

        <section className="admin-card">
          <header className="admin-card-head">
            <div>
              <h3>Hoàn thành & độ chính xác</h3>
              <p>Tỉ lệ trên số lượt bắt đầu</p>
            </div>
          </header>
          <div className="admin-card-body">
            <div className="admin-rings">
              <Donut
                percent={overview.lessonCompletionRatePct}
                color={palette.primary}
                label={`${overview.lessonCompletionRatePct}%`}
                sub="Bài học"
                size={96}
              />
              <Donut
                percent={overview.videoCompletionRatePct}
                color={palette.primaryMid}
                label={`${overview.videoCompletionRatePct}%`}
                sub="Video"
                size={96}
              />
              <Donut
                percent={overview.answerCorrectRatePct}
                color={palette.success}
                label={`${overview.answerCorrectRatePct}%`}
                sub="Trả lời đúng"
                size={96}
              />
            </div>
            <div className="admin-divider" />
            <ul className="admin-mini-list">
              <li>
                <span>Bài học hoàn thành</span>
                <strong>{fmt(overview.lessonsCompletedTotal)}</strong>
              </li>
              <li>
                <span>Video hoàn thành</span>
                <strong>{fmt(overview.videosCompletedTotal)}</strong>
              </li>
              <li>
                <span>Lượt trả lời</span>
                <strong>{fmt(overview.answersTotal)}</strong>
              </li>
            </ul>
            <p className="admin-chart-foot">
              Tỉ lệ tính trên lượt bắt đầu bài học, video và tổng số câu đã trả lời.
            </p>
          </div>
        </section>
      </div>

      <section className="admin-card">
        <header className="admin-card-head">
          <div>
            <h3>Tạo nhanh</h3>
            <p>Đi thẳng tới màn hình quản lý tương ứng.</p>
          </div>
        </header>
        <div className="admin-card-body is-flush">
          <div className="admin-action-list">
            <button type="button" className="admin-action-row" onClick={() => onNavigate('content')}>
              <span className="admin-action-copy">
                <strong>Chặng học</strong>
                <small>Tạo chặng mới trong lộ trình</small>
              </span>
              <span className="admin-action-cta">
                Mở <ArrowRight size={14} />
              </span>
            </button>
            <button type="button" className="admin-action-row" onClick={() => onNavigate('content')}>
              <span className="admin-action-copy">
                <strong>Bài học</strong>
                <small>Thêm bài và câu hỏi vào chặng đã chọn</small>
              </span>
              <span className="admin-action-cta">
                Mở <ArrowRight size={14} />
              </span>
            </button>
            <button type="button" className="admin-action-row" onClick={() => onNavigate('videos')}>
              <span className="admin-action-copy">
                <strong>Video chung</strong>
                <small>Nhập YouTube, AI tách đoạn cho học viên</small>
              </span>
              <span className="admin-action-cta">
                Mở <ArrowRight size={14} />
              </span>
            </button>
          </div>
          <p className="admin-action-note">
            Dùng Nội dung học để đi theo thứ tự chặng → bài → câu hỏi, hoặc Thư viện video để bổ sung video dùng chung.
          </p>
        </div>
      </section>

      <div className="admin-page-foot">
        <span>Dữ liệu hoạt động tổng hợp từ học bài, video, trả lời, đấu trường, dịch, chat và lưu từ.</span>
        <span>Cập nhật khi bạn làm mới trang.</span>
      </div>
    </div>
  )
}
