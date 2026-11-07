import { useState } from 'react'
import { ListChecks, VideoCamera } from '@phosphor-icons/react'
import { useAuth } from '../../context/AuthContext'
import { useI18n } from '../../i18n'
import { AdminLessonsPanel } from './AdminLessonsPanel'
import { AdminVideoPanel } from './AdminVideoPanel'

type AdminTab = 'videos' | 'lessons'

export function AdminView() {
  const { user } = useAuth()
  const { t } = useI18n()
  const [tab, setTab] = useState<AdminTab>('lessons')

  if (user?.role !== 'admin') {
    return (
      <div className="tab-view-container admin-page">
        <div className="video-state-card">
          <p>{t.adminNoAccess}</p>
        </div>
      </div>
    )
  }

  const tabs: Array<{ id: AdminTab; label: string; icon: typeof VideoCamera }> = [
    { id: 'lessons', label: t.adminTabLessons, icon: ListChecks },
    { id: 'videos', label: t.adminTabVideos, icon: VideoCamera },
  ]

  return (
    <div className="tab-view-container admin-page">
      <div className="page-heading page-heading-row">
        <div>
          <span className="page-eyebrow">{t.adminEyebrow}</span>
          <h1>{t.adminTitle}</h1>
          <p>{t.adminDesc}</p>
        </div>
        <div className="admin-switch" role="tablist" aria-label={t.adminTitle}>
          {tabs.map((entry) => {
            const Icon = entry.icon
            const active = tab === entry.id
            return (
              <button
                key={entry.id}
                type="button"
                role="tab"
                aria-selected={active}
                className={`admin-switch-option${active ? ' is-active' : ''}`}
                onClick={() => setTab(entry.id)}
              >
                <Icon size={17} weight={active ? 'fill' : 'regular'} />
                <span>{entry.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {tab === 'lessons' ? <AdminLessonsPanel /> : <AdminVideoPanel />}
    </div>
  )
}
