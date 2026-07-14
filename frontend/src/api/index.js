import api from './client'

// Shifts
export const getActiveShift = () => api.get('/shifts/active/')
export const openShift = () => api.post('/shifts/open/')
export const closeShift = () => api.post('/shifts/close/')
export const getShifts = () => api.get('/shifts/')

// Products
export const getFlavors = () => api.get('/products/flavors/active/')
export const getAllFlavors = () => api.get('/products/flavors/')
export const createFlavor = (data) => api.post('/products/flavors/', data)
export const updateFlavor = (id, data) => api.patch(`/products/flavors/${id}/`, data)
export const deleteFlavor = (id) => api.delete(`/products/flavors/${id}/`)
export const getCupSizes = () => api.get('/products/cup-sizes/?is_active=true')
export const getAllCupSizes = () => api.get('/products/cup-sizes/')
export const createCupSize = (data) => api.post('/products/cup-sizes/', data)
export const updateCupSize = (id, data) => api.patch(`/products/cup-sizes/${id}/`, data)
export const getToppings = () => api.get('/products/toppings/?is_active=true')
export const getAllToppings = () => api.get('/products/toppings/')
export const createTopping = (data) => api.post('/products/toppings/', data)
export const updateTopping = (id, data) => api.patch(`/products/toppings/${id}/`, data)
export const deleteTopping = (id) => api.delete(`/products/toppings/${id}/`)
export const deleteCupSize = (id) => api.delete(`/products/cup-sizes/${id}/`)

// Inventory
export const getBags = () => api.get('/inventory/bags/')
export const updateBag = (id, data) => api.patch(`/inventory/bags/${id}/`, data)
export const getCupStocks = () => api.get('/inventory/cups/')
export const addBagStock     = (id, data) => api.post(`/inventory/bags/${id}/add-stock/`, data)
export const adjustBagStock  = (id, data) => api.post(`/inventory/bags/${id}/adjust/`, data)
export const addCupStock     = (id, data) => api.post(`/inventory/cups/${id}/add-stock/`, data)
export const adjustCupStock  = (id, data) => api.post(`/inventory/cups/${id}/adjust/`, data)
export const getInventoryAlerts = () => api.get('/inventory/bags/alerts/')
export const getToppingStocks    = ()           => api.get('/inventory/toppings/')
export const addToppingStock     = (id, data)   => api.post(`/inventory/toppings/${id}/add-stock/`, data)
export const adjustToppingStock  = (id, data)   => api.post(`/inventory/toppings/${id}/adjust/`, data)
export const getMovements      = (params)   => api.get('/inventory/movements/', { params })

// Sales
export const createSale = (data) => api.post('/sales/create-sale/', data)
export const getTodaySales = () => api.get('/sales/today/')
export const getSales = (params) => api.get('/sales/', { params })

// Billing
export const getInvoices  = (params)     => api.get('/billing/', { params })
export const getInvoice   = (id)         => api.get(`/billing/${id}/`)
export const voidInvoice  = (id, data)   => api.post(`/billing/${id}/void/`, data)
export const editSale     = (id, data)   => api.patch(`/sales/${id}/edit/`, data)

// Promotions
export const getPromotions = () => api.get('/promotions/')
export const getActivePromotions = () => api.get('/promotions/active/')
export const createPromotion = (data) => api.post('/promotions/', data)
export const updatePromotion = (id, data) => api.patch(`/promotions/${id}/`, data)
export const togglePromotion   = (id) => api.patch(`/promotions/${id}/toggle/`)
export const deletePromotion   = (id) => api.delete(`/promotions/${id}/`)
export const setPromotionItems = (id, items) => api.put(`/promotions/${id}/items/`, items)

// Expenses
export const getExpenses      = (params) => api.get('/expenses/', { params })
export const getTodayExpenses = ()       => api.get('/expenses/today/')
export const createExpense    = (data)   => api.post('/expenses/', data)
export const updateExpense    = (id, data) => api.patch(`/expenses/${id}/`, data)
export const deleteExpense    = (id)     => api.delete(`/expenses/${id}/`)

// Purchases
export const getPurchases = (params) => api.get('/purchases/', { params })
export const createPurchase = (data) => api.post('/purchases/', data)

// Deliveries
export const getDeliveries      = (params) => api.get('/deliveries/', { params })
export const createDelivery     = (data)   => api.post('/deliveries/', data)
export const updateDelivery     = (id, data) => api.patch(`/deliveries/${id}/`, data)
export const cancelDeliveryReq    = (id, reason = 'Domicilio cancelado') => api.post(`/deliveries/${id}/cancel/`, { reason })
export const getDeliveryHeatmap   = (params) => api.get('/deliveries/heatmap/', { params })

// Domiciliarios
export const getDomiciliarios   = ()       => api.get('/deliveries/domiciliarios/')
export const createDomiciliario = (data)   => api.post('/deliveries/domiciliarios/', data)
export const updateDomiciliario = (id, data) => api.patch(`/deliveries/domiciliarios/${id}/`, data)

// Cash audit
export const getCashAuditPrefill   = (params) => api.get('/cash/prefill/', { params })
export const createCashAudit       = (data)   => api.post('/cash/', data)
export const getCashAudit          = (id)     => api.get(`/cash/${id}/`)
export const getShiftDetail           = (id, channel = 'all') => api.get(`/shifts/${id}/detail/`, { params: { channel } })
export const saveSellerDeliveries     = (data) => api.post('/cash/save-seller-deliveries/', data)
export const saveDeliveryAmount       = (data) => api.post('/cash/save-delivery-amount/', data)

// Attendance
export const getTodayAttendance   = ()       => api.get('/attendance/today/')
export const createAttendance     = (data)   => api.post('/attendance/', data)
export const checkoutAttendance   = (id)     => api.post(`/attendance/${id}/checkout/`)
export const getAttendanceRecords = (params) => api.get('/attendance/', { params })
export const getAttendanceMetrics = (params) => api.get('/attendance/metrics/', { params })
// Operativa — solo su propio registro
export const myAttendanceStatus   = ()       => api.get('/attendance/my-status/')
export const myCheckin            = ()       => api.post('/attendance/my-checkin/')
export const myCheckout           = ()       => api.post('/attendance/my-checkout/')

// Users
export const getUsers = () => api.get('/auth/users/')
export const getOperatives = () => api.get('/auth/users/operatives/')
export const createUser = (data) => api.post('/auth/users/', data)
export const updateUser = (id, data) => api.patch(`/auth/users/${id}/`, data)
export const changePassword = (id, data) => api.post(`/auth/users/${id}/change-password/`, data)
export const toggleUserActive = (id) => api.post(`/auth/users/${id}/toggle-active/`)

// Payroll
export const getPayrollSummary    = (params)   => api.get('/payroll/payments/summary/', { params })
export const getAllSchedules       = ()         => api.get('/payroll/schedules/all-employees/')
export const upsertSchedule       = (data)     => api.post('/payroll/schedules/upsert/', data)
export const getWorkLogs          = (params)   => api.get('/payroll/logs/', { params })
export const addManualWorkLog     = (data)     => api.post('/payroll/logs/manual/', data)
export const removeWorkLog        = (id)       => api.delete(`/payroll/logs/${id}/remove/`)
export const payWages             = (data)     => api.post('/payroll/payments/pay/', data)
export const getPaymentHistory    = (params)   => api.get('/payroll/payments/', { params })

// Reports
export const getDailyReport    = (shiftId) => api.get('/reports/daily/', { params: shiftId ? { shift_id: shiftId } : {} })
export const getWeeklyReport   = () => api.get('/reports/weekly/')
export const getMonthlyReport  = () => api.get('/reports/monthly/')
export const getInventoryStatus= () => api.get('/reports/inventory/')
export const getRangeReport    = (dateFrom, dateTo, channel = 'all') => api.get('/reports/range/', { params: { date_from: dateFrom, date_to: dateTo, channel } })
export const getPlatformReport = (dateFrom, dateTo, channel = 'all') => api.get('/reports/platform/', { params: { date_from: dateFrom, date_to: dateTo, channel } })

// ── Config POS ──────────────────────────────────────────────────────────────
export const getTransferMethods    = ()       => api.get('/store-config/transfer-methods/')
export const createTransferMethod  = (data)   => api.post('/store-config/transfer-methods/', data)
export const updateTransferMethod  = (id, data) => api.patch(`/store-config/transfer-methods/${id}/`, data)
export const deleteTransferMethod  = (id)     => api.delete(`/store-config/transfer-methods/${id}/`)
