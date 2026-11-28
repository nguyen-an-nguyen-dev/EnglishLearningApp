import { authStorage } from './authStorage'

interface ApiEnvelope<T> {
  success: boolean
  data?: T
  message?: string
  error?: string
  errors?: string[]
}

export class ApiError extends Error {
  readonly status: number
  readonly errors: string[]

  constructor(message: string, status: number, errors: string[] = []) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.errors = errors
  }
}

/**
 * Fired when the server rejects the stored token (HTTP 401). The auth layer
 * drops the stale session so the UI stops pretending the user is signed in.
 */
export const SESSION_EXPIRED_EVENT = 'englearn:session-expired'

function handleUnauthorized(): void {
  authStorage.clear()
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT))
  }
}

export async function requestApi<T>(
  path: string,
  options: RequestInit = {},
  token = authStorage.getToken(),
  alternate?: { contentType: string; read: (response: Response) => Promise<T> },
): Promise<T> {
  if (!token) throw new Error('Bạn cần đăng nhập lại.')

  const response = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  })
  if (response.ok && alternate && response.headers.get('content-type')?.startsWith(alternate.contentType)) {
    return alternate.read(response)
  }
  const body = (await response.json().catch(() => ({}))) as ApiEnvelope<T>

  if (!response.ok || !body.success || body.data === undefined) {
    if (response.status === 401) handleUnauthorized()
    const details = body.errors?.filter((entry) => !/^[A-Z0-9_]+$/.test(entry)) ?? []
    const detail = details.length ? ` ${details.join(' ')}` : ''
    throw new ApiError(
      (body.error || body.message || 'Không tải được dữ liệu.') + detail,
      response.status,
      body.errors ?? [],
    )
  }

  return body.data
}

/**
 * Same envelope handling as `requestApi`, but never attaches a token and never
 * throws when the caller has no session.
 */
export async function requestPublicApi<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })
  const body = (await response.json().catch(() => ({}))) as ApiEnvelope<T>

  if (!response.ok || !body.success) {
    throw new ApiError(
      body.error || body.message || 'Không tải được dữ liệu.',
      response.status,
      body.errors ?? [],
    )
  }

  // A public payload may be null (e.g. "no preview available yet"); only the
  // failure envelope is treated as an error.
  return body.data as T
}
