import type { OrderStatus, DriverStatus, UserRole } from '@/types/database'

// ============================================================
// ORDER STATUS CONFIG
// ============================================================

export const ORDER_STATUS_CONFIG: Record<
  OrderStatus,
  {
    label: string
    color: string
    bgColor: string
    textColor: string
    icon: string
  }
> = {
  pending_assignment: {
    label: 'Pendiente de asignación',
    color: 'yellow',
    bgColor: 'bg-yellow-100',
    textColor: 'text-yellow-800',
    icon: 'Clock',
  },
  assigned: {
    label: 'Asignado',
    color: 'blue',
    bgColor: 'bg-blue-100',
    textColor: 'text-blue-800',
    icon: 'UserCheck',
  },
  in_transit: {
    label: 'En camino',
    color: 'indigo',
    bgColor: 'bg-indigo-100',
    textColor: 'text-indigo-800',
    icon: 'Truck',
  },
  delivered: {
    label: 'Entregado',
    color: 'green',
    bgColor: 'bg-green-100',
    textColor: 'text-green-800',
    icon: 'CheckCircle2',
  },
  delivery_failed: {
    label: 'Entrega fallida',
    color: 'red',
    bgColor: 'bg-red-100',
    textColor: 'text-red-800',
    icon: 'XCircle',
  },
  pending: {
    label: 'Pendiente',
    color: 'orange',
    bgColor: 'bg-orange-100',
    textColor: 'text-orange-800',
    icon: 'AlertCircle',
  },
  rescheduled: {
    label: 'Reprogramado',
    color: 'purple',
    bgColor: 'bg-purple-100',
    textColor: 'text-purple-800',
    icon: 'CalendarClock',
  },
  cancelled: {
    label: 'Cancelado',
    color: 'gray',
    bgColor: 'bg-gray-100',
    textColor: 'text-gray-600',
    icon: 'Ban',
  },
}

// ============================================================
// DRIVER STATUS CONFIG
// ============================================================

export const DRIVER_STATUS_CONFIG: Record<
  DriverStatus,
  {
    label: string
    bgColor: string
    textColor: string
    dotColor: string
  }
> = {
  available: {
    label: 'Disponible',
    bgColor: 'bg-green-100',
    textColor: 'text-green-800',
    dotColor: 'bg-green-500',
  },
  busy: {
    label: 'Ocupado',
    bgColor: 'bg-blue-100',
    textColor: 'text-blue-800',
    dotColor: 'bg-blue-500',
  },
  inactive: {
    label: 'Inactivo',
    bgColor: 'bg-gray-100',
    textColor: 'text-gray-600',
    dotColor: 'bg-gray-400',
  },
  suspended: {
    label: 'Suspendido',
    bgColor: 'bg-red-100',
    textColor: 'text-red-800',
    dotColor: 'bg-red-500',
  },
}

// ============================================================
// DISTRICTS (Lima, Peru — initial configuration)
// ============================================================

export const LIMA_DISTRICTS = [
  'Ancón',
  'Ate',
  'Barranco',
  'Bellavista',
  'Breña',
  'Callao',
  'Carabayllo',
  'Cercado de Lima',
  'Chorrillos',
  'Cieneguilla',
  'Comas',
  'El Agustino',
  'Independencia',
  'Jesús María',
  'La Molina',
  'La Punta',
  'La Victoria',
  'Lince',
  'Los Olivos',
  'Lurigancho-Chosica',
  'Lurín',
  'Magdalena del Mar',
  'Miraflores',
  'Pachacámac',
  'Pucusana',
  'Pueblo Libre',
  'Puente Piedra',
  'Punta Hermosa',
  'Punta Negra',
  'Rímac',
  'San Bartolo',
  'San Borja',
  'San Isidro',
  'San Juan de Lurigancho',
  'San Juan de Miraflores',
  'San Luis',
  'San Martín de Porres',
  'San Miguel',
  'Santa Anita',
  'Santa María del Mar',
  'Santa Rosa',
  'Santiago de Surco',
  'Surco',
  'Surquillo',
  'Villa El Salvador',
  'Villa María del Triunfo',
] as const

export type LimaDistrict = (typeof LIMA_DISTRICTS)[number]

// ============================================================
// INCIDENT REASONS
// ============================================================

export const INCIDENT_REASONS = [
  { value: 'customer_absent', label: 'Cliente ausente' },
  { value: 'customer_not_responding', label: 'Cliente no responde' },
  { value: 'incorrect_address', label: 'Dirección incorrecta' },
  { value: 'customer_rejected', label: 'Cliente rechazó el pedido' },
  { value: 'access_problem', label: 'Problema de acceso' },
  { value: 'product_problem', label: 'Problema con el producto' },
  { value: 'other', label: 'Otro' },
] as const

// ============================================================
// FILE UPLOAD CONFIG
// ============================================================

export const EVIDENCE_CONFIG = {
  maxSizeBytes: 10 * 1024 * 1024, // 10 MB
  allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/heic'],
  allowedExtensions: ['.jpg', '.jpeg', '.png', '.webp', '.heic'],
  bucketName: 'delivery-evidence',
  maxWidth: 1920,
  maxHeight: 1920,
}

// ============================================================
// PAGINATION
// ============================================================

export const DEFAULT_PAGE_SIZE = 20
export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100]

// ============================================================
// WHATSAPP
// ============================================================

export const WHATSAPP_CONFIG = {
  baseUrl: 'https://wa.me/',
  defaultCountryCode: '51', // Peru
  messageVariables: [
    '{{cliente}}',
    '{{codigo_pedido}}',
    '{{motorizado}}',
    '{{telefono_motorizado}}',
    '{{direccion}}',
    '{{fecha_entrega}}',
  ],
}

// ============================================================
// DATE FORMATS
// ============================================================

export const DATE_FORMAT = 'dd/MM/yyyy'
export const DATE_TIME_FORMAT = 'dd/MM/yyyy HH:mm'
export const TIME_FORMAT = 'HH:mm'
export const TIMEZONE = 'America/Lima'

// ============================================================
// CURRENCY
// ============================================================

export const CURRENCY_CONFIG = {
  code: 'PEN',
  symbol: 'S/',
  locale: 'es-PE',
}

// ============================================================
// NAV ITEMS
// ============================================================

export const ADMIN_NAV_ITEMS = [
  {
    label: 'Dashboard',
    href: '/admin/dashboard',
    icon: 'LayoutDashboard',
  },
  {
    label: 'Pedidos',
    href: '/admin/orders',
    icon: 'Package',
  },
  {
    label: 'Asignaciones',
    href: '/admin/assignments',
    icon: 'ClipboardList',
  },
  {
    label: 'Motorizados',
    href: '/admin/drivers',
    icon: 'Bike',
  },
  {
    label: 'Reportes',
    href: '/admin/reports',
    icon: 'BarChart3',
  },
  {
    label: 'Configuración',
    href: '/admin/settings',
    icon: 'Settings',
  },
] as const

export const DRIVER_NAV_ITEMS = [
  {
    label: 'Mis pedidos',
    href: '/driver',
    icon: 'Package',
  },
  {
    label: 'Historial',
    href: '/driver/history',
    icon: 'History',
  },
  {
    label: 'Mi perfil',
    href: '/driver/profile',
    icon: 'User',
  },
] as const

// ============================================================
// ROLES AVAILABLE FOR DISPLAY
// ============================================================

export const USER_ROLES: { value: UserRole; label: string }[] = [
  { value: 'super_admin', label: 'Super Administrador' },
  { value: 'admin', label: 'Administrador' },
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'driver', label: 'Motorizado' },
]
