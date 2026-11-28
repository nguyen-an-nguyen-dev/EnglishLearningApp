import { useLayoutEffect, useRef, type KeyboardEvent, type PointerEvent } from 'react'
import type { BuddyDockPosition } from './buddyDockSettings'

const DRAG_THRESHOLD = 6
const KEYBOARD_STEP = 24

interface DragGesture {
  id: number
  x: number
  y: number
  dock: DOMRect
  area: DOMRect
  dx: number
  dy: number
  moved: boolean
}

function clampOffset(offset: number, min: number, max: number) {
  return Math.max(min, Math.min(max, offset))
}

function fraction(value: number, available: number) {
  return available > 0 ? Math.max(0, Math.min(1, value / available)) : 0
}

function positionFromPoint(area: DOMRect, dock: DOMRect, left: number, top: number): BuddyDockPosition {
  return {
    x: fraction(left - area.left, area.width - dock.width),
    y: fraction(top - area.top, area.height - dock.height),
  }
}

export function useBuddyDockDrag(
  position: BuddyDockPosition | null,
  onMove: (position: BuddyDockPosition) => void,
) {
  const areaRef = useRef<HTMLDivElement>(null)
  const dockRef = useRef<HTMLDivElement>(null)
  const gesture = useRef<DragGesture | null>(null)
  const frame = useRef<number | null>(null)
  const suppressClick = useRef(false)

  useLayoutEffect(() => {
    // Clear the drag transform after React has applied the saved anchor.
    dockRef.current?.style.removeProperty('transform')
    areaRef.current?.removeAttribute('data-dragging')
  }, [position])

  useLayoutEffect(() => () => {
    if (frame.current !== null) cancelAnimationFrame(frame.current)
  }, [])

  function onPointerDown(event: PointerEvent<HTMLButtonElement>) {
    const dock = dockRef.current
    const area = areaRef.current
    if (!event.isPrimary || event.button !== 0 || !dock || !area) return
    suppressClick.current = false
    gesture.current = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      dock: dock.getBoundingClientRect(),
      area: area.getBoundingClientRect(),
      dx: 0,
      dy: 0,
      moved: false,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function onPointerMove(event: PointerEvent<HTMLButtonElement>) {
    const drag = gesture.current
    if (drag?.id !== event.pointerId || !areaRef.current) return
    const dx = event.clientX - drag.x
    const dy = event.clientY - drag.y
    if (!drag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return
    if (!drag.moved) {
      drag.moved = true
      areaRef.current.dataset.dragging = 'true'
    }
    drag.dx = clampOffset(dx, drag.area.left - drag.dock.left, drag.area.right - drag.dock.right)
    drag.dy = clampOffset(dy, drag.area.top - drag.dock.top, drag.area.bottom - drag.dock.bottom)
    if (frame.current === null) {
      frame.current = requestAnimationFrame(() => {
        frame.current = null
        const dock = dockRef.current
        if (dock && gesture.current === drag) {
          dock.style.transform = `translate3d(${drag.dx}px, ${drag.dy}px, 0)`
        }
      })
    }
  }

  function endGesture(event: PointerEvent<HTMLButtonElement>) {
    const drag = gesture.current
    if (drag?.id !== event.pointerId) return
    gesture.current = null
    if (frame.current !== null) {
      cancelAnimationFrame(frame.current)
      frame.current = null
    }
    if (!drag.moved) return
    suppressClick.current = true
    if (event.type === 'pointerup' && areaRef.current) {
      onMove(positionFromPoint(
        areaRef.current.getBoundingClientRect(), drag.dock,
        drag.dock.left + event.clientX - drag.x, drag.dock.top + event.clientY - drag.y,
      ))
    } else {
      dockRef.current?.style.removeProperty('transform')
      areaRef.current?.removeAttribute('data-dragging')
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const horizontal = Number(event.key === 'ArrowRight') - Number(event.key === 'ArrowLeft')
    const vertical = Number(event.key === 'ArrowDown') - Number(event.key === 'ArrowUp')
    if ((!horizontal && !vertical) || gesture.current || !dockRef.current || !areaRef.current) return
    event.preventDefault()
    const dock = dockRef.current.getBoundingClientRect()
    onMove(positionFromPoint(areaRef.current.getBoundingClientRect(), dock, dock.left + horizontal * KEYBOARD_STEP, dock.top + vertical * KEYBOARD_STEP))
  }

  return {
    areaRef,
    dockRef,
    shouldSuppressClick: (detail: number) => detail > 0 && suppressClick.current,
    handlers: { onPointerDown, onPointerMove, onPointerUp: endGesture, onPointerCancel: endGesture, onLostPointerCapture: endGesture, onKeyDown },
  }
}
