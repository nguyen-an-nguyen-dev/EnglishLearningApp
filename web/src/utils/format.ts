/**
 * Compact numbers the way score counters usually read:
 * 860 → "860", 1 250 → "1,2k", 12 500 → "12,5k", 1 250 000 → "1,2m".
 *
 * One decimal at most, trailing ",0" dropped. The value is floored, never
 * rounded up — a score should not claim more XP than the learner has.
 */
const UNITS = ['', 'k', 'm', 'b'] as const

export function formatCompact(value: number, decimalSeparator = ','): string {
  if (!Number.isFinite(value)) return '0'

  const rounded = Math.round(value)
  const sign = rounded < 0 ? '-' : ''
  let size = Math.abs(rounded)
  let unit = 0

  while (size >= 1000 && unit < UNITS.length - 1) {
    size /= 1000
    unit += 1
  }

  const scaled = Math.floor(size * 10) / 10

  const text = scaled % 1 === 0 ? String(scaled) : String(scaled).replace('.', decimalSeparator)
  return `${sign}${text}${UNITS[unit]}`
}
