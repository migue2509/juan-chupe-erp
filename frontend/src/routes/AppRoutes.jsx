import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Layout from '../components/Layout'
import Login from '../pages/Login'

// Lazy-load todas las páginas — cada una se descarga solo cuando se visita
const Dashboard  = lazy(() => import('../pages/Dashboard'))
const POS        = lazy(() => import('../pages/POS'))
const Billing    = lazy(() => import('../pages/Billing'))
const Deliveries = lazy(() => import('../pages/Deliveries'))
const Expenses   = lazy(() => import('../pages/Expenses'))
const Products   = lazy(() => import('../pages/Products'))
const Inventory  = lazy(() => import('../pages/Inventory'))
const Promotions = lazy(() => import('../pages/Promotions'))
const Shifts     = lazy(() => import('../pages/Shifts'))
const Reports    = lazy(() => import('../pages/Reports'))
const Users      = lazy(() => import('../pages/Users'))
const Attendance = lazy(() => import('../pages/Attendance'))
const Payroll    = lazy(() => import('../pages/Payroll'))
const ConfigPOS  = lazy(() => import('../pages/ConfigPOS'))
const Mapa       = lazy(() => import('../pages/Mapa'))
const Platforms  = lazy(() => import('../pages/Platforms'))

const Spinner = () => (
  <div className="flex items-center justify-center h-full w-full py-20">
    <div className="w-7 h-7 border-4 border-brand-pink border-t-transparent rounded-full animate-spin" />
  </div>
)

// Wrapper que envuelve cada página en Suspense
const S = ({ children }) => <Suspense fallback={<Spinner />}>{children}</Suspense>

function PrivateRoute({ children, adminOnly = false }) {
  const { user, loading } = useAuth()
  if (loading) return <Spinner />
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
        <Route index element={<S><Dashboard /></S>} />
        <Route path="pos"        element={<S><POS /></S>} />
        <Route path="billing"    element={<S><Billing /></S>} />
        <Route path="deliveries" element={<S><Deliveries /></S>} />
        <Route path="expenses"   element={<S><Expenses /></S>} />
        <Route path="products"   element={<PrivateRoute adminOnly><S><Products /></S></PrivateRoute>} />
        <Route path="inventory"  element={<PrivateRoute><S><Inventory /></S></PrivateRoute>} />
        <Route path="promotions" element={<PrivateRoute adminOnly><S><Promotions /></S></PrivateRoute>} />
        <Route path="shifts"     element={<PrivateRoute adminOnly><S><Shifts /></S></PrivateRoute>} />
        <Route path="reports"    element={<PrivateRoute adminOnly><S><Reports /></S></PrivateRoute>} />
        <Route path="users"      element={<PrivateRoute adminOnly><S><Users /></S></PrivateRoute>} />
        <Route path="attendance" element={<PrivateRoute><S><Attendance /></S></PrivateRoute>} />
        <Route path="payroll"    element={<PrivateRoute adminOnly><S><Payroll /></S></PrivateRoute>} />
        <Route path="config-pos" element={<PrivateRoute adminOnly><S><ConfigPOS /></S></PrivateRoute>} />
        <Route path="mapa"       element={<PrivateRoute adminOnly><S><Mapa /></S></PrivateRoute>} />
        <Route path="platforms"  element={<PrivateRoute adminOnly><S><Platforms /></S></PrivateRoute>} />
      </Route>
    </Routes>
  )
}
