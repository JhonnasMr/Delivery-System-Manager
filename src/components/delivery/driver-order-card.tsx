'use client'

import { useState } from 'react'
import { OrderStatusBadge } from '@/components/orders/order-status-badge'
import { UpdateStatusModal } from '@/components/delivery/update-status-modal'
import { EvidenceUploadModal } from '@/components/delivery/evidence-upload-modal'
import {
  buildWhatsAppUrl,
  buildMapsUrl,
  buildTelUrl,
  formatCurrency,
  shortId,
} from '@/lib/utils'
import {
  MessageSquare,
  Phone,
  Navigation,
  Camera,
  CheckCircle2,
  MapPin,
  CheckSquare,
  Square,
} from 'lucide-react'
import type { Order } from '@/types/database'

interface DriverOrderCardProps {
  order: Order
  driverId: string
  driverName: string
  userId: string
  selected?: boolean
  onToggleSelect?: (orderId: string) => void
  onUpdated: () => void
}

export function DriverOrderCard({
  order,
  driverId,
  driverName,
  userId,
  selected = false,
  onToggleSelect,
  onUpdated,
}: DriverOrderCardProps) {
  const [statusModalOpen, setStatusModalOpen] = useState(false)
  const [evidenceModalOpen, setEvidenceModalOpen] = useState(false)

  const code = order.external_code || `#${shortId(order.id)}`
  const waMsg = `Hola ${order.customer_name}, soy ${driverName}, tu motorizado asignado para entregar el pedido ${code} en ${order.delivery_address}.`

  return (
    <div
      className={`rounded-2xl bg-white border shadow-xs p-4 space-y-3.5 transition ${
        selected ? 'border-blue-600 ring-2 ring-blue-500/20' : 'border-gray-200'
      }`}
    >
      {/* Top row: checkbox + code + status */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          {onToggleSelect && (
            <button
              type="button"
              onClick={() => onToggleSelect(order.id)}
              className="p-1 -ml-1 text-blue-600"
              aria-label="Seleccionar pedido para mensaje masivo"
            >
              {selected ? (
                <CheckSquare className="w-5 h-5" />
              ) : (
                <Square className="w-5 h-5 text-gray-300" />
              )}
            </button>
          )}
          <span className="font-mono text-sm font-bold text-gray-900">
            {code}
          </span>
          {order.amount !== null && (
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
              {formatCurrency(order.amount)}
            </span>
          )}
        </div>
        <OrderStatusBadge status={order.status} />
      </div>

      {/* Customer & Address */}
      <div className="space-y-1.5">
        <h3 className="text-base font-bold text-gray-900">
          {order.customer_name}
        </h3>
        <div className="flex items-start gap-2 text-sm text-gray-700">
          <MapPin className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-blue-700 text-xs uppercase">
              {order.delivery_district || 'Lima'}
            </p>
            <p className="leading-snug">{order.delivery_address}</p>
            {order.delivery_reference && (
              <p className="text-xs text-gray-500 mt-0.5">
                Ref: {order.delivery_reference}
              </p>
            )}
          </div>
        </div>
        {order.notes && (
          <p className="text-xs bg-amber-50 text-amber-800 border border-amber-200 rounded-lg px-2.5 py-1.5 mt-1">
            Nota: {order.notes}
          </p>
        )}
      </div>

      {/* Quick Action Buttons (Large Touch Targets >= 44px) */}
      <div className="grid grid-cols-3 gap-2 pt-1">
        <a
          href={buildWhatsAppUrl(
            order.customer_whatsapp || order.customer_phone,
            waMsg
          )}
          target="_blank"
          rel="noopener noreferrer"
          className="min-h-11 rounded-xl bg-green-600 hover:bg-green-700 active:scale-95 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition"
        >
          <MessageSquare className="w-4 h-4" />
          WhatsApp
        </a>

        <a
          href={buildTelUrl(order.customer_phone)}
          className="min-h-11 rounded-xl bg-blue-50 hover:bg-blue-100 active:scale-95 text-blue-700 font-semibold text-xs flex items-center justify-center gap-1.5 transition"
        >
          <Phone className="w-4 h-4" />
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
          className="min-h-11 rounded-xl bg-amber-50 hover:bg-amber-100 active:scale-95 text-amber-800 font-semibold text-xs flex items-center justify-center gap-1.5 transition"
        >
          <Navigation className="w-4 h-4" />
          Mapa
        </a>
      </div>

      {/* Primary Delivery Operations */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setEvidenceModalOpen(true)}
          className="min-h-11 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 active:scale-95 text-gray-700 font-semibold text-xs flex items-center justify-center gap-1.5 transition"
        >
          <Camera className="w-4 h-4 text-gray-600" />
          Subir foto
        </button>

        <button
          type="button"
          onClick={() => setStatusModalOpen(true)}
          className="min-h-11 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition shadow-xs"
        >
          <CheckCircle2 className="w-4 h-4" />
          Cambiar estado
        </button>
      </div>

      <UpdateStatusModal
        order={order}
        driverId={driverId}
        userId={userId}
        open={statusModalOpen}
        onOpenChange={setStatusModalOpen}
        onSuccess={onUpdated}
      />

      <EvidenceUploadModal
        order={order}
        driverId={driverId}
        userId={userId}
        open={evidenceModalOpen}
        onOpenChange={setEvidenceModalOpen}
        onUploaded={onUpdated}
      />
    </div>
  )
}
