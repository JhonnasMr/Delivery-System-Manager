'use client'

import { useMemo, useState } from 'react'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
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
import {
  Upload,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  Loader2,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'

interface ParsedOrderRow {
  rowNumber: number
  external_code: string
  customer_name: string
  customer_phone: string
  delivery_address: string
  delivery_district: string
  delivery_reference: string
  scheduled_date_raw: string
  scheduled_date: string
  amount_raw: string
  amount: number | null
  notes: string
  errors: string[]
  isDuplicate: boolean
}

interface OrderImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  organizationId: string
  userId: string
  existingCodes: Set<string>
  onImported: () => void
}

const DISTRICT_ALIASES: Record<string, string> = {
  SJL: 'San Juan de Lurigancho',
  'SAN JUAN DE LURIGANCHO': 'San Juan de Lurigancho',
  SJM: 'San Juan de Miraflores',
  'SAN JUAN DE MIRAFLORES': 'San Juan de Miraflores',
  SMP: 'San Martín de Porres',
  'SAN MARTIN DE PORRES': 'San Martín de Porres',
  VES: 'Villa El Salvador',
  'VILLA EL SALVADOR': 'Villa El Salvador',
  VMT: 'Villa María del Triunfo',
  'VILLA MARIA DEL TRIUNFO': 'Villa María del Triunfo',
  CERCADO: 'Cercado de Lima',
  LIMA: 'Cercado de Lima',
  SURCO: 'Santiago de Surco',
  'SANTIAGO DE SURCO': 'Santiago de Surco',
  MAGDALENA: 'Magdalena del Mar',
  CALLAO: 'Callao',
}

function resolveDistrictName(rawDistrict: string): string {
  const cleaned = rawDistrict.trim()
  if (!cleaned) return 'Cercado de Lima'
  const upper = cleaned.toUpperCase()
  if (DISTRICT_ALIASES[upper]) return DISTRICT_ALIASES[upper]

  const exactMatch = LIMA_DISTRICTS.find(
    (d) => d.toLowerCase() === cleaned.toLowerCase()
  )
  return exactMatch ?? cleaned
}

/**
 * Convierte fechas como "18/11/2026", "18-11-2026", "2026-11-18"
 * o números seriales de Excel al formato ISO "YYYY-MM-DD" para PostgreSQL.
 */
function parseFlexibleDate(raw: string): { iso: string; valid: boolean } {
  const cleaned = raw.trim()
  if (!cleaned) {
    return { iso: todayISO(), valid: true }
  }

  // 1. Formato DD/MM/YYYY o DD-MM-YYYY (ej. 18/11/2026 o 18-11-2026 o 18/11/26)
  const dmyMatch = cleaned.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/)
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10)
    const month = parseInt(dmyMatch[2], 10)
    let year = parseInt(dmyMatch[3], 10)
    if (year < 100) year += 2000

    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      return { iso, valid: true }
    }
    return { iso: cleaned, valid: false }
  }

  // 2. Formato YYYY-MM-DD o YYYY/MM/DD
  const ymdMatch = cleaned.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/)
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10)
    const month = parseInt(ymdMatch[2], 10)
    const day = parseInt(ymdMatch[3], 10)
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      return { iso, valid: true }
    }
    return { iso: cleaned, valid: false }
  }

  // 3. Número serial de fecha de Excel (ej. 46344)
  if (/^\d{5}$/.test(cleaned)) {
    const serial = parseInt(cleaned, 10)
    const utcDays = serial - 25569
    const dateObj = new Date(utcDays * 86400 * 1000)
    if (!Number.isNaN(dateObj.getTime())) {
      return { iso: dateObj.toISOString().slice(0, 10), valid: true }
    }
  }

  return { iso: cleaned, valid: false }
}

/**
 * Limpia y convierte un monto como "S/ 45.50", "45,50" o "45.5" a número.
 */
function parseFlexibleAmount(raw: string): {
  amount: number | null
  valid: boolean
} {
  const cleaned = raw.trim()
  if (!cleaned) return { amount: null, valid: true }

  // Quitar símbolo de moneda "S/", "S/.", "$" y espacios
  const normalized = cleaned
    .replace(/^(S\/\.?|PEN|\$)\s*/i, '')
    .replace(/\s+/g, '')
    .replace(',', '.')

  const num = Number(normalized)
  if (Number.isNaN(num) || num < 0) {
    return { amount: null, valid: false }
  }
  return { amount: num, valid: true }
}

function revalidateRows(
  list: Omit<
    ParsedOrderRow,
    'errors' | 'isDuplicate' | 'scheduled_date' | 'amount'
  >[],
  existingCodes: Set<string>
): ParsedOrderRow[] {
  const seenInFile = new Set<string>()

  return list.map((r) => {
    const errors: string[] = []
    if (!r.customer_name || r.customer_name.trim().length < 2) {
      errors.push('Falta cliente')
    }
    if (!r.customer_phone || r.customer_phone.replace(/\D/g, '').length < 7) {
      errors.push('Teléfono inválido')
    }
    if (!r.delivery_district || r.delivery_district.trim().length < 2) {
      errors.push('Falta distrito')
    }

    const parsedDate = parseFlexibleDate(r.scheduled_date_raw)
    if (!parsedDate.valid) {
      errors.push('Fecha inválida (usa DD/MM/AAAA o DD-MM-AAAA)')
    }

    const parsedAmount = parseFlexibleAmount(r.amount_raw)
    if (!parsedAmount.valid) {
      errors.push('Monto inválido')
    }

    let isDuplicate = false
    const code = r.external_code.trim()
    if (code) {
      if (existingCodes.has(code)) {
        isDuplicate = true
        errors.push(`Código ya existe en BD (${code})`)
      } else if (seenInFile.has(code)) {
        isDuplicate = true
        errors.push(`Código repetido en archivo (${code})`)
      } else {
        seenInFile.add(code)
      }
    }

    return {
      ...r,
      scheduled_date: parsedDate.iso,
      amount: parsedAmount.amount,
      errors,
      isDuplicate,
    }
  })
}

export function OrderImportDialog({
  open,
  onOpenChange,
  organizationId,
  userId,
  existingCodes,
  onImported,
}: OrderImportDialogProps) {
  const [rows, setRows] = useState<ParsedOrderRow[]>([])
  const [fileName, setFileName] = useState<string>('')
  const [viewMode, setViewMode] = useState<'all' | 'invalid' | 'valid'>('all')
  const [isImporting, setIsImporting] = useState(false)
  const [importSummary, setImportSummary] = useState<{
    inserted: number
    skipped: number
  } | null>(null)

  const extractRawRow = (
    raw: Record<string, unknown>,
    index: number
  ): Omit<
    ParsedOrderRow,
    'errors' | 'isDuplicate' | 'scheduled_date' | 'amount'
  > => {
    const getVal = (keys: string[]): string => {
      for (const k of keys) {
        const matchKey = Object.keys(raw).find(
          (rk) => rk.trim().toLowerCase() === k.toLowerCase()
        )
        if (matchKey && raw[matchKey] !== undefined && raw[matchKey] !== null) {
          return String(raw[matchKey]).trim()
        }
      }
      return ''
    }

    const external_code = getVal([
      'codigo',
      'código',
      'external_code',
      'codigo_pedido',
      'orden',
      'order_code',
    ])
    const customer_name = getVal([
      'cliente',
      'nombre',
      'customer_name',
      'destinatario',
    ])
    const customer_phone = getVal([
      'telefono',
      'teléfono',
      'celular',
      'phone',
      'customer_phone',
      'whatsapp',
    ])
    const delivery_address = getVal([
      'direccion',
      'dirección',
      'address',
      'delivery_address',
    ])
    const rawDistrict = getVal(['distrito', 'district', 'delivery_district'])
    const delivery_district = resolveDistrictName(rawDistrict)
    const delivery_reference = getVal([
      'referencia',
      'reference',
      'delivery_reference',
    ])
    const scheduled_date_raw =
      getVal([
        'fecha',
        'fecha_programada',
        'scheduled_date',
        'fecha_entrega',
      ]) || todayISO()
    const amount_raw = getVal([
      'importe',
      'monto',
      'precio',
      'amount',
      'total',
      'cobrar',
      'valor',
    ])
    const notes = getVal([
      'observaciones',
      'observacion',
      'observación',
      'notas',
      'notes',
    ])

    return {
      rowNumber: index + 2,
      external_code,
      customer_name,
      customer_phone,
      delivery_address,
      delivery_district,
      delivery_reference,
      scheduled_date_raw,
      amount_raw,
      notes,
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setFileName(file.name)
    setImportSummary(null)
    setViewMode('all')

    if (file.name.toLowerCase().endsWith('.csv')) {
      const buffer = await file.arrayBuffer()
      let text = new TextDecoder('utf-8').decode(buffer)
      if (text.includes('\uFFFD')) {
        text = new TextDecoder('windows-1252').decode(buffer)
      }

      Papa.parse<Record<string, unknown>>(text, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const baseList = results.data.map((r, idx) => extractRawRow(r, idx))
          setRows(revalidateRows(baseList, existingCodes))
        },
        error: (err: Error) => {
          toast.error(`Error al leer CSV: ${err.message}`)
        },
      })
    } else {
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array' })
      const sheetName = workbook.SheetNames[0]
      const sheet = workbook.Sheets[sheetName]
      const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet)
      const baseList = jsonData.map((r, idx) => extractRawRow(r, idx))
      setRows(revalidateRows(baseList, existingCodes))
    }
  }

  const handleUpdateRowField = (
    rowNumber: number,
    field:
      | 'delivery_district'
      | 'notes'
      | 'delivery_address'
      | 'customer_phone'
      | 'external_code'
      | 'customer_name'
      | 'amount_raw'
      | 'scheduled_date_raw',
    value: string
  ) => {
    setRows((prev) => {
      const updated = prev.map((r) =>
        r.rowNumber === rowNumber ? { ...r, [field]: value } : r
      )
      return revalidateRows(updated, existingCodes)
    })
  }

  const handleDiscardRow = (rowNumber: number) => {
    setRows((prev) => {
      const remaining = prev.filter((r) => r.rowNumber !== rowNumber)
      return revalidateRows(remaining, existingCodes)
    })
    toast.info(`Fila #${rowNumber} descartada de la importación`)
  }

  const handleDiscardAllInvalid = () => {
    const invalidCount = rows.filter((r) => r.errors.length > 0).length
    if (invalidCount === 0) return

    setRows((prev) => {
      const onlyValid = prev.filter((r) => r.errors.length === 0)
      return revalidateRows(onlyValid, existingCodes)
    })
    setViewMode('all')
    toast.success(`Se descartaron ${invalidCount} fila(s) con errores`)
  }

  const validRows = useMemo(
    () => rows.filter((r) => r.errors.length === 0),
    [rows]
  )
  const invalidRows = useMemo(
    () => rows.filter((r) => r.errors.length > 0),
    [rows]
  )

  const displayedRows = useMemo(() => {
    if (viewMode === 'invalid') return invalidRows
    if (viewMode === 'valid') return validRows
    return rows
  }, [rows, validRows, invalidRows, viewMode])

  const handleConfirmImport = async () => {
    if (validRows.length === 0) {
      toast.error('No hay filas válidas para importar')
      return
    }

    setIsImporting(true)
    const supabase = createClient()

    const payload = validRows.map((r) => ({
      organization_id: organizationId,
      external_code: r.external_code.trim() || null,
      customer_name: r.customer_name.trim(),
      customer_phone: r.customer_phone.trim(),
      customer_whatsapp: r.customer_phone.trim(),
      delivery_address: r.delivery_address.trim(),
      delivery_district: r.delivery_district.trim(),
      delivery_reference: r.delivery_reference.trim() || null,
      scheduled_date: r.scheduled_date,
      original_scheduled_date: r.scheduled_date,
      amount: r.amount,
      currency_code: 'PEN',
      status: 'pending_assignment' as const,
      notes: r.notes.trim() || null,
      created_by: userId,
    }))

    const { data: inserted, error } = await supabase
      .from('orders')
      .insert(payload)
      .select('id')

    setIsImporting(false)

    if (error) {
      toast.error(`Error en la importación: ${error.message}`)
      return
    }

    const insertedCount = inserted?.length ?? 0

    if (inserted && inserted.length > 0) {
      await supabase.from('order_status_history').insert(
        inserted.map((o) => ({
          order_id: o.id,
          previous_status: null,
          new_status: 'pending_assignment' as const,
          changed_by: userId,
          notes: `Importado masivamente desde ${fileName}`,
        }))
      )
    }

    setImportSummary({
      inserted: insertedCount,
      skipped: invalidRows.length,
    })

    toast.success(`Se importaron ${insertedCount} pedidos correctamente`)
    onImported()
  }

  const downloadTemplate = () => {
    const csvContent =
      'codigo,cliente,telefono,direccion,distrito,referencia,fecha,importe,observaciones\n' +
      'PED-1001,Juan Pérez,987654321,Av. Arequipa 1250,Lince,Frente al parque,18/11/2026,45.50,Entregar en recepción\n' +
      'PED-1002,María Gómez,912345678,,Miraflores,,18-11-2026,80.00,PEDIR UBICACIÓN'
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'plantilla_pedidos.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[97vw] sm:max-w-[96vw] xl:max-w-[1440px] h-[90vh] max-h-[90vh] flex flex-col p-6">
        <DialogHeader>
          <DialogTitle className="text-lg">
            Importación masiva de pedidos (CSV / Excel)
          </DialogTitle>
          <DialogDescription>
            Acepta fechas como <strong>18/11/2026</strong> o{' '}
            <strong>18-11-2026</strong>. Puedes editar en vivo el{' '}
            <strong>Distrito</strong>, <strong>Monto (S/)</strong>,{' '}
            <strong>Fecha</strong>, <strong>Dirección (opcional)</strong> y{' '}
            <strong>Observación</strong> antes de confirmar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 flex flex-col min-h-0">
          {/* Barra superior de carga de archivo */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-gray-50 rounded-xl border border-dashed border-gray-300 shrink-0">
            <div className="flex items-center gap-3">
              <FileSpreadsheet className="w-7 h-7 text-blue-600 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  {fileName || 'Selecciona un archivo CSV o Excel (.xlsx)'}
                </p>
                <p className="text-xs text-gray-500">
                  Columnas reconocidas: codigo, cliente, telefono, direccion
                  (opcional), distrito, referencia, fecha (DD/MM/AAAA o
                  DD-MM-AAAA), importe/monto, observaciones
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={downloadTemplate}
              >
                Descargar plantilla CSV
              </Button>
              <label className="cursor-pointer inline-flex items-center gap-2 px-3.5 py-1.5 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700">
                <Upload className="w-4 h-4" />
                Elegir archivo
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </label>
            </div>
          </div>

          {importSummary && (
            <div className="p-3.5 rounded-xl bg-green-50 border border-green-200 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-6 h-6 text-green-600" />
                <div>
                  <p className="text-sm font-semibold text-green-900">
                    Importación completada
                  </p>
                  <p className="text-xs text-green-700">
                    Insertados: {importSummary.inserted} · Omitidos con error:{' '}
                    {importSummary.skipped}
                  </p>
                </div>
              </div>
              <Button size="sm" onClick={() => onOpenChange(false)}>
                Cerrar
              </Button>
            </div>
          )}

          {rows.length > 0 && (
            <>
              {/* Filtros rápidos + Botón Descartar todas las rechazadas */}
              <div className="flex flex-wrap items-center justify-between gap-3 shrink-0">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setViewMode('all')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                      viewMode === 'all'
                        ? 'bg-gray-900 text-white border-gray-900'
                        : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    Todos ({rows.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('valid')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border inline-flex items-center gap-1.5 transition ${
                      viewMode === 'valid'
                        ? 'bg-green-600 text-white border-green-600'
                        : 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Válidos ({validRows.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('invalid')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border inline-flex items-center gap-1.5 transition ${
                      viewMode === 'invalid'
                        ? 'bg-red-600 text-white border-red-600'
                        : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                    }`}
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Con errores / rechazados ({invalidRows.length})
                  </button>

                  {invalidRows.length > 0 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleDiscardAllInvalid}
                      className="text-red-600 border-red-200 hover:bg-red-50 h-8 text-xs"
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                      Descartar todas las rechazadas ({invalidRows.length})
                    </Button>
                  )}
                </div>

                <p className="text-xs text-gray-500">
                  Edita en línea{' '}
                  <span className="font-semibold text-gray-700">Distrito</span>,{' '}
                  <span className="font-semibold text-gray-700">Monto S/</span>,{' '}
                  <span className="font-semibold text-gray-700">Fecha</span> u{' '}
                  <span className="font-semibold text-gray-700">
                    Observación
                  </span>
                  .
                </p>
              </div>

              {/* Tabla rectangular panorámica con edición en línea y botón descartar */}
              <div className="border rounded-xl overflow-auto flex-1 min-h-0 shadow-2xs">
                <datalist id="import-lima-districts">
                  {LIMA_DISTRICTS.map((district) => (
                    <option key={district} value={district} />
                  ))}
                </datalist>

                <table className="w-full text-xs text-left border-collapse">
                  <thead className="bg-gray-100 text-gray-700 uppercase sticky top-0 z-10 border-b">
                    <tr>
                      <th className="px-2.5 py-2.5 w-12">Fila</th>
                      <th className="px-2.5 py-2.5 w-24">Código</th>
                      <th className="px-2.5 py-2.5 min-w-[160px]">Cliente</th>
                      <th className="px-2.5 py-2.5 w-28">Teléfono</th>
                      <th className="px-2.5 py-2.5 min-w-[175px]">
                        Distrito (Editable)
                      </th>
                      <th className="px-2.5 py-2.5 min-w-[190px]">
                        Dirección (Opcional)
                      </th>
                      <th className="px-2.5 py-2.5 w-28">
                        Monto S/ (Editable)
                      </th>
                      <th className="px-2.5 py-2.5 w-32">Fecha (Editable)</th>
                      <th className="px-2.5 py-2.5 min-w-[180px]">
                        Observación (Editable)
                      </th>
                      <th className="px-2.5 py-2.5 min-w-[165px]">
                        Estado / Motivo
                      </th>
                      <th className="px-2.5 py-2.5 w-14 text-center">
                        Descartar
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {displayedRows.map((r) => {
                      const hasError = r.errors.length > 0
                      const hasPhoneError =
                        !r.customer_phone ||
                        r.customer_phone.replace(/\D/g, '').length < 7
                      const hasNameError =
                        !r.customer_name || r.customer_name.trim().length < 2
                      const hasAmountError = !parseFlexibleAmount(r.amount_raw)
                        .valid
                      const hasDateError = !parseFlexibleDate(
                        r.scheduled_date_raw
                      ).valid

                      return (
                        <tr
                          key={r.rowNumber}
                          className={
                            hasError
                              ? 'bg-red-50/75 hover:bg-red-50'
                              : 'bg-white hover:bg-gray-50/70'
                          }
                        >
                          <td className="px-2.5 py-2 font-mono font-semibold text-gray-600">
                            {r.rowNumber}
                          </td>

                          <td className="px-2.5 py-2">
                            <input
                              type="text"
                              value={r.external_code}
                              onChange={(e) =>
                                handleUpdateRowField(
                                  r.rowNumber,
                                  'external_code',
                                  e.target.value
                                )
                              }
                              className={`w-full rounded-md border px-2 py-1 font-mono text-xs bg-white ${
                                r.isDuplicate
                                  ? 'border-red-500 text-red-700 font-bold bg-red-50'
                                  : 'border-gray-200'
                              }`}
                            />
                          </td>

                          <td className="px-2.5 py-2">
                            <input
                              type="text"
                              value={r.customer_name}
                              onChange={(e) =>
                                handleUpdateRowField(
                                  r.rowNumber,
                                  'customer_name',
                                  e.target.value
                                )
                              }
                              placeholder="Nombre del cliente..."
                              className={`w-full rounded-md border px-2 py-1 text-xs font-medium bg-white ${
                                hasNameError
                                  ? 'border-red-500 text-red-700 bg-red-50'
                                  : 'border-gray-200 text-gray-900'
                              }`}
                            />
                          </td>

                          <td className="px-2.5 py-2">
                            <input
                              type="text"
                              value={r.customer_phone}
                              onChange={(e) =>
                                handleUpdateRowField(
                                  r.rowNumber,
                                  'customer_phone',
                                  e.target.value
                                )
                              }
                              className={`w-full rounded-md border px-2 py-1 text-xs bg-white ${
                                hasPhoneError
                                  ? 'border-red-500 text-red-700 bg-red-50'
                                  : 'border-gray-200'
                              }`}
                            />
                          </td>

                          {/* DISTRITO EDITABLE */}
                          <td className="px-2.5 py-2">
                            <input
                              type="text"
                              list="import-lima-districts"
                              value={r.delivery_district}
                              onChange={(e) =>
                                handleUpdateRowField(
                                  r.rowNumber,
                                  'delivery_district',
                                  e.target.value
                                )
                              }
                              placeholder="Selecciona o escribe distrito..."
                              className="w-full rounded-md border border-blue-200 bg-white px-2 py-1 text-xs font-medium text-gray-900 focus:border-blue-600 focus:outline-none"
                            />
                          </td>

                          {/* DIRECCIÓN OPCIONAL EDITABLE */}
                          <td className="px-2.5 py-2">
                            <input
                              type="text"
                              value={r.delivery_address}
                              onChange={(e) =>
                                handleUpdateRowField(
                                  r.rowNumber,
                                  'delivery_address',
                                  e.target.value
                                )
                              }
                              placeholder="Opcional (ej. pedir ubicación)"
                              className="w-full rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-800 placeholder:text-gray-400 focus:border-blue-600 focus:outline-none"
                            />
                          </td>

                          {/* MONTO S/ EDITABLE */}
                          <td className="px-2.5 py-2">
                            <div className="relative flex items-center">
                              <span className="absolute left-2 text-[11px] font-semibold text-gray-400 pointer-events-none">
                                S/
                              </span>
                              <input
                                type="text"
                                value={r.amount_raw}
                                onChange={(e) =>
                                  handleUpdateRowField(
                                    r.rowNumber,
                                    'amount_raw',
                                    e.target.value
                                  )
                                }
                                placeholder="0.00"
                                className={`w-full rounded-md border pl-6 pr-2 py-1 text-xs font-semibold bg-white focus:outline-none ${
                                  hasAmountError
                                    ? 'border-red-500 text-red-700 bg-red-50'
                                    : 'border-blue-200 text-emerald-700 focus:border-blue-600'
                                }`}
                              />
                            </div>
                          </td>

                          {/* FECHA EDITABLE (ACEPTA DD/MM/YYYY y DD-MM-YYYY) */}
                          <td className="px-2.5 py-2">
                            <input
                              type="text"
                              value={r.scheduled_date_raw}
                              onChange={(e) =>
                                handleUpdateRowField(
                                  r.rowNumber,
                                  'scheduled_date_raw',
                                  e.target.value
                                )
                              }
                              placeholder="18/11/2026"
                              className={`w-full rounded-md border px-2 py-1 text-xs bg-white focus:outline-none ${
                                hasDateError
                                  ? 'border-red-500 text-red-700 bg-red-50'
                                  : 'border-gray-200 text-gray-800 focus:border-blue-600'
                              }`}
                            />
                          </td>

                          {/* OBSERVACIÓN EDITABLE */}
                          <td className="px-2.5 py-2">
                            <input
                              type="text"
                              value={r.notes}
                              onChange={(e) =>
                                handleUpdateRowField(
                                  r.rowNumber,
                                  'notes',
                                  e.target.value
                                )
                              }
                              placeholder="Añadir observación..."
                              className="w-full rounded-md border border-blue-200 bg-white px-2 py-1 text-xs text-gray-800 focus:border-blue-600 focus:outline-none"
                            />
                          </td>

                          {/* ESTADO / MOTIVOS DE RECHAZO */}
                          <td className="px-2.5 py-2">
                            {!hasError ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-800 font-semibold text-[11px]">
                                <CheckCircle2 className="w-3 h-3" />
                                Listo para importar
                              </span>
                            ) : (
                              <div className="flex flex-wrap gap-1">
                                {r.errors.map((err, i) => (
                                  <span
                                    key={i}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-100 text-red-800 font-semibold text-[11px] border border-red-200"
                                  >
                                    <AlertTriangle className="w-3 h-3 shrink-0" />
                                    {err}
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>

                          {/* BOTÓN DESCARTAR FILA */}
                          <td className="px-2.5 py-2 text-center">
                            <button
                              type="button"
                              title={`Descartar fila #${r.rowNumber}`}
                              onClick={() => handleDiscardRow(r.rowNumber)}
                              className="inline-flex items-center justify-center p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-100 transition"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="pt-3 border-t shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={validRows.length === 0 || isImporting || !!importSummary}
            onClick={handleConfirmImport}
          >
            {isImporting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Importando...
              </>
            ) : (
              `Confirmar importación (${validRows.length} válidos)`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
