import { useMemo, useState } from 'react'
import { Lock } from '@phosphor-icons/react'
import { StreakShieldArt } from '../StreakShieldArt'
import { CosmeticPreview } from './CosmeticPreview'
import { TurboMascot } from '../cosmetics/TurboMascot'
import { nameplateSkin } from '../../cosmetics'
import { useWallet } from '../../context/WalletContext'
import { useI18n } from '../../i18n'
import { tierLabel } from '../../utils/leagueLabels'
import { formatCompact } from '../../utils/format'
import { LoadingDots } from '../LoadingDots'
import type { ShopItem, ShopSlot } from '../../types/gamification'

type GaraTab = 'all' | ShopSlot

const TABS: { id: GaraTab; label: string }[] = [
  { id: 'all', label: 'Tất cả' },
  { id: 'car', label: 'Xe' },
  { id: 'frame', label: 'Khung avatar' },
  { id: 'nameplate', label: 'Nền' },
  { id: 'booster', label: 'Vật phẩm' },
]

const RARITY_LABEL: Record<string, string> = {
  common: 'Cơ bản',
  rare: 'Hiếm',
  epic: 'Sử thi',
  legendary: 'Huyền thoại',
}

/** Booster art: original SVG shield plus x2 glyphs for the multipliers. */
function BoosterGlyph({ visualKey, kind }: { visualKey: string; kind?: string | null }) {
  const effect = kind ?? (
    visualKey === 'booster_shield' ? 'streak_shield'
      : visualKey === 'booster_xp' ? 'xp_multiplier'
        : visualKey === 'booster_rc' ? 'rc_multiplier'
          : null
  )
  if (effect === 'streak_shield') {
    return (
      <span className="gara-booster-glyph" aria-hidden="true">
        <StreakShieldArt />
      </span>
    )
  }
  if (effect === 'xp_multiplier') {
    return (
      <span className="gara-booster-glyph" aria-hidden="true">
        <b>x2</b>
        <small>XP</small>
      </span>
    )
  }
  if (effect === 'rc_multiplier') {
    return (
      <span className="gara-booster-glyph is-rc" aria-hidden="true">
        <b>x2</b>
        <small>RC</small>
      </span>
    )
  }
  return (
    <span className="gara-booster-glyph is-starter" aria-hidden="true">
      <StreakShieldArt />
    </span>
  )
}

/** Scenic thumbnail for the Nền section; same art the equipped block paints. */
function NameplateArt({ visualKey, style }: { visualKey: string; style?: Record<string, string | null> | null }) {
  const skin = nameplateSkin(visualKey, style)
  return <span className="gara-scenic-art" style={{ backgroundImage: skin.art }} aria-hidden="true" />
}

function GaraArt({ item }: { item: ShopItem }) {
  if (item.slot === 'booster') return <BoosterGlyph visualKey={item.visual_key} kind={item.booster_kind} />
  if (item.slot === 'nameplate') return <NameplateArt visualKey={item.visual_key} style={item.style} />
  return <CosmeticPreview slot={item.slot} visualKey={item.visual_key} style={item.style} sampleName={item.name} size={150} />
}

function GaraCard({
  item,
  coins,
  busy,
  onPurchase,
  onEquip,
  onUnequip,
}: {
  item: ShopItem
  coins: number
  busy: boolean
  onPurchase: (id: number) => void
  onEquip: (id: number) => void
  onUnequip: (slot: ShopSlot) => void
}) {
  const free = item.price === 0
  const affordable = coins >= item.price
  const isBooster = item.slot === 'booster'
  // A booster is never "owned": it holds charges or a running timer.
  const held = isBooster && (item.charges > 0 || Boolean(item.active_until))
  // Owned cosmetics must stay actionable (wear / take off); only price gates a buy.
  const blocked = !item.unlocked || (isBooster ? !affordable : !item.owned && !affordable)

  const priceLabel = !item.unlocked
    ? (item.unlock_label || 'Đang khoá')
    : !isBooster && item.owned
      ? 'Đã sở hữu'
      : free
        ? 'Miễn phí'
        : `${formatCompact(item.price)} RC`

  const actionLabel = !item.unlocked
    ? 'Unlock'
    : isBooster
      ? affordable ? 'Mua' : `Thiếu ${formatCompact(item.price - coins)} RC`
      : item.equipped
        ? 'Bỏ dùng'
        : item.owned
          ? 'Trang bị'
          : affordable
            ? free ? 'Nhận' : 'Mua'
            : `Thiếu ${formatCompact(item.price - coins)} RC`

  return (
    <li className={`gara-v2-card is-${item.slot === 'booster' ? 'booster' : item.rarity}${item.equipped ? ' is-worn' : ''}${!item.unlocked ? ' is-locked' : ''}`}>
      <div className={`gara-v2-art${item.slot === 'nameplate' ? ' is-scenic' : ''}${item.slot === 'car' ? ' is-car' : ''}${item.slot === 'frame' ? ' is-frame' : ''}`}>
        <span className="gara-v2-rarity">{isBooster ? 'Vật phẩm' : RARITY_LABEL[item.rarity] ?? 'Cơ bản'}</span>
        <GaraArt item={item} />
        {!item.unlocked && (
          <span className="gara-v2-lock" aria-hidden="true">
            <Lock size={14} weight="bold" />
          </span>
        )}
        {item.equipped && <span className="gara-v2-worn">Đang dùng</span>}
        {isBooster && item.charges > 0 && <span className="gara-v2-charges">×{item.charges}</span>}
        {isBooster && item.active_until && item.charges === 0 && <span className="gara-v2-charges">Đang chạy</span>}
      </div>

      <div className="gara-v2-body">
        <h3>{item.name}</h3>
        <p>{item.description}</p>
        <div className={`gara-v2-price${!item.unlocked ? ' is-locked' : ''}`}>
          {!item.unlocked ? (
            <Lock size={13} weight="bold" aria-hidden="true" />
          ) : (!isBooster && item.owned) ? null : free ? null : (
            <i className="gc-coin" aria-hidden="true" />
          )}
          <span>{priceLabel}</span>
        </div>
        <div className="gara-v2-foot">
          <button
            type="button"
            className={`gc-btn ${blocked ? 'is-disabled' : isBooster || (!item.owned && !free) ? 'is-accent' : 'is-quiet'}`}
            disabled={busy || blocked}
            onClick={() => {
              if (isBooster) onPurchase(item.id)
              else if (item.equipped) onUnequip(item.slot)
              else if (item.owned) onEquip(item.id)
              else onPurchase(item.id)
            }}
          >
            {busy ? 'Đang xử lý...' : actionLabel}
          </button>
          {held && item.charges > 0 && <p className="gara-v2-hint">Đang giữ {item.charges} lượt</p>}
        </div>
      </div>
    </li>
  )
}

/** Gara Engorace - the shop. One vertical flow: header pills, the stall banner with Bác Turbo, the tab strip, then one section per slot. Balance and level show as read-only pills. */
export function GaraShop() {
  const { t } = useI18n()
  const { shop, wallet, loading, purchase, equip, unequip } = useWallet()
  const [tab, setTab] = useState<GaraTab>('all')
  const [busyId, setBusyId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Which stall question Bác Turbo is answering; null shows his greeting.
  const [faq, setFaq] = useState<'streak' | 'rc' | null>(null)

  const coins = wallet?.coins ?? 0
  const level = wallet?.level ?? 1

  const sections = useMemo(() => {
    const wanted: ShopSlot[] = tab === 'all' ? ['car', 'frame', 'nameplate', 'booster'] : [tab]
    return wanted.map((slot) => {
      // The plain plate is only a fallback, never a shop choice: it cannot be
      // unequipped, so listing it just leaves a dead "Bỏ dùng" card behind.
      const items = shop
        .filter((item) => item.slot === slot && !(slot === 'nameplate' && item.unlock_type === 'default'))
        .sort((a, b) => a.id - b.id)
      const owned = slot === 'booster'
        ? items.filter((item) => item.charges > 0 || item.active_until).length
        : items.filter((item) => item.owned).length
      return { slot, items, owned }
    }).filter((entry) => entry.items.length > 0)
  }, [shop, tab])

  const equippedLine = useMemo(() => {
    const eq = wallet?.equipment
    return [eq?.car?.name, eq?.frame?.name, eq?.nameplate?.name].filter(Boolean).join(' · ')
  }, [wallet])

  async function run(id: number, action: () => Promise<void>) {
    setBusyId(id)
    setError(null)
    try {
      await action()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thực hiện được.')
    } finally {
      setBusyId(null)
    }
  }

  const sectionTitle: Record<ShopSlot, string> = {
    car: 'Xe',
    frame: 'Khung avatar',
    nameplate: 'Nền',
    booster: 'Vật phẩm hỗ trợ',
  }

  return (
    <div className="tab-view-container gara-v2">
      <header className="gara-v2-head">
        <div>
          <h1>Gara Engorace</h1>
          <p>Tiêu Race Coin để mở xe, khung avatar, nền và vật phẩm hỗ trợ.</p>
        </div>
        <div className="gara-v2-pills">
          <span className="gc-pill">
            <i className="gc-coin" aria-hidden="true" />
            {formatCompact(coins)} RC
          </span>
          <span className="gc-pill">
            Cấp {level}
            <small>{wallet?.level_progress.xp_to_next_level !== null
              ? `${wallet?.level_progress.xp_to_next_level} XP tới cấp ${level + 1}`
              : 'Cấp tối đa'}</small>
          </span>
          <span className="gc-pill">
            {wallet?.tier ? tierLabel(t, wallet.tier) : t.tierUnranked}
          </span>
        </div>
      </header>

      <section className="gara-stall">
        <div className="gara-stall-awning" aria-hidden="true" />

        {/* The showroom bay is deliberately bare: one garage doorway on the
            left and the equipped car rolling out of it. No lamp, checkered
            floor or other scenery — the gate and the car are the whole scene. */}
        <div className="gara-bay" aria-hidden="true">
          <div className="gara-bay-stage">
            <div className="gara-bay-interior" aria-hidden="true" />
            <span className="gara-bay-door-rail" aria-hidden="true" />
            <span className="gara-bay-door">
              <i className="gara-bay-door-shutter" />
            </span>
            <div className="gara-bay-car">
              <CosmeticPreview
                slot="car"
                visualKey={wallet?.equipment.car?.visual_key ?? 'car_classic_yellow'}
              />
            </div>
          </div>
        </div>

        <div className="gara-stall-speech">
          <div className="gara-bubble-slot">
            <div className="gara-bubble" aria-live="polite">
              <span className="gara-bubble-name">Bác Turbo</span>
              {/* The answer replaces the greeting inside the bubble, so the
                  questions below never open a second panel under themselves. */}
              <div className="gara-bubble-msg" id="gara-faq-answer" key={faq ?? 'intro'}>
                {faq === 'streak' ? (
                  <>
                    <p>
                      Thẻ Bảo vệ chuỗi giữ nguyên chuỗi của bạn khi thua một trận.
                      Mỗi thẻ dùng một lần — cần thì mua ở mục Vật phẩm nha!
                    </p>
                    <p className="gara-bubble-note">
                      Đừng tiếc thẻ khi chuỗi đang dài: mất chuỗi là mất luôn cả
                      đà học đấy.
                    </p>
                  </>
                ) : faq === 'rc' ? (
                  <>
                    <p className="gara-bubble-lead">Không cần nhiệm vụ — RC trả thẳng:</p>
                    <ul className="gara-bubble-rc">
                      <li><span>Hoàn thành bài</span><strong>+15 RC</strong></li>
                      <li><span>Xong cả chặng</span><strong>+40 RC</strong></li>
                      <li><span>Mỗi video nghe</span><strong>+10 RC</strong></li>
                      <li><span>Thắng trận đấu</span><strong>+20 RC</strong></li>
                      <li><span>Thua vẫn có</span><strong>+8 RC</strong></li>
                      <li><span>Huy hiệu mới</span><strong>+25 RC</strong></li>
                    </ul>
                    <p className="gara-bubble-note">
                      Tối đa 5 trận/ngày; thưởng bài chỉ trả một lần.
                    </p>
                  </>
                ) : (
                  <p>
                    Ê, tay đua! Hàng mới về đủ cả: xe, khung avatar, nền, còn có thẻ Bảo vệ chuỗi nữa.
                    Thua một trận mà mất chuỗi thì tiếc lắm đó nha!
                  </p>
                )}
              </div>
            </div>
          </div>
          <div className="gara-faq">
            <button
              type="button"
              className={`gc-btn is-quiet${faq === 'streak' ? ' is-answering' : ''}`}
              aria-expanded={faq === 'streak'}
              aria-controls="gara-faq-answer"
              onClick={() => setFaq((current) => current === 'streak' ? null : 'streak')}
            >
              {faq === 'streak' ? '▾' : '▸'} Bảo vệ chuỗi là gì vậy bác?
            </button>
            <button
              type="button"
              className={`gc-btn is-quiet${faq === 'rc' ? ' is-answering' : ''}`}
              aria-expanded={faq === 'rc'}
              aria-controls="gara-faq-answer"
              onClick={() => setFaq((current) => current === 'rc' ? null : 'rc')}
            >
              {faq === 'rc' ? '▾' : '▸'} Làm sao kiếm thêm RC?
            </button>
          </div>
        </div>

        {/* Turbo stands behind the counter: his torso runs past the stall’s bottom edge and the counter board paints over it. */}
        <div className="gara-stall-mascot">
          <TurboMascot />
        </div>

        <div className="gara-stall-counter" aria-hidden="true">
          <span>Quầy hàng · Trả bằng Race Coin</span>
          <span>Bác Turbo · Chủ gara</span>
        </div>
      </section>

      <nav className="gara-v2-tabs" aria-label="Loại vật phẩm">
        {TABS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            className={`gc-btn ${tab === entry.id ? 'is-accent' : 'is-quiet'}`}
            onClick={() => setTab(entry.id)}
          >
            {entry.label}
          </button>
        ))}
        {equippedLine && <span className="gara-v2-tabs-note">Đang dùng: <strong>{equippedLine}</strong></span>}
      </nav>

      {error && <p className="gara-v2-error">{error}</p>}

      {loading && shop.length === 0 ? (
        <div className="shop-state">
          <LoadingDots label="Đang mở gara..." />
        </div>
      ) : (
        sections.map((section) => (
          <section className="gara-v2-section" key={section.slot}>
            <div className="gara-v2-section-head">
              <h2>{sectionTitle[section.slot]}</h2>
              <span className="gara-v2-count">
                {section.owned}/{section.items.length} đã sở hữu
              </span>
              {section.slot === 'booster' && <p>Dùng một lần · mua lại bất cứ lúc nào</p>}
            </div>
            <ul className="gara-v2-grid">
              {section.items.map((item) => (
                <GaraCard
                  key={item.id}
                  item={item}
                  coins={coins}
                  busy={busyId === item.id}
                  onPurchase={(id) => void run(id, () => purchase(id))}
                  onEquip={(id) => void run(id, () => equip(id))}
                  onUnequip={(slot) => void run(item.id, () => unequip(slot))}
                />
              ))}
            </ul>
          </section>
        ))
      )}

    </div>
  )
}
