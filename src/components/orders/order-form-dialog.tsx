'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import { LIMA_DISTRICTS } from '@/lib/constants'
import { todayISO } from '@/lib/utils/date'
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
import type { Order, Driver } from '@/types/database'

const orderSchema = z.object({
  external_code: z.string().trim().optional(),
  customer_name: z
    .string()
    .trim()
    .min(2, 'El nombre del cliente debe tener al menos 2 caracteres'),
  customer_phone: z
    .string()
    .trim()
    .min(7, 'Ingresa un número de teléfono válido'),
  customer_whatsapp: z.string().trim().optional(),
  delivery_address: z.string().trim().optional(),
  delivery_district: z.string().trim().min(1, 'Selecciona un distrito'),
  delivery_reference: z.string().trim().optional(),
  scheduled_date: z.string().min(1, 'La fecha programada es obligatoria'),
  amount: z.string().optional(),
  assigned_driver_id: z.string().optional(),
  notes: z.string().trim().optional(),
})

type OrderFormValues = z.infer<typeof orderSchema>

interface OrderFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  organizationId: string
  userId: string
  drivers: Pick<Driver, 'id' | 'full_name' | 'status'>[]
  editingOrder?: Order | null
  onSaved: () => void
}

export function OrderFormDialog({
  open,
  onOpenChange,
  organizationId,
  userId,
  drivers,
  editingOrder,
  onSaved,
}: OrderFormDialogProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<OrderFormValues>({
    resolver: zodResolver(orderSchema),
    defaultValues: {
      external_code: '',
      customer_name: '',
      customer_phone: '',
      customer_whatsapp: '',
      delivery_address: '',
      delivery_district: 'Miraflores',
      delivery_reference: '',
      scheduled_date: todayISO(),
      amount: '',
      assigned_driver_id: '',
      notes: '',
    },
  })

  useEffect(() => {
    if (editingOrder) {
      reset({
        external_code: editingOrder.external_code ?? '',
        customer_name: editingOrder.customer_name,
        customer_phone: editingOrder.customer_phone,
        customer_whatsapp: editingOrder.customer_whatsapp ?? '',
        delivery_address: editingOrder.delivery_address,
        delivery_district: editingOrder.delivery_district ?? 'Miraflores',
        delivery_reference: editingOrder.delivery_reference ?? '',
        scheduled_date: editingOrder.scheduled_date ?? todayISO(),
        amount:
          editingOrder.amount !== null && editingOrder.amount !== undefined
            ? String(editingOrder.amount)
            : '',
        assigned_driver_id: editingOrder.assigned_driver_id ?? '',
        notes: editingOrder.notes ?? '',
      })
    } else {
      reset({
        external_code: '',
        customer_name: '',
        customer_phone: '',
        customer_whatsapp: '',
        delivery_address: '',
        delivery_district: 'Miraflores',
        delivery_reference: '',
        scheduled_date: todayISO(),
        amount: '',
        assigned_driver_id: '',
        notes: '',
      })
    }
  }, [editingOrder, open, reset])

  const onSubmit = async (values: OrderFormValues) => {
    const supabase = createClient()

    const parsedAmount =
      values.amount && values.amount.trim() !== ''
        ? parseFloat(values.amount)
        : null

    if (parsedAmount !== null && Number.isNaN(parsedAmount)) {
      toast.error('El importe debe ser un número válido')
      return
    }

    const externalCode = values.external_code?.trim() || null

    // Check duplicate external_code
    if (externalCode) {
      let dupQuery = supabase
        .from('orders')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('external_code', externalCode)
        .is('deleted_at', null)

      if (editingOrder) {
        dupQuery = dupQuery.neq('id', editingOrder.id)
      }

      const { data: existing } = await dupQuery.maybeSingle()
      if (existing) {
        toast.error(
          `Ya existe un pedido con el código externo "${externalCode}"`
        )
        return
      }
    }

    const driverId = values.assigned_driver_id?.trim() || null

    if (editingOrder) {
      const nextStatus =
        driverId && editingOrder.status === 'pending_assignment'
          ? 'assigned'
          : !driverId && editingOrder.status === 'assigned'
          ? 'pending_assignment'
          : editingOrder.status

      const { error } = await supabase
        .from('orders')
        .update({
          external_code: externalCode,
          customer_name: values.customer_name,
          customer_phone: values.customer_phone,
          customer_whatsapp:
            values.customer_whatsapp?.trim() || values.customer_phone,
          delivery_address: values.delivery_address?.trim() ?? '',
          delivery_district: values.delivery_district,
          delivery_reference: values.delivery_reference?.trim() || null,
          scheduled_date: values.scheduled_date,
          amount: parsedAmount,
          assigned_driver_id: driverId,
          status: nextStatus,
          notes: values.notes?.trim() || null,
        })
        .eq('id', editingOrder.id)

      if (error) {
        toast.error(`Error al actualizar pedido: ${error.message}`)
        return
      }

      await supabase.from('audit_logs').insert({
        organization_id: organizationId,
        user_id: userId,
        action: 'edit_order',
        entity_type: 'orders',
        entity_id: editingOrder.id,
        new_values: {
          external_code: externalCode,
          customer_name: values.customer_name,
          assigned_driver_id: driverId,
        },
      })

      toast.success('Pedido actualizado correctamente')
    } else {
      const initialStatus = driverId ? 'assigned' : 'pending_assignment'

      const { data: created, error } = await supabase
        .from('orders')
        .insert({
          organization_id: organizationId,
          external_code: externalCode,
          customer_name: values.customer_name,
          customer_phone: values.customer_phone,
          customer_whatsapp:
            values.customer_whatsapp?.trim() || values.customer_phone,
          delivery_address: values.delivery_address?.trim() ?? '',
          delivery_district: values.delivery_district,
          delivery_reference: values.delivery_reference?.trim() || null,
          scheduled_date: values.scheduled_date,
          original_scheduled_date: values.scheduled_date,
          amount: parsedAmount,
          currency_code: 'PEN',
          assigned_driver_id: driverId,
          status: initialStatus,
          notes: values.notes?.trim() || null,
          created_by: userId,
        })
        .select('id')
        .single()

      if (error || !created) {
        toast.error(`Error al crear pedido: ${error?.message ?? 'Desconocido'}`)
        return
      }

      await supabase.from('order_status_history').insert({
        order_id: created.id,
        previous_status: null,
        new_status: initialStatus,
        changed_by: userId,
        notes: 'Pedido registrado en el sistema',
      })

      if (driverId) {
        await supabase.from('order_assignments').insert({
          order_id: created.id,
          driver_id: driverId,
          assigned_by: userId,
          notes: 'Asignación inicial al crear pedido',
        })
      }

      await supabase.from('audit_logs').insert({
        organization_id: organizationId,
        user_id: userId,
        action: 'create_order',
        entity_type: 'orders',
        entity_id: created.id,
        new_values: {
          external_code: externalCode,
          customer_name: values.customer_name,
          status: initialStatus,
        },
      })

      toast.success('Pedido registrado exitosamente')
    }

    onOpenChange(false)
    onSaved()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingOrder ? 'Editar pedido' : 'Registrar nuevo pedido'}
          </DialogTitle>
          <DialogDescription>
            Completa los datos del cliente y de la entrega. Los campos con * son
            obligatorios.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="external_code">Código de pedido externo</Label>
              <Input
                id="external_code"
                placeholder="Ej. PED-2026-001"
                {...register('external_code')}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="scheduled_date">Fecha programada *</Label>
              <Input
                id="scheduled_date"
                type="date"
                {...register('scheduled_date')}
              />
              {errors.scheduled_date && (
                <p className="text-xs text-red-600">
                  {errors.scheduled_date.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="customer_name">Nombre del cliente *</Label>
              <Input
                id="customer_name"
                placeholder="Nombre completo del destinatario"
                {...register('customer_name')}
              />
              {errors.customer_name && (
                <p className="text-xs text-red-600">
                  {errors.customer_name.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="customer_phone">Teléfono *</Label>
              <Input
                id="customer_phone"
                placeholder="987654321"
                {...register('customer_phone')}
              />
              {errors.customer_phone && (
                <p className="text-xs text-red-600">
                  {errors.customer_phone.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="customer_whatsapp">WhatsApp (opcional)</Label>
              <Input
                id="customer_whatsapp"
                placeholder="Dejar vacío si es igual al teléfono"
                {...register('customer_whatsapp')}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="delivery_district">Distrito *</Label>
              <select
                id="delivery_district"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                {...register('delivery_district')}
              >
                {LIMA_DISTRICTS.map((district) => (
                  <option key={district} value={district}>
                    {district}
                  </option>
                ))}
              </select>
              {errors.delivery_district && (
                <p className="text-xs text-red-600">
                  {errors.delivery_district.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="amount">Importe a cobrar S/ (opcional)</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                placeholder="0.00"
                {...register('amount')}
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="delivery_address">
                Dirección de entrega (opcional)
              </Label>
              <Input
                id="delivery_address"
                placeholder="Av. Larco 123, Dpto 402 (o dejar vacío si se pedirá ubicación)"
                {...register('delivery_address')}
              />
              {errors.delivery_address && (
                <p className="text-xs text-red-600">
                  {errors.delivery_address.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="delivery_reference">Referencia de ubicación</Label>
              <Input
                id="delivery_reference"
                placeholder="Frente al parque, edificio gris..."
                {...register('delivery_reference')}
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="assigned_driver_id">
                Asignar motorizado (opcional)
              </Label>
              <select
                id="assigned_driver_id"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                {...register('assigned_driver_id')}
              >
                <option value="">-- Dejar pendiente de asignación --</option>
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.full_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="notes">Observaciones / Instrucciones</Label>
              <Textarea
                id="notes"
                rows={2}
                placeholder="Instrucciones especiales para el motorizado..."
                {...register('notes')}
              />
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : editingOrder ? (
                'Guardar cambios'
              ) : (
                'Crear pedido'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
