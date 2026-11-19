'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { OrderStatusBadge } from '@/components/orders/order-status-badge'
import { formatDateTime } from '@/lib/utils/date'
import { shortId } from '@/lib/utils'
import { History } from 'lucide-react'
import type { Order } from '@/types/database'

export default function DriverHistoryPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) {
        setLoading(false)
        return
      }
      const { data: driver } = await supabase
        .from('drivers')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle()

      if (!driver) {
        setLoading(false)
        return
      }

      const { data } = await supabase
        .from('orders')
        .select('*')
        .eq('assigned_driver_id', driver.id)
        .in('status', ['delivered', 'delivery_failed', 'rescheduled'])
        .order('updated_at', { ascending: false })
        .limit(50)

      setOrders(data ?? [])
      setLoading(false)
    })
  }, [])

  if (loading) {
    return (
      <div className="py-12 text-center text-sm text-gray-400">
        Cargando tu historial de entregas...
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
        <History className="w-5 h-5 text-blue-600" />
        Historial de entregas ({orders.length})
      </h2>

      {orders.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 text-center text-sm text-gray-400 border">
          Aún no tienes entregas finalizadas en tu historial.
        </div>
      ) : (
        <div className="space-y-2.5">
          {orders.map((o) => (
            <div
              key={o.id}
              className="bg-white rounded-2xl p-4 border space-y-1.5"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-gray-900">
                  {o.external_code || `#${shortId(o.id)}`}
                </span>
                <OrderStatusBadge status={o.status} size="sm" />
              </div>
              <p className="text-sm font-semibold text-gray-900">
                {o.customer_name}
              </p>
              <p className="text-xs text-gray-600">
                {o.delivery_district} · {o.delivery_address}
              </p>
              <p className="text-[11px] text-gray-400">
                Actualizado: {formatDateTime(o.updated_at)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
