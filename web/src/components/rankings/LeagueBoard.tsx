import { ArrowDown, ArrowRight, ArrowUp } from '@phosphor-icons/react'
import { useI18n } from '../../i18n'
import type { RankingEntry } from '../../types/community'
import { previewBoard } from '../../utils/leaderboardPreview'
import { formatCompact } from '../../utils/format'
import { AvatarFrame } from '../cosmetics/AvatarFrame'
import { Nameplate } from '../cosmetics/Nameplate'
import { tierLabel } from '../../utils/leagueLabels'

export interface LeagueBoardProps {
  entries: RankingEntry[]
  myUserId?: number
  tier: string | null | undefined
  /** Jump to the study roadmap, offered when the learner has not scored yet. */
  onStartStudying?: () => void
}

const RANK_MEDAL: Record<number, string> = { 1: 'is-gold', 2: 'is-silver', 3: 'is-bronze' }

function PersonRow({ entry, isMe }: { entry: RankingEntry; isMe: boolean }) {
  const { t } = useI18n()
  const rank = entry.rank
  return (
    <li className={`league-row${isMe ? ' is-you' : ''}`} data-rank={rank}>
      <span className={`league-rank ${RANK_MEDAL[rank] ?? ''}`}>{rank}</span>
      <AvatarFrame
        name={entry.name}
        visualKey={entry.frame_key ?? null}
        style={entry.frame_style ?? null}
        size={34}
      />
      <span className="league-name">
        <Nameplate
          visualKey={entry.nameplate_key ?? null}
          style={entry.nameplate_style ?? null}
          dense
        >
          {entry.name}
          {isMe && <em>{t.you}</em>}
        </Nameplate>
      </span>
      <span className="league-rp">
        {formatCompact(entry.race_points ?? 0)}
        <i>RP</i>
      </span>
    </li>
  )
}

function BoardSection({
  kind,
  title,
  hint,
  entries,
  myUserId,
}: {
  kind: 'top' | 'bottom'
  title: string
  hint: string
  entries: RankingEntry[]
  myUserId?: number
}) {
  const Icon = kind === 'top' ? ArrowUp : ArrowDown
  return (
    <section className={`league-section is-${kind}`}>
      <header className="league-section-head">
        <span className="league-section-icon"><Icon size={13} weight="bold" /></span>
        <h3>{title}</h3>
        <span className="league-section-hint">{hint}</span>
      </header>
      <ol className="league-list">
        {entries.map((entry) => (
          <PersonRow key={entry.userId} entry={entry} isMe={entry.userId === myUserId} />
        ))}
      </ol>
    </section>
  )
}

function UnrankedBanner({
  tierName,
  onStartStudying,
}: {
  tierName: string
  onStartStudying?: () => void
}) {
  const { t } = useI18n()
  return (
    <div className="league-unranked">
      <div className="league-unranked-copy">
        <strong>{t.rankUnrankedTitle(tierName)}</strong>
        <p>{t.rankUnrankedBody}</p>
      </div>
      {onStartStudying && (
        <button type="button" className="league-unranked-cta" onClick={onStartStudying}>
          {t.rankUnrankedCta}
          <ArrowRight size={15} weight="bold" />
        </button>
      )}
    </div>
  )
}

/**
 * One quiet board: the six learners you can climb past and the six you must
 * stay ahead of, with everything between reduced to a single line. No zone
 * legends, progress bars or status columns — just rank, name and points.
 */
export function LeagueBoard({ entries, myUserId, tier, onStartStudying }: LeagueBoardProps) {
  const { t } = useI18n()
  const { top, bottom, hiddenCount, me, meInMiddle } = previewBoard(entries, myUserId)
  const isRanked = myUserId !== undefined && me !== null
  // The two labels stay honest at the ladder ends: diamond has nothing to
  // climb toward, bronze has nothing to fall out of.
  const topHint = tier === 'diamond' ? t.leagueStatusTop : t.leagueStatusPromote
  const bottomHint = tier === 'bronze' ? t.leagueStatusStay : t.leagueStatusDemote

  return (
    <div className="league-board">
      {!isRanked && myUserId !== undefined && (
        <UnrankedBanner tierName={tierLabel(t, tier)} onStartStudying={onStartStudying} />
      )}

      <BoardSection
        kind="top"
        title={t.leagueTopTitle}
        hint={topHint}
        entries={top}
        myUserId={myUserId}
      />

      {hiddenCount > 0 && (
        <div className="league-middle">
          <span className="league-middle-line" aria-hidden="true" />
          <span className="league-middle-pill">
            {meInMiddle ? t.leagueYouMiddle : t.leagueMiddle(hiddenCount)}
          </span>
          <span className="league-middle-line" aria-hidden="true" />
          {meInMiddle && me && (
            <div className="league-middle-you">
              <PersonRow entry={me} isMe />
            </div>
          )}
        </div>
      )}

      <BoardSection
        kind="bottom"
        title={t.leagueBottomTitle}
        hint={bottomHint}
        entries={bottom}
        myUserId={myUserId}
      />
    </div>
  )
}
