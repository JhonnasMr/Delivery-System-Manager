'use client'

import { useMemo } from 'react'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { format, parseISO, subDays } from 'date-fns'
import { es } from 'date-fns/locale'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { ORDER_STATUS_CONFIG } from '@/lib/constants'
import type { OrderStatus } from '@/types/database'

interface DashboardChartsProps {
  weekOrders: Array<{
    id: string
    status: string
    scheduled_date: string | null
    created_at: string
  }>
  todayStatusCounts: Record<string, number>
}

const STATUS_CHART_COLORS: Record<OrderStatus, string> = {
  pending_assignment: '#eab308',
  assigned: '#3b82f6',
  in_transit: '#6366f1',
  delivered: '#22c55e',
  delivery_failed: '#ef4444',
  pending: '#f97316',
  rescheduled: '#a855f7',
  cancelled: '#6b7280',
}

export default function DashboardCharts({
  weekOrders,
  todayStatusCounts,
}: DashboardChartsProps) {
  const statusData = useMemo(() => {
    const keys: OrderStatus[] = [
      'pending_assignment',
      'assigned',
      'in_transit',
      'delivered',
      'delivery_failed',
      'pending',
      'rescheduled',
      'cancelled',
    ]
    return keys.map((key) => ({
      key,
      name: ORDER_STATUS_CONFIG[key].label,
      total: todayStatusCounts[key] ?? 0,
      color: STATUS_CHART_COLORS[key],
    }))
  }, [todayStatusCounts])

  const dailyData = useMemo(() => {
    const days: Array<{
      dateKey: string
      label: string
      entregados: number
      fallidos: number
      total: number
    }> = []

    for (let i = 6; i >= 0; i--) {
      const d = subDays(new Date(), i)
      const dateKey = format(d, 'yyyy-MM-dd')
      const label = format(d, 'EEE dd', { locale: es })
      days.push({
        dateKey,
        label: label.charAt(0).toUpperCase() + label.slice(1),
        entregados: 0,
        fallidos: 0,
        total: 0,
      })
    }

    const dayMap = new Map(days.map((d) => [d.dateKey, d]))

    weekOrders.forEach((order) => {
      const rawDate = order.scheduled_date || order.created_at.slice(0, 10)
      let key = rawDate
      try {
        key = format(parseISO(rawDate), 'yyyy-MM-dd')
      } catch {
        // fallback to slice
      }
      const entry = dayMap.get(key)
      if (entry) {
        entry.total += 1
        if (order.status === 'delivered') entry.entregados += 1
        if (order.status === 'delivery_failed') entry.fallidos += 1
      }
    })

    return days
  }, [weekOrders])

  const hasTodayOrders = statusData.some((s) => s.total > 0)

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">
            Pedidos del día por estado
          </CardTitle>
          <CardDescription>
            Distribución actual de los pedidos programados para hoy
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!hasTodayOrders ? (
            <div className="h-64 flex items-center justify-center text-sm text-gray-400">
              No hay pedidos registrados para el día de hoy
            </div>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={statusData}
                  margin={{ top: 10, right: 16, left: -10, bottom: 24 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11 }}
                    interval={0}
                    angle={-18}
                    textAnchor="end"
                  />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip
                    formatter={(value) => [value, 'Pedidos']}
                    contentStyle={{
                      borderRadius: '8px',
                      border: '1px solid #e5e7eb',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="total" radius={[6, 6, 0, 0]}>
                    {statusData.map((entry) => (
                      <Cell key={entry.key} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">
            Evolución de entregas (últimos 7 días)
          </CardTitle>
          <CardDescription>
            Comparativa de pedidos totales, entregados y fallidos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={dailyData}
                margin={{ top: 10, right: 16, left: -10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    borderRadius: '8px',
                    border: '1px solid #e5e7eb',
                    fontSize: '12px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Line
                  type="monotone"
                  dataKey="total"
                  name="Total"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
                <Line
                  type="monotone"
                  dataKey="entregados"
                  name="Entregados"
                  stroke="#22c55e"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
                <Line
                  type="monotone"
                  dataKey="fallidos"
                  name="Fallidos"
                  stroke="#ef4444"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
