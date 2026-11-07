import { authStorage } from './authService'

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

export async function requestApi<T>(
  path: string,
  options: RequestInit = {},
  token = authStorage.getToken(),
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
  const body = (await response.json().catch(() => ({}))) as ApiEnvelope<T>

  if (!response.ok || !body.success || body.data === undefined) {
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
 * For the handful of endpoints the landing page calls before anyone signs in.
 * Same envelope handling as `requestApi`, but it never attaches a token and
 * never throws just because the caller has no session yet.
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

  // A public payload is allowed to be `null` (e.g. "no preview available yet"),
  // so only the failure envelope is treated as an error.
  return body.data as T
}
