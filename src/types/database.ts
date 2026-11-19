// ============================================================
// DATABASE TYPES — Generated from Supabase Schema
// Keep in sync with migrations/001_initial_schema.sql
// ============================================================

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// ============================================================
// ENUMS
// ============================================================

export type UserRole = 'super_admin' | 'admin' | 'supervisor' | 'driver'

export type DriverStatus = 'available' | 'busy' | 'inactive' | 'suspended'

export type OrderStatus =
  | 'pending_assignment'
  | 'assigned'
  | 'in_transit'
  | 'delivered'
  | 'delivery_failed'
  | 'pending'
  | 'rescheduled'
  | 'cancelled'

export type EvidenceType =
  | 'package_photo'
  | 'delivery_photo'
  | 'incident_photo'
  | 'address_reference_photo'

export type IncidentType =
  | 'customer_absent'
  | 'customer_not_responding'
  | 'incorrect_address'
  | 'customer_rejected'
  | 'access_problem'
  | 'product_problem'
  | 'other'

export type MessageStatus =
  | 'not_prepared'
  | 'prepared'
  | 'opened'
  | 'confirmed_sent'

export type AuditAction =
  | 'create_order'
  | 'edit_order'
  | 'assign_order'
  | 'reassign_order'
  | 'change_order_status'
  | 'mark_delivered'
  | 'mark_failed'
  | 'reschedule_order'
  | 'cancel_order'
  | 'create_driver'
  | 'edit_driver'
  | 'activate_driver'
  | 'deactivate_driver'
  | 'suspend_driver'
  | 'create_user'
  | 'edit_user'
  | 'change_role'
  | 'update_settings'
  | 'upload_evidence'
  | 'send_whatsapp'

// ============================================================
// DATABASE SCHEMA
// ============================================================

export type Database = {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string
          name: string
          slug: string
          logo_url: string | null
          country_code: string
          currency_code: string
          phone_prefix: string
          timezone: string
          is_active: boolean
          settings: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          logo_url?: string | null
          country_code?: string
          currency_code?: string
          phone_prefix?: string
          timezone?: string
          is_active?: boolean
          settings?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          logo_url?: string | null
          country_code?: string
          currency_code?: string
          phone_prefix?: string
          timezone?: string
          is_active?: boolean
          settings?: Json
          updated_at?: string
        }
        Relationships: []
      }

      profiles: {
        Row: {
          id: string
          organization_id: string | null
          full_name: string
          avatar_url: string | null
          role: UserRole
          is_active: boolean
          phone: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          organization_id?: string | null
          full_name: string
          avatar_url?: string | null
          role?: UserRole
          is_active?: boolean
          phone?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          organization_id?: string | null
          full_name?: string
          avatar_url?: string | null
          role?: UserRole
          is_active?: boolean
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }

      organization_members: {
        Row: {
          id: string
          organization_id: string
          user_id: string
          role: UserRole
          is_active: boolean
          joined_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          user_id: string
          role?: UserRole
          is_active?: boolean
          joined_at?: string
        }
        Update: {
          role?: UserRole
          is_active?: boolean
        }
        Relationships: []
      }

      drivers: {
        Row: {
          id: string
          organization_id: string
          user_id: string | null
          full_name: string
          document_id: string | null
          phone: string
          whatsapp: string | null
          email: string | null
          photo_url: string | null
          status: DriverStatus
          is_active: boolean
          joined_at: string
          notes: string | null
          deleted_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          user_id?: string | null
          full_name: string
          document_id?: string | null
          phone: string
          whatsapp?: string | null
          email?: string | null
          photo_url?: string | null
          status?: DriverStatus
          is_active?: boolean
          joined_at?: string
          notes?: string | null
          deleted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          user_id?: string | null
          full_name?: string
          document_id?: string | null
          phone?: string
          whatsapp?: string | null
          email?: string | null
          photo_url?: string | null
          status?: DriverStatus
          is_active?: boolean
          joined_at?: string
          notes?: string | null
          deleted_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }

      customers: {
        Row: {
          id: string
          organization_id: string
          full_name: string
          phone: string
          whatsapp: string | null
          address: string | null
          district: string | null
          reference: string | null
          notes: string | null
          deleted_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          full_name: string
          phone: string
          whatsapp?: string | null
          address?: string | null
          district?: string | null
          reference?: string | null
          notes?: string | null
          deleted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          full_name?: string
          phone?: string
          whatsapp?: string | null
          address?: string | null
          district?: string | null
          reference?: string | null
          notes?: string | null
          deleted_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }

      orders: {
        Row: {
          id: string
          organization_id: string
          external_code: string | null
          customer_id: string | null
          customer_name: string
          customer_phone: string
          customer_whatsapp: string | null
          delivery_address: string
          delivery_district: string | null
          delivery_reference: string | null
          delivery_lat: number | null
          delivery_lng: number | null
          assigned_driver_id: string | null
          status: OrderStatus
          scheduled_date: string | null
          scheduled_time: string | null
          original_scheduled_date: string | null
          amount: number | null
          currency_code: string | null
          notes: string | null
          additional_info: Json
          created_by: string | null
          deleted_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          external_code?: string | null
          customer_id?: string | null
          customer_name: string
          customer_phone: string
          customer_whatsapp?: string | null
          delivery_address: string
          delivery_district?: string | null
          delivery_reference?: string | null
          delivery_lat?: number | null
          delivery_lng?: number | null
          assigned_driver_id?: string | null
          status?: OrderStatus
          scheduled_date?: string | null
          scheduled_time?: string | null
          original_scheduled_date?: string | null
          amount?: number | null
          currency_code?: string | null
          notes?: string | null
          additional_info?: Json
          created_by?: string | null
          deleted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          external_code?: string | null
          customer_id?: string | null
          customer_name?: string
          customer_phone?: string
          customer_whatsapp?: string | null
          delivery_address?: string
          delivery_district?: string | null
          delivery_reference?: string | null
          delivery_lat?: number | null
          delivery_lng?: number | null
          assigned_driver_id?: string | null
          status?: OrderStatus
          scheduled_date?: string | null
          scheduled_time?: string | null
          original_scheduled_date?: string | null
          amount?: number | null
          currency_code?: string | null
          notes?: string | null
          additional_info?: Json
          deleted_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'orders_assigned_driver_id_fkey'
            columns: ['assigned_driver_id']
            isOneToOne: false
            referencedRelation: 'drivers'
            referencedColumns: ['id']
          },
        ]
      }

      order_assignments: {
        Row: {
          id: string
          order_id: string
          driver_id: string
          assigned_by: string | null
          unassigned_at: string | null
          unassigned_by: string | null
          unassign_reason: string | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          order_id: string
          driver_id: string
          assigned_by?: string | null
          unassigned_at?: string | null
          unassigned_by?: string | null
          unassign_reason?: string | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          unassigned_at?: string | null
          unassigned_by?: string | null
          unassign_reason?: string | null
          notes?: string | null
        }
        Relationships: []
      }

      order_status_history: {
        Row: {
          id: string
          order_id: string
          previous_status: OrderStatus | null
          new_status: OrderStatus
          changed_by: string | null
          reason: string | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          order_id: string
          previous_status?: OrderStatus | null
          new_status: OrderStatus
          changed_by?: string | null
          reason?: string | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          notes?: string | null
        }
        Relationships: []
      }

      delivery_evidence: {
        Row: {
          id: string
          order_id: string
          driver_id: string
          uploaded_by: string | null
          evidence_type: EvidenceType
          storage_path: string
          file_name: string
          mime_type: string
          file_size_bytes: number | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          order_id: string
          driver_id: string
          uploaded_by?: string | null
          evidence_type?: EvidenceType
          storage_path: string
          file_name: string
          mime_type: string
          file_size_bytes?: number | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          notes?: string | null
        }
        Relationships: []
      }

      delivery_incidents: {
        Row: {
          id: string
          order_id: string
          driver_id: string
          reported_by: string | null
          incident_type: IncidentType
          description: string | null
          resolved: boolean
          resolved_at: string | null
          resolved_by: string | null
          resolution_notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          order_id: string
          driver_id: string
          reported_by?: string | null
          incident_type?: IncidentType
          description?: string | null
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          resolution_notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          incident_type?: IncidentType
          description?: string | null
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          resolution_notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }

      order_reschedules: {
        Row: {
          id: string
          order_id: string
          rescheduled_by: string | null
          previous_date: string | null
          new_date: string
          new_time: string | null
          reason: string
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          order_id: string
          rescheduled_by?: string | null
          previous_date?: string | null
          new_date: string
          new_time?: string | null
          reason: string
          notes?: string | null
          created_at?: string
        }
        Update: {
          notes?: string | null
        }
        Relationships: []
      }

      message_templates: {
        Row: {
          id: string
          organization_id: string
          name: string
          body: string
          variables: string[]
          is_default: boolean
          is_active: boolean
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          name: string
          body: string
          variables?: string[]
          is_default?: boolean
          is_active?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          body?: string
          variables?: string[]
          is_default?: boolean
          is_active?: boolean
          updated_at?: string
        }
        Relationships: []
      }

      message_logs: {
        Row: {
          id: string
          organization_id: string
          order_id: string | null
          driver_id: string | null
          sent_by: string | null
          template_id: string | null
          recipient_phone: string
          message_body: string
          status: MessageStatus
          wa_message_id: string | null
          error_details: Json | null
          opened_at: string | null
          confirmed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          order_id?: string | null
          driver_id?: string | null
          sent_by?: string | null
          template_id?: string | null
          recipient_phone: string
          message_body: string
          status?: MessageStatus
          wa_message_id?: string | null
          error_details?: Json | null
          opened_at?: string | null
          confirmed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          status?: MessageStatus
          wa_message_id?: string | null
          error_details?: Json | null
          opened_at?: string | null
          confirmed_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }

      notifications: {
        Row: {
          id: string
          organization_id: string
          user_id: string
          title: string
          body: string
          type: string
          related_entity: string | null
          related_id: string | null
          is_read: boolean
          read_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          user_id: string
          title: string
          body: string
          type?: string
          related_entity?: string | null
          related_id?: string | null
          is_read?: boolean
          read_at?: string | null
          created_at?: string
        }
        Update: {
          is_read?: boolean
          read_at?: string | null
        }
        Relationships: []
      }

      audit_logs: {
        Row: {
          id: string
          organization_id: string | null
          user_id: string | null
          action: AuditAction
          entity_type: string
          entity_id: string | null
          previous_values: Json | null
          new_values: Json | null
          ip_address: string | null
          user_agent: string | null
          created_at: string
        }
        Insert: {
          id?: string
          organization_id?: string | null
          user_id?: string | null
          action: AuditAction
          entity_type: string
          entity_id?: string | null
          previous_values?: Json | null
          new_values?: Json | null
          ip_address?: string | null
          user_agent?: string | null
          created_at?: string
        }
        Update: {
          ip_address?: string | null
        }
        Relationships: []
      }

      organization_settings: {
        Row: {
          id: string
          organization_id: string
          company_name: string | null
          logo_url: string | null
          primary_color: string | null
          default_whatsapp_template: string | null
          wa_business_phone_id: string | null
          wa_access_token_encrypted: string | null
          wa_webhook_verify_token: string | null
          default_timezone: string
          default_currency: string
          default_country: string
          default_phone_prefix: string
          enable_realtime: boolean
          enable_sms: boolean
          max_daily_orders: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          company_name?: string | null
          logo_url?: string | null
          primary_color?: string | null
          default_whatsapp_template?: string | null
          wa_business_phone_id?: string | null
          wa_access_token_encrypted?: string | null
          wa_webhook_verify_token?: string | null
          default_timezone?: string
          default_currency?: string
          default_country?: string
          default_phone_prefix?: string
          enable_realtime?: boolean
          enable_sms?: boolean
          max_daily_orders?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          company_name?: string | null
          logo_url?: string | null
          primary_color?: string | null
          default_whatsapp_template?: string | null
          wa_business_phone_id?: string | null
          wa_access_token_encrypted?: string | null
          wa_webhook_verify_token?: string | null
          default_timezone?: string
          default_currency?: string
          default_country?: string
          default_phone_prefix?: string
          enable_realtime?: boolean
          enable_sms?: boolean
          max_daily_orders?: number | null
          updated_at?: string
        }
        Relationships: []
      }
    }

    Views: {
      [_ in never]: never
    }

    Functions: {
      get_my_role: {
        Args: Record<PropertyKey, never>
        Returns: UserRole
      }
      get_my_org_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      is_driver: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      is_admin_or_above: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      is_supervisor_or_above: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      get_my_driver_id: {
        Args: Record<PropertyKey, never>
        Returns: string | null
      }
    }

    Enums: {
      user_role: UserRole
      driver_status: DriverStatus
      order_status: OrderStatus
      evidence_type: EvidenceType
      incident_type: IncidentType
      message_status: MessageStatus
      audit_action: AuditAction
    }

    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// ============================================================
// CONVENIENCE TYPES (Row shortcuts)
// ============================================================

export type Organization = Database['public']['Tables']['organizations']['Row']
export type Profile = Database['public']['Tables']['profiles']['Row']
export type Driver = Database['public']['Tables']['drivers']['Row']
export type Customer = Database['public']['Tables']['customers']['Row']
export type Order = Database['public']['Tables']['orders']['Row']
export type OrderAssignment = Database['public']['Tables']['order_assignments']['Row']
export type OrderStatusHistory = Database['public']['Tables']['order_status_history']['Row']
export type DeliveryEvidence = Database['public']['Tables']['delivery_evidence']['Row']
export type DeliveryIncident = Database['public']['Tables']['delivery_incidents']['Row']
export type OrderReschedule = Database['public']['Tables']['order_reschedules']['Row']
export type MessageTemplate = Database['public']['Tables']['message_templates']['Row']
export type MessageLog = Database['public']['Tables']['message_logs']['Row']
export type Notification = Database['public']['Tables']['notifications']['Row']
export type AuditLog = Database['public']['Tables']['audit_logs']['Row']
export type OrganizationSettings = Database['public']['Tables']['organization_settings']['Row']

// ============================================================
// EXTENDED TYPES (with joins)
// ============================================================

export type OrderWithDriver = Order & {
  driver: Pick<Driver, 'id' | 'full_name' | 'phone' | 'status'> | null
}

export type OrderWithFullDetails = Order & {
  driver: Driver | null
  status_history: OrderStatusHistory[]
  evidence: DeliveryEvidence[]
  incidents: DeliveryIncident[]
  reschedules: OrderReschedule[]
  assignments: OrderAssignment[]
}

export type DriverWithStats = Driver & {
  total_assigned: number
  total_delivered: number
  total_failed: number
  total_in_transit: number
}

// ============================================================
// LABEL MAPS
// ============================================================

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending_assignment: 'Pendiente de asignación',
  assigned: 'Asignado',
  in_transit: 'En camino',
  delivered: 'Entregado',
  delivery_failed: 'Entrega fallida',
  pending: 'Pendiente',
  rescheduled: 'Reprogramado',
  cancelled: 'Cancelado',
}

export const DRIVER_STATUS_LABELS: Record<DriverStatus, string> = {
  available: 'Disponible',
  busy: 'Ocupado',
  inactive: 'Inactivo',
  suspended: 'Suspendido',
}

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  super_admin: 'Super Administrador',
  admin: 'Administrador',
  supervisor: 'Supervisor',
  driver: 'Motorizado',
}

export const INCIDENT_TYPE_LABELS: Record<IncidentType, string> = {
  customer_absent: 'Cliente ausente',
  customer_not_responding: 'Cliente no responde',
  incorrect_address: 'Dirección incorrecta',
  customer_rejected: 'Cliente rechazó el pedido',
  access_problem: 'Problema de acceso',
  product_problem: 'Problema con el producto',
  other: 'Otro',
}

// ============================================================
// STATE MACHINE — Allowed transitions per role
// ============================================================

export const ALLOWED_STATUS_TRANSITIONS: Record<
  OrderStatus,
  Partial<Record<UserRole, OrderStatus[]>>
> = {
  pending_assignment: {
    super_admin: ['assigned', 'cancelled'],
    admin: ['assigned', 'cancelled'],
    supervisor: ['assigned', 'cancelled'],
    driver: [],
  },
  assigned: {
    super_admin: ['in_transit', 'pending_assignment', 'cancelled'],
    admin: ['in_transit', 'pending_assignment', 'cancelled'],
    supervisor: ['in_transit', 'pending_assignment', 'cancelled'],
    driver: ['in_transit'],
  },
  in_transit: {
    super_admin: ['delivered', 'delivery_failed', 'pending', 'rescheduled'],
    admin: ['delivered', 'delivery_failed', 'pending', 'rescheduled'],
    supervisor: ['delivered', 'delivery_failed', 'pending', 'rescheduled'],
    driver: ['delivered', 'delivery_failed', 'pending', 'rescheduled'],
  },
  delivered: {
    super_admin: [],
    admin: [],
    supervisor: [],
    driver: [],
  },
  delivery_failed: {
    super_admin: ['pending', 'rescheduled', 'assigned', 'cancelled'],
    admin: ['pending', 'rescheduled', 'assigned', 'cancelled'],
    supervisor: ['pending', 'rescheduled', 'assigned'],
    driver: ['pending', 'rescheduled'],
  },
  pending: {
    super_admin: ['assigned', 'rescheduled', 'cancelled'],
    admin: ['assigned', 'rescheduled', 'cancelled'],
    supervisor: ['assigned', 'rescheduled'],
    driver: ['rescheduled'],
  },
  rescheduled: {
    super_admin: ['pending_assignment', 'assigned', 'cancelled'],
    admin: ['pending_assignment', 'assigned', 'cancelled'],
    supervisor: ['pending_assignment', 'assigned'],
    driver: [],
  },
  cancelled: {
    super_admin: ['pending_assignment'],
    admin: [],
    supervisor: [],
    driver: [],
  },
}
