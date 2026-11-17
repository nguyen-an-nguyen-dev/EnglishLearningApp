import { useMemo, useState } from 'react'
import { Lock } from '@phosphor-icons/react'
import { CosmeticPreview } from './CosmeticPreview'
import { TurboMascot } from '../cosmetics/TurboMascot'
import { nameplateSkin } from '../../cosmetics'
import { useWallet } from '../../context/WalletContext'
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

/** Booster art: a shield for the streak card, a "x2" orb for the multipliers. */
function BoosterGlyph({ visualKey }: { visualKey: string }) {
  if (visualKey === 'booster_shield') {
    return (
      <span className="gara-booster-glyph" aria-hidden="true">
        <svg viewBox="0 0 64 64" width="52" height="52">
          <path d="M32 4l24 8v18c0 16-10 26-24 30C18 56 8 46 8 30V12z" fill="#38c98a" stroke="#14203a" strokeWidth="4" strokeLinejoin="round" />
          <path d="M32 20c6 8 10 12 10 18a10 10 0 0 1-20 0c0-6 4-8 5-14 3 2 4 4 5 6 0-4 0-7 0-10z" fill="#ffd23f" stroke="#14203a" strokeWidth="3" strokeLinejoin="round" />
        </svg>
      </span>
    )
  }
  if (visualKey === 'booster_xp') {
    return (
      <span className="gara-booster-glyph" aria-hidden="true">
        <b>x2</b>
        <small>XP</small>
      </span>
    )
  }
  if (visualKey === 'booster_rc') {
    return (
      <span className="gara-booster-glyph is-rc" aria-hidden="true">
        <b>x2</b>
        <small>RC</small>
      </span>
    )
  }
  return (
    <span className="gara-booster-glyph is-starter" aria-hidden="true">
      <svg viewBox="0 0 64 64" width="52" height="52">
        <path d="M32 4l24 8v18c0 16-10 26-24 30C18 56 8 46 8 30V12z" fill="#38c98a" stroke="#14203a" strokeWidth="4" strokeLinejoin="round" />
        <path d="M32 20c6 8 10 12 10 18a10 10 0 0 1-20 0c0-6 4-8 5-14 3 2 4 4 5 6 0-4 0-7 0-10z" fill="#ffd23f" stroke="#14203a" strokeWidth="3" strokeLinejoin="round" />
      </svg>
    </span>
  )
}

/** Scenic thumbnail for the Nền section; same art the equipped block paints. */
function NameplateArt({ visualKey }: { visualKey: string }) {
  const skin = nameplateSkin(visualKey)
  return <span className="gara-scenic-art" style={{ backgroundImage: skin.art }} aria-hidden="true" />
}

function GaraArt({ item }: { item: ShopItem }) {
  if (item.slot === 'booster') return <BoosterGlyph visualKey={item.visual_key} />
  if (item.slot === 'nameplate') return <NameplateArt visualKey={item.visual_key} />
  return <CosmeticPreview slot={item.slot} visualKey={item.visual_key} sampleName={item.name} size={104} />
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
    ? 'Đang khoá'
    : !isBooster && item.owned
      ? 'Đã sở hữu'
      : free
        ? 'Miễn phí'
        : `${formatCompact(item.price)} RC`

  const actionLabel = !item.unlocked
    ? 'Chưa mở khoá'
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
    <li className={`gara-v2-card is-${item.slot === 'booster' ? 'booster' : item.rarity}${item.equipped ? ' is-worn' : ''}`}>
      <div className={`gara-v2-art${item.slot === 'nameplate' ? ' is-scenic' : ''}${item.slot === 'car' ? ' is-car' : ''}`}>
        <span className="gara-v2-rarity">{isBooster ? 'Vật phẩm' : RARITY_LABEL[item.rarity] ?? 'Cơ bản'}</span>
        <GaraArt item={item} />
        {!item.unlocked && (
          <span className="gara-v2-lock">
            <Lock size={14} weight="bold" /> {item.unlock_label || 'Đang khoá'}
          </span>
        )}
        {item.equipped && <span className="gara-v2-worn">Đang dùng</span>}
        {isBooster && item.charges > 0 && <span className="gara-v2-charges">×{item.charges}</span>}
        {isBooster && item.active_until && item.charges === 0 && <span className="gara-v2-charges">Đang chạy</span>}
      </div>

      <div className="gara-v2-body">
        <h3>{item.name}</h3>
        <p>{item.description}</p>
        <div className="gara-v2-price">
          {!item.unlocked || (!isBooster && item.owned) ? null : free ? null : <i className="gc-coin" aria-hidden="true" />}
          <span className={!item.unlocked ? 'is-locked' : ''}>{priceLabel}</span>
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

/**
 * Gara Engorace — the shop from the design reference.
 *
 * One vertical flow: header pills (balance/level/tier + "kiếm thêm RC"), the
 * stall banner with Bác Turbo, the tab strip, then one section per slot with an
 * owned counter, consumables last. Balance and level appear here as pills (the
 * reference does) but stay read-only; buying still happens on the cards.
 */
export function GaraShop() {
  const { shop, wallet, loading, purchase, equip, unequip } = useWallet()
  const [tab, setTab] = useState<GaraTab>('all')
  const [busyId, setBusyId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  // The RC guide replaces the old quest board: income is explained where a
  // learner wonders about it, and the numbers are the backend's own.
  const [rcGuide, setRcGuide] = useState(false)

  const coins = wallet?.coins ?? 0
  const level = wallet?.level ?? 1
  const boosters = wallet?.boosters

  const sections = useMemo(() => {
    const wanted: ShopSlot[] = tab === 'all' ? ['car', 'frame', 'nameplate', 'booster'] : [tab]
    return wanted.map((slot) => {
      const items = shop.filter((item) => item.slot === slot).sort((a, b) => a.id - b.id)
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
            {wallet?.tier === 'bronze' ? 'Hạng Đồng'
              : wallet?.tier === 'silver' ? 'Hạng Bạc'
                : wallet?.tier === 'gold' ? 'Hạng Vàng'
                  : wallet?.tier === 'diamond' ? 'Hạng Kim Cương' : 'Chưa xếp hạng'}
          </span>
        </div>
      </header>

      <section className="gara-stall">
        <div className="gara-stall-awning" aria-hidden="true">
          <b>GARA ENGORACE · MỞ CỬA</b>
        </div>

        {/* The showroom bay is deliberately bare: one garage doorway on the
            left and the equipped car rolling out of it. No lamp, checkered
            floor or other scenery — the gate and the car are the whole scene. */}
        <div className="gara-bay" aria-hidden="true">
          <div className="gara-bay-stage">
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
          <div className="gara-bubble">
            <span className="gara-bubble-name">Bác Turbo</span>
            <span>
              Ê, tay đua! Hàng mới về đủ cả: xe, khung avatar, nền, còn có thẻ Bảo vệ chuỗi nữa.
              Thua một trận mà mất chuỗi thì tiếc lắm đó nha!
            </span>
          </div>
          <div className="gara-faq">
            <button type="button" className="gc-btn is-quiet" onClick={() => setTab('booster')}>
              ▸ Bảo vệ chuỗi là gì vậy bác?
            </button>
            <button
              type="button"
              className="gc-btn is-quiet"
              aria-expanded={rcGuide}
              onClick={() => setRcGuide((open) => !open)}
            >
              {rcGuide ? '▾' : '▸'} Làm sao kiếm thêm RC?
            </button>          </div>

          {rcGuide && (
            <div className="gara-rc-guide">
              <p className="gara-rc-guide-title">Không cần nhiệm vụ — RC trả thẳng cho việc học:</p>
              <ul>
                <li><span>Hoàn thành một bài</span><strong>+15 RC</strong></li>
                <li><span>Xong cả một chặng</span><strong>+40 RC</strong></li>
                <li><span>Mỗi video luyện nghe</span><strong>+10 RC</strong></li>
                <li><span>Thắng một trận đấu</span><strong>+20 RC</strong></li>
                <li><span>Thua vẫn có</span><strong>+8 RC</strong></li>
                <li><span>Mỗi huy hiệu mới</span><strong>+25 RC</strong></li>
              </ul>
              <p className="gara-rc-guide-note">Đấu trường trả RC cho 5 trận đầu mỗi ngày; phần thưởng bài chỉ trả một lần.</p>
            </div>
          )}
        </div>

        {/* Turbo stands behind the counter: his torso runs past the stall's
            bottom edge and the counter board is painted over it, so he reads as
            the shopkeeper on duty rather than a sticker hovering in the air. */}
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

      {boosters && (boosters.streak_shields > 0 || boosters.rc_multipliers > 0 || boosters.xp_multiplier_ms_left > 0) && (
        <div className="arena-v2-boost">
          Đang có: {boosters.streak_shields} khiên · {boosters.rc_multipliers} thẻ x2 RC
          {boosters.xp_multiplier_ms_left > 0 ? ` · x2 XP còn ${Math.ceil(boosters.xp_multiplier_ms_left / 60000)} phút` : ''}
        </div>
      )}

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
