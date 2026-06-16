// @ts-nocheck
import imageCompression from 'browser-image-compression'
import { createClient } from '@/lib/supabase/client'

export interface Attachment {
  url: string
  name: string
  type: string // 'image' | 'file'
}

// Types acceptés : images + PDF/documents courants.
const ACCEPTED = [
  'image/', 'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument', // docx, xlsx, pptx
  'application/vnd.ms-excel', 'application/vnd.ms-powerpoint',
  'text/plain', 'text/csv',
]
export const ATTACHMENT_ACCEPT = 'image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv'
export const MAX_ATTACHMENT_MB = 10

export function isAcceptedFile(file: File): boolean {
  return ACCEPTED.some(t => file.type.startsWith(t))
}

// Upload un fichier dans le bucket 'attachments' et renvoie l'attachment.
// Compresse les images ; laisse les autres fichiers tels quels.
export async function uploadAttachment(file: File, userId: string): Promise<Attachment | null> {
  if (!file || !userId) return null
  if (!isAcceptedFile(file)) {
    alert('Type de fichier non pris en charge (images, PDF et documents uniquement).')
    return null
  }
  if (file.size > MAX_ATTACHMENT_MB * 1024 * 1024) {
    alert(`Fichier trop volumineux (max ${MAX_ATTACHMENT_MB} Mo).`)
    return null
  }

  const supabase = createClient()
  const isImage = file.type.startsWith('image/')

  let toUpload: File | Blob = file
  if (isImage) {
    try {
      toUpload = await imageCompression(file, { maxSizeMB: 1, maxWidthOrHeight: 1600, useWebWorker: true })
    } catch { toUpload = file }
  }

  const ext = file.name.split('.').pop() || 'bin'
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const { error } = await supabase.storage.from('attachments').upload(path, toUpload, { upsert: false, contentType: file.type })
  if (error) {
    console.error('[uploadAttachment]', error.message)
    alert("L'envoi de la pièce jointe a échoué.")
    return null
  }
  const { data } = supabase.storage.from('attachments').getPublicUrl(path)
  return { url: data.publicUrl, name: file.name, type: isImage ? 'image' : 'file' }
}
