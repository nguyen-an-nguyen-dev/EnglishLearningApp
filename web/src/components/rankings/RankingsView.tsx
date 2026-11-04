import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { ArrowClockwise, Crown, Trophy } from '@phosphor-icons/react'
import { useAuth } from '../../context/AuthContext'
import { useI18n } from '../../i18n'
import { getRankingApi } from '../../services/communityService'
import type { RankingBoard, RankingEntry } from '../../types/community'
import { initialOf } from '../../utils/avatar'
import { formatCompact } from '../../utils/format'

const VISIBLE_ROWS = 20
const HUE_COUNT = 5

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

function PodiumStep({
  entry,
  place,
  isMe,
}: {
  entry: RankingEntry
  place: 1 | 2 | 3
  isMe: boolean
}) {
  const { t } = useI18n()
  return (
    <li className={`rank-step is-${place}${isMe ? ' is-you' : ''}`} style={hueVars(entry.name)}>
      <span className="rank-step-avatar" aria-hidden="true">
        {place === 1 ? <Crown size={20} weight="fill" /> : initialOf(entry.name)}
      </span>
      <span className="rank-step-name">
        {entry.name}
        {isMe && <em>{t.you}</em>}
      </span>
      <span className="rank-step-xp">
        {formatCompact(entry.xp)}<i>XP</i>
      </span>
      <span className="rank-step-base" aria-hidden="true">{place}</span>
    </li>
  )
}

function Lane({ entry, isMe, share }: { entry: RankingEntry; isMe: boolean; share: number }) {
  const { t } = useI18n()
  return (
    <li
      className={`rank-row${isMe ? ' is-you' : ''}`}
      style={{ ...hueVars(entry.name), '--share': `${share}%` } as CSSProperties}
    >
      <span className="rank-index">{String(entry.rank).padStart(2, '0')}</span>
      <span className="rank-avatar" aria-hidden="true">{initialOf(entry.name)}</span>
      <span className="rank-name">
        {entry.name}
        {isMe && <em>{t.you}</em>}
      </span>
      <span className="rank-bar" aria-hidden="true"><i /></span>
      <span className="rank-xp">
        {formatCompact(entry.xp)}<i>XP</i>
      </span>
    </li>
  )
}

export function RankingsView() {
  const { t } = useI18n()
  const { user } = useAuth()
  const [board, setBoard] = useState<RankingBoard | null>(null)
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

  const entries = useMemo(() => board?.leaderboard ?? [], [board])
  const leader = entries[0]
  const myRank = board?.current_user_rank ?? null
  const me = useMemo(() => entries.find((entry) => entry.userId === user?.id), [entries, user?.id])
  const third = entries[2]
  const gapToTop3 = third && me ? Math.max(0, third.xp - me.xp) : null
  const podium = entries.slice(0, 3)
  const rest = useMemo(() => {
    if (entries.length <= VISIBLE_ROWS) return entries.slice(3)
    const tail = entries.slice(3, VISIBLE_ROWS)
    if (me && me.rank > VISIBLE_ROWS) tail.push(me)
    return tail
  }, [entries, me])

  const share = (xp: number) => (leader && leader.xp > 0 ? Math.round((xp / leader.xp) * 100) : 0)

  return (
    <div className="tab-view-container rank-view">
      <header className="page-heading rank-head">
        <div>
          <span className="page-eyebrow">{t.rankEyebrow}</span>
          <h1>{t.rankTitle}</h1>
          <p>{t.rankDesc}</p>
        </div>
      </header>

      {loading && (
        <div className="rank-state">
          <span className="video-spinner" aria-hidden="true" />
          <p>{t.rankLoading}</p>
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
          <p>{t.rankEmpty}</p>
        </div>
      )}

      {!loading && !error && entries.length > 0 && (
        <>
          <ol className="rank-podium" aria-label={t.rankTop}>
            {podium[1] && <PodiumStep entry={podium[1]} place={2} isMe={podium[1].userId === user?.id} />}
            {podium[0] && <PodiumStep entry={podium[0]} place={1} isMe={podium[0].userId === user?.id} />}
            {podium[2] && <PodiumStep entry={podium[2]} place={3} isMe={podium[2].userId === user?.id} />}
          </ol>

          <section className="rank-you" aria-label={t.rankStanding}>
            <div className="rank-you-rank">
              <span className="arena-label">{t.rankStanding}</span>
              <strong>{myRank ? `#${myRank}` : '—'}</strong>
              <span className="rank-you-total">{t.rankOutOf(entries.length)}</span>
            </div>
            <dl className="rank-facts">
              <div>
                <dt>{t.rankXp}</dt>
                <dd>{formatCompact(me?.xp ?? user?.xp ?? 0)}</dd>
              </div>
              <div>
                <dt>{t.rankGapTop3}</dt>
                <dd>{gapToTop3 === null ? '—' : gapToTop3 === 0 ? t.rankReached : `${formatCompact(gapToTop3)} XP`}</dd>
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
                  share={share(entry.xp)}
                />
              ))}
            </ol>
          )}
        </>
      )}
    </div>
  )
}
