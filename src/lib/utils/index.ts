import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { OrderStatus, UserRole } from '@/types/database'
import { ORDER_STATUS_CONFIG } from '@/lib/constants'
import { ALLOWED_STATUS_TRANSITIONS } from '@/types/database'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format a phone number for use with WhatsApp.
 * Strips non-digits, prepends country code if needed.
 */
export function normalizePhoneForWhatsApp(
  phone: string,
  countryCode = '51'
): string {
  const digits = phone.replace(/\D/g, '')

  if (digits.startsWith('51') && digits.length === 11) {
    return digits
  }

  if (digits.length === 9) {
    return `${countryCode}${digits}`
  }

  return digits
}

/**
 * Build a WhatsApp deeplink URL.
 */
export function buildWhatsAppUrl(phone: string, message?: string): string {
  const normalizedPhone = normalizePhoneForWhatsApp(phone)
  const base = `https://wa.me/${normalizedPhone}`
  if (!message) return base
  return `${base}?text=${encodeURIComponent(message)}`
}

/**
 * Build a Google Maps navigation URL from an address string.
 */
export function buildMapsUrl(
  address: string,
  lat?: number | null,
  lng?: number | null
): string {
  if (lat && lng) {
    return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`
}

/**
 * Build a tel: link for calling.
 */
export function buildTelUrl(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  return `tel:+${digits.startsWith('51') ? digits : `51${digits}`}`
}

/**
 * Interpolate template variables in a WhatsApp message body.
 */
export function interpolateTemplate(
  template: string,
  vars: {
    cliente?: string
    codigo_pedido?: string
    motorizado?: string
    telefono_motorizado?: string
    direccion?: string
    fecha_entrega?: string
  }
): string {
  return template
    .replace(/{{cliente}}/g, vars.cliente ?? '')
    .replace(/{{codigo_pedido}}/g, vars.codigo_pedido ?? '')
    .replace(/{{motorizado}}/g, vars.motorizado ?? '')
    .replace(/{{telefono_motorizado}}/g, vars.telefono_motorizado ?? '')
    .replace(/{{direccion}}/g, vars.direccion ?? '')
    .replace(/{{fecha_entrega}}/g, vars.fecha_entrega ?? '')
}

/**
 * Get allowed next statuses for a given current status and role.
 */
export function getAllowedTransitions(
  currentStatus: OrderStatus,
  role: UserRole
): OrderStatus[] {
  return ALLOWED_STATUS_TRANSITIONS[currentStatus][role] ?? []
}

/**
 * Format currency amount.
 */
export function formatCurrency(
  amount: number | null | undefined,
  currencyCode = 'PEN',
  locale = 'es-PE'
): string {
  if (amount === null || amount === undefined) return '—'
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: 2,
  }).format(amount)
}

/**
 * Truncate a string to a given length with ellipsis.
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str
  return `${str.slice(0, maxLength - 3)}...`
}

/**
 * Generate a short display code from a UUID.
 */
export function shortId(uuid: string): string {
  return uuid.split('-')[0].toUpperCase()
}

/**
 * Get order status display info.
 */
export function getStatusConfig(status: OrderStatus) {
  return ORDER_STATUS_CONFIG[status]
}

/**
 * Validate Peruvian phone number (9 digits starting with 9).
 */
export function isValidPeruvianPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, '')
  return /^9\d{8}$/.test(digits)
}
