import { FRAME } from '../designTokens'

const r1 = (n: number) => Math.round(n * 10) / 10

/** Full-circle donut path, outer clockwise + inner anticlockwise. */
export function donutPath(outer: number, inner: number): string {
  const { cx, avatarY: cy } = FRAME
  return [
    `M${cx} ${cy - outer}A${outer} ${outer} 0 1 0 ${cx} ${cy + outer}A${outer} ${outer} 0 1 0 ${cx} ${cy - outer}Z`,
    `M${cx} ${cy - inner}A${inner} ${inner} 0 1 1 ${cx} ${cy + inner}A${inner} ${inner} 0 1 1 ${cx} ${cy - inner}Z`,
  ].join('')
}

/** Arc on the frame ring; angles use SVG screen space (0=right, 90=down). */
export function arcPath(radius: number, startDeg: number, endDeg: number): string {
  const { cx, avatarY: cy } = FRAME
  const a0 = (startDeg * Math.PI) / 180
  const a1 = (endDeg * Math.PI) / 180
  const x0 = r1(cx + radius * Math.cos(a0))
  const y0 = r1(cy + radius * Math.sin(a0))
  const x1 = r1(cx + radius * Math.cos(a1))
  const y1 = r1(cy + radius * Math.sin(a1))
  const large = Math.abs(endDeg - startDeg) > 180 ? 1 : 0
  return `M${x0} ${y0}A${radius} ${radius} 0 ${large} 1 ${x1} ${y1}`
}

/** A 45° anchor on the ring, so ornaments can never float. */
export function onRing(radius: number, angle: number): { x: number; y: number } {
  const rad = (angle * Math.PI) / 180
  return {
    x: r1(FRAME.cxAvatar + radius * Math.cos(rad)),
    y: r1(FRAME.avatarY + radius * Math.sin(rad)),
  }
}

export function radialWedge(r0: number, r1Rad: number, a0: number, a1: number): string {
  const p0 = onRing(r0, a0)
  const p1 = onRing(r1Rad, a0)
  const p2 = onRing(r1Rad, a1)
  const p3 = onRing(r0, a1)
  const large = Math.abs(a1 - a0) > 180 ? 1 : 0
  return [
    `M${p0.x} ${p0.y}L${p1.x} ${p1.y}`,
    `A${r1Rad} ${r1Rad} 0 ${large} 1 ${p2.x} ${p2.y}`,
    `L${p3.x} ${p3.y}`,
    `A${r0} ${r0} 0 ${large} 0 ${p0.x} ${p0.y}Z`,
  ].join('')
}

/** Regular flat-top hexagon at a given circumradius: a safe crystal cage. */
export function hexPath(radius: number): string {
  const points = Array.from({ length: 6 }, (_, index) => {
    const angle = ((index * 60) * Math.PI) / 180
    return `${r1(FRAME.cxAvatar + radius * Math.cos(angle))} ${r1(FRAME.avatarY + radius * Math.sin(angle))}`
  })
  return `M${points.join('L')}Z`
}
