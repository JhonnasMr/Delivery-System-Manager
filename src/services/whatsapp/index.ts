// WhatsApp service layer
// Provides an abstraction that can switch from link-based to Cloud API provider

import { buildWhatsAppUrl, interpolateTemplate } from '@/lib/utils'
import type { Order, MessageTemplate } from '@/types/database'
import type { Driver } from '@/types/database'
import { formatDate } from '@/lib/utils/date'

// ============================================================
// TYPES
// ============================================================

export interface WhatsAppMessage {
  orderId: string
  recipientPhone: string
  recipientName: string
  messageBody: string
  whatsappUrl: string
  status: 'prepared' | 'opened' | 'confirmed_sent'
}

export interface BulkMessagePreview {
  messages: WhatsAppMessage[]
  invalidPhones: string[]
}

// ============================================================
// WHATSAPP LINK PROVIDER (Initial implementation)
// ============================================================

/**
 * Prepare a single WhatsApp message for an order.
 * Returns the link and message body without sending anything.
 */
export function prepareWhatsAppMessage(
  order: Order,
  template: string,
  driver?: Pick<Driver, 'full_name' | 'phone'>
): WhatsAppMessage | null {
  const phone = order.customer_whatsapp || order.customer_phone
  if (!phone) return null

  const messageBody = interpolateTemplate(template, {
    cliente: order.customer_name,
    codigo_pedido: order.external_code || order.id.split('-')[0].toUpperCase(),
    motorizado: driver?.full_name ?? '',
    telefono_motorizado: driver?.phone ?? '',
    direccion: order.delivery_address,
    fecha_entrega: order.scheduled_date ? formatDate(order.scheduled_date) : '',
  })

  const whatsappUrl = buildWhatsAppUrl(phone, messageBody)

  return {
    orderId: order.id,
    recipientPhone: phone,
    recipientName: order.customer_name,
    messageBody,
    whatsappUrl,
    status: 'prepared',
  }
}

/**
 * Prepare bulk WhatsApp messages for multiple orders.
 * Returns prepared messages and a list of invalid phone numbers.
 */
export function prepareBulkWhatsAppMessages(
  orders: Order[],
  template: string,
  driver?: Pick<Driver, 'full_name' | 'phone'>
): BulkMessagePreview {
  const messages: WhatsAppMessage[] = []
  const invalidPhones: string[] = []

  for (const order of orders) {
    const phone = order.customer_whatsapp || order.customer_phone
    if (!phone || phone.trim() === '') {
      invalidPhones.push(order.customer_name)
      continue
    }

    const msg = prepareWhatsAppMessage(order, template, driver)
    if (msg) {
      messages.push(msg)
    } else {
      invalidPhones.push(order.customer_name)
    }
  }

  return { messages, invalidPhones }
}

/**
 * Open a WhatsApp link in a new tab and return the updated message status.
 * This is the user action — we can't confirm the message was sent,
 * only that the link was opened.
 */
export function openWhatsAppLink(message: WhatsAppMessage): WhatsAppMessage {
  window.open(message.whatsappUrl, '_blank', 'noopener,noreferrer')
  return { ...message, status: 'opened' }
}

// ============================================================
// FUTURE: WhatsApp Cloud API Provider interface
// When integrating, implement this interface and swap providers
// ============================================================

export interface WhatsAppProvider {
  sendMessage(phone: string, body: string, orderId?: string): Promise<{ id: string }>
  sendTemplate(phone: string, templateName: string, vars: string[]): Promise<{ id: string }>
  getMessageStatus(messageId: string): Promise<string>
  validatePhone(phone: string): Promise<boolean>
}

// The current provider is link-based (no API calls needed)
// Future: WhatsAppCloudApiProvider implements WhatsAppProvider
// and uses process.env.WHATSAPP_ACCESS_TOKEN (server-side only)
