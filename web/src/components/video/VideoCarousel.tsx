import { useRef } from 'react'
import type { ReactNode } from 'react'
import { CaretLeft, CaretRight } from '@phosphor-icons/react'
import { useI18n } from '../../i18n'

interface VideoCarouselProps<T> {
  title: string
  description?: string
  countLabel?: string
  tone?: 'sky' | 'sun'
  items: T[]
  getKey: (item: T) => string | number
  renderItem: (item: T) => ReactNode
  emptyText: string
  toolbar?: ReactNode
  trailing?: ReactNode
  buddyTarget?: string
}

/** Horizontal gallery so long catalogues stay one screen tall. */
export function VideoCarousel<T>({
  title,
  description,
  countLabel,
  tone = 'sky',
  items,
  getKey,
  renderItem,
  emptyText,
  toolbar,
  trailing,
  buddyTarget,
}: VideoCarouselProps<T>) {
  const trackRef = useRef<HTMLDivElement>(null)
  const { t } = useI18n()

  function scroll(direction: -1 | 1) {
    const track = trackRef.current
    if (!track) return
    track.scrollBy({ left: direction * Math.max(280, track.clientWidth * 0.82), behavior: 'smooth' })
  }

  return (
    <section className={`video-carousel-section${tone === 'sun' ? ' is-owned' : ''}`} aria-label={title}>
      <header className="video-carousel-head" data-buddy-target={buddyTarget}>
        <h2>{title}</h2>
        <span className={`video-carousel-count${tone === 'sun' ? ' is-sun' : ''}`}>{countLabel ?? `${items.length}`}</span>
        {description && <p className="video-carousel-desc">{description}</p>}
        <div className="video-carousel-nav">
          <button type="button" onClick={() => scroll(-1)} aria-label={t.videoCarouselPrev} title={t.videoCarouselPrev}>
            <CaretLeft size={20} weight="bold" />
          </button>
          <button type="button" onClick={() => scroll(1)} aria-label={t.videoCarouselNext} title={t.videoCarouselNext}>
            <CaretRight size={20} weight="bold" />
          </button>
        </div>
      </header>

      {toolbar && <div className="video-carousel-toolbar">{toolbar}</div>}

      {items.length === 0 && !trailing ? (
        <p className="video-carousel-empty">{emptyText}</p>
      ) : (
        <div className="video-carousel-track" ref={trackRef}>
          {items.map((item) => (
            <div className="video-carousel-slide" key={getKey(item)}>{renderItem(item)}</div>
          ))}
          {trailing && <div className="video-carousel-slide is-trailing">{trailing}</div>}
        </div>
      )}
    </section>
  )
}
