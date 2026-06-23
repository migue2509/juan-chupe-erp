import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Layout from '../components/Layout'
import Login from '../pages/Login'
import Dashboard from '../pages/Dashboard'
import POS from '../pages/POS'
import Products from '../pages/Products'
import Inventory from '../pages/Inventory'
import Shifts from '../pages/Shifts'
import Promotions from '../pages/Promotions'
import Expenses from '../pages/Expenses'
import Deliveries from '../pages/Deliveries'
import CashAudit from '../pages/CashAudit'
import Reports from '../pages/Reports'
import Users from '../pages/Users'
import Billing from '../pages/Billing'
import Attendance from '../pages/Attendance'
import Payroll from '../pages/Payroll'

function PrivateRoute({ children, adminOnly = false }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="flex items-center justify-center h-screen"><div className="w-8 h-8 border-4 border-brand-pink border-t-transparent rounded-full animate-spin" /></div>
  if (!user) return <Navigate to="/login" replace />
  if (adminOnly && user.role !== 'admin') return <Navigate to="/" replace />
  return children
}

export default function AppRoutes() {
  const { user } = useAuth()
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
      <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
        <Route index element={user?.role === 'operative' ? <Navigate to="/attendance" replace /> : <Dashboard />} />
        <Route path="pos" element={<POS />} />
        <Route path="billing" element={<Billing />} />
        <Route path="deliveries" element={<Deliveries />} />
        <Route path="expenses" element={<Expenses />} />
        <Route path="products" element={<PrivateRoute adminOnly><Products /></PrivateRoute>} />
        <Route path="inventory" element={<PrivateRoute adminOnly><Inventory /></PrivateRoute>} />
        <Route path="promotions" element={<PrivateRoute adminOnly><Promotions /></PrivateRoute>} />
        <Route path="shifts" element={<PrivateRoute adminOnly><Shifts /></PrivateRoute>} />
        <Route path="cash-audit" element={<PrivateRoute adminOnly><CashAudit /></PrivateRoute>} />
        <Route path="reports" element={<PrivateRoute adminOnly><Reports /></PrivateRoute>} />
        <Route path="users" element={<PrivateRoute adminOnly><Users /></PrivateRoute>} />
        <Route path="attendance" element={<PrivateRoute><Attendance /></PrivateRoute>} />
        <Route path="payroll"    element={<PrivateRoute adminOnly><Payroll /></PrivateRoute>} />
      </Route>
    </Routes>
  )
}
