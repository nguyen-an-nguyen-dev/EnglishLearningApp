import { useEffect, useState } from 'react'
import { ArrowClockwise, ArrowRight, Trophy } from '@phosphor-icons/react'
import { useAuth } from '../../context/AuthContext'
import { useWallet } from '../../context/WalletContext'
import { useI18n } from '../../i18n'
import { LoadingDots } from '../LoadingDots'
import { getRankingApi } from '../../services/communityService'
import type { RankingBoard } from '../../types/community'
import { LeagueBoard } from './LeagueBoard'
import { LeagueHero } from './LeagueHero'

/**
 * One board only: this week's league. The view shows the six learners you can
 * climb past and the six you must stay ahead of, with a single quiet line for
 * everyone in between. There is no all-time leaderboard to switch to.
 */
export function RankingsView({ onStartStudying }: { onStartStudying?: () => void }) {
  const { t } = useI18n()
  const { user } = useAuth()
  const { league } = useWallet()
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

  const entries = board?.league ?? []
  const myRank = board?.current_user_league_rank ?? null
  const currentTier = board?.league_tier ?? league?.tier ?? 'bronze'
  const leader = entries[0]

  return (
    <div
      className="tab-view-container rank-view"
      data-board="league"
      data-my-rank={myRank ?? ''}
      data-total-users={entries.length}
      data-my-score={board?.league?.find((entry) => entry.userId === user?.id)?.race_points ?? 0}
      data-leader-name={leader?.name ?? ''}
      data-leader-score={leader?.race_points ?? 0}
      data-league-tier={currentTier}
    >
      <header className="page-heading rank-head">
        <h1>{t.rankLeagueTitle}</h1>
        <p>{t.rankLeagueDesc}</p>
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
        <div className="rank-card">
          <LeagueHero
            tier={currentTier}
            season={league?.season ?? null}
            racePoints={league?.race_points ?? 0}
            myRank={myRank}
            total={entries.length}
          />
          {entries.length === 0 ? (
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
            <LeagueBoard
              entries={entries}
              myUserId={user?.id}
              tier={currentTier}
              onStartStudying={onStartStudying}
            />
          )}
        </div>
      )}
    </div>
  )
}
