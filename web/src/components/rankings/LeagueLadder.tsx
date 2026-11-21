import { useI18n } from '../../i18n'
import { LEAGUE_TIERS, tierIndex } from '../../utils/league'
import { tierLabel } from '../../utils/leagueLabels'
import { OreCrest } from './OreCrest'

/**
 * The whole ladder in one strip: every ore from coal to diamond. Tiers up to and
 * including the learner's own are lit, the rest dimmed; the current tier is larger.
 */
export function LeagueLadder({ tier }: { tier: string | null | undefined }) {
  const { t } = useI18n()
  const current = tierIndex(tier)

  return (
    <div className="lad" role="list" aria-label={t.rankLadderAria}>
      {LEAGUE_TIERS.map((key, index) => {
        const isCurrent = index === current
        return (
          <span key={key} className={`lad-item${isCurrent ? ' is-current' : ''}`} role="listitem" aria-current={isCurrent ? 'true' : undefined}>
            <OreCrest
              tier={key}
              locked={index > current}
              className={isCurrent ? 'is-current' : undefined}
            />
            <span className={isCurrent ? 'lad-name is-current' : 'lad-name'}>
              {tierLabel(t, key)}
            </span>
          </span>
        )
      })}
    </div>
  )
}
