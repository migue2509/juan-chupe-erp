import axios from 'axios'
import toast from 'react-hot-toast'
import { getApiErrorMessage } from '../utils/apiErrors'

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
})

// Attach token + fix Content-Type para FormData
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  // Si es FormData, dejar que el browser ponga el Content-Type con boundary correcto
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type']
  }
  return config
})

// Handle 401 — refresh or logout
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true
      try {
        const refresh = localStorage.getItem('refresh_token')
        const { data } = await axios.post('/api/auth/refresh/', { refresh })
        localStorage.setItem('access_token', data.access)
        original.headers.Authorization = `Bearer ${data.access}`
        return api(original)
      } catch {
        localStorage.clear()
        window.location.href = '/login'
      }
    }
    if (!error.config?.skipGlobalToast) {
      toast.error(getApiErrorMessage(error))
    }
    return Promise.reject(error)
  }
)

export default api
