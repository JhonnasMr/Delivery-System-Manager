import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { DATE_FORMAT, DATE_TIME_FORMAT } from '@/lib/constants'

/**
 * Format a date string or Date object to DD/MM/YYYY
 */
export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '—'
  try {
    const d = typeof date === 'string' ? parseISO(date) : date
    return format(d, DATE_FORMAT, { locale: es })
  } catch {
    return '—'
  }
}

/**
 * Format a date string or Date object to DD/MM/YYYY HH:mm
 */
export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return '—'
  try {
    const d = typeof date === 'string' ? parseISO(date) : date
    return format(d, DATE_TIME_FORMAT, { locale: es })
  } catch {
    return '—'
  }
}

/**
 * Format a date to full Spanish long form
 * e.g. "viernes, 6 de noviembre de 2026"
 */
export function formatDateLong(date: string | Date | null | undefined): string {
  if (!date) return '—'
  try {
    const d = typeof date === 'string' ? parseISO(date) : date
    return format(d, "EEEE, d 'de' MMMM 'de' yyyy", { locale: es })
  } catch {
    return '—'
  }
}

/**
 * Format a date string to a human-readable relative format
 */
export function formatRelativeDate(date: string | Date | null | undefined): string {
  if (!date) return '—'
  try {
    const d = typeof date === 'string' ? parseISO(date) : date
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    const mins = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (mins < 1) return 'Hace un momento'
    if (mins < 60) return `Hace ${mins} minuto${mins !== 1 ? 's' : ''}`
    if (hours < 24) return `Hace ${hours} hora${hours !== 1 ? 's' : ''}`
    if (days === 1) return 'Ayer'
    if (days < 7) return `Hace ${days} días`
    return formatDate(d)
  } catch {
    return '—'
  }
}

/**
 * Get today's date as YYYY-MM-DD string
 */
export function todayISO(): string {
  return new Date().toISOString().split('T')[0]
}

/**
 * Get a date N days ago as YYYY-MM-DD string
 */
export function daysAgoISO(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().split('T')[0]
}
