import { Check } from '@phosphor-icons/react'
import { useWallet } from '../../context/WalletContext'
import { useI18n } from '../../i18n'
import { buildStreakWeek } from '../../utils/streakWeek'
import { StreakShieldArt } from '../StreakShieldArt'
import { StreakFlame } from './StreakFlame'

/**
 * Compact streak readout for the sidebar profile card: the mascot flame, the
 * running count, and this week's days. It reads `last_activity_days_ago` from
 * the wallet so the strip starts on the last active day instead of assuming
 * every day up to today was kept.
 */
export function StreakSummary({ compact = false }: { compact?: boolean }) {
  const { wallet } = useWallet()
  const { t, lang } = useI18n()
  if (!wallet) return null

  const shields = wallet.boosters.streak_shields
  const weekdays = lang === 'vi'
    ? ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']
    : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const days = buildStreakWeek({
    streak: wallet.streak,
    lastActivityDaysAgo: wallet.last_activity_days_ago,
    today: new Date(),
    labels: weekdays,
  })

  const lost = wallet.streak_lost_recent && wallet.streak_lost_at
    ? t.streakLostNotice(
      wallet.streak_lost,
      new Date(wallet.streak_lost_at).toLocaleDateString(
        lang === 'vi' ? 'vi-VN' : 'en-US',
        { day: 'numeric', month: 'numeric' },
      ),
    )
    : ''
  const summary = [
    t.streakCurrent(wallet.streak),
    shields > 0 ? t.streakShields(shields) : t.streakNoShield,
    lost,
  ].filter(Boolean).join(' · ')

  const stateLabel: Record<(typeof days)[number]['state'], string> = {
    done: t.streakDayDone,
    pending: t.streakDayPending,
    missed: t.streakDayMissed,
    upcoming: t.streakDayUpcoming,
  }
  const weekLabel = `${t.streakWeekLabel}: ${days.map((day) => `${day.label} ${stateLabel[day.state]}`).join(', ')}`

  return (
    <span className={`streak-summary${compact ? ' is-compact' : ''}`} title={summary}>
      <span className="sr-only">{summary}</span>
      <span className="streak-summary-line" aria-hidden="true">
        <StreakFlame
          size={compact ? 18 : 22}
          active={wallet.streak > 0}
          className={shields > 0 ? 'is-shielded' : ''}
        />
        <strong>{wallet.streak}</strong>
        {!compact && <span className="streak-summary-days">{t.streakDaysLabel}</span>}
        {!compact && shields > 0 && (
          <span className="streak-shields" title={t.streakShields(shields)}>
            <StreakShieldArt size={22} />
            <b>{shields}</b>
          </span>
        )}
      </span>

      {!compact && (
        <span className="streak-week" role="img" aria-label={weekLabel}>
          {days.map((day) => (
            <span className="streak-week-day" key={day.label}>
              <i className={`streak-week-dot is-${day.state}${day.isToday ? ' is-today' : ''}`}>
                {day.state === 'done' && <Check size={11} weight="bold" />}
              </i>
              <small>{day.label}</small>
            </span>
          ))}
        </span>
      )}

      {!compact && lost && <small className="streak-summary-loss">{lost}</small>}
    </span>
  )
}
