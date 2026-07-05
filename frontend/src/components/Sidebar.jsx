import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Icon } from './Icons'

// Grupos por rol — cada sección tiene label (null = sin cabecera) + items
const GROUPS_ADMIN = [
  {
    label: null,
    items: [
      { to: '/',        label: 'Dashboard',      icon: 'dashboard' },
    ],
  },
  {
    label: 'Operaciones',
    items: [
      { to: '/pos',        label: 'Punto de Venta', icon: 'pos' },
      { to: '/billing',    label: 'Facturas',        icon: 'billing' },
      { to: '/deliveries', label: 'Domicilios',      icon: 'deliveries' },
      { to: '/expenses',   label: 'Gastos',          icon: 'expenses' },
    ],
  },
  {
    label: 'Turno',
    items: [
      { to: '/shifts', label: 'Jornadas', icon: 'shifts' },
    ],
  },
  {
    label: 'Catalogo',
    items: [
      { to: '/products',   label: 'Productos',   icon: 'products' },
      { to: '/promotions', label: 'Promociones', icon: 'promotions' },
      { to: '/inventory',  label: 'Inventario',  icon: 'inventory' },
    ],
  },
  {
    label: 'Analisis',
    items: [
      { to: '/reports',    label: 'Reportes',   icon: 'reports' },
      { to: '/platforms',  label: 'Plataformas', icon: 'platform' },
      { to: '/mapa',       label: 'Mapa',        icon: 'map' },
    ],
  },
  {
    label: 'Equipo',
    items: [
      { to: '/users',      label: 'Usuarios',   icon: 'users' },
      { to: '/attendance', label: 'Asistencia', icon: 'attendance' },
      { to: '/payroll',    label: 'Nomina',     icon: 'cash' },
    ],
  },
  {
    label: 'Configuracion',
    items: [
      { to: '/config-pos', label: 'Config Pagos', icon: 'config' },
    ],
  },
]

const GROUPS_SELLER = [
  {
    label: null,
    items: [
      { to: '/', label: 'Dashboard', icon: 'dashboard' },
    ],
  },
  {
    label: 'Operaciones',
    items: [
      { to: '/pos',        label: 'Punto de Venta', icon: 'pos' },
      { to: '/billing',    label: 'Facturas',        icon: 'billing' },
      { to: '/deliveries', label: 'Domicilios',      icon: 'deliveries' },
      { to: '/expenses',   label: 'Gastos',          icon: 'expenses' },
      { to: '/inventory',  label: 'Inventario',      icon: 'inventory' },
    ],
  },
  {
    label: 'Personal',
    items: [
      { to: '/attendance', label: 'Asistencia', icon: 'attendance' },
    ],
  },
]

const GROUPS_DELIVERY = [
  {
    label: null,
    items: [
      { to: '/', label: 'Dashboard', icon: 'dashboard' },
    ],
  },
  {
    label: 'Operaciones',
    items: [
      { to: '/pos',        label: 'Punto de Venta', icon: 'pos' },
      { to: '/billing',    label: 'Facturas',        icon: 'billing' },
      { to: '/deliveries', label: 'Domicilios',      icon: 'deliveries' },
      { to: '/expenses',   label: 'Gastos',          icon: 'expenses' },
    ],
  },
]

function NavGroups({ groups, onClose }) {
  return (
    <>
      {groups.map((group, gi) => (
        <div key={gi} className={gi > 0 ? 'pt-3' : ''}>
          {group.label && (
            <div className="px-3 pb-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                {group.label}
              </p>
            </div>
          )}
          <div className="space-y-0.5">
            {group.items.map(({ to, label, icon }) => (
              <NavLink key={to} to={to} end={to === '/'} onClick={onClose}
                className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
                <Icon name={icon} className="w-4 h-4 flex-shrink-0" />
                <span>{label}</span>
              </NavLink>
            ))}
          </div>
        </div>
      ))}
    </>
  )
}

export default function Sidebar({ open, onClose }) {
  const { isAdmin, user } = useAuth()

  const groups = isAdmin
    ? GROUPS_ADMIN
    : user?.role === 'delivery'
      ? GROUPS_DELIVERY
      : GROUPS_SELLER

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
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        <NavGroups groups={groups} onClose={onClose} />
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
