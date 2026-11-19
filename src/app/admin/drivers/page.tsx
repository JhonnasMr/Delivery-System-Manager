'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import { DRIVER_STATUS_CONFIG } from '@/lib/constants'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Plus,
  Pencil,
  Power,
  Trash2,
  Phone,
  MessageSquare,
  Loader2,
  Bike,
} from 'lucide-react'
import { buildWhatsAppUrl } from '@/lib/utils'
import { toast } from 'sonner'
import type { Driver, DriverStatus, Order } from '@/types/database'

const driverSchema = z.object({
  full_name: z.string().trim().min(2, 'El nombre es obligatorio'),
  document_id: z.string().trim().min(6, 'Documento de identidad obligatorio'),
  phone: z.string().trim().min(7, 'Teléfono válido obligatorio'),
  whatsapp: z.string().trim().optional(),
  email: z.string().trim().email('Correo inválido').optional().or(z.literal('')),
  status: z.enum(['available', 'busy', 'inactive', 'suspended']),
  notes: z.string().trim().optional(),
})

type DriverFormValues = z.infer<typeof driverSchema>

export default function DriversPage() {
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [orders, setOrders] = useState<
    Pick<Order, 'id' | 'assigned_driver_id' | 'status'>[]
  >([])
  const [orgId, setOrgId] = useState('')
  const [userId, setUserId] = useState('')
  const [loading, setLoading] = useState(true)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<DriverFormValues>({
    resolver: zodResolver(driverSchema),
    defaultValues: {
      full_name: '',
      document_id: '',
      phone: '',
      whatsapp: '',
      email: '',
      status: 'available',
      notes: '',
    },
  })

  const fetchDrivers = useCallback(async () => {
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

    const [driversRes, ordersRes] = await Promise.all([
      supabase
        .from('drivers')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .is('deleted_at', null)
        .order('full_name'),
      supabase
        .from('orders')
        .select('id, assigned_driver_id, status')
        .eq('organization_id', profile.organization_id)
        .is('deleted_at', null),
    ])

    setDrivers(driversRes.data ?? [])
    setOrders(ordersRes.data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchDrivers()
  }, [fetchDrivers])

  const metricsByDriver = useMemo(() => {
    const map = new Map<
      string,
      {
        total: number
        delivered: number
        failed: number
        active: number
      }
    >()

    drivers.forEach((d) =>
      map.set(d.id, { total: 0, delivered: 0, failed: 0, active: 0 })
    )

    orders.forEach((o) => {
      if (!o.assigned_driver_id) return
      const m = map.get(o.assigned_driver_id)
      if (!m) return
      m.total += 1
      if (o.status === 'delivered') m.delivered += 1
      if (o.status === 'delivery_failed') m.failed += 1
      if (o.status === 'assigned' || o.status === 'in_transit') m.active += 1
    })

    return map
  }, [drivers, orders])

  const openCreate = () => {
    setEditingDriver(null)
    reset({
      full_name: '',
      document_id: '',
      phone: '',
      whatsapp: '',
      email: '',
      status: 'available',
      notes: '',
    })
    setDialogOpen(true)
  }

  const openEdit = (driver: Driver) => {
    setEditingDriver(driver)
    reset({
      full_name: driver.full_name,
      document_id: driver.document_id ?? '',
      phone: driver.phone,
      whatsapp: driver.whatsapp ?? '',
      email: driver.email ?? '',
      status: driver.status,
      notes: driver.notes ?? '',
    })
    setDialogOpen(true)
  }

  const onSubmit = async (values: DriverFormValues) => {
    const supabase = createClient()

    if (editingDriver) {
      const { error } = await supabase
        .from('drivers')
        .update({
          full_name: values.full_name,
          document_id: values.document_id,
          phone: values.phone,
          whatsapp: values.whatsapp || values.phone,
          email: values.email || null,
          status: values.status as DriverStatus,
          is_active: values.status !== 'inactive' && values.status !== 'suspended',
          notes: values.notes || null,
        })
        .eq('id', editingDriver.id)

      if (error) {
        toast.error(`Error al actualizar motorizado: ${error.message}`)
        return
      }

      await supabase.from('audit_logs').insert({
        organization_id: orgId,
        user_id: userId,
        action: 'edit_driver',
        entity_type: 'drivers',
        entity_id: editingDriver.id,
        new_values: values,
      })

      toast.success('Motorizado actualizado')
    } else {
      const { data: created, error } = await supabase
        .from('drivers')
        .insert({
          organization_id: orgId,
          full_name: values.full_name,
          document_id: values.document_id,
          phone: values.phone,
          whatsapp: values.whatsapp || values.phone,
          email: values.email || null,
          status: values.status as DriverStatus,
          is_active: true,
          notes: values.notes || null,
        })
        .select('id')
        .single()

      if (error || !created) {
        toast.error(`Error al registrar motorizado: ${error?.message}`)
        return
      }

      await supabase.from('audit_logs').insert({
        organization_id: orgId,
        user_id: userId,
        action: 'create_driver',
        entity_type: 'drivers',
        entity_id: created.id,
        new_values: values,
      })

      toast.success('Motorizado registrado exitosamente')
    }

    setDialogOpen(false)
    fetchDrivers()
  }

  const toggleDriverActive = async (driver: Driver) => {
    const supabase = createClient()
    const nextActive = !driver.is_active
    const nextStatus: DriverStatus = nextActive ? 'available' : 'inactive'

    const { error } = await supabase
      .from('drivers')
      .update({
        is_active: nextActive,
        status: nextStatus,
      })
      .eq('id', driver.id)

    if (error) {
      toast.error(`Error al cambiar estado: ${error.message}`)
      return
    }

    await supabase.from('audit_logs').insert({
      organization_id: orgId,
      user_id: userId,
      action: nextActive ? 'activate_driver' : 'deactivate_driver',
      entity_type: 'drivers',
      entity_id: driver.id,
    })

    toast.success(
      nextActive ? 'Motorizado activado' : 'Motorizado desactivado'
    )
    fetchDrivers()
  }

  const handleSoftDelete = async (driver: Driver) => {
    const stats = metricsByDriver.get(driver.id)
    if (stats && stats.active > 0) {
      toast.error(
        'No puedes dar de baja a un motorizado con pedidos actualmente en ruta. Reasígnalos primero.'
      )
      return
    }

    const confirmed = window.confirm(
      `¿Confirmas dar de baja (soft delete) a ${driver.full_name}? Su historial de entregas se conservará intacto.`
    )
    if (!confirmed) return

    const supabase = createClient()
    const { error } = await supabase
      .from('drivers')
      .update({
        is_active: false,
        status: 'inactive',
        deleted_at: new Date().toISOString(),
      })
      .eq('id', driver.id)

    if (error) {
      toast.error(`Error al dar de baja: ${error.message}`)
      return
    }

    toast.success('Motorizado dado de baja preservando su historial')
    fetchDrivers()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            Gestión de Flota de Motorizados
          </h1>
          <p className="text-sm text-gray-500">
            Administra tus repartidores, su disponibilidad e indicadores de cumplimiento
          </p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="w-4 h-4 mr-1.5" />
          Registrar motorizado
        </Button>
      </div>

      {loading ? (
        <div className="p-12 text-center text-sm text-gray-400">
          Cargando flota de motorizados...
        </div>
      ) : drivers.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center space-y-2">
            <Bike className="w-10 h-10 text-gray-300 mx-auto" />
            <p className="text-base font-medium text-gray-700">
              No hay motorizados registrados
            </p>
            <p className="text-xs text-gray-400">
              Agrega a tu primer repartidor para empezar a asignar pedidos.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {drivers.map((driver) => {
            const m = metricsByDriver.get(driver.id) ?? {
              total: 0,
              delivered: 0,
              failed: 0,
              active: 0,
            }
            const rate =
              m.total > 0 ? Math.round((m.delivered / m.total) * 100) : 0
            const cfg = DRIVER_STATUS_CONFIG[driver.status]

            return (
              <Card key={driver.id} className="overflow-hidden">
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-gray-900 text-base">
                        {driver.full_name}
                      </h3>
                      <p className="text-xs text-gray-500">
                        Doc: {driver.document_id || '—'} · Tel: {driver.phone}
                      </p>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.bgColor} ${cfg.textColor}`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${cfg.dotColor}`}
                      />
                      {cfg.label}
                    </span>
                  </div>

                  {/* Métricas */}
                  <div className="grid grid-cols-4 gap-2 text-center bg-gray-50 rounded-xl p-3">
                    <div>
                      <p className="text-lg font-bold text-blue-600">
                        {m.active}
                      </p>
                      <p className="text-[11px] text-gray-500">En ruta</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-green-600">
                        {m.delivered}
                      </p>
                      <p className="text-[11px] text-gray-500">Entregados</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-red-600">
                        {m.failed}
                      </p>
                      <p className="text-[11px] text-gray-500">Fallidos</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-gray-900">{rate}%</p>
                      <p className="text-[11px] text-gray-500">Éxito</p>
                    </div>
                  </div>

                  {/* Acciones */}
                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-1.5">
                      <a
                        href={`tel:${driver.phone}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border text-xs font-medium text-gray-700 hover:bg-gray-50"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        Llamar
                      </a>
                      <a
                        href={buildWhatsAppUrl(driver.whatsapp || driver.phone)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-green-50 text-green-700 text-xs font-medium hover:bg-green-100"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        WhatsApp
                      </a>
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Editar"
                        onClick={() => openEdit(driver)}
                      >
                        <Pencil className="w-4 h-4 text-blue-600" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title={
                          driver.is_active ? 'Desactivar' : 'Activar'
                        }
                        onClick={() => toggleDriverActive(driver)}
                      >
                        <Power
                          className={`w-4 h-4 ${
                            driver.is_active
                              ? 'text-amber-600'
                              : 'text-green-600'
                          }`}
                        />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Dar de baja (Soft Delete)"
                        onClick={() => handleSoftDelete(driver)}
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Modal Crear / Editar */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingDriver ? 'Editar motorizado' : 'Registrar motorizado'}
            </DialogTitle>
            <DialogDescription>
              Ingresa la información personal y operativa del repartidor.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="full_name">Nombre completo *</Label>
              <Input id="full_name" {...register('full_name')} />
              {errors.full_name && (
                <p className="text-xs text-red-600">
                  {errors.full_name.message}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="document_id">DNI / CE *</Label>
                <Input id="document_id" {...register('document_id')} />
                {errors.document_id && (
                  <p className="text-xs text-red-600">
                    {errors.document_id.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="status">Estado operativo</Label>
                <select
                  id="status"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                  {...register('status')}
                >
                  <option value="available">Disponible</option>
                  <option value="busy">Ocupado</option>
                  <option value="inactive">Inactivo</option>
                  <option value="suspended">Suspendido</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="phone">Teléfono celular *</Label>
                <Input id="phone" {...register('phone')} />
                {errors.phone && (
                  <p className="text-xs text-red-600">{errors.phone.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="whatsapp">WhatsApp</Label>
                <Input
                  id="whatsapp"
                  placeholder="Igual al celular si vacío"
                  {...register('whatsapp')}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email">Correo electrónico</Label>
              <Input id="email" type="email" {...register('email')} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="notes">Notas / Placa de moto</Label>
              <Textarea id="notes" rows={2} {...register('notes')} />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                Guardar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
