/** First letter of a display name — the initials avatar used across the app. */
export function initialOf(name: string | null | undefined): string {
  const trimmed = name?.trim() ?? ''
  return trimmed ? trimmed[0].toUpperCase() : '?'
}
