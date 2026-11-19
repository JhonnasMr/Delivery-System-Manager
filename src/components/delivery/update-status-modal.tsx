'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { INCIDENT_REASONS, ORDER_STATUS_CONFIG } from '@/lib/constants'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import type { Database, Order, OrderStatus, IncidentType } from '@/types/database'

interface UpdateStatusModalProps {
  order: Order
  driverId: string
  userId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

const DRIVER_STATUS_OPTIONS: { value: OrderStatus; label: string }[] = [
  { value: 'in_transit', label: 'En camino' },
  { value: 'delivered', label: 'Entregado' },
  { value: 'pending', label: 'Pendiente (intentar más tarde)' },
  { value: 'delivery_failed', label: 'Entrega fallida (reportar motivo)' },
  { value: 'rescheduled', label: 'Reprogramar para otro día' },
]

export function UpdateStatusModal({
  order,
  driverId,
  userId,
  open,
  onOpenChange,
  onSuccess,
}: UpdateStatusModalProps) {
  const [newStatus, setNewStatus] = useState<OrderStatus>('delivered')
  const [incidentType, setIncidentType] =
    useState<IncidentType>('customer_absent')
  const [newDate, setNewDate] = useState<string>('')
  const [notes, setNotes] = useState<string>('')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (newStatus === 'rescheduled' && !newDate) {
      toast.error('Selecciona la nueva fecha para reprogramar el pedido')
      return
    }

    setSaving(true)
    const supabase = createClient()

    const updatePayload: Database['public']['Tables']['orders']['Update'] = {
      status: newStatus,
    }
    if (newStatus === 'rescheduled' && newDate) {
      updatePayload.scheduled_date = newDate
    }
    if (notes.trim()) {
      updatePayload.notes = notes.trim()
    }

    const { error } = await supabase
      .from('orders')
      .update(updatePayload)
      .eq('id', order.id)

    if (error) {
      setSaving(false)
      toast.error(`No se pudo actualizar: ${error.message}`)
      return
    }

    await supabase.from('order_status_history').insert({
      order_id: order.id,
      previous_status: order.status,
      new_status: newStatus,
      changed_by: userId,
      reason:
        newStatus === 'delivery_failed'
          ? incidentType
          : newStatus === 'rescheduled'
          ? `Reprogramado al ${newDate}`
          : null,
      notes: notes.trim() || null,
    })

    if (newStatus === 'delivery_failed') {
      await supabase.from('delivery_incidents').insert({
        order_id: order.id,
        driver_id: driverId,
        reported_by: userId,
        incident_type: incidentType,
        description: notes.trim() || null,
      })
    }

    if (newStatus === 'rescheduled' && newDate) {
      await supabase.from('order_reschedules').insert({
        order_id: order.id,
        rescheduled_by: userId,
        previous_date: order.scheduled_date,
        new_date: newDate,
        reason: notes.trim() || 'Reprogramado en ruta por motorizado',
        notes: notes.trim() || null,
      })
    }

    setSaving(false)
    toast.success(
      `Pedido actualizado a: ${ORDER_STATUS_CONFIG[newStatus].label}`
    )
    onOpenChange(false)
    onSuccess()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Actualizar estado del pedido</DialogTitle>
          <DialogDescription>
            Cliente: {order.customer_name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Selecciona el nuevo estado</Label>
            <div className="grid grid-cols-1 gap-2">
              {DRIVER_STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setNewStatus(opt.value)}
                  className={`min-h-11 px-4 py-2.5 rounded-xl border text-left text-sm font-medium transition ${
                    newStatus === opt.value
                      ? 'border-blue-600 bg-blue-50 text-blue-800 ring-2 ring-blue-500/20'
                      : 'border-gray-200 bg-white text-gray-700'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {newStatus === 'delivery_failed' && (
            <div className="space-y-1.5">
              <Label>Motivo de entrega fallida *</Label>
              <select
                value={incidentType}
                onChange={(e) =>
                  setIncidentType(e.target.value as IncidentType)
                }
                className="flex h-11 w-full rounded-xl border border-input bg-white px-3 text-sm"
              >
                {INCIDENT_REASONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {newStatus === 'rescheduled' && (
            <div className="space-y-1.5">
              <Label>Nueva fecha de entrega *</Label>
              <Input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="h-11"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Observaciones / Detalles</Label>
            <Textarea
              rows={2}
              placeholder="Ej. Recibió familiar en portería / No contestaron el intercomunicador..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="h-11"
          >
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving} className="h-11">
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Confirmar estado
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
