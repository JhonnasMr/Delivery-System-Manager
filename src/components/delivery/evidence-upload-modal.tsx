'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { EVIDENCE_CONFIG } from '@/lib/constants'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Camera, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import type { Order, EvidenceType } from '@/types/database'

interface EvidenceUploadModalProps {
  order: Order
  driverId: string
  userId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onUploaded: () => void
}

export function EvidenceUploadModal({
  order,
  driverId,
  userId,
  open,
  onOpenChange,
  onUploaded,
}: EvidenceUploadModalProps) {
  const [file, setFile] = useState<File | null>(null)
  const [evidenceType, setEvidenceType] =
    useState<EvidenceType>('delivery_photo')
  const [notes, setNotes] = useState('')
  const [uploading, setUploading] = useState(false)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (!selected) return
    if (selected.size > EVIDENCE_CONFIG.maxSizeBytes) {
      toast.error('La imagen supera el límite de 10 MB')
      return
    }
    setFile(selected)
  }

  const handleUpload = async () => {
    if (!file) {
      toast.error('Selecciona o toma una fotografía primero')
      return
    }

    setUploading(true)
    const supabase = createClient()
    const ext = file.name.split('.').pop() || 'jpg'
    const storagePath = `${order.organization_id}/${order.id}/${Date.now()}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from(EVIDENCE_CONFIG.bucketName)
      .upload(storagePath, file, {
        contentType: file.type || 'image/jpeg',
        upsert: false,
      })

    if (uploadError) {
      setUploading(false)
      toast.error(`Error al subir foto a Storage: ${uploadError.message}`)
      return
    }

    const { error: dbError } = await supabase.from('delivery_evidence').insert({
      order_id: order.id,
      driver_id: driverId,
      uploaded_by: userId,
      evidence_type: evidenceType,
      storage_path: storagePath,
      file_name: file.name,
      mime_type: file.type || 'image/jpeg',
      file_size_bytes: file.size,
      notes: notes.trim() || null,
    })

    setUploading(false)

    if (dbError) {
      toast.error(`Error al registrar evidencia: ${dbError.message}`)
      return
    }

    toast.success('Fotografía de evidencia guardada correctamente')
    setFile(null)
    setNotes('')
    onOpenChange(false)
    onUploaded()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Subir evidencia fotográfica</DialogTitle>
          <DialogDescription>
            Toma una foto del paquete entregado, fachada o incidencia.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Tipo de fotografía</Label>
            <select
              value={evidenceType}
              onChange={(e) => setEvidenceType(e.target.value as EvidenceType)}
              className="flex h-11 w-full rounded-xl border border-input bg-white px-3 text-sm"
            >
              <option value="delivery_photo">Foto de entrega realizada</option>
              <option value="package_photo">Foto del paquete</option>
              <option value="address_reference_photo">
                Foto de fachada / dirección
              </option>
              <option value="incident_photo">Foto de incidencia</option>
            </select>
          </div>

          <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-blue-300 rounded-2xl bg-blue-50/50 cursor-pointer hover:bg-blue-50 transition">
            <Camera className="w-10 h-10 text-blue-600 mb-2" />
            <span className="text-sm font-semibold text-blue-900">
              {file ? file.name : 'Tocar para tomar foto o elegir de galería'}
            </span>
            <span className="text-xs text-blue-600 mt-0.5">
              JPG, PNG o WEBP (máx. 10 MB)
            </span>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleFileChange}
            />
          </label>

          <div className="space-y-1.5">
            <Label>Comentario (opcional)</Label>
            <Textarea
              rows={2}
              placeholder="Ej. Entregado a vigilancia con sello..."
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
          <Button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="h-11"
          >
            {uploading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Subir fotografía
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
