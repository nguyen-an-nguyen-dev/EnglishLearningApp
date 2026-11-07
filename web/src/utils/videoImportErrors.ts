import type { Dict } from '../i18n'
import { ApiError } from '../services/apiClient'

/**
 * The backend answers a failed YouTube import with a stable code list plus, for
 * some codes, a human detail. Both the learner import dialog and the admin
 * console render the same Vietnamese copy from it.
 */
export function videoImportErrorMessage(error: unknown, t: Dict): string {
  if (error instanceof ApiError) {
    const codes = error.errors
    // Non-code entries carry the human detail (e.g. which captions the video has).
    const detail = codes.find((entry) => !/^[A-Z0-9_]+$/.test(entry))
    if (codes.includes('INVALID_YOUTUBE_URL')) return t.videoImportInvalid
    if (codes.includes('VIDEO_TOO_LONG')) return t.videoImportTooLong
    if (codes.includes('VIDEO_NO_ENGLISH_CAPTIONS')) {
      return detail ? `${t.videoImportNoEnglishCaptions} ${detail}.` : t.videoImportNoEnglishCaptions
    }
    if (codes.includes('VIDEO_NO_CAPTIONS')) return t.videoImportNoCaptions
    if (codes.includes('VIDEO_PRIVATE')) return t.videoImportPrivate
    if (codes.includes('VIDEO_LIVE')) return t.videoImportLive
    if (codes.includes('VIDEO_NO_DURATION')) return t.videoImportNoDuration
    if (codes.includes('VIDEO_UNREADABLE')) return t.videoImportUnreadable
    if (codes.includes('VIDEO_IMPORT_RATE_LIMIT')) return t.videoImportRateLimit
    if (codes.includes('VIDEO_UNAVAILABLE')) return t.videoImportUnavailable
    if (codes.includes('VIDEO_ALREADY_IMPORTED')) return t.videoImportDuplicate
    if (codes.includes('VIDEO_ALREADY_IN_LIBRARY')) return t.adminVideoDuplicate
    if (codes.includes('VIDEO_IMPORT_LIMIT')) return t.videoImportLimit
    if (codes.includes('VIDEO_IMPORT_TIMEOUT')) return t.videoImportTimeout
    if (codes.includes('VIDEO_IMPORT_UNAVAILABLE')) return t.videoImportUnavailable
    return error.message || t.videoImportError
  }
  return error instanceof Error ? error.message : t.videoImportError
}
