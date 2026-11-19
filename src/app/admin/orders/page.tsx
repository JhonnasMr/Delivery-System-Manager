'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { LIMA_DISTRICTS, ORDER_STATUS_CONFIG, DEFAULT_PAGE_SIZE } from '@/lib/constants'
import { formatDate, formatDateTime } from '@/lib/utils/date'
import { buildWhatsAppUrl, formatCurrency, shortId } from '@/lib/utils'
import { OrderStatusBadge } from '@/components/orders/order-status-badge'
import { OrderFormDialog } from '@/components/orders/order-form-dialog'
import { OrderImportDialog } from '@/components/orders/order-import-dialog'
import { OrderDetailSheet } from '@/components/orders/order-detail-sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import {
  Plus,
  Upload,
  Search,
  Eye,
  Pencil,
  Ban,
  MessageSquare,
  Download,
  UserCheck,
  RefreshCw,
  ArrowUpDown,
} from 'lucide-react'
import { toast } from 'sonner'
import type { Order, Driver, OrderStatus } from '@/types/database'

type OrderRow = Order & {
  driver_name?: string | null
}

type SortKey =
  | 'external_code'
  | 'customer_name'
  | 'delivery_district'
  | 'status'
  | 'scheduled_date'
  | 'updated_at'

export default function OrdersPage() {
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [drivers, setDrivers] = useState<
    Pick<Driver, 'id' | 'full_name' | 'status'>[]
  >([])
  const [orgId, setOrgId] = useState<string>('')
  const [userId, setUserId] = useState<string>('')
  const [loading, setLoading] = useState(true)

  // Filters
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [districtFilter, setDistrictFilter] = useState<string>('all')
  const [driverFilter, setDriverFilter] = useState<string>('all')
  const [dateFilter, setDateFilter] = useState<string>('')

  // Sorting, Pagination & Selection
  const [sortKey, setSortKey] = useState<SortKey>('updated_at')
  const [sortAsc, setSortAsc] = useState<boolean>(false)
  const [pageIndex, setPageIndex] = useState<number>(0)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkDriverId, setBulkDriverId] = useState<string>('')

  // Dialogs
  const [formOpen, setFormOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [editingOrder, setEditingOrder] = useState<Order | null>(null)
  const [selectedOrder, setSelectedOrder] = useState<OrderRow | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  const fetchAll = useCallback(async () => {
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
        .select(
          `
          *,
          drivers:assigned_driver_id (
            id,
            full_name
          )
        `
        )
        .eq('organization_id', profile.organization_id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false }),
      supabase
        .from('drivers')
        .select('id, full_name, status')
        .eq('organization_id', profile.organization_id)
        .eq('is_active', true)
        .is('deleted_at', null)
        .order('full_name'),
    ])

    if (ordersRes.error) {
      toast.error(`Error al cargar pedidos: ${ordersRes.error.message}`)
    } else {
      const mapped: OrderRow[] = (ordersRes.data ?? []).map((o) => {
        const d = Array.isArray(o.drivers) ? o.drivers[0] : o.drivers
        return {
          ...o,
          driver_name: d?.full_name ?? null,
        }
      })
      setOrders(mapped)
    }

    setDrivers(driversRes.data ?? [])
    setSelectedIds(new Set())
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  // Filtered and Sorted data
  const filteredOrders = useMemo(() => {
    const filtered = orders.filter((o) => {
      if (statusFilter !== 'all' && o.status !== statusFilter) return false
      if (districtFilter !== 'all' && o.delivery_district !== districtFilter)
        return false
      if (driverFilter === 'unassigned' && o.assigned_driver_id !== null)
        return false
      if (
        driverFilter !== 'all' &&
        driverFilter !== 'unassigned' &&
        o.assigned_driver_id !== driverFilter
      )
        return false
      if (dateFilter && o.scheduled_date !== dateFilter) return false

      if (search.trim() !== '') {
        const q = search.toLowerCase()
        const codeMatch = (o.external_code ?? '').toLowerCase().includes(q)
        const idMatch = o.id.toLowerCase().includes(q)
        const nameMatch = o.customer_name.toLowerCase().includes(q)
        const phoneMatch = o.customer_phone.toLowerCase().includes(q)
        const addrMatch = o.delivery_address.toLowerCase().includes(q)
        if (!codeMatch && !idMatch && !nameMatch && !phoneMatch && !addrMatch) {
          return false
        }
      }
      return true
    })

    return [...filtered].sort((a, b) => {
      const valA = String(a[sortKey] ?? '')
      const valB = String(b[sortKey] ?? '')
      const cmp = valA.localeCompare(valB, 'es', { numeric: true })
      return sortAsc ? cmp : -cmp
    })
  }, [
    orders,
    statusFilter,
    districtFilter,
    driverFilter,
    dateFilter,
    search,
    sortKey,
    sortAsc,
  ])

  const pageCount = Math.max(
    1,
    Math.ceil(filteredOrders.length / DEFAULT_PAGE_SIZE)
  )
  const paginatedOrders = useMemo(() => {
    const start = pageIndex * DEFAULT_PAGE_SIZE
    return filteredOrders.slice(start, start + DEFAULT_PAGE_SIZE)
  }, [filteredOrders, pageIndex])

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc)
    } else {
      setSortKey(key)
      setSortAsc(true)
    }
  }

  const toggleRow = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const allPageSelected =
    paginatedOrders.length > 0 &&
    paginatedOrders.every((o) => selectedIds.has(o.id))

  const toggleAllPage = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (allPageSelected) {
        paginatedOrders.forEach((o) => next.delete(o.id))
      } else {
        paginatedOrders.forEach((o) => next.add(o.id))
      }
      return next
    })
  }

  const handleCancelOrder = async (order: OrderRow) => {
    const reason = window.prompt(
      `Ingresa el motivo de cancelación para el pedido ${
        order.external_code || shortId(order.id)
      }:`
    )
    if (!reason || reason.trim() === '') return

    const supabase = createClient()
    const { error } = await supabase
      .from('orders')
      .update({ status: 'cancelled' })
      .eq('id', order.id)

    if (error) {
      toast.error(`No se pudo cancelar: ${error.message}`)
      return
    }

    await Promise.all([
      supabase.from('order_status_history').insert({
        order_id: order.id,
        previous_status: order.status,
        new_status: 'cancelled',
        changed_by: userId,
        reason: reason.trim(),
        notes: `Cancelado administrativamente: ${reason.trim()}`,
      }),
      supabase.from('audit_logs').insert({
        organization_id: orgId,
        user_id: userId,
        action: 'cancel_order',
        entity_type: 'orders',
        entity_id: order.id,
        previous_values: { status: order.status },
        new_values: { status: 'cancelled', reason: reason.trim() },
      }),
    ])

    toast.success('Pedido cancelado y registrado en auditoría')
    fetchAll()
  }

  const selectedRows = useMemo(
    () => orders.filter((o) => selectedIds.has(o.id)),
    [orders, selectedIds]
  )

  const handleBulkAssign = async () => {
    if (!bulkDriverId) {
      toast.error('Selecciona un motorizado para asignar')
      return
    }
    if (selectedRows.length === 0) return

    const supabase = createClient()
    const ids = selectedRows.map((o) => o.id)

    const { error } = await supabase
      .from('orders')
      .update({
        assigned_driver_id: bulkDriverId,
        status: 'assigned',
      })
      .in('id', ids)

    if (error) {
      toast.error(`Error en asignación masiva: ${error.message}`)
      return
    }

    await Promise.all([
      supabase.from('order_assignments').insert(
        ids.map((orderId) => ({
          order_id: orderId,
          driver_id: bulkDriverId,
          assigned_by: userId,
          notes: 'Asignación masiva desde módulo de pedidos',
        }))
      ),
      supabase.from('order_status_history').insert(
        selectedRows.map((o) => ({
          order_id: o.id,
          previous_status: o.status,
          new_status: 'assigned' as const,
          changed_by: userId,
          notes: 'Asignado en lote a motorizado',
        }))
      ),
    ])

    toast.success(`${ids.length} pedidos asignados correctamente`)
    setBulkDriverId('')
    fetchAll()
  }

  const handleExportCSV = () => {
    const headers = [
      'Codigo',
      'Cliente',
      'Telefono',
      'Distrito',
      'Direccion',
      'Motorizado',
      'Estado',
      'Fecha_Programada',
      'Importe',
    ]
    const csvRows = [
      headers.join(','),
      ...filteredOrders.map((o) =>
        [
          `"${o.external_code || shortId(o.id)}"`,
          `"${o.customer_name.replace(/"/g, '""')}"`,
          `"${o.customer_phone}"`,
          `"${o.delivery_district || ''}"`,
          `"${o.delivery_address.replace(/"/g, '""')}"`,
          `"${o.driver_name || 'Sin asignar'}"`,
          `"${ORDER_STATUS_CONFIG[o.status].label}"`,
          `"${o.scheduled_date || ''}"`,
          o.amount ?? '',
        ].join(',')
      ),
    ]
    const blob = new Blob([csvRows.join('\n')], {
      type: 'text/csv;charset=utf-8;',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `pedidos_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const existingCodes = useMemo(() => {
    const s = new Set<string>()
    orders.forEach((o) => {
      if (o.external_code) s.add(o.external_code)
    })
    return s
  }, [orders])

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            Gestión de Pedidos
          </h1>
          <p className="text-sm text-gray-500">
            Registra, importa, filtra y supervisa todos los envíos de la operación
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchAll}>
            <RefreshCw className="w-4 h-4 mr-1.5" />
            Actualizar
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            <Download className="w-4 h-4 mr-1.5" />
            Exportar CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setImportOpen(true)}
          >
            <Upload className="w-4 h-4 mr-1.5" />
            Importar CSV/Excel
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setEditingOrder(null)
              setFormOpen(true)
            }}
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Nuevo pedido
          </Button>
        </div>
      </div>

      {/* Barra de filtros */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="relative lg:col-span-2">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                placeholder="Buscar por código, cliente, teléfono o dirección..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPageIndex(0)
                }}
                className="pl-9"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value)
                setPageIndex(0)
              }}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            >
              <option value="all">Todos los estados</option>
              {(Object.keys(ORDER_STATUS_CONFIG) as OrderStatus[]).map((st) => (
                <option key={st} value={st}>
                  {ORDER_STATUS_CONFIG[st].label}
                </option>
              ))}
            </select>

            <select
              value={districtFilter}
              onChange={(e) => {
                setDistrictFilter(e.target.value)
                setPageIndex(0)
              }}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            >
              <option value="all">Todos los distritos</option>
              {LIMA_DISTRICTS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>

            <div className="flex gap-2">
              <select
                value={driverFilter}
                onChange={(e) => {
                  setDriverFilter(e.target.value)
                  setPageIndex(0)
                }}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              >
                <option value="all">Todos los motorizados</option>
                <option value="unassigned">Sin asignar</option>
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.full_name}
                  </option>
                ))}
              </select>
              <Input
                type="date"
                value={dateFilter}
                onChange={(e) => {
                  setDateFilter(e.target.value)
                  setPageIndex(0)
                }}
                className="w-40"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Acciones masivas */}
      {selectedRows.length > 0 && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm font-medium text-blue-900">
            {selectedRows.length} pedido(s) seleccionado(s)
          </span>
          <div className="flex items-center gap-2">
            <select
              value={bulkDriverId}
              onChange={(e) => setBulkDriverId(e.target.value)}
              className="h-9 rounded-md border border-blue-300 bg-white px-3 text-sm"
            >
              <option value="">Seleccionar motorizado...</option>
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.full_name}
                </option>
              ))}
            </select>
            <Button size="sm" onClick={handleBulkAssign}>
              <UserCheck className="w-4 h-4 mr-1.5" />
              Asignar seleccionados
            </Button>
          </div>
        </div>
      )}

      {/* Tabla */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-12 text-center text-sm text-gray-400">
              Cargando pedidos desde Supabase...
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="p-12 text-center space-y-2">
              <p className="text-base font-medium text-gray-700">
                No se encontraron pedidos
              </p>
              <p className="text-xs text-gray-400">
                Prueba ajustando los filtros o registra un nuevo pedido.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b bg-gray-50/80 text-xs font-semibold text-gray-500 uppercase">
                    <th className="px-4 py-3">
                      <input
                        type="checkbox"
                        className="rounded border-gray-300"
                        checked={allPageSelected}
                        onChange={toggleAllPage}
                        aria-label="Seleccionar todos"
                      />
                    </th>
                    <th className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => handleSort('external_code')}
                        className="inline-flex items-center gap-1 hover:text-gray-800"
                      >
                        Código
                        <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </th>
                    <th className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => handleSort('customer_name')}
                        className="inline-flex items-center gap-1 hover:text-gray-800"
                      >
                        Cliente
                        <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </th>
                    <th className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => handleSort('delivery_district')}
                        className="inline-flex items-center gap-1 hover:text-gray-800"
                      >
                        Distrito / Dirección
                        <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </th>
                    <th className="px-4 py-3">Motorizado</th>
                    <th className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => handleSort('status')}
                        className="inline-flex items-center gap-1 hover:text-gray-800"
                      >
                        Estado
                        <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </th>
                    <th className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => handleSort('scheduled_date')}
                        className="inline-flex items-center gap-1 hover:text-gray-800"
                      >
                        Programado
                        <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </th>
                    <th className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => handleSort('updated_at')}
                        className="inline-flex items-center gap-1 hover:text-gray-800"
                      >
                        Actualizado
                        <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </th>
                    <th className="px-4 py-3">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                  {paginatedOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-gray-50/60">
                      <td className="px-4 py-3 align-middle">
                        <input
                          type="checkbox"
                          className="rounded border-gray-300"
                          checked={selectedIds.has(order.id)}
                          onChange={() => toggleRow(order.id)}
                          aria-label="Seleccionar fila"
                        />
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <span className="font-mono text-xs font-semibold text-gray-900">
                          {order.external_code || `#${shortId(order.id)}`}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <p className="font-medium text-gray-900 text-sm">
                          {order.customer_name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {order.customer_phone}
                        </p>
                      </td>
                      <td className="px-4 py-3 align-middle max-w-xs">
                        <p className="text-xs font-semibold text-gray-700">
                          {order.delivery_district || '—'}
                        </p>
                        <p className="text-xs text-gray-600 truncate">
                          {order.delivery_address}
                        </p>
                        {order.delivery_reference && (
                          <p className="text-[11px] text-gray-400 truncate">
                            Ref: {order.delivery_reference}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 align-middle">
                        {order.driver_name ? (
                          <span className="text-xs font-medium text-gray-800">
                            {order.driver_name}
                          </span>
                        ) : (
                          <span className="text-xs text-amber-600 font-medium">
                            Sin asignar
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <OrderStatusBadge status={order.status} size="sm" />
                      </td>
                      <td className="px-4 py-3 align-middle text-xs text-gray-600">
                        <p>{formatDate(order.scheduled_date)}</p>
                        {order.amount !== null && (
                          <p className="font-medium text-gray-900">
                            {formatCurrency(order.amount)}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 align-middle text-xs text-gray-500">
                        {formatDateTime(order.updated_at)}
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Ver detalle e historial"
                            onClick={() => {
                              setSelectedOrder(order)
                              setDetailOpen(true)
                            }}
                          >
                            <Eye className="w-4 h-4 text-gray-600" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Editar pedido"
                            onClick={() => {
                              setEditingOrder(order)
                              setFormOpen(true)
                            }}
                          >
                            <Pencil className="w-4 h-4 text-blue-600" />
                          </Button>
                          <a
                            href={buildWhatsAppUrl(
                              order.customer_whatsapp || order.customer_phone,
                              `Hola ${order.customer_name}, nos comunicamos sobre tu pedido ${
                                order.external_code || shortId(order.id)
                              }.`
                            )}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Contactar por WhatsApp"
                            className="inline-flex items-center justify-center w-8 h-8 rounded-md hover:bg-green-50 text-green-600"
                          >
                            <MessageSquare className="w-4 h-4" />
                          </a>
                          {order.status !== 'cancelled' &&
                            order.status !== 'delivered' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Cancelar pedido"
                                onClick={() => handleCancelOrder(order)}
                              >
                                <Ban className="w-4 h-4 text-red-500" />
                              </Button>
                            )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Paginación */}
          {filteredOrders.length > 0 && (
            <div className="flex items-center justify-between px-4 py-3 border-t text-xs text-gray-500">
              <span>
                Mostrando {paginatedOrders.length} de {filteredOrders.length}{' '}
                pedidos
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
                  disabled={pageIndex === 0}
                >
                  Anterior
                </Button>
                <span>
                  Página {pageIndex + 1} de {pageCount}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setPageIndex((p) => Math.min(pageCount - 1, p + 1))
                  }
                  disabled={pageIndex + 1 >= pageCount}
                >
                  Siguiente
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modales */}
      <OrderFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        organizationId={orgId}
        userId={userId}
        drivers={drivers}
        editingOrder={editingOrder}
        onSaved={fetchAll}
      />

      <OrderImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        organizationId={orgId}
        userId={userId}
        existingCodes={existingCodes}
        onImported={fetchAll}
      />

      <OrderDetailSheet
        order={selectedOrder}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </div>
  )
}
