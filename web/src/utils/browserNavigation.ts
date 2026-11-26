import { useSyncExternalStore, type MouseEvent } from 'react'
import { confirmArenaLeave } from './arenaGuard'

const listeners = new Set<() => void>()
const readUrl = () => window.location.pathname + window.location.search + window.location.hash
let currentUrl = typeof window === 'undefined' ? '/' : readUrl()
let entryIndex = 0
let restoring = false

function notify() {
  listeners.forEach((listener) => listener())
}

function onBrowserNavigation() {
  const nextUrl = readUrl()
  if (nextUrl === currentUrl) {
    restoring = false
    return
  }
  const nextIndex: unknown = window.history.state?.engoraceEntry
  const leavingArena = new URL(currentUrl, window.location.origin).pathname === '/arena'
    && window.location.pathname !== '/arena'
  if (!restoring && leavingArena && !confirmArenaLeave()) {
    if (typeof nextIndex === 'number' && nextIndex !== entryIndex) {
      restoring = true
      window.history.go(entryIndex - nextIndex)
    } else {
      window.history.pushState({ engoraceEntry: entryIndex }, '', currentUrl)
    }
    return
  }
  restoring = false
  entryIndex = typeof nextIndex === 'number' ? nextIndex : entryIndex
  currentUrl = nextUrl
  notify()
}

function subscribe(listener: () => void) {
  if (!listeners.size) {
    const savedIndex: unknown = window.history.state?.engoraceEntry
    entryIndex = typeof savedIndex === 'number' ? savedIndex : 0
    window.history.replaceState({ ...window.history.state, engoraceEntry: entryIndex }, '')
    window.addEventListener('popstate', onBrowserNavigation)
    window.addEventListener('hashchange', onBrowserNavigation)
  }
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
    if (!listeners.size) {
      window.removeEventListener('popstate', onBrowserNavigation)
      window.removeEventListener('hashchange', onBrowserNavigation)
    }
  }
}

export function useBrowserUrl(): string {
  return useSyncExternalStore(subscribe, () => currentUrl, () => '/')
}

export function navigate(to: string, { replace = false, landing = false } = {}): void {
  if (to === currentUrl) return
  const index = replace ? entryIndex : entryIndex + 1
  const state = { engoraceEntry: index, learnerLanding: landing }
  if (replace) window.history.replaceState(state, '', to)
  else window.history.pushState(state, '', to)
  entryIndex = index
  currentUrl = readUrl()
  notify()
}

export function keepCurrentLandingEntry(): void {
  window.history.replaceState({ ...window.history.state, learnerLanding: true }, '')
}

/** Allow the browser to handle opening real links in a new tab. */
export function interceptLink(event: MouseEvent<HTMLAnchorElement>, action: () => void): void {
  if (event.defaultPrevented || event.button !== 0 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
  event.preventDefault()
  action()
}
