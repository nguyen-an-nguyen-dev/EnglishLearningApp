import { useCallback, useEffect, useRef, useState } from 'react'
import { CheckCircle, WarningCircle } from '@phosphor-icons/react'
import { useAuth } from '../../context/AuthContext'
import { useI18n } from '../../i18n'
import { ApiError } from '../../services/apiClient'
import {
  getLinkedProvidersApi,
  getProvidersApi,
  linkProviderApi,
  unlinkProviderApi,
  type ProviderConfig,
} from '../../services/authService'
import type { LinkedProvider, SocialProvider } from '../../types/auth'
import { loadScript } from '../../utils/socialSdk'

const NO_PROVIDERS: ProviderConfig = { google: false, facebook: false, googleClientId: '', facebookAppId: '' }

type Note = { kind: 'ok' | 'error'; text: string }

const PROVIDER_LABEL: Record<SocialProvider, string> = {
  google: 'Google',
  facebook: 'Facebook',
}

const PROVIDERS: SocialProvider[] = ['google', 'facebook']

export function SocialAccounts() {
  const { t } = useI18n()
  const { token, user, refreshUser } = useAuth()
  const [config, setConfig] = useState<ProviderConfig>(NO_PROVIDERS)
  const [linked, setLinked] = useState<LinkedProvider[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<SocialProvider | null>(null)
  const [note, setNote] = useState<Note | null>(null)
  const googleSlotRef = useRef<HTMLSpanElement>(null)

  const linkRef = useRef<(provider: SocialProvider, providerToken: string) => void>(() => {})

  const handleLink = useCallback(async (provider: SocialProvider, providerToken: string) => {
    if (!token || busy) return
    setBusy(provider)
    setNote(null)
    try {
      const providers = await linkProviderApi(token, provider, providerToken)
      setLinked(providers)
      setNote({ kind: 'ok', text: t.socialLinkSuccess })
    } catch (error) {
      let text = error instanceof Error ? error.message : t.saveFailed
      if (error instanceof ApiError) {
        if (error.errors.includes('PROVIDER_EMAIL_MISMATCH')) {
          text = t.socialEmailMismatch(PROVIDER_LABEL[provider], user?.email ?? '')
        } else if (error.errors.includes('PROVIDER_ALREADY_LINKED')) {
          text = t.socialAlreadyLinked(PROVIDER_LABEL[provider])
        } else if (error.errors.includes('PROVIDER_SLOT_TAKEN')) {
          text = t.socialSlotTaken(PROVIDER_LABEL[provider])
        }
      }
      setNote({ kind: 'error', text })
    } finally {
      setBusy(null)
    }
  }, [busy, token, t, user?.email])

  useEffect(() => {
    linkRef.current = (provider, providerToken) => {
      void handleLink(provider, providerToken)
    }
  }, [handleLink])

  useEffect(() => {
    let cancelled = false
    void Promise.all([
      getProvidersApi(),
      token ? getLinkedProvidersApi(token).catch(() => [] as LinkedProvider[]) : Promise.resolve([] as LinkedProvider[]),
    ]).then(([providerConfig, providers]) => {
      if (cancelled) return
      setConfig(providerConfig)
      setLinked(providers)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [token])

  const googleLinked = linked.some((entry) => entry.provider === 'google')

  useEffect(() => {
    if (!config.google || !config.googleClientId || googleLinked) return
    let cancelled = false
    loadScript('https://accounts.google.com/gsi/client')
      .then(() => {
        const slot = googleSlotRef.current
        if (cancelled || !slot || !window.google) return
        window.google.accounts.id.initialize({
          client_id: config.googleClientId,
          callback: (response) => linkRef.current('google', response.credential),
        })
        slot.replaceChildren()
        // The Google SDK button sits transparent under the "Liên kết" text link, so the official popup flow keeps working.
        window.google.accounts.id.renderButton(slot, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          shape: 'pill',
          text: 'continue_with',
          locale: 'vi',
          width: 200,
        })
      })
      .catch((error: unknown) => {
        setNote({ kind: 'error', text: error instanceof Error ? error.message : t.saveFailed })
      })
    return () => { cancelled = true }
  }, [config.google, config.googleClientId, googleLinked, t.saveFailed])

  function handleFacebook() {
    if (!config.facebook || !config.facebookAppId) {
      setNote({ kind: 'error', text: t.socialNotConfigured })
      return
    }
    setNote(null)
    loadScript('https://connect.facebook.net/vi_VN/sdk.js')
      .then(() => {
        if (!window.FB) throw new Error('Không tải được Facebook SDK.')
        window.FB.init({ appId: config.facebookAppId, cookie: true, xfbml: false, version: 'v19.0' })
        window.FB.login(
          (response) => {
            const providerToken = response.authResponse?.accessToken
            if (providerToken) linkRef.current('facebook', providerToken)
          },
          { scope: 'email,public_profile' },
        )
      })
      .catch((error: unknown) => {
        setNote({ kind: 'error', text: error instanceof Error ? error.message : t.saveFailed })
      })
  }

  async function handleUnlink(provider: SocialProvider) {
    if (!token || busy) return
    if (!window.confirm(t.socialUnlinkConfirm(PROVIDER_LABEL[provider]))) return
    if (user?.has_password === false && linked.length <= 1) {
      setNote({ kind: 'error', text: t.socialLastMethod })
      return
    }
    setBusy(provider)
    setNote(null)
    try {
      const providers = await unlinkProviderApi(token, provider)
      setLinked(providers)
      await refreshUser()
      setNote({ kind: 'ok', text: t.socialUnlinkSuccess })
    } catch (error) {
      const text = error instanceof ApiError && error.errors.includes('LAST_LOGIN_METHOD')
        ? t.socialLastMethod
        : error instanceof Error ? error.message : t.saveFailed
      setNote({ kind: 'error', text })
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="profile-social" aria-labelledby="profile-social-title">
      <header className="profile-social-head">
        <h3 id="profile-social-title">{t.socialAccounts}</h3>
        <p>{t.socialAccountsDesc}</p>
      </header>

      {loading ? (
        <p className="profile-social-empty">{t.saving}</p>
      ) : (
        <ul className="profile-social-list">
          {PROVIDERS.map((provider) => {
            const entry = linked.find((item) => item.provider === provider)
            const configured = provider === 'google'
              ? config.google && Boolean(config.googleClientId)
              : config.facebook && Boolean(config.facebookAppId)
            const badge = provider === 'google' ? '/social/google.svg' : '/social/facebook.svg'
            const label = PROVIDER_LABEL[provider]
            return (
              <li key={provider} className={`profile-social-row${entry ? ' is-linked' : ''}`}>
                <span className={`profile-social-mark is-${provider}`} aria-hidden="true">
                  <img src={badge} alt="" width={18} height={18} />
                </span>
                <span className="profile-social-copy">
                  <strong>{label}</strong>
                  <small>{entry ? entry.email : configured ? t.socialNotLinked : t.socialNotConfigured}</small>
                </span>
                {entry ? (
                  <button
                    type="button"
                    className="profile-social-link is-danger"
                    onClick={() => void handleUnlink(provider)}
                    disabled={busy !== null}
                    aria-label={`${t.socialUnlink} ${label}`}
                  >
                    {t.socialUnlink}
                  </button>
                ) : !configured ? null : provider === 'google' ? (
                  <span className="profile-social-action" aria-busy={busy === provider}>
                    <span className="profile-social-link" aria-hidden="true">
                      {busy === provider ? t.saving : t.socialLink}
                    </span>
                    <span className="profile-social-google" ref={googleSlotRef} />
                  </span>
                ) : (
                  <button
                    type="button"
                    className="profile-social-link"
                    onClick={handleFacebook}
                    disabled={busy !== null}
                    aria-label={`${t.socialLink} ${label}`}
                  >
                    {busy === provider ? t.saving : t.socialLink}
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {note && (
        <p className={`account-note is-${note.kind}`} role="status">
          {note.kind === 'ok' ? <CheckCircle size={15} weight="fill" /> : <WarningCircle size={15} weight="fill" />}
          <span>{note.text}</span>
        </p>
      )}

      <p className="profile-social-note">{t.socialSameEmailNote(user?.email ?? '')}</p>
    </section>
  )
}
