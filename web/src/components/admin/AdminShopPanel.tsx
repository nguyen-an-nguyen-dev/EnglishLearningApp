import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import {
  CheckCircle,
  PencilSimple,
  Plus,
  Storefront,
  Trash,
  WarningCircle,
  X,
} from '@phosphor-icons/react'
import { useI18n } from '../../i18n'
import {
  createAdminShopItemApi,
  deleteAdminShopItemApi,
  listAdminShopItemsApi,
  updateAdminShopItemApi,
} from '../../services/adminService'
import type {
  AdminBoosterKind,
  AdminShopItem,
  AdminShopRarity,
  AdminShopSlot,
  AdminShopUnlockType,
  ShopItemPayload,
} from '../../types/admin'
import {
  BOOSTER_KINDS,
  SHOP_RARITIES,
  SHOP_SLOTS,
  SHOP_UNLOCK_TYPES,
} from '../../types/admin'
import { CosmeticPreview } from '../shop/CosmeticPreview'
import { AdminDialog } from './AdminDialog'
import { AdminAsyncState } from './AdminAsyncState'
import { formatCompact } from '../../utils/format'
import { LEAGUE_TIERS } from '../../utils/league'

const SLOT_LABEL: Record<AdminShopSlot, string> = {
  car: 'Xe',
  frame: 'Khung avatar',
  nameplate: 'Nền tên',
  booster: 'Vật phẩm tiêu hao',
}

const RARITY_LABEL: Record<AdminShopRarity, string> = {
  common: 'Cơ bản',
  rare: 'Hiếm',
  epic: 'Sử thi',
  legendary: 'Huyền thoại',
}

const UNLOCK_LABEL: Record<AdminShopUnlockType, string> = {
  default: 'Mặc định',
  level: 'Theo cấp',
  stage: 'Theo chặng',
  league: 'Theo hạng',
  achievement: 'Theo thành tựu',
}

const BOOSTER_LABEL: Record<AdminBoosterKind, string> = {
  streak_shield: 'Bảo vệ chuỗi',
  xp_multiplier: 'Nhân đôi XP',
  rc_multiplier: 'Nhân đôi Race Coin',
}

interface ShopDraft {
  mode: 'create' | 'edit'
  id?: number
  name: string
  description: string
  slot: AdminShopSlot
  rarity: AdminShopRarity
  price: string
  unlockType: AdminShopUnlockType
  unlockValue: string
  visualKey: string
  styleText: string
  boosterKind: AdminBoosterKind | ''
  boosterCharges: string
  boosterDuration: string
  active: boolean
}

const EMPTY_DRAFT: ShopDraft = {
  mode: 'create',
  name: '',
  description: '',
  slot: 'car',
  rarity: 'rare',
  price: '0',
  unlockType: 'default',
  unlockValue: '',
  visualKey: '',
  styleText: '',
  boosterKind: '',
  boosterCharges: '0',
  boosterDuration: '0',
  active: true,
}

function draftFrom(item: AdminShopItem): ShopDraft {
  return {
    mode: 'edit',
    id: item.id,
    name: item.name,
    description: item.description,
    slot: item.slot,
    rarity: item.rarity,
    price: String(item.price),
    unlockType: item.unlock_type,
    unlockValue: item.unlock_value ?? '',
    visualKey: item.visual_key,
    styleText: item.style ? JSON.stringify(item.style, null, 2) : '',
    boosterKind: item.booster_kind ?? '',
    boosterCharges: String(item.booster_charges),
    boosterDuration: String(item.booster_duration_minutes),
    active: item.active,
  }
}

function parseStyle(text: string): Record<string, string | null> | null {
  const trimmed = text.trim()
  if (!trimmed) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(trimmed)
  } catch {
    throw new Error('Style phải là JSON hợp lệ, ví dụ {"body":"#E5484D"}.')
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Style phải là một object JSON.')
  }
  const result: Record<string, string | null> = {}
  for (const [key, value] of Object.entries(parsed)) {
    if (value !== null && typeof value !== 'string') {
      throw new Error(`Giá trị của "${key}" phải là chuỗi hoặc null.`)
    }
    result[key] = value
  }
  return result
}

function ShopThumb({ item }: { item: AdminShopItem }) {
  if (item.slot === 'booster') {
    return <span className="admin-shop-booster">{item.booster_kind ? BOOSTER_LABEL[item.booster_kind] : 'Tiêu hao'}</span>
  }
  if (item.slot === 'nameplate') {
    return (
      <span
        className="admin-shop-plate"
        style={{
          background: item.style?.bg ?? undefined,
          color: item.style?.fg ?? undefined,
        }}
      >
        {item.name.slice(0, 8)}
      </span>
    )
  }
  return <CosmeticPreview slot={item.slot} visualKey={item.visual_key} style={item.style} sampleName={item.name} size={54} />
}

export function AdminShopPanel() {
  const { t } = useI18n()
  const [items, setItems] = useState<AdminShopItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [search, setSearch] = useState('')

  const [draft, setDraft] = useState<ShopDraft | null>(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    listAdminShopItemsApi()
      .then((loaded) => {
        if (cancelled) return
        setItems(loaded)
        setLoading(false)
        setLoadError(null)
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setLoadError(error instanceof Error ? error.message : t.adminLoadError)
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [reloadKey, t.adminLoadError])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(null), 5_000)
    return () => window.clearTimeout(timer)
  }, [notice])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return items
    return items.filter((item) =>
      [item.name, item.code, item.visual_key, item.slot, item.rarity]
        .some((field) => field.toLowerCase().includes(query)),
    )
  }, [items, search])

  function reload() {
    setLoading(true)
    setReloadKey((key) => key + 1)
  }

  function openCreate() {
    setFormError(null)
    setDraft({ ...EMPTY_DRAFT })
  }

  function openEdit(item: AdminShopItem) {
    setFormError(null)
    setDraft(draftFrom(item))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!draft) return
    const price = Number(draft.price)
    if (!Number.isInteger(price) || price < 0) {
      setFormError('Giá phải là số nguyên không âm.')
      return
    }
    if (!draft.name.trim()) {
      setFormError('Tên vật phẩm là bắt buộc.')
      return
    }
    if (draft.slot === 'booster' && !draft.boosterKind) {
      setFormError('Vật phẩm tiêu hao cần chọn loại hiệu ứng.')
      return
    }
    const charges = Number(draft.boosterCharges)
    const duration = Number(draft.boosterDuration)
    if (!Number.isInteger(charges) || charges < 0 || !Number.isInteger(duration) || duration < 0) {
      setFormError('Số lượt và thời lượng phải là số nguyên không âm.')
      return
    }
    let style: Record<string, string | null> | null
    try {
      style = parseStyle(draft.styleText)
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Style không hợp lệ.')
      return
    }

    const payload: ShopItemPayload = {
      name: draft.name.trim(),
      description: draft.description.trim(),
      slot: draft.slot,
      rarity: draft.rarity,
      price,
      unlock_type: draft.unlockType,
      unlock_value: draft.unlockType === 'default' ? null : draft.unlockValue.trim() || null,
      visual_key: draft.visualKey.trim() || undefined,
      style,
      booster_kind: draft.slot === 'booster' ? (draft.boosterKind || null) : null,
      booster_charges: draft.slot === 'booster' ? charges : 0,
      booster_duration_minutes: draft.slot === 'booster' ? duration : 0,
      active: draft.active,
    }

    setSaving(true)
    setFormError(null)
    try {
      if (draft.mode === 'edit' && draft.id) {
        const updated = await updateAdminShopItemApi(draft.id, payload)
        setItems((current) => current.map((entry) => (entry.id === updated.id ? updated : entry)))
      } else {
        const created = await createAdminShopItemApi(payload)
        setItems((current) => [...current, created])
      }
      setDraft(null)
      setNotice({ tone: 'ok', text: 'Đã lưu vật phẩm.' })
    } catch (error) {
      setFormError(error instanceof Error ? error.message : t.adminSaveError)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(item: AdminShopItem) {
    if (!window.confirm(`Xóa "${item.name}"? Người học đang sở hữu vật phẩm này cũng sẽ mất nó.`)) return
    setBusyId(item.id)
    try {
      await deleteAdminShopItemApi(item.id)
      setItems((current) => current.filter((entry) => entry.id !== item.id))
      setNotice({ tone: 'ok', text: `Đã xóa "${item.name}".` })
    } catch (error) {
      setNotice({ tone: 'error', text: error instanceof Error ? error.message : t.adminSaveError })
    } finally {
      setBusyId(null)
    }
  }

  async function toggleActive(item: AdminShopItem) {
    setBusyId(item.id)
    try {
      const updated = await updateAdminShopItemApi(item.id, { active: !item.active })
      setItems((current) => current.map((entry) => (entry.id === updated.id ? updated : entry)))
    } catch (error) {
      setNotice({ tone: 'error', text: error instanceof Error ? error.message : t.adminSaveError })
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section className="admin-panel" aria-labelledby="admin-shop-title">
      <div className="admin-toolbar">
        <div className="admin-toolbar-copy">
          <h2 id="admin-shop-title">Vật phẩm Gara ({items.length})</h2>
          <p>Toàn bộ vật phẩm shop lấy từ cơ sở dữ liệu, không còn hardcode.</p>
        </div>
        <div className="admin-shop-toolbar-actions">
          <input
            type="search"
            className="admin-shop-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Tìm theo tên, mã, slot…"
            aria-label="Tìm vật phẩm"
          />
          <button type="button" className="video-primary-btn" onClick={openCreate}>
            <Plus size={16} weight="bold" />
            <span>Thêm vật phẩm</span>
          </button>
        </div>
      </div>

      {notice && (
        <div className={`video-toast is-${notice.tone}`} role="status">
          {notice.tone === 'ok' ? <CheckCircle size={16} weight="fill" /> : <WarningCircle size={16} weight="fill" />}
          <span>{notice.text}</span>
          <button type="button" onClick={() => setNotice(null)} aria-label={t.close}>
            <X size={14} />
          </button>
        </div>
      )}

      <AdminAsyncState
        loading={loading}
        error={loadError}
        onRetry={reload}
        empty={!loading && !loadError && filtered.length === 0}
        emptyIcon={<Storefront size={22} weight="fill" aria-hidden="true" />}
        emptyText="Chưa có vật phẩm nào khớp."
        rows={5}
        thumb
      >

      
        <ul className="admin-list is-video">
          {filtered.map((item) => (
            <li className={`admin-row${item.active ? '' : ' is-inactive'}`} key={item.id}>
              <span className="admin-shop-thumb">
                <ShopThumb item={item} />
              </span>
              <div className="admin-row-main">
                <strong>{item.name}</strong>
                <div className="admin-row-meta">
                  <span className="admin-chip">{SLOT_LABEL[item.slot]}</span>
                  <span className="admin-chip">{RARITY_LABEL[item.rarity]}</span>
                  <span className="admin-chip">{item.price === 0 ? 'Miễn phí' : `${formatCompact(item.price)} RC`}</span>
                  <span className="admin-chip">{UNLOCK_LABEL[item.unlock_type]}{item.unlock_value ? ` · ${item.unlock_value}` : ''}</span>
                  {item.booster_kind && <span className="admin-chip is-xp">{BOOSTER_LABEL[item.booster_kind]}</span>}
                  {!item.active && <span className="admin-chip is-warn">Đang ẩn</span>}
                  <span className="admin-row-meta-text">{item.code} · {item.visual_key}</span>
                </div>
              </div>
              <div className="admin-row-actions">
                <button
                  type="button"
                  className="admin-icon-btn"
                  onClick={() => void toggleActive(item)}
                  disabled={busyId === item.id}
                  title={item.active ? 'Ẩn khỏi shop' : 'Hiện trong shop'}
                  aria-label={item.active ? 'Ẩn khỏi shop' : 'Hiện trong shop'}
                >
                  <span className={`admin-status-dot${item.active ? ' is-on' : ''}`} />
                </button>
                <button
                  type="button"
                  className="admin-icon-btn"
                  onClick={() => openEdit(item)}
                  aria-label={t.adminEdit}
                  title={t.adminEdit}
                >
                  <PencilSimple size={16} />
                </button>
                <button
                  type="button"
                  className="admin-icon-btn is-danger"
                  onClick={() => void handleDelete(item)}
                  disabled={busyId === item.id}
                  aria-label={t.adminDelete}
                  title={t.adminDelete}
                >
                  <Trash size={16} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      </AdminAsyncState>

      <AdminDialog
        open={draft !== null}
        title={draft?.mode === 'edit' ? 'Sửa vật phẩm' : 'Thêm vật phẩm shop'}
        description="Giá trị ở đây được dùng trực tiếp bởi Gara và API mua vật phẩm."
        busy={saving}
        onClose={() => setDraft(null)}
        footer={(
          <div className="admin-dialog-actions">
            <button type="button" className="video-ghost-btn" onClick={() => setDraft(null)} disabled={saving}>
              <span>{t.cancel}</span>
            </button>
            <button type="submit" form="admin-shop-form" className="video-primary-btn" disabled={saving}>
              {saving ? <span className="video-spinner is-small" aria-hidden="true" /> : <Storefront size={16} weight="fill" />}
              <span>{t.save}</span>
            </button>
          </div>
        )}
      >
        {draft && (
          <form id="admin-shop-form" className="admin-form" onSubmit={(event) => void handleSubmit(event)}>
            <div className="admin-section">
              <h4 className="admin-section-title">Thông tin chung</h4>
              <label className="admin-field">
                <span>Tên vật phẩm</span>
                <input
                  type="text"
                  data-autofocus
                  value={draft.name}
                  maxLength={120}
                  onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                  disabled={saving}
                />
              </label>
              <label className="admin-field">
                <span>Mô tả</span>
                <textarea
                  value={draft.description}
                  maxLength={500}
                  rows={2}
                  onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                  disabled={saving}
                />
              </label>
              <div className="admin-field-row">
                <label className="admin-field">
                  <span>Loại</span>
                  <select
                    value={draft.slot}
                    onChange={(event) => setDraft({ ...draft, slot: event.target.value as AdminShopSlot })}
                    disabled={saving}
                  >
                    {SHOP_SLOTS.map((slot) => <option key={slot} value={slot}>{SLOT_LABEL[slot]}</option>)}
                  </select>
                </label>
                <label className="admin-field">
                  <span>Độ hiếm</span>
                  <select
                    value={draft.rarity}
                    onChange={(event) => setDraft({ ...draft, rarity: event.target.value as AdminShopRarity })}
                    disabled={saving}
                  >
                    {SHOP_RARITIES.map((rarity) => <option key={rarity} value={rarity}>{RARITY_LABEL[rarity]}</option>)}
                  </select>
                </label>
                <label className="admin-field">
                  <span>Giá (RC)</span>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={draft.price}
                    onChange={(event) => setDraft({ ...draft, price: event.target.value })}
                    disabled={saving}
                  />
                </label>
              </div>
              <label className="admin-check">
                <input
                  type="checkbox"
                  checked={draft.active}
                  onChange={(event) => setDraft({ ...draft, active: event.target.checked })}
                  disabled={saving}
                />
                <span>Hiển thị trong shop</span>
              </label>
            </div>

            <div className="admin-section">
              <h4 className="admin-section-title">Mở khóa</h4>
              <div className="admin-field-row">
                <label className="admin-field">
                  <span>Kiểu mở khóa</span>
                  <select
                    value={draft.unlockType}
                    onChange={(event) => setDraft({ ...draft, unlockType: event.target.value as AdminShopUnlockType })}
                    disabled={saving}
                  >
                    {SHOP_UNLOCK_TYPES.map((type) => <option key={type} value={type}>{UNLOCK_LABEL[type]}</option>)}
                  </select>
                </label>
                {draft.unlockType !== 'default' && (
                  <label className="admin-field">
                    <span>Giá trị mở khóa</span>
                    {draft.unlockType === 'league' ? (
                      <select
                        value={draft.unlockValue}
                        onChange={(event) => setDraft({ ...draft, unlockValue: event.target.value })}
                        disabled={saving}
                      >
                        <option value="">Chọn hạng</option>
                        {LEAGUE_TIERS.map((tier) => <option key={tier} value={tier}>{tier}</option>)}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={draft.unlockValue}
                        onChange={(event) => setDraft({ ...draft, unlockValue: event.target.value })}
                        placeholder={draft.unlockType === 'level' || draft.unlockType === 'stage' ? '3' : 'lessons_10'}
                        disabled={saving}
                      />
                    )}
                  </label>
                )}
              </div>
            </div>

            {draft.slot === 'booster' && (
              <div className="admin-section">
                <h4 className="admin-section-title">Hiệu ứng tiêu hao</h4>
                <div className="admin-field-row">
                  <label className="admin-field">
                    <span>Loại hiệu ứng</span>
                    <select
                      value={draft.boosterKind}
                      onChange={(event) => setDraft({ ...draft, boosterKind: event.target.value as AdminBoosterKind | '' })}
                      disabled={saving}
                    >
                      <option value="">Chọn hiệu ứng</option>
                      {BOOSTER_KINDS.map((kind) => <option key={kind} value={kind}>{BOOSTER_LABEL[kind]}</option>)}
                    </select>
                  </label>
                  <label className="admin-field">
                    <span>Số lượt</span>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={draft.boosterCharges}
                      onChange={(event) => setDraft({ ...draft, boosterCharges: event.target.value })}
                      disabled={saving}
                    />
                  </label>
                  <label className="admin-field">
                    <span>Thời lượng (phút)</span>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={draft.boosterDuration}
                      onChange={(event) => setDraft({ ...draft, boosterDuration: event.target.value })}
                      disabled={saving}
                    />
                  </label>
                </div>
                <p className="admin-field-hint">Cần ít nhất một trong hai: số lượt hoặc thời lượng.</p>
              </div>
            )}

            <div className="admin-section">
              <h4 className="admin-section-title">Hình ảnh</h4>
              <label className="admin-field">
                <span>Visual key</span>
                <input
                  type="text"
                  value={draft.visualKey}
                  maxLength={60}
                  onChange={(event) => setDraft({ ...draft, visualKey: event.target.value })}
                  placeholder="Tự sinh từ tên nếu để trống"
                  disabled={saving}
                />
              </label>
              <label className="admin-field">
                <span>Style JSON</span>
                <textarea
                  value={draft.styleText}
                  rows={5}
                  onChange={(event) => setDraft({ ...draft, styleText: event.target.value })}
                  placeholder={'{"body":"#E5484D","bodyDark":"#B32D31"}'}
                  disabled={saving}
                />
                <small className="admin-field-hint">
                  Xe dùng body/bodyDark/trim/glass/glassLight/wheel/light/trail; khung dùng ring/ringDark/accent;
                  nền dùng bg/fg/edge hoặc scene (plain, slate, sky, sunset, forest, royal).
                </small>
              </label>
            </div>

            {formError && <p className="video-import-error" role="alert">{formError}</p>}
          </form>
        )}
      </AdminDialog>
    </section>
  )
}
