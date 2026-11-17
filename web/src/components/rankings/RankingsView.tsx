import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { ArrowClockwise, Crown, Trophy } from '@phosphor-icons/react'
import { useAuth } from '../../context/AuthContext'
import { useWallet } from '../../context/WalletContext'
import { useI18n } from '../../i18n'
import { LoadingDots } from '../LoadingDots'
import { getRankingApi } from '../../services/communityService'
import type { RankingBoard, RankingEntry } from '../../types/community'
import { AvatarFrame } from '../cosmetics/AvatarFrame'
import { Nameplate } from '../cosmetics/Nameplate'
import { tierMeta } from '../../cosmetics'
import { formatCompact } from '../../utils/format'

const VISIBLE_ROWS = 20
const HUE_COUNT = 5

type Board = 'league' | 'career'

/** A stable hue per learner so the board reads as a crowd, not a spreadsheet. */
function hueOf(name: string): number {
  let hash = 0
  for (let index = 0; index < name.length; index += 1) {
    hash = (hash * 31 + name.charCodeAt(index)) >>> 0
  }
  return hash % HUE_COUNT
}

function hueVars(name: string): CSSProperties {
  return { '--hue': `var(--rank-hue-${hueOf(name)})` } as CSSProperties
}

/** League rows are scored on Race Points; career rows on XP. */
function scoreOf(entry: RankingEntry, board: Board): number {
  return board === 'league' ? entry.race_points ?? 0 : entry.xp
}

function PodiumStep({
  entry,
  place,
  isMe,
  board,
}: {
  entry: RankingEntry
  place: 1 | 2 | 3
  isMe: boolean
  board: Board
}) {
  const { t } = useI18n()
  const tier = tierMeta(entry.tier)
  return (
    <li className={`rank-step is-${place}${isMe ? ' is-you' : ''}`} style={hueVars(entry.name)}>
      <span className="rank-step-avatar">
        {place === 1 && board === 'league'
          ? <Crown size={20} weight="fill" />
          : <AvatarFrame name={entry.name} visualKey={entry.frame_key ?? null} size={place === 1 ? 62 : 52} />}
      </span>
      <Nameplate visualKey={entry.nameplate_key ?? null} dense>
        {entry.name}
        {isMe && <em>{t.you}</em>}
      </Nameplate>
      <span className="rank-step-xp">
        {formatCompact(scoreOf(entry, board))}
        <i>{board === 'league' ? 'RP' : 'XP'}</i>
      </span>
      {board === 'league' && <span className="rank-tier" style={{ color: tier.color }}>{tier.label}</span>}
      <span className="rank-step-base" aria-hidden="true">{place}</span>
    </li>
  )
}

function Lane({ entry, isMe, share, board }: { entry: RankingEntry; isMe: boolean; share: number; board: Board }) {
  const { t } = useI18n()
  const tier = tierMeta(entry.tier)
  return (
    <li
      className={`rank-row${isMe ? ' is-you' : ''}`}
      style={{ ...hueVars(entry.name), '--share': `${share}%` } as CSSProperties}
    >
      <span className="rank-index">{String(entry.rank).padStart(2, '0')}</span>
      <AvatarFrame name={entry.name} visualKey={entry.frame_key ?? null} size={38} />
      <Nameplate visualKey={entry.nameplate_key ?? null} dense>
        {entry.name}
        {isMe && <em>{t.you}</em>}
      </Nameplate>
      <span className="rank-bar" aria-hidden="true"><i /></span>
      {board === 'league' && <span className="rank-tier" style={{ color: tier.color }}>{tier.label}</span>}
      <span className="rank-xp">
        {formatCompact(scoreOf(entry, board))}<i>{board === 'league' ? 'RP' : 'XP'}</i>
      </span>
    </li>
  )
}

export function RankingsView() {
  const { t } = useI18n()
  const { user } = useAuth()
  const { league } = useWallet()
  const [board, setBoard] = useState<RankingBoard | null>(null)
  const [tab, setTab] = useState<Board>('league')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

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

  const isLeague = tab === 'league'
  const entries = useMemo(
    () => (isLeague ? board?.league ?? [] : board?.leaderboard ?? []),
    [board, isLeague],
  )
  const leader = entries[0]
  const myRank = isLeague ? board?.current_user_league_rank ?? null : board?.current_user_rank ?? null
  const me = useMemo(() => entries.find((entry) => entry.userId === user?.id), [entries, user?.id])
  const third = entries[2]
  const gapToTop3 = third && me ? Math.max(0, scoreOf(third, tab) - scoreOf(me, tab)) : null
  const podium = entries.slice(0, 3)
  const rest = useMemo(() => {
    if (entries.length <= VISIBLE_ROWS) return entries.slice(3)
    const tail = entries.slice(3, VISIBLE_ROWS)
    if (me && me.rank > VISIBLE_ROWS) tail.push(me)
    return tail
  }, [entries, me])

  const share = (value: number) => (leader && scoreOf(leader, tab) > 0 ? Math.round((value / scoreOf(leader, tab)) * 100) : 0)
  const myIndex = entries.findIndex((entry) => entry.userId === user?.id)
  const above = myIndex > 0 ? entries[myIndex - 1] : null
  const below = myIndex >= 0 && myIndex < entries.length - 1 ? entries[myIndex + 1] : null
  const tier = tierMeta(league?.tier)

  return (
    <div
      className="tab-view-container rank-view"
      data-board={tab}
      data-my-rank={myRank ?? ''}
      data-total-users={entries.length}
      data-my-score={me ? scoreOf(me, tab) : 0}
      data-leader-name={leader?.name ?? ''}
      data-leader-score={leader ? scoreOf(leader, tab) : 0}
      data-above-name={above?.name ?? ''}
      data-above-rank={above?.rank ?? ''}
      data-below-name={below?.name ?? ''}
      data-below-rank={below?.rank ?? ''}
    >
      <header className="page-heading rank-head">
        <div>
          <span className="page-eyebrow">{isLeague ? t.rankLeagueEyebrow : t.rankEyebrow}</span>
          <h1>{isLeague ? t.rankLeagueTitle : t.rankTitle}</h1>
          <p>{isLeague ? t.rankLeagueDesc : t.rankDesc}</p>
        </div>
        {isLeague && league?.season && (
          <div className="rank-season">
            <span className="arena-label">{league.season.code}</span>
            <strong style={{ color: tier.color }}>{tier.label}</strong>
            <span className="rank-season-rp">{formatCompact(league.race_points)} RP</span>
          </div>
        )}
      </header>

      <nav className="rank-tabs" aria-label={t.rankTitle}>
        <button
          type="button"
          className={`rank-tab${isLeague ? ' is-active' : ''}`}
          onClick={() => setTab('league')}
        >
          {t.rankLeagueTab}
        </button>
        <button
          type="button"
          className={`rank-tab${!isLeague ? ' is-active' : ''}`}
          onClick={() => setTab('career')}
        >
          {t.rankCareerTab}
        </button>
      </nav>

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

      {!loading && !error && entries.length === 0 && (
        <div className="rank-state">
          <Trophy size={30} weight="regular" />
          <p>{isLeague ? t.rankLeagueEmpty : t.rankEmpty}</p>
        </div>
      )}

      {!loading && !error && entries.length > 0 && (
        <>
          <ol className="rank-podium" aria-label={t.rankTop}>
            {podium[1] && <PodiumStep entry={podium[1]} place={2} isMe={podium[1].userId === user?.id} board={tab} />}
            {podium[0] && <PodiumStep entry={podium[0]} place={1} isMe={podium[0].userId === user?.id} board={tab} />}
            {podium[2] && <PodiumStep entry={podium[2]} place={3} isMe={podium[2].userId === user?.id} board={tab} />}
          </ol>

          <section className="rank-you" aria-label={t.rankStanding}>
            <div className="rank-you-rank">
              <span className="arena-label">{t.rankStanding}</span>
              <strong>{myRank ? `#${myRank}` : '—'}</strong>
              <span className="rank-you-total">{t.rankOutOf(entries.length)}</span>
            </div>
            <dl className="rank-facts">
              <div>
                <dt>{isLeague ? t.rankRacePoints : t.rankXp}</dt>
                <dd>{formatCompact(me ? scoreOf(me, tab) : 0)}</dd>
              </div>
              <div>
                <dt>{t.rankGapTop3}</dt>
                <dd>{gapToTop3 === null ? '—' : gapToTop3 === 0 ? t.rankReached : `${formatCompact(gapToTop3)} ${isLeague ? 'RP' : 'XP'}`}</dd>
              </div>
              <div>
                <dt>{t.rankTop}</dt>
                <dd className="is-name">{leader?.name ?? '—'}</dd>
              </div>
            </dl>
          </section>

          {rest.length > 0 && (
            <ol className="rank-board">
              {rest.map((entry) => (
                <Lane
                  key={entry.userId}
                  entry={entry}
                  isMe={entry.userId === user?.id}
                  share={share(scoreOf(entry, tab))}
                  board={tab}
                />
              ))}
            </ol>
          )}
        </>
      )}
    </div>
  )
}
