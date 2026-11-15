import { useState } from 'react'
import { CheckCircle, Fire, Flag } from '@phosphor-icons/react'
import { useWallet } from '../../context/WalletContext'
import { formatCompact } from '../../utils/format'
import type { Quest } from '../../types/gamification'

/**
 * Daily + weekly missions with a claim button. This is the income floor that
 * keeps a learner earning while they work toward the 100%-to-complete rule.
 */
export function RewardCenter() {
  const { rewards, claimQuest } = useWallet()
  const [busyCode, setBusyCode] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (!rewards) {
    return (
      <section className="reward-center">
        <div className="reward-loading">
          <span className="video-spinner" aria-hidden="true" />
          <p>Đang tải nhiệm vụ...</p>
        </div>
      </section>
    )
  }

  async function claim(code: string) {
    setError(null)
    setBusyCode(code)
    try {
      await claimQuest(code)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không nhận được thưởng.')
    } finally {
      setBusyCode(null)
    }
  }

  return (
    <section className="reward-center">
      <header className="reward-head">
        <div>
          <span className="page-eyebrow">NHIỆM VỤ</span>
          <h2>Trung tâm phần thưởng</h2>
          <p>Hoàn thành nhiệm vụ để nhận Race Coin, XP và điểm đua cho league tuần.</p>
        </div>
        <div className="reward-streak" title="Chuỗi ngày học liên tiếp">
          <Fire size={18} weight="fill" />
          <strong>{rewards.streak}</strong>
          <span>ngày</span>
        </div>
      </header>

      {error && <p className="arena-error">{error}</p>}

      <div className="reward-columns">
        <QuestColumn title="Nhiệm vụ ngày" quests={rewards.daily} busyCode={busyCode} onClaim={claim} />
        <QuestColumn title="Nhiệm vụ tuần" quests={rewards.weekly} busyCode={busyCode} onClaim={claim} />
      </div>
    </section>
  )
}

function QuestColumn({
  title,
  quests,
  busyCode,
  onClaim,
}: {
  title: string
  quests: Quest[]
  busyCode: string | null
  onClaim: (code: string) => void
}) {
  return (
    <div className="reward-column">
      <span className="arena-label">{title}</span>
      <ul className="quest-list">
        {quests.map((quest) => (
          <QuestRow key={quest.code} quest={quest} busyCode={busyCode} onClaim={onClaim} />
        ))}
      </ul>
    </div>
  )
}

function QuestRow({
  quest,
  busyCode,
  onClaim,
}: {
  quest: Quest
  busyCode: string | null
  onClaim: (code: string) => void
}) {
  const percent = quest.target > 0 ? Math.min(100, Math.round((quest.progress / quest.target) * 100)) : 0
  const busy = busyCode === quest.code

  return (
    <li className={`quest-row${quest.claimable ? ' is-claimable' : ''}${quest.claimed ? ' is-claimed' : ''}`}>
      <div className="quest-main">
        <strong>{quest.title}</strong>
        <p>{quest.description}</p>
        <div className="quest-meter" role="img" aria-label={`${quest.progress}/${quest.target}`}>
          <span style={{ width: `${percent}%` }} />
        </div>
      </div>

      <div className="quest-side">
        <span className="quest-count">{quest.progress}/{quest.target}</span>
        <span className="quest-reward">
          <Flag size={12} weight="fill" /> +{formatCompact(quest.rc_reward)} RC
        </span>
        {quest.claimed ? (
          <span className="quest-done"><CheckCircle size={15} weight="fill" /> Đã nhận</span>
        ) : (
          <button
            type="button"
            className="quest-claim"
            disabled={!quest.claimable || busy}
            onClick={() => onClaim(quest.code)}
          >
            {busy ? '...' : 'Nhận'}
          </button>
        )}
      </div>
    </li>
  )
}
