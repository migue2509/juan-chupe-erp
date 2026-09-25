import toast from 'react-hot-toast'
import { Icon } from '../components/Icons'

const TONE_STYLES = {
  danger: {
    icon: 'trash',
    iconClass: 'bg-red-50 text-red-500 border-red-100',
    accentClass: 'border-red-200',
    buttonClass: 'btn-danger',
  },
  warning: {
    icon: 'alert',
    iconClass: 'bg-amber-50 text-amber-600 border-amber-100',
    accentClass: 'border-amber-200',
    buttonClass: 'btn-primary',
  },
  info: {
    icon: 'info',
    iconClass: 'bg-cyan-50 text-cyan-700 border-cyan-100',
    accentClass: 'border-cyan-200',
    buttonClass: 'btn-primary',
  },
}

function ConfirmationToast({
  visible,
  title,
  message,
  confirmText,
  cancelText,
  tone,
  onConfirm,
  onCancel,
}) {
  const style = TONE_STYLES[tone] || TONE_STYLES.danger

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-label={title}
      className={`w-[360px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border ${style.accentClass} bg-white shadow-xl transition-all duration-200 ${
        visible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
      }`}
    >
      <div className="flex gap-3 p-4">
        <span className={`mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border ${style.iconClass}`}>
          <Icon name={style.icon} className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-brand-navy">{title}</p>
          {message && (
            <p className="mt-1 text-sm leading-5 text-gray-500">{message}</p>
          )}
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-gray-300 transition-colors hover:bg-gray-100 hover:text-gray-500"
          aria-label="Cerrar confirmacion"
        >
          <Icon name="x" className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex justify-end gap-2 border-t border-gray-100 bg-slate-50 px-4 py-3">
        <button type="button" onClick={onCancel} className="btn-secondary px-3 py-1.5 text-xs">
          {cancelText}
        </button>
        <button type="button" onClick={onConfirm} className={`${style.buttonClass} px-3 py-1.5 text-xs`}>
          {confirmText}
        </button>
      </div>
    </div>
  )
}

export function confirmAction({
  title = 'Confirmar accion',
  message = '',
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  tone = 'danger',
} = {}) {
  return new Promise((resolve) => {
    let resolved = false
    let toastId

    const finish = (value) => {
      if (resolved) return
      resolved = true
      toast.dismiss(toastId)
      resolve(value)
    }

    toastId = toast.custom(
      (t) => (
        <ConfirmationToast
          visible={t.visible}
          title={title}
          message={message}
          confirmText={confirmText}
          cancelText={cancelText}
          tone={tone}
          onConfirm={() => finish(true)}
          onCancel={() => finish(false)}
        />
      ),
      {
        duration: Infinity,
        position: 'top-right',
      }
    )
  })
}
