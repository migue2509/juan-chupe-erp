import api from './client'

export const login = (username, password) =>
  api.post('/auth/login/', { username, password })

export const getUsers = () => api.get('/auth/users/')
export const createUser = (data) => api.post('/auth/users/', data)
export const updateUser = (id, data) => api.patch(`/auth/users/${id}/`, data)
export const toggleUser = (id) => api.patch(`/auth/users/${id}/toggle-active/`)
export const changePassword = (data) => api.post('/auth/users/change-password/', data)
export const deleteUser = (id) => api.delete(`/auth/users/${id}/`)
export const getOperatives = () => api.get('/auth/users/operatives/')
export const getDeliveryPeople = () => api.get('/auth/users/?role=delivery')
export const uploadAvatar = (userId, file) => {
  const form = new FormData()
  form.append('avatar', file)
  return api.post(`/auth/users/${userId}/upload-avatar/`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}
export const removeAvatar = (userId) => api.post(`/auth/users/${userId}/remove-avatar/`)
