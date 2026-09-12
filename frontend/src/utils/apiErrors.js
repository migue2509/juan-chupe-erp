export const getApiErrorMessage = (error, fallback = 'Error del servidor') => {
  const data = error?.response?.data
  if (!data) return fallback

  if (typeof data === 'string') return data
  if (data.detail) return data.detail
  if (Array.isArray(data.non_field_errors) && data.non_field_errors.length > 0) {
    return data.non_field_errors[0]
  }

  const firstFieldError = Object.values(data).find(value => {
    if (Array.isArray(value)) return value.length > 0
    return Boolean(value)
  })

  if (Array.isArray(firstFieldError)) return firstFieldError[0]
  if (firstFieldError) return String(firstFieldError)

  return fallback
}

export const getShiftCloseErrorMessage = (error) => {
  const missing = error?.response?.data?.missing_audits
  if (!Array.isArray(missing) || missing.length === 0) {
    return getApiErrorMessage(error, 'No se pudo cerrar la jornada')
  }

  const labels = { pos: 'POS', delivery: 'Domicilios' }
  const channels = missing.map(channel => labels[channel] || channel).join(' y ')
  return `Antes de cerrar marca como entregado: ${channels}.`
}
