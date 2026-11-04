export interface YouTubePlayerInstance {
  getCurrentTime: () => number
  getDuration: () => number
  seekTo: (seconds: number, allowSeekAhead: boolean) => void
  playVideo: () => void
  pauseVideo: () => void
  setPlaybackRate?: (rate: number) => void
  setPlaybackQuality?: (quality: string) => void
  setPlaybackQualityRange?: (start: string, end?: string) => void
  unloadModule?: (module: string) => void
  destroy: () => void
}

export interface YouTubeNamespace {
  Player: new (
    element: HTMLElement,
    options: {
      videoId: string
      playerVars?: Record<string, string | number>
      events?: {
        onReady?: (event: { target: YouTubePlayerInstance }) => void
        onStateChange?: (event: { data: number; target: YouTubePlayerInstance }) => void
      }
    },
  ) => YouTubePlayerInstance
}

interface YouTubeWindow extends Window {
  YT?: YouTubeNamespace
  onYouTubeIframeAPIReady?: () => void
}

let youtubeApiPromise: Promise<YouTubeNamespace> | null = null

export function loadYouTubeApi(): Promise<YouTubeNamespace> {
  if (typeof window === 'undefined') return Promise.reject(new Error('No browser window.'))
  const browserWindow = window as YouTubeWindow
  if (browserWindow.YT?.Player) return Promise.resolve(browserWindow.YT)
  if (youtubeApiPromise) return youtubeApiPromise

  youtubeApiPromise = new Promise<YouTubeNamespace>((resolve, reject) => {
    const previousReady = browserWindow.onYouTubeIframeAPIReady
    browserWindow.onYouTubeIframeAPIReady = () => {
      previousReady?.()
      if (browserWindow.YT) resolve(browserWindow.YT)
    }
    if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      const script = document.createElement('script')
      script.src = 'https://www.youtube.com/iframe_api'
      script.async = true
      script.onerror = () => reject(new Error('YouTube API failed to load.'))
      document.head.appendChild(script)
    }
    window.setTimeout(() => {
      if (browserWindow.YT?.Player) resolve(browserWindow.YT)
      else reject(new Error('YouTube API timed out.'))
    }, 8_000)
  })
  return youtubeApiPromise
}
