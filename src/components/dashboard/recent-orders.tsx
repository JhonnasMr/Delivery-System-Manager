import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { OrderStatusBadge } from '@/components/orders/order-status-badge'
import { formatRelativeDate } from '@/lib/utils/date'
import { shortId } from '@/lib/utils'
import { ArrowRight, Package } from 'lucide-react'
import type { OrderStatus } from '@/types/database'

interface RecentOrdersProps {
  orgId: string
}

export default async function RecentOrders({ orgId }: RecentOrdersProps) {
  const supabase = await createClient()

  const { data: orders } = await supabase
    .from('orders')
    .select(
      `
      id,
      external_code,
      customer_name,
      delivery_district,
      status,
      updated_at,
      drivers:assigned_driver_id (
        id,
        full_name
      )
    `
    )
    .eq('organization_id', orgId)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
    .limit(10)

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base font-semibold">
          Actividad reciente
        </CardTitle>
        <Link
          href="/admin/orders"
          className="text-xs font-medium text-blue-600 hover:text-blue-700 inline-flex items-center gap-1"
        >
          Ver todos
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </CardHeader>
      <CardContent className="flex-1">
        {!orders || orders.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-center text-gray-400">
            <Package className="w-10 h-10 mb-2 text-gray-300" />
            <p className="text-sm">No hay pedidos recientes</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {orders.map((order) => {
              const driverRecord = Array.isArray(order.drivers)
                ? order.drivers[0]
                : order.drivers
              return (
                <div
                  key={order.id}
                  className="py-3 first:pt-0 last:pb-0 flex items-start justify-between gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-semibold text-gray-900">
                        {order.external_code || `#${shortId(order.id)}`}
                      </span>
                      <span className="text-xs text-gray-400">·</span>
                      <span className="text-xs text-gray-500 truncate">
                        {order.delivery_district || 'Sin distrito'}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-gray-800 truncate mt-0.5">
                      {order.customer_name}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {driverRecord?.full_name
                        ? `Motorizado: ${driverRecord.full_name}`
                        : 'Sin motorizado asignado'}{' '}
                      · {formatRelativeDate(order.updated_at)}
                    </p>
                  </div>
                  <OrderStatusBadge
                    status={order.status as OrderStatus}
                    size="sm"
                  />
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
