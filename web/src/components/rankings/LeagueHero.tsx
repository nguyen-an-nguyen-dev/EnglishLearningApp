import { useEffect, useState } from 'react'
import { Clock } from '@phosphor-icons/react'
import { useI18n } from '../../i18n'
import { formatCompact } from '../../utils/format'
import { tierLabel, tierTagline } from '../../utils/leagueLabels'
import { LeagueCrest } from './LeagueCrest'

export interface LeagueSeason {
  code: string
  starts_at: string
  ends_at: string
}

export interface LeagueHeroProps {
  tier: string | null | undefined
  season: LeagueSeason | null
  racePoints: number
  myRank: number | null
  total: number
}

function useMinuteClock(enabled: boolean): number {
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
  const remaining = Math.max(0, new Date(endsAt).getTime() - now)
  const hours = Math.floor(remaining / 3_600_000)
  if (hours >= 24) return t.leagueTimeLeftDays(Math.floor(hours / 24), hours % 24)
  if (hours >= 1) return t.leagueTimeLeftHours(hours)
  return t.leagueTimeLeftMinutes(Math.max(1, Math.ceil(remaining / 60_000)))
}

/** A single quiet banner: your tier, your standing and the weekly clock. */
export function LeagueHero({ tier, season, racePoints, myRank, total }: LeagueHeroProps) {
  const { t } = useI18n()
  const now = useMinuteClock(Boolean(season))
  const endsLabel = timeLeftLabel(t, season?.ends_at ?? null, now)

  return (
    <section className="league-hero" data-league-tier={tier ?? 'bronze'}>
      <LeagueCrest tier={tier} size={54} className="league-hero-crest" />
      <div className="league-hero-copy">
        <h2>{tierLabel(t, tier)}</h2>
        <p>{tierTagline(t, tier)}</p>
        {endsLabel && (
          <span className="league-hero-clock">
            <Clock size={12} weight="bold" /> {endsLabel}
          </span>
        )}
      </div>
      <dl className="league-hero-stats">
        <div>
          <dt>{t.leagueYourRank}</dt>
          <dd>{myRank ? `#${myRank}` : '—'}<small>{t.rankOutOf(total)}</small></dd>
        </div>
        <div>
          <dt>{t.leagueWeeklyRp}</dt>
          <dd>{formatCompact(racePoints)}<i>RP</i></dd>
        </div>
      </dl>
    </section>
  )
}
