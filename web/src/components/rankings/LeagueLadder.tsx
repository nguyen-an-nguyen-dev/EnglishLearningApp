import { useI18n } from '../../i18n'
import { LEAGUE_TIERS, tierIndex } from '../../utils/league'
import { tierLabel } from '../../utils/leagueLabels'
import { OreCrest } from './OreCrest'

/** The learner's current ore is lifted and bright; future leagues stay locked. */
export function LeagueLadder({ tier }: { tier: string | null | undefined }) {
  const { t } = useI18n()
  const current = tierIndex(tier)

  return (
    <div className="lad ores" role="list" aria-label={t.rankLadderAria}>
      {LEAGUE_TIERS.map((key, index) => {
        const isCurrent = index === current
        const isLocked = index > current
        return (
          <span
            key={key}
            className={'tr' + (isCurrent ? ' cur' : '') + (isLocked ? ' lk' : '')}
            role="listitem"
            aria-current={isCurrent ? 'true' : undefined}
          >
            <OreCrest
              tier={key}
              locked={isLocked}
              className={isCurrent ? 'is-current' : undefined}
            />
            <span>{tierLabel(t, key)}</span>
          </span>
        )
      })}
    </div>
  )
}
