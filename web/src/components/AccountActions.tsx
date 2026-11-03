import { useState } from 'react'
import type { FormEvent } from 'react'
import { CaretDown, LockKey, UserCircle } from '@phosphor-icons/react'
import { useAuth } from '../context/AuthContext'
import { useI18n } from '../i18n'
import type { AuthUser } from '../types/auth'

type Mode = 'password' | 'name' | null

interface Note {
  kind: 'ok' | 'error'
  text: string
}

function Note({ note }: { note: Note | null }) {
  if (!note) return null
  return <p className={`account-note is-${note.kind}`} role="status">{note.text}</p>
}

function PasswordForm({ onCancel }: { onCancel: () => void }) {
  const { t } = useI18n()
  const { changePassword } = useAuth()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [repeat, setRepeat] = useState('')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<Note | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setNote(null)

    if (next.length < 6) {
      setNote({ kind: 'error', text: t.passwordTooShort })
      return
    }
    if (next !== repeat) {
      setNote({ kind: 'error', text: t.passwordMismatch })
      return
    }

    setBusy(true)
    try {
      await changePassword({ currentPassword: current, newPassword: next })
      setCurrent('')
      setNext('')
      setRepeat('')
      setNote({ kind: 'ok', text: t.passwordUpdated })
    } catch (error) {
      const message = error instanceof Error ? error.message : ''
      setNote({
        kind: 'error',
        text: /current password/i.test(message) ? t.wrongPassword : message || t.saveFailed,
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="account-form" onSubmit={handleSubmit}>
      <div className="account-field">
        <label htmlFor="pw-current">{t.currentPassword}</label>
        <input
          id="pw-current"
          type="password"
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          required
        />
      </div>
      <div className="account-field">
        <label htmlFor="pw-next">{t.newPassword}</label>
        <input
          id="pw-next"
          type="password"
          autoComplete="new-password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          required
        />
      </div>
      <div className="account-field">
        <label htmlFor="pw-repeat">{t.repeatNewPassword}</label>
        <input
          id="pw-repeat"
          type="password"
          autoComplete="new-password"
          value={repeat}
          onChange={(e) => setRepeat(e.target.value)}
          required
        />
      </div>

      <Note note={note} />

      <div className="account-actions">
        <button type="submit" className="account-submit" disabled={busy}>
          {busy ? t.saving : t.save}
        </button>
        <button type="button" className="account-cancel" onClick={onCancel}>
          {t.cancel}
        </button>
      </div>
    </form>
  )
}

function NameForm({ user, onCancel }: { user: AuthUser | null; onCancel: () => void }) {
  const { t } = useI18n()
  const { updateProfile } = useAuth()
  const [name, setName] = useState(user?.name ?? '')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<Note | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setNote(null)
    setBusy(true)
    try {
      await updateProfile({ name: name.trim(), email: user?.email ?? '' })
      setNote({ kind: 'ok', text: t.profileUpdated })
    } catch (error) {
      setNote({ kind: 'error', text: error instanceof Error ? error.message : t.saveFailed })
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="account-form" onSubmit={handleSubmit}>
      <div className="account-field">
        <label htmlFor="acc-name">{t.displayName}</label>
        <input
          id="acc-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>
      <div className="account-field">
        <label htmlFor="acc-email">{t.emailLabel}</label>
        <input id="acc-email" type="email" value={user?.email ?? ''} readOnly />
        <small className="account-hint">{t.emailLocked}</small>
      </div>

      <Note note={note} />

      <div className="account-actions">
        <button type="submit" className="account-submit" disabled={busy}>
          {busy ? t.saving : t.save}
        </button>
        <button type="button" className="account-cancel" onClick={onCancel}>
          {t.cancel}
        </button>
      </div>
    </form>
  )
}

export function AccountActions({ user }: { user: AuthUser | null }) {
  const { t } = useI18n()
  const [mode, setMode] = useState<Mode>(null)

  const toggle = (next: Exclude<Mode, null>) => setMode((prev) => (prev === next ? null : next))

  return (
    <div className="account-rows">
      <div className="account-row">
        <button
          type="button"
          className="account-toggle"
          aria-expanded={mode === 'password'}
          onClick={() => toggle('password')}
        >
          <LockKey size={18} />
          <span>{t.changePassword}</span>
          <CaretDown size={15} weight="bold" />
        </button>
        {mode === 'password' && <PasswordForm onCancel={() => setMode(null)} />}
      </div>

      <div className="account-row">
        <button
          type="button"
          className="account-toggle"
          aria-expanded={mode === 'name'}
          onClick={() => toggle('name')}
        >
          <UserCircle size={18} />
          <span>{t.editName}</span>
          <CaretDown size={15} weight="bold" />
        </button>
        {mode === 'name' && <NameForm user={user} onCancel={() => setMode(null)} />}
      </div>
    </div>
  )
}
