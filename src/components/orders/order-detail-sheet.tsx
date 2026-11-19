'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { OrderStatusBadge } from '@/components/orders/order-status-badge'
import { formatDate, formatDateTime } from '@/lib/utils/date'
import {
  buildWhatsAppUrl,
  buildMapsUrl,
  formatCurrency,
  shortId,
} from '@/lib/utils'
import {
  INCIDENT_TYPE_LABELS,
  ORDER_STATUS_LABELS,
  type Order,
  type OrderStatusHistory,
  type DeliveryEvidence,
  type DeliveryIncident,
  type OrderReschedule,
} from '@/types/database'
import {
  MessageSquare,
  MapPin,
  Phone,
  History,
  Camera,
  AlertTriangle,
  CalendarClock,
  ExternalLink,
} from 'lucide-react'

interface OrderDetailSheetProps {
  order: (Order & { driver_name?: string | null }) | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function OrderDetailSheet({
  order,
  open,
  onOpenChange,
}: OrderDetailSheetProps) {
  const [history, setHistory] = useState<OrderStatusHistory[]>([])
  const [evidence, setEvidence] = useState<
    Array<DeliveryEvidence & { publicUrl: string }>
  >([])
  const [incidents, setIncidents] = useState<DeliveryIncident[]>([])
  const [reschedules, setReschedules] = useState<OrderReschedule[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!order || !open) return
    const supabase = createClient()
    setLoading(true)

    Promise.all([
      supabase
        .from('order_status_history')
        .select('*')
        .eq('order_id', order.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('delivery_evidence')
        .select('*')
        .eq('order_id', order.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('delivery_incidents')
        .select('*')
        .eq('order_id', order.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('order_reschedules')
        .select('*')
        .eq('order_id', order.id)
        .order('created_at', { ascending: false }),
    ]).then(([histRes, evRes, incRes, reschRes]) => {
      setHistory(histRes.data ?? [])
      const evWithUrls = (evRes.data ?? []).map((ev) => {
        const { data } = supabase.storage
          .from('delivery-evidence')
          .getPublicUrl(ev.storage_path)
        return { ...ev, publicUrl: data.publicUrl }
      })
      setEvidence(evWithUrls)
      setIncidents(incRes.data ?? [])
      setReschedules(reschRes.data ?? [])
      setLoading(false)
    })
  }, [order, open])

  if (!order) return null

  const code = order.external_code || `#${shortId(order.id)}`
  const waMessage = `Hola ${order.customer_name}, te escribimos sobre tu pedido ${code} con entrega en ${order.delivery_address}.`

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader className="pb-4 border-b">
          <div className="flex items-center justify-between pr-6">
            <SheetTitle className="text-lg font-bold">
              Pedido {code}
            </SheetTitle>
            <OrderStatusBadge status={order.status} />
          </div>
          <SheetDescription>
            Registrado el {formatDateTime(order.created_at)}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 py-5">
          {/* Datos del cliente */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-2.5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Información del destinatario
            </h3>
            <p className="text-base font-semibold text-gray-900">
              {order.customer_name}
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <a
                href={buildWhatsAppUrl(
                  order.customer_whatsapp || order.customer_phone,
                  waMessage
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-medium hover:bg-green-700"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                WhatsApp ({order.customer_phone})
              </a>
              <a
                href={`tel:${order.customer_phone}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border text-gray-700 text-xs font-medium hover:bg-gray-100"
              >
                <Phone className="w-3.5 h-3.5" />
                Llamar
              </a>
              <a
                href={buildMapsUrl(
                  `${order.delivery_address}, ${order.delivery_district ?? ''}, Lima, Peru`,
                  order.delivery_lat,
                  order.delivery_lng
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border text-gray-700 text-xs font-medium hover:bg-gray-100"
              >
                <MapPin className="w-3.5 h-3.5 text-blue-600" />
                Ver en Google Maps
              </a>
            </div>

            <div className="pt-2 text-sm text-gray-700 space-y-1">
              <p>
                <span className="font-medium text-gray-500">Dirección:</span>{' '}
                {order.delivery_address}
              </p>
              <p>
                <span className="font-medium text-gray-500">Distrito:</span>{' '}
                {order.delivery_district || '—'}
              </p>
              {order.delivery_reference && (
                <p>
                  <span className="font-medium text-gray-500">Referencia:</span>{' '}
                  {order.delivery_reference}
                </p>
              )}
              <p>
                <span className="font-medium text-gray-500">
                  Fecha programada:
                </span>{' '}
                {formatDate(order.scheduled_date)}
              </p>
              <p>
                <span className="font-medium text-gray-500">Importe:</span>{' '}
                {formatCurrency(order.amount)}
              </p>
              <p>
                <span className="font-medium text-gray-500">Motorizado:</span>{' '}
                {order.driver_name || 'Sin asignar'}
              </p>
              {order.notes && (
                <p>
                  <span className="font-medium text-gray-500">
                    Observaciones:
                  </span>{' '}
                  {order.notes}
                </p>
              )}
            </div>
          </div>

          {loading ? (
            <p className="text-sm text-gray-400 text-center py-6">
              Cargando trazabilidad del pedido...
            </p>
          ) : (
            <>
              {/* Evidencias fotográficas */}
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                  <Camera className="w-4 h-4 text-blue-600" />
                  Evidencias fotográficas ({evidence.length})
                </h4>
                {evidence.length === 0 ? (
                  <p className="text-xs text-gray-400">
                    Aún no se han subido fotografías para este pedido.
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {evidence.map((ev) => (
                      <a
                        key={ev.id}
                        href={ev.publicUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group block border rounded-lg overflow-hidden bg-gray-50 hover:border-blue-500"
                      >
                        <div className="p-3 flex items-center justify-between">
                          <div className="truncate">
                            <p className="text-xs font-medium text-gray-800 truncate">
                              {ev.file_name}
                            </p>
                            <p className="text-[11px] text-gray-400">
                              {formatDateTime(ev.created_at)}
                            </p>
                          </div>
                          <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-blue-600 shrink-0" />
                        </div>
                      </a>
                    ))}
                  </div>
                )}
              </div>

              {/* Incidencias */}
              {incidents.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-red-700 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    Incidencias reportadas ({incidents.length})
                  </h4>
                  <div className="space-y-2">
                    {incidents.map((inc) => (
                      <div
                        key={inc.id}
                        className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs space-y-1"
                      >
                        <div className="flex justify-between font-semibold text-red-800">
                          <span>{INCIDENT_TYPE_LABELS[inc.incident_type]}</span>
                          <span>{formatDateTime(inc.created_at)}</span>
                        </div>
                        {inc.description && (
                          <p className="text-red-700">{inc.description}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Reprogramaciones */}
              {reschedules.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-purple-700 flex items-center gap-2">
                    <CalendarClock className="w-4 h-4" />
                    Reprogramaciones ({reschedules.length})
                  </h4>
                  <div className="space-y-2">
                    {reschedules.map((r) => (
                      <div
                        key={r.id}
                        className="p-3 rounded-lg bg-purple-50 border border-purple-200 text-xs space-y-1"
                      >
                        <p className="font-semibold text-purple-900">
                          Nueva fecha: {formatDate(r.new_date)} (Anterior:{' '}
                          {formatDate(r.previous_date)})
                        </p>
                        <p className="text-purple-700">Motivo: {r.reason}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Historial de estados */}
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                  <History className="w-4 h-4 text-gray-600" />
                  Historial de estados ({history.length})
                </h4>
                {history.length === 0 ? (
                  <p className="text-xs text-gray-400">
                    Sin movimientos registrados.
                  </p>
                ) : (
                  <div className="space-y-2.5 border-l-2 border-gray-200 pl-3 ml-1.5">
                    {history.map((h) => (
                      <div key={h.id} className="text-xs space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-900">
                            {ORDER_STATUS_LABELS[h.new_status]}
                          </span>
                          <span className="text-gray-400">
                            · {formatDateTime(h.created_at)}
                          </span>
                        </div>
                        {h.notes && (
                          <p className="text-gray-600">{h.notes}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
