import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Icon } from './Icons'

const NAV_OPERATIVE = [
  { to: '/',           label: 'Dashboard',      icon: 'dashboard' },
  { to: '/pos',        label: 'Punto de Venta', icon: 'pos' },
  { to: '/billing',    label: 'Facturas',        icon: 'billing' },
  { to: '/deliveries', label: 'Domicilios',      icon: 'deliveries' },
  { to: '/expenses',   label: 'Gastos',          icon: 'expenses' },
]

const NAV_SELLER = [
  { to: '/',            label: 'Dashboard',      icon: 'dashboard' },
  { to: '/attendance',  label: 'Asistencia',     icon: 'attendance' },
  { to: '/pos',         label: 'Punto de Venta', icon: 'pos' },
  { to: '/billing',     label: 'Facturas',       icon: 'billing' },
  { to: '/deliveries',  label: 'Domicilios',     icon: 'deliveries' },
  { to: '/expenses',    label: 'Gastos',         icon: 'expenses' },
]

const NAV_ADMIN = [
  { to: '/shifts',     label: 'Jornadas',       icon: 'shifts' },
  { to: '/products',   label: 'Productos',      icon: 'products' },
  { to: '/inventory',  label: 'Inventario',     icon: 'inventory' },
  { to: '/promotions', label: 'Promociones',    icon: 'promotions' },
  { to: '/reports',    label: 'Reportes',       icon: 'reports' },
  { to: '/users',      label: 'Usuarios',       icon: 'users' },
  { to: '/attendance', label: 'Asistencia',     icon: 'attendance' },
  { to: '/payroll',    label: 'Nómina',         icon: 'cash' },
  { to: '/config-pos', label: 'Config Pagos',   icon: 'config' },
]

export default function Sidebar({ open, onClose }) {
  const { isAdmin, user } = useAuth()
  const isSeller = user?.role === 'operative' || user?.role === 'delivery'
  const navItems = isSeller ? NAV_SELLER : NAV_OPERATIVE

  const inner = (
    <aside className="flex flex-col w-60 flex-shrink-0 h-full" style={{ background: '#0F1035' }}>
      {/* Logo */}
      <div className="px-5 py-5 border-b border-white/8">
        <div className="flex items-center gap-3">
          <img src="/logo-neon.png" alt="Juan Chupe" className="w-9 h-9 object-contain flex-shrink-0" />
          <div>
            <p className="font-bold text-white text-sm leading-tight">Juan Chupe</p>
            <p className="text-[11px] text-slate-400 leading-tight">Granizados ERP</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-0.5">
        {navItems.map(({ to, label, icon }) => (
          <NavLink key={to} to={to} end={to === '/'} onClick={onClose}
            className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
            <Icon name={icon} className="w-4 h-4 flex-shrink-0" />
            <span>{label}</span>
          </NavLink>
        ))}

        {isAdmin && (
          <>
            <div className="pt-5 pb-2 px-3">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Administración</p>
            </div>
            {NAV_ADMIN.map(({ to, label, icon }) => (
              <NavLink key={to} to={to} onClick={onClose}
                className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
                <Icon name={icon} className="w-4 h-4 flex-shrink-0" />
                <span>{label}</span>
              </NavLink>
            ))}
          </>
        )}
      </nav>

      <div className="px-5 py-4 border-t border-white/8">
        <p className="text-[10px] text-slate-500">OPIA SYSTEMS · v1.0</p>
      </div>
    </aside>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden md:flex h-full">{inner}</div>

      {/* Mobile overlay */}
      {open && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/50" onClick={onClose} />
          <div className="relative z-10 h-full">{inner}</div>
        </div>
      )}
    </>
  )
}
