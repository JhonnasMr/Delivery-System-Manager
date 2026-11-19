'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { DriverOrderCard } from '@/components/delivery/driver-order-card'
import {
  prepareBulkWhatsAppMessages,
  openWhatsAppLink,
  type WhatsAppMessage,
} from '@/services/whatsapp'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  MessageSquare,
  Package,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
} from 'lucide-react'
import { toast } from 'sonner'
import type { Order, Driver } from '@/types/database'

const DEFAULT_DRIVER_WA_TEMPLATE =
  'Hola {{cliente}}, soy {{motorizado}}, motorizado encargado de tu pedido {{codigo_pedido}}. Hoy pasaré por {{direccion}}. ¡Atento(a) por favor!'

export default function DriverHomePage() {
  const [driver, setDriver] = useState<Driver | null>(null)
  const [userId, setUserId] = useState<string>('')
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  const [tab, setTab] = useState<string>('active')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Bulk WhatsApp modal
  const [bulkModalOpen, setBulkModalOpen] = useState(false)
  const [preparedMessages, setPreparedMessages] = useState<WhatsAppMessage[]>(
    []
  )

  const fetchDriverOrders = useCallback(async () => {
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

    const { data: driverRow } = await supabase
      .from('drivers')
      .select('*')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .maybeSingle()

    if (!driverRow) {
      setDriver(null)
      setLoading(false)
      return
    }
    setDriver(driverRow)

    const { data: orderRows, error } = await supabase
      .from('orders')
      .select('*')
      .eq('assigned_driver_id', driverRow.id)
      .is('deleted_at', null)
      .order('scheduled_date', { ascending: true })

    if (error) {
      toast.error(`Error al cargar tus pedidos: ${error.message}`)
    } else {
      setOrders(orderRows ?? [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchDriverOrders()

    const supabase = createClient()
    const channel = supabase
      .channel('driver-orders-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => {
          fetchDriverOrders()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchDriverOrders])

  const counts = useMemo(() => {
    return {
      active: orders.filter(
        (o) =>
          o.status === 'assigned' ||
          o.status === 'in_transit' ||
          o.status === 'pending'
      ).length,
      in_transit: orders.filter((o) => o.status === 'in_transit').length,
      delivered: orders.filter((o) => o.status === 'delivered').length,
      failed: orders.filter(
        (o) => o.status === 'delivery_failed' || o.status === 'rescheduled'
      ).length,
    }
  }, [orders])

  const filteredOrders = useMemo(() => {
    if (tab === 'active') {
      return orders.filter(
        (o) =>
          o.status === 'assigned' ||
          o.status === 'in_transit' ||
          o.status === 'pending'
      )
    }
    if (tab === 'in_transit') {
      return orders.filter((o) => o.status === 'in_transit')
    }
    if (tab === 'delivered') {
      return orders.filter((o) => o.status === 'delivered')
    }
    if (tab === 'incidents') {
      return orders.filter(
        (o) => o.status === 'delivery_failed' || o.status === 'rescheduled'
      )
    }
    return orders
  }, [orders, tab])

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handlePrepareBulkWhatsApp = () => {
    if (!driver) return
    const selectedOrders = orders.filter((o) => selectedIds.has(o.id))
    const { messages } = prepareBulkWhatsAppMessages(
      selectedOrders,
      DEFAULT_DRIVER_WA_TEMPLATE,
      driver
    )
    setPreparedMessages(messages)
    setBulkModalOpen(true)
  }

  const handleOpenSinglePrepared = (index: number) => {
    const msg = preparedMessages[index]
    if (!msg) return
    const updated = openWhatsAppLink(msg)
    setPreparedMessages((prev) =>
      prev.map((m, i) => (i === index ? updated : m))
    )
  }

  if (loading) {
    return (
      <div className="py-16 text-center text-sm text-gray-500">
        Cargando tu hoja de ruta...
      </div>
    )
  }

  if (!driver) {
    return (
      <div className="bg-white rounded-2xl p-6 text-center space-y-2 border">
        <Package className="w-10 h-10 text-gray-300 mx-auto" />
        <h2 className="text-base font-bold text-gray-800">
          Perfil de motorizado no vinculado
        </h2>
        <p className="text-xs text-gray-500">
          Solicita al administrador que vincule tu usuario con una ficha de
          motorizado activa.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Resumen rápido */}
      <div className="grid grid-cols-3 gap-2.5">
        <div className="bg-white rounded-2xl p-3 border text-center">
          <p className="text-xl font-bold text-blue-600">{counts.active}</p>
          <p className="text-[11px] font-medium text-gray-500">Por entregar</p>
        </div>
        <div className="bg-white rounded-2xl p-3 border text-center">
          <p className="text-xl font-bold text-indigo-600">
            {counts.in_transit}
          </p>
          <p className="text-[11px] font-medium text-gray-500">En camino</p>
        </div>
        <div className="bg-white rounded-2xl p-3 border text-center">
          <p className="text-xl font-bold text-green-600">{counts.delivered}</p>
          <p className="text-[11px] font-medium text-gray-500">Entregados</p>
        </div>
      </div>

      {/* Pestañas táctiles */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {[
            { id: 'active', label: `Pendientes (${counts.active})` },
            { id: 'in_transit', label: `En ruta (${counts.in_transit})` },
            { id: 'delivered', label: `Entregados (${counts.delivered})` },
            { id: 'incidents', label: `Incidencias (${counts.failed})` },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                tab === t.id
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white text-gray-600 border'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={fetchDriverOrders}
          className="p-2 rounded-xl bg-white border text-gray-600 shrink-0"
          aria-label="Actualizar"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Barra flotante para preparar WhatsApp masivo */}
      {selectedIds.size > 0 && (
        <div className="p-3 bg-green-600 text-white rounded-2xl shadow-md flex items-center justify-between">
          <span className="text-xs font-semibold">
            {selectedIds.size} cliente(s) seleccionados
          </span>
          <Button
            size="sm"
            variant="secondary"
            onClick={handlePrepareBulkWhatsApp}
            className="bg-white text-green-700 hover:bg-green-50 font-semibold text-xs"
          >
            <MessageSquare className="w-4 h-4 mr-1.5" />
            Preparar WhatsApp
          </Button>
        </div>
      )}

      {/* Lista de tarjetas */}
      {filteredOrders.length === 0 ? (
        <div className="bg-white rounded-2xl p-10 text-center space-y-2 border">
          <Package className="w-10 h-10 text-gray-300 mx-auto" />
          <p className="text-sm font-semibold text-gray-700">
            No hay pedidos en esta bandeja
          </p>
          <p className="text-xs text-gray-400">
            Cuando te asignen nuevos pedidos aparecerán aquí en tiempo real.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map((order) => (
            <DriverOrderCard
              key={order.id}
              order={order}
              driverId={driver.id}
              driverName={driver.full_name}
              userId={userId}
              selected={selectedIds.has(order.id)}
              onToggleSelect={toggleSelect}
              onUpdated={fetchDriverOrders}
            />
          ))}
        </div>
      )}

      {/* Modal de envío asistido de WhatsApp para múltiples pedidos */}
      <Dialog open={bulkModalOpen} onOpenChange={setBulkModalOpen}>
        <DialogContent className="max-w-md max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Mensajes de WhatsApp preparados</DialogTitle>
            <DialogDescription>
              Toca &quot;Abrir chat&quot; en cada cliente para enviarle su aviso de
              reparto personalizado.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto divide-y border rounded-xl">
            {preparedMessages.map((msg, idx) => (
              <div
                key={msg.orderId}
                className="p-3 flex items-center justify-between gap-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {msg.recipientName}
                  </p>
                  <p className="text-xs text-gray-500">{msg.recipientPhone}</p>
                </div>
                <Button
                  size="sm"
                  variant={msg.status === 'opened' ? 'outline' : 'default'}
                  onClick={() => handleOpenSinglePrepared(idx)}
                  className={
                    msg.status === 'opened'
                      ? 'text-green-700 border-green-300'
                      : 'bg-green-600 hover:bg-green-700'
                  }
                >
                  {msg.status === 'opened' ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                      Abierto
                    </>
                  ) : (
                    <>
                      <ExternalLink className="w-3.5 h-3.5 mr-1" />
                      Abrir chat
                    </>
                  )}
                </Button>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setBulkModalOpen(false)
                setSelectedIds(new Set())
              }}
            >
              Listo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
