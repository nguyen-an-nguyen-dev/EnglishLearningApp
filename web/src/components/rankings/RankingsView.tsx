import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { ArrowClockwise, ArrowDown, ArrowRight, ArrowUp, Clock, Crosshair, Medal, Minus, ShieldCheck, Trophy } from '@phosphor-icons/react'
import { useAuth } from '../../context/AuthContext'
import { useWallet } from '../../context/WalletContext'
import { useI18n } from '../../i18n'
import { LoadingDots } from '../LoadingDots'
import { getRankingApi } from '../../services/communityService'
import type { RankingBoard, RankingEntry } from '../../types/community'
import { formatCompact } from '../../utils/format'
import { nameplateSkin } from '../../cosmetics'
import { AvatarFrame } from '../cosmetics/AvatarFrame'
import { Nameplate } from '../cosmetics/Nameplate'
import {
  DEFAULT_LEAGUE_RULES,
  asLeagueTier,
  demotionCount,
  leagueZone,
  promotionCount,
  type LeagueRules,
  type LeagueZone,
} from '../../utils/league'
import { tierLabel } from '../../utils/leagueLabels'
import { LeagueLadder } from './LeagueLadder'

/** Re-renders once a minute while a season is running, so the clock stays true. */
function useSeasonClock(enabled: boolean): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!enabled) return
    const timer = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(timer)
  }, [enabled])
  return now
}

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
  if (hours >= 24) return t.leagueTimeLeftDays(Math.floor(hours / 24), hours % 24)
  if (hours >= 1) return t.leagueTimeLeftHours(hours)
  return t.leagueTimeLeftMinutes(Math.max(1, Math.ceil(remaining / 60_000)))
}

const PODIUM_MEDAL: Record<1 | 2 | 3, string> = { 1: 'is-gold', 2: 'is-silver', 3: 'is-bronze' }

/**
 * The equipped nameplate doubles as the card's own backdrop: `skin.bg` is a
 * ready-made scenic plate and `skin.fg` the text colour that reads on it.
 * Plain plates fall back to a quiet tier-tinted gradient.
 */
function plateStyle(entry: RankingEntry): { className: string; style?: CSSProperties } {
  const skin = nameplateSkin(entry.nameplate_key ?? null, entry.nameplate_style ?? null)
  // No plate equipped: a quiet tier-tinted gradient keeps every card dressed
  // without shouting over the people who bought real scenery.
  if (skin.bg === 'transparent') return { className: ' has-default' }
  return {
    className: ' has-plate',
    style: {
      background: skin.bg,
      borderColor: skin.edge ?? undefined,
      '--plate-fg': skin.fg ?? '#F3FAFF',
    } as CSSProperties,
  }
}

function PodiumCard({
  entry,
  place,
  isMe,
  cardRef,
}: {
  entry: RankingEntry
  place: 1 | 2 | 3
  isMe: boolean
  cardRef?: React.Ref<HTMLElement>
}) {
  const plate = plateStyle(entry)
  return (
    <article
      ref={cardRef}
      tabIndex={isMe ? -1 : undefined}
      className={`podium-card ${PODIUM_MEDAL[place]}${plate.className}${isMe ? ' is-me' : ''}`}
      style={plate.style}
      data-rank={entry.rank}
      aria-label={`${entry.name}, #${entry.rank}`}
    >
      <span className="podium-rank">
        <Medal size={26} weight="fill" aria-hidden="true" />
        <b>{entry.rank}</b>
      </span>
      <AvatarFrame
        name={entry.name}
        visualKey={entry.frame_key ?? null}
        style={entry.frame_style ?? null}
        size={64}
      />
      {plate.className ? (
        <span className="podium-name" title={entry.name}>{entry.name}</span>
      ) : (
        <Nameplate
          visualKey={entry.nameplate_key ?? null}
          style={entry.nameplate_style ?? null}
          dense
        >
          <span className="podium-name" title={entry.name}>{entry.name}</span>
        </Nameplate>
      )}
      <p className="podium-score">
        {formatCompact(entry.race_points ?? 0)}
        <small>RP</small>
      </p>
    </article>
  )
}

function PersonRow({ entry, isMe, zone, rowRef }: { entry: RankingEntry; isMe: boolean; zone: LeagueZone; rowRef?: React.Ref<HTMLLIElement> }) {
  const plate = plateStyle(entry)
  return (
    <li
      ref={rowRef}
      tabIndex={isMe ? -1 : undefined}
      className={`league-row${plate.className}${isMe ? ' is-me' : ''}`}
      style={plate.style}
      data-rank={entry.rank}
      data-zone={zone}
    >
      <span className="league-rank">
        <span>{entry.rank}</span>
      </span>
      <AvatarFrame
        name={entry.name}
        visualKey={entry.frame_key ?? null}
        style={entry.frame_style ?? null}
        size={38}
      />
      <span className="league-person">
        {plate.className ? (
          <span className="league-name" title={entry.name}>{entry.name}</span>
        ) : (
          <Nameplate
            visualKey={entry.nameplate_key ?? null}
            style={entry.nameplate_style ?? null}
            dense
          >
            <span className="league-name" title={entry.name}>{entry.name}</span>
          </Nameplate>
        )}
      </span>
      <span className="league-score">
        {formatCompact(entry.race_points ?? 0)}
        <small>RP</small>
      </span>
    </li>
  )
}

interface GoalState {
  tone: 'promote' | 'safe' | 'danger'
  title: string
  detail: string
  /** 0–100 fill of the meter. */
  pct: number
}

const clampPct = (value: number) => Math.max(0, Math.min(100, Math.round(value)))

function ZoneBand({ zone, from, to }: { zone: LeagueZone; from: number; to: number }) {
  const { t } = useI18n()
  const label = zone === 'promote'
    ? t.rankZonePromote(from, to)
    : zone === 'demote'
      ? t.rankZoneDemote(from, to)
      : t.rankZoneStay(from, to)
  const Icon = zone === 'promote' ? ArrowUp : zone === 'demote' ? ArrowDown : Minus
  return (
    <h2 className={`league-zone is-${zone}`}>
      <Icon size={13} weight="bold" aria-hidden="true" />
      <span>{label}</span>
    </h2>
  )
}

interface Band {
  zone: LeagueZone
  entries: RankingEntry[]
}

/**
 * One board for the week's league: the ore ladder on top, a podium for the top
 * three, the learner's weekly goal with a live RP meter, then zone-banded rows.
 */
export function RankingsView({ onStartStudying }: { onStartStudying?: () => void }) {
  const { t } = useI18n()
  const { user } = useAuth()
  const { league } = useWallet()
  const [board, setBoard] = useState<RankingBoard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const myPodium = useRef<HTMLElement>(null)
  const myRow = useRef<HTMLLIElement>(null)

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

  const entries = useMemo(() => board?.league ?? [], [board])
  const total = entries.length
  const myRank = board?.current_user_league_rank ?? null
  const currentTier = asLeagueTier(board?.league_tier ?? league?.tier)
  const rules: LeagueRules = board?.league_rules ?? DEFAULT_LEAGUE_RULES
  const leader = entries[0]
  const myEntry = entries.find((entry) => entry.userId === user?.id)
  const myScore = myEntry?.race_points ?? 0
  const promoteSlots = total > 0
    ? promotionCount(total, currentTier, rules)
    : currentTier === 'diamond' ? 0 : rules.promotion_slots
  const demoteSlots = demotionCount(total, currentTier, rules)

  const endsAt = league?.season?.ends_at ?? null
  const now = useSeasonClock(Boolean(endsAt))
  const timeLeft = timeLeftLabel(t, endsAt, now)

  const goal = useMemo<GoalState | null>(() => {
    if (!myEntry || myRank === null || total === 0) return null
    const score = myEntry.race_points ?? 0
    const detail = t.rankGoalDetail(myRank, formatCompact(score))
    const zone = leagueZone(myRank, total, currentTier, rules)
    const leaderScore = Math.max(1, leader?.race_points ?? score)

    if (zone === 'demote' && demoteSlots > 0) {
      const safeScore = entries[Math.max(0, total - demoteSlots - 1)]?.race_points ?? 0
      const need = Math.max(1, safeScore - score + 1)
      return {
        tone: 'danger',
        title: currentTier === 'diamond' ? t.rankRpToSafety(need) : t.rankRpToEscapeDemote(need),
        detail,
        pct: safeScore > 0 ? clampPct((score / safeScore) * 100) : 0,
      }
    }

    if (zone === 'promote') {
      return {
        tone: 'safe',
        title: t.rankInPromoteZone,
        detail,
        pct: clampPct((score / leaderScore) * 100),
      }
    }

    // Diamond's safe zone has no promotion left to chase — no goal to show.
    if (promoteSlots === 0) return null

    const boundary = entries[Math.min(promoteSlots, total) - 1]
    const boundaryScore = boundary?.race_points ?? 0
    const need = Math.max(1, boundaryScore - score)
    return {
      tone: 'promote',
      title: t.rankRpToPromote(need, promoteSlots),
      detail,
      pct: boundaryScore > 0 ? clampPct((score / boundaryScore) * 100) : 0,
    }
  }, [myEntry, myRank, total, currentTier, rules, demoteSlots, promoteSlots, leader, entries, t])

  const restEntries = useMemo(() => entries.slice(3), [entries])

  // Zone labels span the whole board — including the podium — so "#1–#6"
  // stays truthful even though ranks 1–3 render as cards, not list rows.
  const zoneSpans = useMemo(() => {
    const spans = new Map<LeagueZone, { from: number; to: number }>()
    for (const entry of entries) {
      const zone = leagueZone(entry.rank, total, currentTier, rules)
      const span = spans.get(zone)
      if (span) span.to = entry.rank
      else spans.set(zone, { from: entry.rank, to: entry.rank })
    }
    return spans
  }, [entries, total, currentTier, rules])

  const restBands = useMemo<Band[]>(() => {
    const result: Band[] = []
    for (const entry of restEntries) {
      const zone = leagueZone(entry.rank, total, currentTier, rules)
      const last = result[result.length - 1]
      if (last && last.zone === zone) last.entries.push(entry)
      else result.push({ zone, entries: [entry] })
    }
    return result
  }, [restEntries, total, currentTier, rules])
  const isRanked = myRank !== null
  const jumpToMe = () => {
    const target = myPodium.current ?? myRow.current
    target?.focus({ preventScroll: true })
    target?.scrollIntoView({ block: 'center' })
  }

  return (
    <div
      className="tab-view-container rank-view"
      data-board="league"
      data-my-rank={myRank ?? ''}
      data-total-users={total}
      data-my-score={myScore}
      data-leader-name={leader?.name ?? ''}
      data-leader-score={leader?.race_points ?? 0}
      data-league-tier={currentTier}
      data-board-ready={String(!loading && !error)}
    >
      <div className="league-board" data-league-tier={currentTier}>
        <header className="league-header">
          <LeagueLadder tier={currentTier} />
          <h1>{t.rankLeagueName(tierLabel(t, currentTier))}</h1>
          <p>{currentTier === 'diamond' ? t.rankDiamondHint : t.rankPromoteHint(promoteSlots)}</p>
          {timeLeft && <div className="league-clock"><Clock size={17} weight="bold" aria-hidden="true" />{timeLeft}</div>}
        </header>

        {loading && (
          <div className="rank-state">
            <LoadingDots label={t.rankLoading} />
          </div>
        )}

        {!loading && error && (
          <div className="rank-state">
            <p>{error}</p>
            <button type="button" className="arena-link" onClick={reload}>
              <ArrowClockwise size={15} /> {t.retry}
            </button>
          </div>
        )}

        {!loading && !error && (
          <>
            {!isRanked && total > 0 && (
              <div className="league-unranked">
                <div className="league-unranked-copy">
                  <strong>{t.rankUnrankedTitle(tierLabel(t, currentTier))}</strong>
                  <p>{t.rankUnrankedBody}</p>
                </div>
                {onStartStudying && (
                  <button type="button" className="league-unranked-cta" onClick={onStartStudying}>
                    {t.rankUnrankedCta}
                    <ArrowRight size={15} weight="bold" />
                  </button>
                )}
              </div>
            )}

            {total === 0 ? (
              <div className="rank-state is-league-empty">
                <Trophy size={28} weight="regular" />
                <p>{t.rankLeagueEmpty}</p>
                {onStartStudying && (
                  <button type="button" className="league-unranked-cta" onClick={onStartStudying}>
                    {t.rankUnrankedCta}
                    <ArrowRight size={15} weight="bold" />
                  </button>
                )}
              </div>
            ) : (
              <>
                {goal && (
                  <section className={`league-goal is-${goal.tone}`} aria-live="polite">
                    {goal.tone === 'safe'
                      ? <ShieldCheck size={22} weight="bold" aria-hidden="true" />
                      : <ArrowUp size={22} weight="bold" aria-hidden="true" />}
                    <div className="league-goal-copy">
                      <strong>{goal.title}</strong>
                      <span>{goal.detail}</span>
                    </div>
                    <div
                      className="league-goal-meter"
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={goal.pct}
                      aria-label={goal.title}
                    >
                      <span style={{ width: `${goal.pct}%` }} />
                    </div>
                  </section>
                )}

                <section className="league-podium" aria-label={t.rankTopThree}>
                  <h2 className="league-podium-title">{t.rankTopThree}</h2>
                  <div className="league-podium-cards">
                    {[0, 1, 2].map((index) => {
                      const entry = entries[index]
                      const place = (index + 1) as 1 | 2 | 3
                      return entry ? (
                        <PodiumCard
                          key={entry.userId}
                          entry={entry}
                          place={place}
                          isMe={entry === myEntry}
                          cardRef={entry === myEntry ? myPodium : undefined}
                        />
                      ) : (
                        <div key={`empty-${place}`} className="podium-card is-empty" aria-hidden="true" />
                      )
                    })}
                  </div>
                </section>

                <div className="league-board-meta">
                  <p>{t.rankParticipants(total)}</p>
                  {myEntry && (
                    <button type="button" className="league-jump" onClick={jumpToMe}>
                      <Crosshair size={17} weight="bold" aria-hidden="true" />
                      {t.rankJumpToMe(myEntry.rank)}
                    </button>
                  )}
                </div>

                {restBands.length > 0 && (
                  <div className="league-standings">
                    {restBands.map(({ zone, entries: members }) => {
                      const span = zoneSpans.get(zone) ?? { from: members[0].rank, to: members[members.length - 1].rank }
                      return (
                        <section key={zone}>
                          <ZoneBand zone={zone} from={span.from} to={span.to} />
                          <ol className="league-list" role="list" start={members[0].rank}>
                            {members.map((entry) => (
                              <PersonRow
                                key={entry.userId}
                                entry={entry}
                                isMe={entry === myEntry}
                                zone={zone}
                                rowRef={entry === myEntry ? myRow : undefined}
                              />
                            ))}
                          </ol>
                        </section>
                      )
                    })}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
