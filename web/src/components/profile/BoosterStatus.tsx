import { Coins, Lightning } from '@phosphor-icons/react'
import { useI18n } from '../../i18n'
import type { BoosterStock } from '../../types/gamification'

/** Active consumables live here instead of a status line in the Gara shop.
 *  Streak shields already show on the sidebar profile card, so they are not repeated. */
export function BoosterStatus({ boosters }: { boosters: BoosterStock | undefined }) {
  const { t, lang } = useI18n()
  const rc = boosters?.rc_multipliers ?? 0
  const xpMs = boosters?.xp_multiplier_ms_left ?? 0
  const until = boosters?.xp_multiplier_until
    ? new Date(boosters.xp_multiplier_until).toLocaleTimeString(lang === 'vi' ? 'vi-VN' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit',
    })
    : ''

  if (rc === 0 && xpMs <= 0) {
    return null
  }

  return (
    <section className="profile-boosters" aria-label={t.boosterPanelTitle}>
      {rc > 0 && (
        <div className="booster-item">
          <span className="booster-item-icon is-rc" aria-hidden="true"><Coins size={20} weight="fill" /></span>
          <div>
            <strong>{t.boosterRcTitle} <em>×{rc}</em></strong>
            <p>{t.boosterRcDesc}</p>
          </div>
        </div>
      )}
      {xpMs > 0 && (
        <div className="booster-item">
          <span className="booster-item-icon is-xp" aria-hidden="true"><Lightning size={20} weight="fill" /></span>
          <div>
            <strong>{t.boosterXpTitle}</strong>
            <p>{t.boosterXpDesc}</p>
            <small>
              {t.boosterMinutes(Math.ceil(xpMs / 60000))}
              {until && ` · ${t.boosterUntil(until)}`}
            </small>
          </div>
        </div>
      )}
    </section>
  )
}
