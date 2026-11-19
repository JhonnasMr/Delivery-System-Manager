'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import { createClient } from '@/lib/supabase/client'
import { daysAgoISO, todayISO } from '@/lib/utils/date'
import { INCIDENT_TYPE_LABELS } from '@/types/database'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Download, BarChart3, CheckCircle2, XCircle, Percent } from 'lucide-react'
import type { Order, Driver, DeliveryIncident } from '@/types/database'

const PIE_COLORS = [
  '#ef4444',
  '#f97316',
  '#eab308',
  '#8b5cf6',
  '#3b82f6',
  '#14b8a6',
  '#6b7280',
]

export default function ReportsPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [incidents, setIncidents] = useState<DeliveryIncident[]>([])
  const [loading, setLoading] = useState(true)

  const [preset, setPreset] = useState<string>('7d')
  const [dateFrom, setDateFrom] = useState<string>(daysAgoISO(7))
  const [dateTo, setDateTo] = useState<string>(todayISO())

  const applyPreset = (p: string) => {
    setPreset(p)
    const today = todayISO()
    if (p === 'today') {
      setDateFrom(today)
      setDateTo(today)
    } else if (p === 'yesterday') {
      const y = daysAgoISO(1)
      setDateFrom(y)
      setDateTo(y)
    } else if (p === '7d') {
      setDateFrom(daysAgoISO(7))
      setDateTo(today)
    } else if (p === '30d') {
      setDateFrom(daysAgoISO(30))
      setDateTo(today)
    } else if (p === 'month') {
      const firstOfMonth = `${today.slice(0, 7)}-01`
      setDateFrom(firstOfMonth)
      setDateTo(today)
    }
  }

  const fetchReportData = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      return
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single()

    if (!profile?.organization_id) {
      setLoading(false)
      return
    }

    const [ordersRes, driversRes, incRes] = await Promise.all([
      supabase
        .from('orders')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .is('deleted_at', null),
      supabase
        .from('drivers')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .is('deleted_at', null),
      supabase.from('delivery_incidents').select('*'),
    ])

    setOrders(ordersRes.data ?? [])
    setDrivers(driversRes.data ?? [])
    setIncidents(incRes.data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchReportData()
  }, [fetchReportData])

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const d = o.scheduled_date || o.created_at.slice(0, 10)
      return d >= dateFrom && d <= dateTo
    })
  }, [orders, dateFrom, dateTo])

  const summary = useMemo(() => {
    const total = filteredOrders.length
    const delivered = filteredOrders.filter(
      (o) => o.status === 'delivered'
    ).length
    const failed = filteredOrders.filter(
      (o) => o.status === 'delivery_failed'
    ).length
    const activeTotal =
      total - filteredOrders.filter((o) => o.status === 'cancelled').length
    const successRate =
      activeTotal > 0 ? Math.round((delivered / activeTotal) * 100) : 0
    const failRate =
      activeTotal > 0 ? Math.round((failed / activeTotal) * 100) : 0

    return { total, delivered, failed, successRate, failRate }
  }, [filteredOrders])

  const driverProductivity = useMemo(() => {
    return drivers.map((d) => {
      const dOrders = filteredOrders.filter((o) => o.assigned_driver_id === d.id)
      const delivered = dOrders.filter((o) => o.status === 'delivered').length
      const failed = dOrders.filter((o) => o.status === 'delivery_failed').length
      const rate =
        dOrders.length > 0 ? Math.round((delivered / dOrders.length) * 100) : 0
      return {
        id: d.id,
        name: d.full_name,
        asignados: dOrders.length,
        entregados: delivered,
        fallidos: failed,
        cumplimiento: rate,
      }
    })
  }, [drivers, filteredOrders])

  const incidentDistribution = useMemo(() => {
    const orderIds = new Set(filteredOrders.map((o) => o.id))
    const counts: Record<string, number> = {}
    incidents.forEach((inc) => {
      if (!orderIds.has(inc.order_id)) return
      const label = INCIDENT_TYPE_LABELS[inc.incident_type] || inc.incident_type
      counts[label] = (counts[label] ?? 0) + 1
    })
    return Object.entries(counts).map(([name, value]) => ({ name, value }))
  }, [incidents, filteredOrders])

  const exportDriverReportCSV = () => {
    const rows = [
      'Motorizado,Asignados,Entregados,Fallidos,Tasa_Cumplimiento_%',
      ...driverProductivity.map(
        (d) =>
          `"${d.name}",${d.asignados},${d.entregados},${d.fallidos},${d.cumplimiento}`
      ),
    ]
    const blob = new Blob([rows.join('\n')], {
      type: 'text/csv;charset=utf-8;',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `reporte_productividad_${dateFrom}_${dateTo}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            Reportes y Productividad Operativa
          </h1>
          <p className="text-sm text-gray-500">
            Analiza la efectividad de entregas, desempeño por motorizado y causas de incidencias
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={exportDriverReportCSV}>
          <Download className="w-4 h-4 mr-1.5" />
          Exportar reporte CSV
        </Button>
      </div>

      {/* Filtros de fecha */}
      <Card>
        <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1.5">
            {[
              { id: 'today', label: 'Hoy' },
              { id: 'yesterday', label: 'Ayer' },
              { id: '7d', label: 'Últimos 7 días' },
              { id: '30d', label: 'Últimos 30 días' },
              { id: 'month', label: 'Este mes' },
            ].map((btn) => (
              <Button
                key={btn.id}
                size="sm"
                variant={preset === btn.id ? 'default' : 'outline'}
                onClick={() => applyPreset(btn.id)}
              >
                {btn.label}
              </Button>
            ))}
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-gray-500">Desde:</span>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setPreset('custom')
                setDateFrom(e.target.value)
              }}
              className="w-36 h-8 text-xs"
            />
            <span className="text-gray-500">Hasta:</span>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setPreset('custom')
                setDateTo(e.target.value)
              }}
              className="w-36 h-8 text-xs"
            />
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="p-12 text-center text-sm text-gray-400">
          Calculando indicadores reales desde Supabase...
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-500">
                    Total pedidos en periodo
                  </p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {summary.total}
                  </p>
                </div>
                <BarChart3 className="w-8 h-8 text-blue-600" />
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-500">
                    Entregas exitosas
                  </p>
                  <p className="text-2xl font-bold text-green-600 mt-1">
                    {summary.delivered}
                  </p>
                </div>
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-500">
                    Entregas fallidas
                  </p>
                  <p className="text-2xl font-bold text-red-600 mt-1">
                    {summary.failed} ({summary.failRate}%)
                  </p>
                </div>
                <XCircle className="w-8 h-8 text-red-600" />
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-500">
                    Tasa de cumplimiento
                  </p>
                  <p className="text-2xl font-bold text-indigo-600 mt-1">
                    {summary.successRate}%
                  </p>
                </div>
                <Percent className="w-8 h-8 text-indigo-600" />
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Rendimiento por motorizado */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base font-semibold">
                  Rendimiento por motorizado
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={driverProductivity}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Legend />
                      <Bar
                        dataKey="entregados"
                        name="Entregados"
                        fill="#22c55e"
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar
                        dataKey="fallidos"
                        name="Fallidos"
                        fill="#ef4444"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Motivos de incidencia */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold">
                  Motivos de entregas fallidas
                </CardTitle>
              </CardHeader>
              <CardContent>
                {incidentDistribution.length === 0 ? (
                  <div className="h-72 flex items-center justify-center text-sm text-gray-400 text-center">
                    Sin incidencias reportadas en este rango de fechas
                  </div>
                ) : (
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={incidentDistribution}
                          dataKey="value"
                          nameKey="name"
                          outerRadius={80}
                          label
                        >
                          {incidentDistribution.map((_, idx) => (
                            <Cell
                              key={idx}
                              fill={PIE_COLORS[idx % PIE_COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Tabla resumen por motorizado */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">
                Detalle de productividad por motorizado
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500 border-b">
                  <tr>
                    <th className="px-4 py-3">Motorizado</th>
                    <th className="px-4 py-3">Pedidos asignados</th>
                    <th className="px-4 py-3">Entregados</th>
                    <th className="px-4 py-3">Fallidos</th>
                    <th className="px-4 py-3">Tasa de cumplimiento</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {driverProductivity.map((d) => (
                    <tr key={d.id}>
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {d.name}
                      </td>
                      <td className="px-4 py-3">{d.asignados}</td>
                      <td className="px-4 py-3 text-green-600 font-semibold">
                        {d.entregados}
                      </td>
                      <td className="px-4 py-3 text-red-600">{d.fallidos}</td>
                      <td className="px-4 py-3 font-bold">{d.cumplimiento}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
