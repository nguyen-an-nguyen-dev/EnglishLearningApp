import { useEffect, useMemo, useState } from 'react'
import { Medal, ShieldCheck, SignOut, Storefront } from '@phosphor-icons/react'
import { AccountActions } from '../AccountActions'
import { useAuth } from '../../context/AuthContext'
import { useLearning } from '../../context/LearningContext'
import { useWallet } from '../../context/WalletContext'
import { useI18n } from '../../i18n'
import { getMyBadgesApi } from '../../services/communityService'
import { flattenLessons } from '../../roadmap'
import type { EarnedBadge } from '../../types/community'
import { AvatarFrame } from '../cosmetics/AvatarFrame'
import { Nameplate } from '../cosmetics/Nameplate'
import { CosmeticPreview } from '../shop/CosmeticPreview'
import { formatCompact } from '../../utils/format'

type StageState = 'done' | 'current' | 'locked'

export function ProfileView({ onLogout, onOpenShop }: { onLogout: () => void; onOpenShop?: () => void }) {
  const { t } = useI18n()
  const { user } = useAuth()
  const { stages, loading } = useLearning()
  const { wallet } = useWallet()
  const [badges, setBadges] = useState<EarnedBadge[]>([])

  useEffect(() => {
    let cancelled = false
    getMyBadgesApi()
      .then((earned) => {
        if (!cancelled) setBadges(earned)
      })
      .catch(() => {
        /* badges are decorative — a failed request must not break the profile */
      })
    return () => { cancelled = true }
  }, [])

  const lessons = useMemo(() => flattenLessons(stages), [stages])
  const done = lessons.filter((lesson) => lesson.status === 'done').length
  const percent = lessons.length > 0 ? Math.round((done / lessons.length) * 100) : 0
  const currentStage = stages.find((stage) => stage.lessons.some((lesson) => lesson.status === 'current'))
    ?? stages.find((stage) => stage.completedCount < stage.totalCount)
    ?? stages[0]
  const displayName = user?.name || 'An Nguyễn'
  const streak = user?.streak ?? 0
  const xp = user?.xp ?? 0
  const coins = wallet?.coins ?? user?.coins ?? 0
  const level = wallet?.level ?? user?.level ?? 1
  const equipment = wallet?.equipment

  function stageState(index: number): StageState {
    const stage = stages[index]
    if (!stage) return 'locked'
    if (stage.totalCount > 0 && stage.completedCount === stage.totalCount) return 'done'
    if (stage.lessons.some((lesson) => lesson.status === 'current')) return 'current'
    return 'locked'
  }

  const stateLabel: Record<StageState, string> = {
    done: t.statusDone,
    current: t.statusCurrent,
    locked: t.statusLocked,
  }

  return (
    <div
      className="tab-view-container profile-view"
      data-user-name={displayName}
      data-user-email={user?.email || ''}
      data-user-xp={xp}
      data-user-streak={streak}
      data-lessons-done={done}
      data-lessons-total={lessons.length}
      data-progress-percent={percent}
      data-current-stage={currentStage?.title || ''}
      data-badges-count={badges.length}
      data-user-coins={coins}
      data-user-level={level}
    >
      <header className="page-heading">
        <span className="page-eyebrow">{t.profileEyebrow}</span>
        <h1>{t.profileTitle}</h1>
        <p>{t.profileDesc}</p>
      </header>

      <div className="profile-grid">
        <section className="profile-identity">
          <div className="profile-identity-head">
            <AvatarFrame name={displayName} visualKey={equipment?.frame?.visual_key ?? null} size={64} />
            <div className="profile-identity-copy">
              <h2>
                <Nameplate visualKey={equipment?.nameplate?.visual_key ?? null}>{displayName}</Nameplate>
              </h2>
              <p>{user?.email}</p>
              <span className="profile-role">
                <ShieldCheck size={15} weight="regular" />
                {t.activeLearner}
              </span>
            </div>
          </div>

          {/* Wallet card: balance and career level in one block, matching the
              reference. The sidebar no longer repeats these. */}
          <button
            type="button"
            className={`profile-wallet-card${onOpenShop ? ' is-clickable' : ''}`}
            onClick={onOpenShop}
            disabled={!onOpenShop}
            aria-label={`${formatCompact(coins)} Race Coin. ${t.walletLevel} ${level}. ${formatCompact(wallet?.level_progress.xp_to_next_level ?? 0)} XP ${t.walletLevelNext}`}
          >
            <span className="profile-wallet-top">
              <span className="profile-wallet-amount">
                <i className="profile-wallet-coin" aria-hidden="true" />
                <strong>{formatCompact(coins)}</strong>
                <span>RC</span>
              </span>
              <span className="profile-wallet-level">{t.walletLevel} {level}</span>
            </span>
            <span className="profile-wallet-meter" aria-hidden="true">
              <span style={{ width: `${Math.round((wallet?.level_progress.progress_ratio ?? 0) * 100)}%` }} />
            </span>
            <span className="profile-wallet-hint">
              {wallet?.level_progress.xp_to_next_level !== null && wallet?.level_progress.xp_to_next_level !== undefined
                ? `${formatCompact(wallet.level_progress.xp_to_next_level)} XP ${t.walletLevelNext}`
                : t.walletLevelMax}
            </span>
          </button>

          <dl className="profile-numbers">
            <div>
              <dd>{streak}</dd>
              <dt>{t.statStreakLabel}</dt>
            </div>
            <div>
              <dd>{formatCompact(xp)}</dd>
              <dt>{t.statXpLabel}</dt>
            </div>
            <div>
              <dd>{loading ? '...' : `${done}/${lessons.length}`}</dd>
              <dt>{t.statLessonsLabel}</dt>
            </div>
          </dl>

          {equipment && (
            <section className="profile-loadout">
              <header>
                <span className="arena-label">Trang bị đang dùng</span>
                {onOpenShop && (
                  <button type="button" className="profile-shop-link" onClick={onOpenShop}>
                    <Storefront size={14} weight="bold" /> Mở Gara
                  </button>
                )}
              </header>
              {/* Visual previews live here now that the Gara tab is shop-only. */}
              <div className="profile-loadout-row">
                <div className="profile-loadout-slot">
                  <CosmeticPreview slot="car" visualKey={equipment.car?.visual_key ?? 'car_classic_yellow'} size={84} />
                  <small>{equipment.car?.name ?? 'Xe mặc định'}</small>
                </div>
                <div className="profile-loadout-slot">
                  <AvatarFrame name={displayName} visualKey={equipment.frame?.visual_key ?? null} size={52} />
                  <small>{equipment.frame?.name ?? 'Khung mặc định'}</small>
                </div>
                <div className="profile-loadout-slot">
                  <Nameplate visualKey={equipment.nameplate?.visual_key ?? null}>Engorace</Nameplate>
                  <small>{equipment.nameplate?.name ?? 'Biển tên mặc định'}</small>
                </div>
                <div className="profile-loadout-slot">
                  <strong className="profile-loadout-count">{wallet?.owned_count ?? 0}</strong>
                  <small>vật phẩm đã sở hữu</small>
                </div>
              </div>
            </section>
          )}

          <section className="profile-path">
            <header>
              <div>
                <span className="arena-label">{t.pathKicker}</span>
                <h3>{t.pathTitle(currentStage?.sortOrder ?? 1, percent)}</h3>
              </div>
              <strong>{percent}%</strong>
            </header>

            <div className="profile-meter" role="img" aria-label={t.pathAria(percent)}>
              <span style={{ width: `${percent}%` }} />
            </div>

            <ol className="profile-stages">
              {stages.map((stage, index) => {
                const state = stageState(index)
                return (
                  <li className={`profile-stage is-${state}`} key={stage.id}>
                    <span className="profile-stage-index">{String(index + 1).padStart(2, '0')}</span>
                    <span className="profile-stage-name">{stage.title}</span>
                    <span className="profile-stage-count">
                      {t.pathTotal(stage.completedCount, stage.totalCount)}
                    </span>
                    <span className="profile-stage-state">{stateLabel[state]}</span>
                  </li>
                )
              })}
            </ol>
          </section>

          <section className="profile-badges">
            <span className="arena-label">{t.badgesTitle}</span>
            {badges.length > 0 ? (
              <ul>
                {badges.map((badge) => (
                  <li key={badge.code}>
                    <Medal size={15} weight="regular" />
                    <span>{badge.name}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p>{t.badgesEmpty}</p>
            )}
          </section>
        </section>

        <aside className="profile-account">
          <h3>{t.accountOptions}</h3>
          <AccountActions user={user} />
          <p className="profile-tip">
            <strong>{t.tipTitle}</strong>
            {t.tipBody(streak)}
          </p>
          <button type="button" className="profile-logout" onClick={onLogout}>
            <SignOut size={16} weight="bold" />
            <span>{t.logoutShort}</span>
          </button>
        </aside>
      </div>
    </div>
  )
}
