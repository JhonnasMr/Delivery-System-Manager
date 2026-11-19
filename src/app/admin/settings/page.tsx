'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { WHATSAPP_CONFIG, USER_ROLES } from '@/lib/constants'
import { formatDateTime } from '@/lib/utils/date'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Plus, Save, Shield, MessageSquare, History } from 'lucide-react'
import { toast } from 'sonner'
import type {
  MessageTemplate,
  Profile,
  AuditLog,
  UserRole,
} from '@/types/database'

export default function SettingsPage() {
  const [orgId, setOrgId] = useState('')
  const [userId, setUserId] = useState('')
  const [myRole, setMyRole] = useState<UserRole>('admin')

  const [templates, setTemplates] = useState<MessageTemplate[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])

  // New template state
  const [tplName, setTplName] = useState('')
  const [tplBody, setTplBody] = useState(
    'Hola {{cliente}}, soy {{motorizado}}, motorizado encargado de entregar tu pedido {{codigo_pedido}} hoy en {{direccion}}.'
  )

  const fetchSettingsData = useCallback(async () => {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return
    setUserId(user.id)

    const { data: me } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (!me?.organization_id) return
    setOrgId(me.organization_id)
    setMyRole(me.role)

    const [tplRes, profRes, auditRes] = await Promise.all([
      supabase
        .from('message_templates')
        .select('*')
        .eq('organization_id', me.organization_id)
        .order('created_at', { ascending: false }),
      supabase
        .from('profiles')
        .select('*')
        .eq('organization_id', me.organization_id)
        .order('full_name'),
      supabase
        .from('audit_logs')
        .select('*')
        .eq('organization_id', me.organization_id)
        .order('created_at', { ascending: false })
        .limit(50),
    ])

    setTemplates(tplRes.data ?? [])
    setProfiles(profRes.data ?? [])
    setAuditLogs(auditRes.data ?? [])
  }, [])

  useEffect(() => {
    fetchSettingsData()
  }, [fetchSettingsData])

  const handleCreateTemplate = async () => {
    if (!tplName.trim() || !tplBody.trim()) {
      toast.error('Completa el nombre y el mensaje de la plantilla')
      return
    }
    const supabase = createClient()
    const { error } = await supabase.from('message_templates').insert({
      organization_id: orgId,
      name: tplName.trim(),
      body: tplBody.trim(),
      variables: WHATSAPP_CONFIG.messageVariables,
      is_default: templates.length === 0,
      is_active: true,
      created_by: userId,
    })

    if (error) {
      toast.error(`Error al guardar plantilla: ${error.message}`)
      return
    }

    toast.success('Plantilla de WhatsApp guardada')
    setTplName('')
    fetchSettingsData()
  }

  const handleRoleChange = async (targetProfile: Profile, newRole: UserRole) => {
    if (myRole !== 'super_admin') {
      toast.error('Solo un Super Administrador puede cambiar roles de usuarios')
      return
    }

    const supabase = createClient()
    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', targetProfile.id)

    if (error) {
      toast.error(`Error al cambiar rol: ${error.message}`)
      return
    }

    await supabase.from('audit_logs').insert({
      organization_id: orgId,
      user_id: userId,
      action: 'change_role',
      entity_type: 'profiles',
      entity_id: targetProfile.id,
      previous_values: { role: targetProfile.role },
      new_values: { role: newRole },
    })

    toast.success(`Rol de ${targetProfile.full_name} actualizado`)
    fetchSettingsData()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">
          Configuración, Roles y Auditoría
        </h1>
        <p className="text-sm text-gray-500">
          Administra plantillas de WhatsApp, permisos RBAC de usuarios y trazabilidad del sistema
        </p>
      </div>

      <Tabs defaultValue="whatsapp" className="space-y-4">
        <TabsList>
          <TabsTrigger value="whatsapp">
            <MessageSquare className="w-4 h-4 mr-1.5" />
            Plantillas WhatsApp
          </TabsTrigger>
          <TabsTrigger value="users">
            <Shield className="w-4 h-4 mr-1.5" />
            Usuarios y Roles (RBAC)
          </TabsTrigger>
          <TabsTrigger value="audit">
            <History className="w-4 h-4 mr-1.5" />
            Registro de Auditoría
          </TabsTrigger>
        </TabsList>

        {/* PLANTILLAS WHATSAPP */}
        <TabsContent value="whatsapp" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Crear plantilla de mensaje para clientes
              </CardTitle>
              <CardDescription>
                Variables disponibles:{' '}
                {WHATSAPP_CONFIG.messageVariables.join(', ')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>Nombre de la plantilla</Label>
                <Input
                  placeholder="Ej. Aviso de pedido en camino"
                  value={tplName}
                  onChange={(e) => setTplName(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Contenido del mensaje</Label>
                <Textarea
                  rows={3}
                  value={tplBody}
                  onChange={(e) => setTplBody(e.target.value)}
                />
              </div>
              <Button size="sm" onClick={handleCreateTemplate}>
                <Plus className="w-4 h-4 mr-1.5" />
                Guardar plantilla
              </Button>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {templates.map((t) => (
              <Card key={t.id}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-sm text-gray-900">
                      {t.name}
                    </h4>
                    {t.is_default && (
                      <span className="text-[11px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                        Predeterminada
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-600 bg-gray-50 p-3 rounded-lg">
                    {t.body}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* USUARIOS Y ROLES */}
        <TabsContent value="users">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Usuarios de la organización
              </CardTitle>
              <CardDescription>
                Control de acceso basado en roles (SUPER_ADMIN, ADMIN, SUPERVISOR, DRIVER)
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500 border-b">
                  <tr>
                    <th className="px-4 py-3">Nombre</th>
                    <th className="px-4 py-3">Teléfono</th>
                    <th className="px-4 py-3">Rol asignado</th>
                    <th className="px-4 py-3">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {profiles.map((p) => (
                    <tr key={p.id}>
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {p.full_name}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {p.phone || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={p.role}
                          disabled={myRole !== 'super_admin'}
                          onChange={(e) =>
                            handleRoleChange(p, e.target.value as UserRole)
                          }
                          className="h-8 rounded-md border px-2 text-xs bg-white"
                        >
                          {USER_ROLES.map((r) => (
                            <option key={r.value} value={r.value}>
                              {r.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                          {p.is_active ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* AUDITORIA */}
        <TabsContent value="audit">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Últimos eventos auditados
              </CardTitle>
              <CardDescription>
                Registro inmutable de acciones críticas en la plataforma
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-gray-50 uppercase text-gray-500 border-b">
                  <tr>
                    <th className="px-4 py-3">Fecha / Hora</th>
                    <th className="px-4 py-3">Acción</th>
                    <th className="px-4 py-3">Entidad</th>
                    <th className="px-4 py-3">Detalles</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {auditLogs.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-4 py-8 text-center text-gray-400"
                      >
                        No hay registros de auditoría aún.
                      </td>
                    </tr>
                  ) : (
                    auditLogs.map((log) => (
                      <tr key={log.id}>
                        <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">
                          {formatDateTime(log.created_at)}
                        </td>
                        <td className="px-4 py-2.5 font-mono font-semibold text-blue-700">
                          {log.action}
                        </td>
                        <td className="px-4 py-2.5 text-gray-700">
                          {log.entity_type}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-gray-600 max-w-md truncate">
                          {log.new_values
                            ? JSON.stringify(log.new_values)
                            : '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
