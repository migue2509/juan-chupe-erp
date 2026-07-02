import { useState } from 'react'

const RULES = [
  { id: 'length',   label: 'Mínimo 8 caracteres',         test: v => v.length >= 8 },
  { id: 'upper',    label: 'Una letra mayúscula',          test: v => /[A-Z]/.test(v) },
  { id: 'lower',    label: 'Una letra minúscula',          test: v => /[a-z]/.test(v) },
  { id: 'number',   label: 'Un número',                   test: v => /\d/.test(v) },
  { id: 'special',  label: 'Un carácter especial (!@#$…)', test: v => /[!@#$%^&*()\-_=+\[\]{}|;:'",.<>?/\\`~]/.test(v) },
]

function strengthColor(score) {
  if (score <= 1) return 'bg-red-400'
  if (score <= 3) return 'bg-amber-400'
  return 'bg-green-400'
}

function strengthLabel(score) {
  if (score <= 1) return 'Muy débil'
  if (score <= 3) return 'Débil'
  if (score === 4) return 'Buena'
  return 'Fuerte'
}

function strengthTextColor(score) {
  if (score <= 1) return 'text-red-500'
  if (score <= 3) return 'text-amber-500'
  return 'text-green-600'
}

/**
 * PasswordField — input de contraseña con medidor de seguridad.
 *
 * Props:
 *   value       string
 *   onChange    (value: string) => void
 *   placeholder string
 *   autoFocus   bool
 *   label       string  (default: "Contraseña")
 */
export default function PasswordField({ value, onChange, placeholder = 'Contraseña', autoFocus = false, label = 'Contraseña' }) {
  const [show, setShow] = useState(false)

  const results = RULES.map(r => ({ ...r, ok: r.test(value) }))
  const score   = results.filter(r => r.ok).length

  // Only show checklist after user starts typing
  const showDetails = value.length > 0

  return (
    <div>
      <label className="label">{label}</label>

      {/* Input */}
      <div className="relative">
        <input
          className="input pr-10"
          type={show ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          autoComplete="new-password"
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setShow(v => !v)}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
        >
          {show ? (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          )}
        </button>
      </div>

      {/* Strength bar + checklist */}
      {showDetails && (
        <div className="mt-2 space-y-2">
          {/* Bar */}
          <div className="flex items-center gap-2">
            <div className="flex gap-0.5 flex-1">
              {[1, 2, 3, 4, 5].map(i => (
                <div
                  key={i}
                  className={`h-1 flex-1 rounded-full transition-all duration-300 ${i <= score ? strengthColor(score) : 'bg-gray-100'}`}
                />
              ))}
            </div>
            <span className={`text-[11px] font-semibold ${strengthTextColor(score)}`}>
              {strengthLabel(score)}
            </span>
          </div>

          {/* Checklist */}
          <ul className="grid grid-cols-1 gap-0.5">
            {results.map(r => (
              <li key={r.id} className={`flex items-center gap-1.5 text-[11px] transition-colors ${r.ok ? 'text-green-600' : 'text-gray-400'}`}>
                {r.ok ? (
                  <svg className="w-3 h-3 flex-shrink-0 text-green-500" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <div className="w-3 h-3 flex-shrink-0 rounded-full border border-gray-300" />
                )}
                {r.label}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

/** Utility: returns true if the password passes all rules */
export function isPasswordStrong(value) {
  return RULES.every(r => r.test(value))
}
