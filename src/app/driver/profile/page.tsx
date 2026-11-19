'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { DRIVER_STATUS_CONFIG } from '@/lib/constants'
import { CheckCircle2, XCircle, Package, Percent } from 'lucide-react'
import type { Driver, DriverStatus } from '@/types/database'
import { toast } from 'sonner'

export default function DriverProfilePage() {
  const [driver, setDriver] = useState<Driver | null>(null)
  const [stats, setStats] = useState({
    total: 0,
    delivered: 0,
    failed: 0,
    rate: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) {
        setLoading(false)
        return
      }
      const { data: driverRow } = await supabase
        .from('drivers')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()

      if (!driverRow) {
        setLoading(false)
        return
      }
      setDriver(driverRow)

      const { data: orders } = await supabase
        .from('orders')
        .select('status')
        .eq('assigned_driver_id', driverRow.id)
        .is('deleted_at', null)

      const list = orders ?? []
      const total = list.length
      const delivered = list.filter((o) => o.status === 'delivered').length
      const failed = list.filter((o) => o.status === 'delivery_failed').length
      const rate = total > 0 ? Math.round((delivered / total) * 100) : 0

      setStats({ total, delivered, failed, rate })
      setLoading(false)
    })
  }, [])

  const updateMyStatus = async (status: DriverStatus) => {
    if (!driver) return
    const supabase = createClient()
    const { error } = await supabase
      .from('drivers')
      .update({ status })
      .eq('id', driver.id)

    if (error) {
      toast.error('No se pudo cambiar tu disponibilidad')
      return
    }
    setDriver({ ...driver, status })
    toast.success(`Estado cambiado a: ${DRIVER_STATUS_CONFIG[status].label}`)
  }

  if (loading) {
    return (
      <div className="py-12 text-center text-sm text-gray-400">
        Cargando tus indicadores personales...
      </div>
    )
  }

  if (!driver) {
    return (
      <div className="bg-white rounded-2xl p-6 text-center text-sm text-gray-500 border">
        Sin ficha de motorizado asociada.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl p-5 border space-y-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900">
            {driver.full_name}
          </h2>
          <p className="text-xs text-gray-500">
            Documento: {driver.document_id || '—'} · Teléfono: {driver.phone}
          </p>
        </div>

        <div className="space-y-1.5 pt-2">
          <p className="text-xs font-semibold text-gray-600">
            Mi disponibilidad actual:
          </p>
          <div className="grid grid-cols-2 gap-2">
            {(['available', 'busy'] as DriverStatus[]).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => updateMyStatus(st)}
                className={`min-h-11 rounded-xl border text-xs font-semibold transition ${
                  driver.status === st
                    ? 'border-blue-600 bg-blue-50 text-blue-700'
                    : 'border-gray-200 bg-white text-gray-600'
                }`}
              >
                {DRIVER_STATUS_CONFIG[st].label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Indicadores personales */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl p-4 border flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500">Total asignados</p>
            <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
          </div>
          <Package className="w-7 h-7 text-blue-600" />
        </div>

        <div className="bg-white rounded-2xl p-4 border flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500">Entregados</p>
            <p className="text-2xl font-bold text-green-600">
              {stats.delivered}
            </p>
          </div>
          <CheckCircle2 className="w-7 h-7 text-green-600" />
        </div>

        <div className="bg-white rounded-2xl p-4 border flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500">Fallidos</p>
            <p className="text-2xl font-bold text-red-600">{stats.failed}</p>
          </div>
          <XCircle className="w-7 h-7 text-red-600" />
        </div>

        <div className="bg-white rounded-2xl p-4 border flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500">Efectividad</p>
            <p className="text-2xl font-bold text-indigo-600">{stats.rate}%</p>
          </div>
          <Percent className="w-7 h-7 text-indigo-600" />
        </div>
      </div>
    </div>
  )
}
