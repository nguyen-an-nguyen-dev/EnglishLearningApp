import { useEffect, useId, useRef } from 'react'
import type { ReactNode } from 'react'
import { Books, X } from '@phosphor-icons/react'
import { useI18n } from '../../i18n'

interface AdminDialogProps {
  open: boolean
  title: string
  description?: string
  /** Context line, e.g. which lesson the question belongs to. */
  scope?: string
  busy?: boolean
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}

/**
 * One native `<dialog>` shell for every admin form: centred, scrolls its body,
 * keeps the footer visible, and puts focus on the first field instead of the
 * close button.
 */
export function AdminDialog({
  open,
  title,
  description,
  scope,
  busy = false,
  onClose,
  children,
  footer,
}: AdminDialogProps) {
  const { t } = useI18n()
  const titleId = useId()
  const descriptionId = useId()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) {
      dialog.showModal()
      const body = bodyRef.current
      const target = body?.querySelector<HTMLElement>('[data-autofocus]')
        ?? body?.querySelector<HTMLElement>('input:not([type="radio"]):not([type="hidden"]), textarea, select')
      target?.focus()
    }
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={dialogRef}
      className="admin-dialog"
      aria-busy={busy}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={(event) => {
        if (busy) event.preventDefault()
      }}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onClose()
      }}
    >
      <div className="admin-dialog-panel">
        <header className="admin-dialog-head">
          <div>
            <h2 className="admin-dialog-title" id={titleId}>{title}</h2>
            {description && <p className="admin-dialog-desc" id={descriptionId}>{description}</p>}
            {scope && (
              <p className="admin-dialog-scope">
                <Books size={13} weight="bold" />
                <span>{scope}</span>
              </p>
            )}
          </div>
          <button
            type="button"
            className="admin-icon-btn"
            onClick={onClose}
            disabled={busy}
            aria-label={t.close}
            title={t.close}
          >
            <X size={18} />
          </button>
        </header>
        <div className="admin-dialog-body" ref={bodyRef}>{children}</div>
        {footer && <footer className="admin-dialog-footer">{footer}</footer>}
      </div>
    </dialog>
  )
}
