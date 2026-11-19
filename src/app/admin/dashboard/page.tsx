import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import {
  Package,
  Clock,
  UserCheck,
  Truck,
  CheckCircle2,
  XCircle,
  AlertCircle,
  CalendarClock,
  Ban,
  Users,
  TrendingUp,
  TrendingDown,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { formatDateLong } from '@/lib/utils/date'
import DashboardCharts from '@/components/dashboard/dashboard-charts'
import RecentOrders from '@/components/dashboard/recent-orders'
import type { OrderStatus } from '@/types/database'

export const metadata = { title: 'Dashboard' }

async function getDashboardStats(orgId: string) {
  const supabase = await createClient()
  const today = new Date().toISOString().split('T')[0]

  const { data: todayOrders } = await supabase
    .from('orders')
    .select('id, status')
    .eq('organization_id', orgId)
    .eq('scheduled_date', today)
    .is('deleted_at', null)

  const statusCounts: Record<OrderStatus, number> = {
    pending_assignment: 0,
    assigned: 0,
    in_transit: 0,
    delivered: 0,
    delivery_failed: 0,
    pending: 0,
    rescheduled: 0,
    cancelled: 0,
  }

  todayOrders?.forEach((o) => {
    if (o.status in statusCounts) {
      statusCounts[o.status]++
    }
  })

  const total = todayOrders?.length ?? 0
  const totalActive = total - statusCounts.cancelled
  const successRate =
    totalActive > 0
      ? Math.round((statusCounts.delivered / totalActive) * 100)
      : 0

  const { data: drivers } = await supabase
    .from('drivers')
    .select('id, status, is_active')
    .eq('organization_id', orgId)
    .is('deleted_at', null)

  const activeDrivers = drivers?.filter((d) => d.is_active) ?? []
  const availableDrivers = activeDrivers.filter(
    (d) => d.status === 'available'
  )

  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const { data: weekOrders } = await supabase
    .from('orders')
    .select('id, status, scheduled_date, created_at')
    .eq('organization_id', orgId)
    .gte('created_at', sevenDaysAgo.toISOString())
    .is('deleted_at', null)
    .order('created_at', { ascending: true })

  return {
    today: {
      total,
      ...statusCounts,
    },
    successRate,
    drivers: {
      total: activeDrivers.length,
      available: availableDrivers.length,
    },
    weekOrders: weekOrders ?? [],
  }
}

interface StatCardProps {
  title: string
  value: number | string
  icon: React.ComponentType<{ className?: string }>
  iconColor: string
  iconBg: string
  subtitle?: string
  trend?: { value: number; label: string }
}

function StatCard({
  title,
  value,
  icon: Icon,
  iconColor,
  iconBg,
  subtitle,
  trend,
}: StatCardProps) {
  return (
    <Card className="relative overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-500 truncate">
              {title}
            </p>
            <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
            {subtitle && (
              <p className="mt-0.5 text-xs text-gray-400">{subtitle}</p>
            )}
            {trend !== undefined && (
              <div className="mt-1 flex items-center gap-1">
                {trend.value >= 0 ? (
                  <TrendingUp className="w-3.5 h-3.5 text-green-500" />
                ) : (
                  <TrendingDown className="w-3.5 h-3.5 text-red-500" />
                )}
                <span
                  className={`text-xs font-medium ${
                    trend.value >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {trend.value >= 0 ? '+' : ''}
                  {trend.value}% {trend.label}
                </span>
              </div>
            )}
          </div>
          <div
            className={`flex items-center justify-center w-10 h-10 rounded-xl ${iconBg} shrink-0`}
          >
            <Icon className={`w-5 h-5 ${iconColor}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id, full_name')
    .eq('id', user.id)
    .single()

  if (!profile?.organization_id) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <Package className="w-12 h-12 text-gray-300 mb-4" />
        <h2 className="text-lg font-semibold text-gray-700">
          Sin organización asignada
        </h2>
        <p className="text-sm text-gray-500 mt-2">
          Tu cuenta no está asociada a ninguna organización. Contacta al
          administrador.
        </p>
      </div>
    )
  }

  const stats = await getDashboardStats(profile.organization_id)
  const today = formatDateLong(new Date())
  const firstName = profile.full_name.split(' ')[0]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">
          Hola, {firstName} 👋
        </h1>
        <p className="text-sm text-gray-500 mt-0.5 capitalize">
          {today} · Resumen operativo del día
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          title="Total del día"
          value={stats.today.total}
          icon={Package}
          iconColor="text-blue-600"
          iconBg="bg-blue-50"
        />
        <StatCard
          title="Entregados"
          value={stats.today.delivered}
          icon={CheckCircle2}
          iconColor="text-green-600"
          iconBg="bg-green-50"
          subtitle={`${stats.successRate}% de éxito`}
        />
        <StatCard
          title="En camino"
          value={stats.today.in_transit}
          icon={Truck}
          iconColor="text-indigo-600"
          iconBg="bg-indigo-50"
        />
        <StatCard
          title="Sin asignar"
          value={stats.today.pending_assignment}
          icon={Clock}
          iconColor="text-yellow-600"
          iconBg="bg-yellow-50"
        />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          title="Asignados"
          value={stats.today.assigned}
          icon={UserCheck}
          iconColor="text-blue-500"
          iconBg="bg-blue-50"
        />
        <StatCard
          title="Entregas fallidas"
          value={stats.today.delivery_failed}
          icon={XCircle}
          iconColor="text-red-600"
          iconBg="bg-red-50"
        />
        <StatCard
          title="Reprogramados"
          value={stats.today.rescheduled}
          icon={CalendarClock}
          iconColor="text-purple-600"
          iconBg="bg-purple-50"
        />
        <StatCard
          title="Pendientes"
          value={stats.today.pending}
          icon={AlertCircle}
          iconColor="text-orange-600"
          iconBg="bg-orange-50"
        />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          title="Motorizados activos"
          value={stats.drivers.total}
          icon={Users}
          iconColor="text-gray-600"
          iconBg="bg-gray-100"
        />
        <StatCard
          title="Disponibles"
          value={stats.drivers.available}
          icon={Users}
          iconColor="text-green-600"
          iconBg="bg-green-50"
        />
        <StatCard
          title="Cancelados"
          value={stats.today.cancelled}
          icon={Ban}
          iconColor="text-gray-500"
          iconBg="bg-gray-100"
        />
        <Card className="relative overflow-hidden bg-gradient-to-br from-blue-600 to-blue-700">
          <CardContent className="p-5">
            <p className="text-sm font-medium text-blue-100">Tasa de éxito</p>
            <p className="mt-1 text-3xl font-bold text-white">
              {stats.successRate}%
            </p>
            <p className="mt-0.5 text-xs text-blue-200">
              sobre pedidos activos del día
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <DashboardCharts
            weekOrders={stats.weekOrders}
            todayStatusCounts={stats.today}
          />
        </div>
        <div>
          <RecentOrders orgId={profile.organization_id} />
        </div>
      </div>
    </div>
  )
}
