import { useMemo, useState } from 'react'
import { ArrowClockwise } from '@phosphor-icons/react'
import { AreaChart, GroupedBars, HBar, StackedBar } from './Charts'
import { palette } from './palette'
import { useAdminOverview, useInactiveUsers } from './useAdminStats'
import { useI18n } from '../i18n'

function fmt(n: number): string {
  return n.toLocaleString('vi-VN')
}

function fmtDay(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  return match ? `${match[3]}/${match[2]}` : value
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch {
    return iso.slice(0, 10)
  }
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

export function AdminStats() {
  const { t } = useI18n()
  const { overview, trend, stageStats, lessonStats, content, loading, error, refresh } = useAdminOverview()
  const [inactiveDays, setInactiveDays] = useState(7)
  const inactive = useInactiveUsers(inactiveDays)

  const topAbandon = useMemo(
    () => [...lessonStats].sort((a, b) => b.abandonRatePct - a.abandonRatePct).slice(0, 8),
    [lessonStats],
  )
  const topCompletion = useMemo(
    () => [...lessonStats].sort((a, b) => b.completions - a.completions).slice(0, 8),
    [lessonStats],
  )

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
          {t.consoleRefresh}
        </button>
      </div>
    )
  }
  if (!overview) return null

  const retentionRows = [
    { label: 'Hôm nay (DAU)', value: overview.activeToday, note: `Hôm qua: ${fmt(overview.activeYesterday)}`, tone: '' },
    { label: '7 ngày qua (WAU)', value: overview.active7d, note: 'Có ít nhất một hoạt động', tone: '' },
    { label: '30 ngày qua (MAU)', value: overview.active30d, note: 'Có ít nhất một hoạt động', tone: '' },
    { label: 'Không học 7 ngày', value: overview.inactive7d, note: 'Cần theo dõi giữ chân', tone: 'warning' },
    { label: 'Không học 14 ngày', value: overview.inactive14d, note: 'Nhóm có nguy cơ rời bỏ', tone: 'warning' },
    { label: 'Không học 30 ngày', value: overview.inactive30d, note: 'Cần can thiệp', tone: 'danger' },
    { label: 'Chưa từng học', value: overview.neverActive, note: 'Đã đăng ký nhưng chưa có hoạt động', tone: 'danger' },
    { label: 'Quay lại hôm nay', value: overview.returningToday, note: 'Không phải người mới hôm nay', tone: '' },
  ]

  const newRows = [
    { label: 'Mới hôm nay', value: overview.newToday },
    { label: 'Mới hôm qua', value: overview.newYesterday },
    { label: 'Mới trong 7 ngày', value: overview.newThisWeek },
    { label: 'Mới trong 30 ngày', value: overview.newThisMonth },
  ]

  const activePct = overview.totalLearners > 0 ? (overview.active7d / overview.totalLearners) * 100 : 0
  const dailyLabels = trend.map((d) => d.date.slice(5))
  const composition = [
    { label: 'Học 7 ngày qua', value: overview.active7d, color: palette.primary },
    { label: 'Học 8–30 ngày trước', value: Math.max(0, overview.active30d - overview.active7d), color: palette.primarySoft },
    { label: 'Vắng hơn 30 ngày', value: Math.max(0, overview.inactive30d - overview.neverActive), color: palette.warningChart },
    { label: 'Chưa từng học', value: overview.neverActive, color: palette.neutral },
  ].filter((segment) => segment.value > 0)
  const dauMax = Math.max(1, overview.active30d)

  return (
    <div className="admin-page">
      <div className="admin-stats-bar">
        <p className="admin-note">
          Hoạt động được tổng hợp từ học bài, xem video, trả lời, đấu trường, dịch, chat và lưu từ. Không có bảng đăng
          nhập riêng nên “hoạt động” được suy ra từ các sự kiện này.
        </p>
        <button type="button" className="admin-btn is-quiet" onClick={() => { refresh(); inactive.refresh() }}>
          <ArrowClockwise size={15} /> {t.consoleRefresh}
        </button>
      </div>

      <section className="admin-metrics" aria-label="Chỉ số chính">
        <article className="admin-metric">
          <span className="admin-metric-label">Hoạt động hôm nay</span>
          <div className="admin-metric-row">
            <strong className="admin-metric-value">{fmt(overview.activeToday)}</strong>
            <Delta value={overview.retentionTodayVsYesterdayPct} />
          </div>
          <p className="admin-metric-foot">
            Hôm qua {fmt(overview.activeYesterday)} · Quay lại {fmt(overview.returningToday)}
          </p>
        </article>

        <article className="admin-metric">
          <span className="admin-metric-label">Hoạt động 7 ngày</span>
          <strong className="admin-metric-value">{fmt(overview.active7d)}</strong>
          <p className="admin-metric-foot">
            {activePct.toFixed(0)}% tổng học viên · mục tiêu 50% · MAU {fmt(overview.active30d)}
          </p>
        </article>

        <article className="admin-metric">
          <span className="admin-metric-label">Trả lời chính xác</span>
          <strong className="admin-metric-value">{overview.answerCorrectRatePct}%</strong>
          <p className="admin-metric-foot">
            {fmt(overview.answersTotal)} lượt · mục tiêu 70% · {fmt(overview.savedWordsTotal)} từ đã lưu
          </p>
        </article>

        <article className="admin-metric">
          <span className="admin-metric-label">Hoàn thành bài học</span>
          <strong className="admin-metric-value">{overview.lessonCompletionRatePct}%</strong>
          <p className="admin-metric-foot">
            {fmt(overview.lessonsCompletedTotal)} lượt xong · video {overview.videoCompletionRatePct}%
          </p>
        </article>
      </section>

      <div className="admin-grid-2 admin-grid-main">
        <section className="admin-card">
          <header className="admin-card-head">
            <div>
              <h3>Cơ cấu học viên</h3>
              <p>Tỉ trọng nhóm hoạt động và mức độ quay lại</p>
            </div>
          </header>
          <div className="admin-card-body">
            <StackedBar segments={composition} />
            <div className="admin-divider" />
            <div className="admin-subhead">
              <span>Hoạt động</span>
              <span className="admin-muted">So với MAU</span>
            </div>
            <div className="admin-progress-list">
              <HBar label="Hôm nay (DAU)" display={fmt(overview.activeToday)} percent={(overview.activeToday / dauMax) * 100} color={palette.primary} />
              <HBar label="7 ngày (WAU)" display={fmt(overview.active7d)} percent={(overview.active7d / dauMax) * 100} color={palette.primaryMid} />
              <HBar label="30 ngày (MAU)" display={fmt(overview.active30d)} percent={(overview.active30d / dauMax) * 100} color={palette.primarySoft} />
            </div>
            <p className="admin-chart-foot">
              Tổng học viên: <strong>{fmt(overview.totalLearners)}</strong> · Chưa từng học:{' '}
              <strong>{fmt(overview.neverActive)}</strong> · Vắng 30 ngày: <strong>{fmt(overview.inactive30d)}</strong>
            </p>
          </div>
        </section>

        <section className="admin-card">
          <header className="admin-card-head">
            <div>
              <h3>Nhịp học 14 ngày</h3>
              <p>Bài xong, video xong, người mới và xu hướng hoạt động</p>
            </div>
          </header>
          <div className="admin-card-body">
            <GroupedBars
              labels={dailyLabels}
              series={[
                { name: 'Bài xong', color: palette.primary, data: trend.map((d) => d.lessonsCompleted) },
                { name: 'Video xong', color: palette.primaryMid, data: trend.map((d) => d.videosCompleted) },
                { name: 'Người mới', color: palette.primarySoft, data: trend.map((d) => d.newUsers) },
              ]}
              height={168}
            />
            <div className="admin-divider" />
            <div className="admin-subhead">
              <span>Người hoạt động (DAU)</span>
              <span className="admin-muted">14 ngày</span>
            </div>
            <AreaChart data={trend.map((d) => ({ label: d.date.slice(5), value: d.activeUsers }))} color={palette.primary} height={96} />
            <p className="admin-chart-foot">
              Tổng lượt làm bài: <strong>{fmt(trend.reduce((acc, d) => acc + d.attempts, 0))}</strong> · Người mới:{' '}
              <strong>{fmt(trend.reduce((acc, d) => acc + d.newUsers, 0))}</strong>
            </p>
          </div>
        </section>
      </div>

      <section className="admin-section">
        <header className="admin-section-head">
          <div>
            <h2>Giữ chân & tăng trưởng</h2>
            <p>So sánh nhóm đang hoạt động, nhóm rời bỏ và tốc độ đăng ký mới.</p>
          </div>
        </header>

        <div className="admin-grid-2">
          <section className="admin-card">
            <header className="admin-card-head">
              <div>
                <h3>Giữ chân & quay lại</h3>
                <p>DAU / WAU / MAU và các nhóm rời bỏ</p>
              </div>
            </header>
            <div className="admin-card-body is-flush">
              <div className="admin-table-wrap">
                <table className="admin-table is-fit">
                  <thead>
                    <tr>
                      <th>Chỉ số</th>
                      <th className="num">Số người</th>
                      <th>Ghi chú</th>
                    </tr>
                  </thead>
                  <tbody>
                    {retentionRows.map((row) => (
                      <tr key={row.label}>
                        <td>{row.label}</td>
                        <td className="num">
                          <strong className={row.tone ? `admin-text-${row.tone}` : undefined}>{fmt(row.value)}</strong>
                        </td>
                        <td className="muted">{row.note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section className="admin-card">
            <header className="admin-card-head">
              <div>
                <h3>Người dùng mới</h3>
                <p>Đăng ký mới theo từng mốc thời gian</p>
              </div>
            </header>
            <div className="admin-card-body is-flush">
              <div className="admin-table-wrap">
                <table className="admin-table is-fit">
                  <thead>
                    <tr>
                      <th>Mốc</th>
                      <th className="num">Số người mới</th>
                    </tr>
                  </thead>
                  <tbody>
                    {newRows.map((row) => (
                      <tr key={row.label}>
                        <td>{row.label}</td>
                        <td className="num">
                          <strong>{fmt(row.value)}</strong>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="admin-table-foot">
                Tổng học viên: <strong>{fmt(overview.totalLearners)}</strong> · Quản trị viên:{' '}
                <strong>{fmt(overview.totalAdmins)}</strong> · XP trung bình <strong>{fmt(overview.avgXp)}</strong> · Chuỗi
                ngày TB <strong>{overview.avgStreak.toFixed(1)}</strong> (cao nhất {fmt(overview.maxStreak)})
              </p>
            </div>
          </section>
        </div>
      </section>

      <section className="admin-section">
        <header className="admin-section-head">
          <div>
            <h2>Nội dung & hiệu suất</h2>
            <p>Chặng nào đang giữ học viên, bài nào dễ bị bỏ dở và kho nội dung hiện có.</p>
          </div>
        </header>

        <div className="admin-grid-2">
          <section className="admin-card">
            <header className="admin-card-head">
              <div>
                <h3>Hiệu suất theo chặng</h3>
                <p>Số người bắt đầu và hoàn thành từng chặng</p>
              </div>
            </header>
            <div className="admin-card-body is-flush">
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Chặng</th>
                      <th className="num">Bài</th>
                      <th className="num">Bắt đầu</th>
                      <th className="num">Hoàn thành</th>
                      <th className="num">Tỉ lệ xong</th>
                      <th className="num">Điểm TB</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stageStats.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="admin-table-empty">Chưa có dữ liệu chặng học.</td>
                      </tr>
                    ) : (
                      stageStats.map((stage) => {
                        const completionPct = Math.max(0, Math.min(100, stage.completionRatePct))
                        return (
                          <tr key={stage.stageId}>
                            <td>
                              <strong>
                                {String(stage.sortOrder).padStart(2, '0')} · {stage.stageTitle}
                              </strong>
                            </td>
                            <td className="num">{fmt(stage.lessonCount)}</td>
                            <td className="num">{fmt(stage.learnersStarted)}</td>
                            <td className="num">{fmt(stage.completions)}</td>
                            <td className="num">
                              <span
                                className={`admin-status ${
                                  completionPct >= 50 ? 'is-good' : completionPct >= 25 ? 'is-warn' : 'is-bad'
                                }`}
                              >
                                <i /> {completionPct}%
                              </span>
                            </td>
                            <td className="num">{stage.avgScore !== null ? stage.avgScore.toFixed(1) : '—'}</td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section className="admin-card">
            <header className="admin-card-head">
              <div>
                <h3>Bài dễ bỏ dở nhất</h3>
                <p>Tỉ lệ đã bắt đầu nhưng chưa hoàn thành — ưu tiên rà soát nội dung</p>
              </div>
            </header>
            <div className="admin-card-body is-flush">
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Bài học</th>
                      <th className="num">Bắt đầu</th>
                      <th className="num">Hoàn thành</th>
                      <th className="num">Bỏ dở</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topAbandon.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="admin-table-empty">Chưa có dữ liệu bài học.</td>
                      </tr>
                    ) : (
                      topAbandon.map((lesson) => (
                        <tr key={lesson.lessonId}>
                          <td>
                            <strong>{lesson.title}</strong>
                            <div className="muted">
                              {lesson.stageTitle} · {lesson.questionCount} câu
                            </div>
                          </td>
                          <td className="num">{fmt(lesson.learnersStarted)}</td>
                          <td className="num">{fmt(lesson.completions)}</td>
                          <td className="num">
                            <span
                              className={`admin-status ${
                                lesson.abandonRatePct >= 70 ? 'is-bad' : lesson.abandonRatePct >= 40 ? 'is-warn' : 'is-good'
                              }`}
                            >
                              <i /> {lesson.abandonRatePct}%
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </div>

        <div className="admin-grid-2">
          <section className="admin-card">
            <header className="admin-card-head">
              <div>
                <h3>Bài hoàn thành nhiều nhất</h3>
                <p>Độ phủ nội dung hiện tại</p>
              </div>
            </header>
            <div className="admin-card-body is-flush">
              <div className="admin-table-wrap">
                <table className="admin-table is-fit">
                  <thead>
                    <tr>
                      <th>Bài học</th>
                      <th className="num">Lượt xong</th>
                      <th className="num">Điểm TB</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topCompletion.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="admin-table-empty">Chưa có dữ liệu bài học.</td>
                      </tr>
                    ) : (
                      topCompletion.map((lesson) => (
                        <tr key={lesson.lessonId}>
                          <td>
                            <strong>{lesson.title}</strong>
                            <div className="muted">{lesson.stageTitle}</div>
                          </td>
                          <td className="num">{fmt(lesson.completions)}</td>
                          <td className="num">{lesson.avgScore !== null ? lesson.avgScore.toFixed(1) : '—'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section className="admin-card">
            <header className="admin-card-head">
              <div>
                <h3>Tổng hợp học tập</h3>
                <p>Video, đấu trường, dịch và kho nội dung</p>
              </div>
            </header>
            <div className="admin-card-body">
              <ul className="admin-stat-list">
                <li>
                  <span>Video hoàn thành</span>
                  <strong>{fmt(overview.videosCompletedTotal)}</strong>
                </li>
                <li>
                  <span>Trận đấu</span>
                  <strong>{fmt(overview.matchesTotal)}</strong>
                </li>
                <li>
                  <span>Câu trả lời đúng</span>
                  <strong>{overview.answerCorrectRatePct}%</strong>
                </li>
                <li>
                  <span>Bản dịch</span>
                  <strong>{fmt(overview.translationsTotal)}</strong>
                </li>
              </ul>
              {content && (
                <>
                  <div className="admin-divider" />
                  <p className="admin-chart-foot">
                    Kho nội dung: <strong>{fmt(content.stages)}</strong> chặng · <strong>{fmt(content.lessons)}</strong> bài ·{' '}
                    <strong>{fmt(content.questions)}</strong> câu · <strong>{fmt(content.sharedVideos)}</strong> video chung (
                    {fmt(content.videoSegments)} đoạn) · <strong>{fmt(content.battleWords)}</strong> từ đấu trường
                  </p>
                </>
              )}
            </div>
          </section>
        </div>
      </section>

      <section className="admin-section">
        <header className="admin-section-head">
          <div>
            <h2>Người dùng</h2>
            <p>Xu hướng 14 ngày và danh sách học viên không quay lại.</p>
          </div>
        </header>

        <section className="admin-card">
          <header className="admin-card-head">
            <div>
              <h3>Xu hướng 14 ngày</h3>
              <p>Mỗi ngày: hoạt động, người mới, bài xong, video xong và lượt trả lời</p>
            </div>
          </header>
          <div className="admin-card-body is-flush">
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Ngày</th>
                    <th className="num">Hoạt động</th>
                    <th className="num">Người mới</th>
                    <th className="num">Bài xong</th>
                    <th className="num">Video xong</th>
                    <th className="num">Lượt làm</th>
                  </tr>
                </thead>
                <tbody>
                  {trend.map((day) => (
                    <tr key={day.date}>
                      <td>{fmtDay(day.date)}</td>
                      <td className="num">{fmt(day.activeUsers)}</td>
                      <td className="num">{fmt(day.newUsers)}</td>
                      <td className="num">{fmt(day.lessonsCompleted)}</td>
                      <td className="num">{fmt(day.videosCompleted)}</td>
                      <td className="num">{fmt(day.attempts)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="admin-card">
          <header className="admin-card-head">
            <div>
              <h3>Người dùng không quay lại</h3>
              <p>Học viên lâu chưa hoạt động, sắp xếp theo lần học cuối cũ nhất</p>
            </div>
            <div className="admin-seg" role="tablist" aria-label="Mốc không quay lại">
              {[7, 14, 30].map((days) => (
                <button
                  key={days}
                  type="button"
                  className={inactiveDays === days ? 'is-active' : ''}
                  onClick={() => setInactiveDays(days)}
                >
                  {days} ngày
                </button>
              ))}
            </div>
          </header>
          <div className="admin-card-body is-flush">
            {inactive.loading ? (
              <div className="admin-loading-state">{t.consoleLoading}</div>
            ) : inactive.error ? (
              <div className="admin-pad">
                <div className="admin-error-state" role="alert">
                  <span>{inactive.error}</span>
                  <button type="button" className="admin-btn" onClick={inactive.refresh}>
                    {t.consoleRefresh}
                  </button>
                </div>
              </div>
            ) : inactive.users.length === 0 ? (
              <div className="admin-empty-state">Không có học viên nào vắng {inactiveDays} ngày qua.</div>
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Học viên</th>
                      <th className="num">XP</th>
                      <th className="num">Chuỗi ngày</th>
                      <th className="num">Bài đã xong</th>
                      <th>Lần học cuối</th>
                      <th className="num">Số ngày vắng</th>
                      <th>Ngày đăng ký</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inactive.users.map((user) => (
                      <tr key={user.id}>
                        <td>
                          <strong>{user.displayName}</strong>
                          <div className="muted">{user.email}</div>
                        </td>
                        <td className="num">{fmt(user.xp)}</td>
                        <td className="num">{user.streak}</td>
                        <td className="num">{fmt(user.lessonsCompleted)}</td>
                        <td>
                          {user.lastActivityAt ? fmtDate(user.lastActivityAt) : <span className="admin-text-danger admin-strong">Chưa từng học</span>}
                        </td>
                        <td className="num">
                          <strong>{user.daysInactive}</strong>
                        </td>
                        <td className="muted">{fmtDate(user.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </section>
    </div>
  )
}
