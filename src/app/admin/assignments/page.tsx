'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { DRIVER_STATUS_CONFIG, LIMA_DISTRICTS } from '@/lib/constants'
import { formatDate } from '@/lib/utils/date'
import { shortId } from '@/lib/utils'
import { OrderStatusBadge } from '@/components/orders/order-status-badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Bike,
  CheckSquare,
  Square,
  ArrowRight,
  UserMinus,
  RefreshCw,
  Search,
  Package,
  Loader2,
} from 'lucide-react'
import { toast } from 'sonner'
import type { Order, Driver } from '@/types/database'

export default function AssignmentsPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [orgId, setOrgId] = useState<string>('')
  const [userId, setUserId] = useState<string>('')
  const [loading, setLoading] = useState(true)

  // Left panel filters & selection
  const [searchPending, setSearchPending] = useState('')
  const [districtFilter, setDistrictFilter] = useState('all')
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(
    new Set()
  )

  // Right panel driver selection
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [isAssigning, setIsAssigning] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setLoading(false)
      return
    }
    setUserId(user.id)

    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single()

    if (!profile?.organization_id) {
      setLoading(false)
      return
    }
    setOrgId(profile.organization_id)

    const [ordersRes, driversRes] = await Promise.all([
      supabase
        .from('orders')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .is('deleted_at', null)
        .order('scheduled_date', { ascending: true }),
      supabase
        .from('drivers')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .is('deleted_at', null)
        .order('full_name'),
    ])

    setOrders(ordersRes.data ?? [])
    setDrivers(driversRes.data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchData()

    const supabase = createClient()
    const channel = supabase
      .channel('assignments-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => {
          fetchData()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchData])

  const pendingOrders = useMemo(() => {
    return orders.filter((o) => {
      const isUnassigned =
        !o.assigned_driver_id ||
        o.status === 'pending_assignment' ||
        o.status === 'pending' ||
        o.status === 'rescheduled'
      if (!isUnassigned || o.status === 'cancelled' || o.status === 'delivered')
        return false

      if (districtFilter !== 'all' && o.delivery_district !== districtFilter)
        return false

      if (searchPending.trim() !== '') {
        const q = searchPending.toLowerCase()
        const match =
          (o.external_code ?? '').toLowerCase().includes(q) ||
          o.customer_name.toLowerCase().includes(q) ||
          o.delivery_address.toLowerCase().includes(q) ||
          (o.delivery_district ?? '').toLowerCase().includes(q)
        if (!match) return false
      }
      return true
    })
  }, [orders, districtFilter, searchPending])

  const driverStatsMap = useMemo(() => {
    const map = new Map<
      string,
      {
        activeOrders: Order[]
        completedToday: number
      }
    >()
    const today = new Date().toISOString().slice(0, 10)

    drivers.forEach((d) => {
      map.set(d.id, { activeOrders: [], completedToday: 0 })
    })

    orders.forEach((o) => {
      if (!o.assigned_driver_id) return
      const entry = map.get(o.assigned_driver_id)
      if (!entry) return

      if (o.status === 'assigned' || o.status === 'in_transit') {
        entry.activeOrders.push(o)
      } else if (
        o.status === 'delivered' &&
        (o.scheduled_date === today || o.updated_at.slice(0, 10) === today)
      ) {
        entry.completedToday += 1
      }
    })

    return map
  }, [drivers, orders])

  const toggleOrder = (id: string) => {
    setSelectedOrderIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAllPending = () => {
    if (selectedOrderIds.size === pendingOrders.length) {
      setSelectedOrderIds(new Set())
    } else {
      setSelectedOrderIds(new Set(pendingOrders.map((o) => o.id)))
    }
  }

  const selectedDriver = useMemo(
    () => drivers.find((d) => d.id === selectedDriverId) ?? null,
    [drivers, selectedDriverId]
  )

  const selectedOrdersList = useMemo(
    () => orders.filter((o) => selectedOrderIds.has(o.id)),
    [orders, selectedOrderIds]
  )

  const handleConfirmAssignment = async () => {
    if (!selectedDriver || selectedOrdersList.length === 0) return

    setIsAssigning(true)
    const supabase = createClient()
    const ids = selectedOrdersList.map((o) => o.id)

    const { error } = await supabase
      .from('orders')
      .update({
        assigned_driver_id: selectedDriver.id,
        status: 'assigned',
      })
      .in('id', ids)

    if (error) {
      setIsAssigning(false)
      toast.error(`Error al asignar pedidos: ${error.message}`)
      return
    }

    await Promise.all([
      supabase.from('order_assignments').insert(
        ids.map((orderId) => ({
          order_id: orderId,
          driver_id: selectedDriver.id,
          assigned_by: userId,
          notes: `Asignado a ${selectedDriver.full_name}`,
        }))
      ),
      supabase.from('order_status_history').insert(
        selectedOrdersList.map((o) => ({
          order_id: o.id,
          previous_status: o.status,
          new_status: 'assigned' as const,
          changed_by: userId,
          notes: `Asignado al motorizado ${selectedDriver.full_name}`,
        }))
      ),
      supabase.from('audit_logs').insert({
        organization_id: orgId,
        user_id: userId,
        action: 'assign_order',
        entity_type: 'orders',
        new_values: {
          driver_id: selectedDriver.id,
          driver_name: selectedDriver.full_name,
          order_ids: ids,
        },
      }),
    ])

    if (selectedDriver.user_id) {
      await supabase.from('notifications').insert({
        organization_id: orgId,
        user_id: selectedDriver.user_id,
        title: 'Nuevos pedidos asignados',
        body: `Se te han asignado ${ids.length} pedido(s) para reparto.`,
        type: 'order_assigned',
        related_entity: 'orders',
      })
    }

    setIsAssigning(false)
    setPreviewOpen(false)
    setSelectedOrderIds(new Set())
    toast.success(
      `${ids.length} pedido(s) asignados a ${selectedDriver.full_name}`
    )
    fetchData()
  }

  const handleUnassignOrder = async (order: Order) => {
    const supabase = createClient()
    const { error } = await supabase
      .from('orders')
      .update({
        assigned_driver_id: null,
        status: 'pending_assignment',
      })
      .eq('id', order.id)

    if (error) {
      toast.error(`No se pudo retirar la asignación: ${error.message}`)
      return
    }

    await supabase.from('order_status_history').insert({
      order_id: order.id,
      previous_status: order.status,
      new_status: 'pending_assignment',
      changed_by: userId,
      notes: 'Asignación retirada por supervisor/administrador',
    })

    toast.success('Pedido devuelto a pendientes de asignación')
    fetchData()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            Despacho y Asignación de Pedidos
          </h1>
          <p className="text-sm text-gray-500">
            Selecciona pedidos a la izquierda y asígnalos a un motorizado disponible a la derecha
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchData}>
            <RefreshCw className="w-4 h-4 mr-1.5" />
            Sincronizar
          </Button>
          <Button
            size="sm"
            disabled={selectedOrderIds.size === 0 || !selectedDriverId}
            onClick={() => setPreviewOpen(true)}
          >
            Asignar {selectedOrderIds.size > 0 ? `(${selectedOrderIds.size})` : ''}{' '}
            pedido(s)
            <ArrowRight className="w-4 h-4 ml-1.5" />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-sm text-gray-400">
          Cargando consola de asignaciones...
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* IZQUIERDA: PEDIDOS PENDIENTES */}
          <Card className="lg:col-span-7 flex flex-col">
            <CardHeader className="pb-3 border-b space-y-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Package className="w-5 h-5 text-blue-600" />
                  Pedidos pendientes de asignación ({pendingOrders.length})
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleAllPending}
                  disabled={pendingOrders.length === 0}
                >
                  {selectedOrderIds.size === pendingOrders.length &&
                  pendingOrders.length > 0
                    ? 'Deseleccionar todos'
                    : 'Seleccionar todos'}
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="relative">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <Input
                    placeholder="Buscar por cliente, código o dirección..."
                    value={searchPending}
                    onChange={(e) => setSearchPending(e.target.value)}
                    className="pl-9 h-9"
                  />
                </div>
                <select
                  value={districtFilter}
                  onChange={(e) => setDistrictFilter(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                >
                  <option value="all">Todos los distritos</option>
                  {LIMA_DISTRICTS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
            </CardHeader>

            <CardContent className="p-0 flex-1 max-h-[600px] overflow-y-auto divide-y">
              {pendingOrders.length === 0 ? (
                <div className="p-12 text-center text-gray-400 text-sm">
                  ¡Excelente! No hay pedidos pendientes de asignación con estos filtros.
                </div>
              ) : (
                pendingOrders.map((order) => {
                  const isSelected = selectedOrderIds.has(order.id)
                  return (
                    <div
                      key={order.id}
                      onClick={() => toggleOrder(order.id)}
                      className={`p-4 flex items-start gap-3 cursor-pointer transition-colors ${
                        isSelected ? 'bg-blue-50/80' : 'hover:bg-gray-50'
                      }`}
                    >
                      <button
                        type="button"
                        className="mt-0.5 text-blue-600"
                        aria-label="Seleccionar pedido"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-5 h-5" />
                        ) : (
                          <Square className="w-5 h-5 text-gray-300" />
                        )}
                      </button>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-xs font-bold text-gray-900">
                            {order.external_code || `#${shortId(order.id)}`}
                          </span>
                          <OrderStatusBadge status={order.status} size="sm" />
                        </div>
                        <p className="text-sm font-semibold text-gray-900 mt-0.5">
                          {order.customer_name}{' '}
                          <span className="font-normal text-xs text-gray-500">
                            ({order.customer_phone})
                          </span>
                        </p>
                        <p className="text-xs text-gray-600 mt-0.5">
                          <span className="font-semibold text-blue-700">
                            {order.delivery_district || 'Lima'}:
                          </span>{' '}
                          {order.delivery_address}
                        </p>
                        <p className="text-[11px] text-gray-400 mt-1">
                          Programado: {formatDate(order.scheduled_date)}
                        </p>
                      </div>
                    </div>
                  )
                })
              )}
            </CardContent>
          </Card>

          {/* DERECHA: MOTORIZADOS Y SU CARGA */}
          <Card className="lg:col-span-5 flex flex-col">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Bike className="w-5 h-5 text-green-600" />
                Motorizados y carga de trabajo ({drivers.length})
              </CardTitle>
            </CardHeader>

            <CardContent className="p-4 space-y-3 max-h-[600px] overflow-y-auto">
              {drivers.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">
                  No hay motorizados registrados.
                </p>
              ) : (
                drivers.map((driver) => {
                  const stats = driverStatsMap.get(driver.id) ?? {
                    activeOrders: [],
                    completedToday: 0,
                  }
                  const statusCfg = DRIVER_STATUS_CONFIG[driver.status]
                  const isSelected = selectedDriverId === driver.id

                  return (
                    <div
                      key={driver.id}
                      onClick={() =>
                        driver.is_active && setSelectedDriverId(driver.id)
                      }
                      className={`rounded-xl border p-4 transition-all ${
                        !driver.is_active
                          ? 'opacity-50 bg-gray-50 cursor-not-allowed'
                          : isSelected
                          ? 'border-blue-600 ring-2 ring-blue-500/20 bg-blue-50/30 cursor-pointer'
                          : 'hover:border-gray-300 cursor-pointer bg-white'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-sm text-gray-900">
                              {driver.full_name}
                            </p>
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${statusCfg.bgColor} ${statusCfg.textColor}`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${statusCfg.dotColor}`}
                              />
                              {statusCfg.label}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">
                            Tel: {driver.phone}
                          </p>
                        </div>

                        <div className="text-right text-xs">
                          <span className="font-bold text-blue-700">
                            {stats.activeOrders.length} en ruta
                          </span>
                          <p className="text-gray-400">
                            {stats.completedToday} entregados hoy
                          </p>
                        </div>
                      </div>

                      {/* Lista compacta de pedidos actuales del motorizado */}
                      {stats.activeOrders.length > 0 && (
                        <div className="mt-3 pt-2.5 border-t space-y-1.5">
                          <p className="text-[11px] font-semibold uppercase text-gray-400">
                            Pedidos asignados actualmente:
                          </p>
                          {stats.activeOrders.map((ao) => (
                            <div
                              key={ao.id}
                              className="flex items-center justify-between text-xs bg-gray-50 px-2.5 py-1.5 rounded-md"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="truncate pr-2">
                                <span className="font-mono font-semibold">
                                  {ao.external_code || `#${shortId(ao.id)}`}
                                </span>{' '}
                                · {ao.customer_name} ({ao.delivery_district})
                              </div>
                              <button
                                type="button"
                                title="Retirar asignación"
                                onClick={() => handleUnassignOrder(ao)}
                                className="text-red-500 hover:text-red-700 p-1 shrink-0"
                              >
                                <UserMinus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal de vista previa y confirmación de asignación */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar asignación de pedidos</DialogTitle>
            <DialogDescription>
              Revisa el resumen antes de asignar los pedidos al motorizado.
            </DialogDescription>
          </DialogHeader>

          {selectedDriver && (
            <div className="space-y-4 text-sm">
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                <p className="text-xs text-blue-600 uppercase font-semibold">
                  Motorizado seleccionado
                </p>
                <p className="text-base font-bold text-blue-950">
                  {selectedDriver.full_name}
                </p>
                <p className="text-xs text-blue-700">
                  Teléfono: {selectedDriver.phone}
                </p>
              </div>

              <div>
                <p className="font-medium text-gray-700 mb-2">
                  Pedidos a asignar ({selectedOrdersList.length}):
                </p>
                <div className="max-h-48 overflow-y-auto border rounded-lg divide-y text-xs">
                  {selectedOrdersList.map((o) => (
                    <div
                      key={o.id}
                      className="p-2.5 flex items-center justify-between"
                    >
                      <div>
                        <span className="font-mono font-bold">
                          {o.external_code || `#${shortId(o.id)}`}
                        </span>{' '}
                        — {o.customer_name}
                      </div>
                      <span className="text-gray-500">
                        {o.delivery_district}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPreviewOpen(false)}
              disabled={isAssigning}
            >
              Cancelar
            </Button>
            <Button onClick={handleConfirmAssignment} disabled={isAssigning}>
              {isAssigning ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Asignando...
                </>
              ) : (
                'Confirmar asignación'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
