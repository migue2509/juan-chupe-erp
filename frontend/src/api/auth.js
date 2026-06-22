import api from './client'

export const login = (username, password) =>
  api.post('/auth/login/', { username, password })

export const getUsers = () => api.get('/auth/users/')
export const createUser = (data) => api.post('/auth/users/', data)
export const updateUser = (id, data) => api.patch(`/auth/users/${id}/`, data)
export const toggleUser = (id) => api.patch(`/auth/users/${id}/toggle-active/`)
export const changePassword = (data) => api.post('/auth/users/change-password/', data)
export const getOperatives = () => api.get('/auth/users/operatives/')
