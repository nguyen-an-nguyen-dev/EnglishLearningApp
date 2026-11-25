import { useEffect, useState } from 'react'
import { ArrowClockwise, ArrowDown, ArrowUp, Clock, Minus } from '@phosphor-icons/react'
import { useAuth } from '../../context/AuthContext'
import { useWallet } from '../../context/WalletContext'
import { useI18n } from '../../i18n'
import { LoadingDots } from '../LoadingDots'
import { getRankingApi } from '../../services/communityService'
import type { RankingBoard, RankingEntry } from '../../types/community'
import { formatCompact } from '../../utils/format'
import {
  DEFAULT_LEAGUE_RULES,
  asLeagueTier,
  demotionCount,
  leagueZone,
  nextTier,
  previousTier,
  promotionCount,
  stayCount,
  type LeagueRules,
  type LeagueZone,
} from '../../utils/league'
import { tierLabel } from '../../utils/leagueLabels'
import { LeagueLadder } from './LeagueLadder'
import { Avatar } from '../Avatar'

type BoardMode = 'league' | 'career'

function timeLeftLabel(
  t: ReturnType<typeof useI18n>['t'],
  endsAt: string | null,
  now: number,
): string | null {
  if (!endsAt) return null
  const remaining = new Date(endsAt).getTime() - now
  if (!Number.isFinite(remaining)) return null
  if (remaining <= 0) return t.rankWeekEnded
  const hours = Math.floor(remaining / 3_600_000)
  if (hours >= 24) return t.rankCountdownDays(Math.floor(hours / 24))
  if (hours >= 1) return t.rankCountdownHours(hours)
  return t.rankCountdownMinutes(Math.max(1, Math.ceil(remaining / 60_000)))
}

function useSeasonClock(enabled: boolean): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!enabled) return
    const timer = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(timer)
  }, [enabled])
  return now
}

function scoreLabel(value: number, lang: string): string {
  const compact = formatCompact(value)
  return lang === 'vi' ? compact.replace(/(\d)\.(\d)(?=k)/, '$1,$2') : compact
}

function RankingRow({
  entry,
  isMe,
  mode,
  youLabel,
  lang,
}: {
  entry: RankingEntry
  isMe: boolean
  mode: BoardMode
  youLabel: string
  lang: string
}) {
  const score = mode === 'league' ? entry.race_points ?? 0 : entry.xp
  return (
    <li className={'rank-row' + (isMe ? ' is-current-user' : '')} aria-current={isMe ? 'true' : undefined} data-buddy-target={isMe ? 'rank:me' : undefined}>
      <span className="rank-row-place">
        {entry.rank <= 3
          ? <span className={'rank-medal medal-' + entry.rank}>{entry.rank}</span>
          : entry.rank}
      </span>
      <Avatar src={entry.avatar} size={40} className={'rank-avatar avatar-tone-' + (entry.rank % 6)} />
      <span className="rank-person">
        <span className="rank-person-name" title={entry.name}>{entry.name}</span>
        {isMe && <span className="rank-you-badge">{youLabel}</span>}
      </span>
      <span className="rank-score">
        {scoreLabel(score, lang)}
        <small>{mode === 'league' ? 'RP' : 'XP'}</small>
      </span>
    </li>
  )
}

interface ZoneGroup {
  zone: LeagueZone
  entries: RankingEntry[]
}

function LeagueZoneSection({
  group,
  tier,
  currentUserId,
  youLabel,
  lang,
}: {
  group: ZoneGroup
  tier: string
  currentUserId: number | undefined
  youLabel: string
  lang: string
}) {
  const { t } = useI18n()
  const { zone, entries } = group
  const first = entries[0]?.rank ?? 0
  const last = entries[entries.length - 1]?.rank ?? first
  const targetTier = zone === 'promote'
    ? nextTier(tier)
    : zone === 'demote'
      ? previousTier(tier)
      : null
  const detail = zone === 'promote' && targetTier
    ? t.rankZoneUpDetail(entries.length, tierLabel(t, targetTier))
    : zone === 'demote' && targetTier
      ? t.rankZoneDownDetail(entries.length, tierLabel(t, targetTier))
      : t.rankZoneStayDetail(first, last)
  const title = zone === 'promote'
    ? t.rankZoneUpTitle
    : zone === 'demote'
      ? t.rankZoneDownTitle
      : t.rankZoneStayTitle
  const Icon = zone === 'promote' ? ArrowUp : zone === 'demote' ? ArrowDown : Minus

  return (
    <section className={'rank-zone-card zone-' + zone} aria-label={title}>
      <h2 className="rank-zone-heading">
        <Icon size={18} weight="bold" aria-hidden="true" />
        <span>{title}</span>
        <small>{detail}</small>
      </h2>
      <ol className="rank-list" start={first}>
        {entries.map((entry) => (
          <RankingRow
            key={entry.userId}
            entry={entry}
            isMe={entry.userId === currentUserId}
            mode="league"
            youLabel={youLabel}
            lang={lang}
          />
        ))}
      </ol>
    </section>
  )
}

export function RankingsView({ onStartStudying, focusRequest = 0 }: { onStartStudying?: () => void; focusRequest?: number }) {
  const { t, lang } = useI18n()
  const { user } = useAuth()
  const { league } = useWallet()
  const [board, setBoard] = useState<RankingBoard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [selection, setSelection] = useState<{ mode: BoardMode; request: number }>({ mode: 'league', request: focusRequest })
  const mode = selection.request === focusRequest ? selection.mode : 'league'

  useEffect(() => {
    let cancelled = false
    getRankingApi()
      .then((data) => {
        if (cancelled) return
        setBoard(data)
        setError(null)
        setLoading(false)
      })
      .catch((loadError: unknown) => {
        if (cancelled) return
        setError(loadError instanceof Error ? loadError.message : t.rankError)
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [reloadKey, t.rankError])

  const reload = () => {
    setLoading(true)
    setError(null)
    setReloadKey((key) => key + 1)
  }

  const weeklyEntries = board?.league ?? []
  const careerEntries = board?.leaderboard ?? []
  const entries = mode === 'league' ? weeklyEntries : careerEntries
  const tier = asLeagueTier(board?.league_tier ?? league?.tier)
  const rules: LeagueRules = board?.league_rules ?? DEFAULT_LEAGUE_RULES
  const total = weeklyEntries.length
  const myWeeklyEntry = weeklyEntries.find((entry) => entry.userId === user?.id)
  const myCareerEntry = careerEntries.find((entry) => entry.userId === user?.id)
  const myRank = mode === 'league'
    ? board?.current_user_league_rank ?? null
    : board?.current_user_rank ?? null
  const myScore = mode === 'league'
    ? myWeeklyEntry?.race_points ?? 0
    : myCareerEntry?.xp ?? 0
  const promoteSlots = promotionCount(total, tier, rules)
  const demoteSlots = demotionCount(total, tier, rules)
  const safeSlots = stayCount(total, tier, rules)
  const endsAt = league?.season?.ends_at ?? null
  const now = useSeasonClock(Boolean(endsAt))
  const timeLeft = timeLeftLabel(t, endsAt, now)

  const grouped: Record<LeagueZone, RankingEntry[]> = { promote: [], stay: [], demote: [] }
  for (const entry of weeklyEntries) {
    grouped[leagueZone(entry.rank, weeklyEntries.length, tier, rules)].push(entry)
  }
  const zoneGroups = (['promote', 'stay', 'demote'] as const)
    .map((zone) => ({ zone, entries: grouped[zone] }))
    .filter((group) => group.entries.length > 0)
  const currentZoneSummary = t.rankMovementSummary(promoteSlots, safeSlots, demoteSlots)
  const zonesForBuddy = zoneGroups
    .map(({ zone, entries: members }) => zone + ':' + members[0].rank + '-' + members[members.length - 1].rank)
    .join(',')
  const ready = !loading && !error

  return (
    <div
      className="tab-view-container rank-view"
      data-board={mode}
      data-my-rank={myRank ?? ''}
      data-total-users={entries.length}
      data-my-score={myScore}
      data-leader-name={entries[0]?.name ?? ''}
      data-leader-score={mode === 'league' ? entries[0]?.race_points ?? 0 : entries[0]?.xp ?? 0}
      data-league-tier={tier}
      data-zones={mode === 'league' ? zonesForBuddy : ''}
      data-board-ready={String(ready)}
    >
      <div className="rank-page" data-league-tier={tier}>
        <nav className="rank-tabs" role="tablist" aria-label={t.rankTabsAria}>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'league'}
            aria-controls="rank-board-panel"
            className={'rank-tab' + (mode === 'league' ? ' is-active' : '')}
            onClick={() => setSelection({ mode: 'league', request: focusRequest })}
          >
            {t.rankWeeklyTab}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'career'}
            aria-controls="rank-board-panel"
            className={'rank-tab' + (mode === 'career' ? ' is-active' : '')}
            onClick={() => setSelection({ mode: 'career', request: focusRequest })}
          >
            {t.rankCareerTab}
          </button>
        </nav>

        {mode === 'league' && <LeagueLadder tier={tier} />}

        <header className="rank-heading">
          <h1>{mode === 'league' ? t.rankLeagueHeading(tierLabel(t, tier)) : t.rankCareerTitle}</h1>
          {mode === 'career' ? (
            <p className="rank-subtitle">{t.rankCareerSubtitle}</p>
          ) : (
            <>
              {timeLeft && (
                <p className="rank-countdown">
                  <Clock size={16} weight="bold" aria-hidden="true" />
                  {timeLeft}
                </p>
              )}
              <p className="rank-movement-summary">{currentZoneSummary}</p>
            </>
          )}
        </header>

        <section
          id="rank-board-panel"
          role="tabpanel"
          className="rank-board-panel"
          data-buddy-target={!entries.some((entry) => entry.userId === user?.id) ? 'rank:me' : undefined}
          aria-label={mode === 'league' ? t.rankWeeklyTab : t.rankCareerTab}
        >
          {loading && <div className="rank-state"><LoadingDots label={t.rankLoading} /></div>}

          {!loading && error && (
            <div className="rank-state rank-error" role="alert">
              <p>{error}</p>
              <button type="button" className="rank-retry" onClick={reload}>
                <ArrowClockwise size={16} aria-hidden="true" />
                {t.retry}
              </button>
            </div>
          )}

          {!loading && !error && mode === 'league' && zoneGroups.length > 0 && (
            <div className="rank-zones">
              {zoneGroups.map((group) => (
                <LeagueZoneSection
                  key={group.zone}
                  group={group}
                  tier={tier}
                  currentUserId={user?.id}
                  youLabel={t.rankYouBadge}
                  lang={lang}
                />
              ))}
            </div>
          )}

          {!loading && !error && mode === 'career' && entries.length > 0 && (
            <section className="rank-career-list" aria-label={t.rankCareerTitle}>
              <ol className="rank-list">
                {entries.map((entry) => (
                  <RankingRow
                    key={entry.userId}
                    entry={entry}
                    isMe={entry.userId === user?.id}
                    mode="career"
                    youLabel={t.rankYouBadge}
                    lang={lang}
                  />
                ))}
              </ol>
            </section>
          )}

          {!loading && !error && entries.length === 0 && (
            <div className="rank-empty">
              <p>{mode === 'league' ? t.rankLeagueEmpty : t.rankCareerEmpty}</p>
              {mode === 'league' && onStartStudying && (
                <button type="button" className="rank-retry" onClick={onStartStudying}>
                  {t.rankUnrankedCta}
                </button>
              )}
            </div>
          )}
        </section>

        {!loading && !error && (
          <footer className="rank-footer">
            {t.rankShowing(entries.length, entries.length)}
          </footer>
        )}
      </div>
    </div>
  )
}
