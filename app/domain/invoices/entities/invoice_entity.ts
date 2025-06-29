import { DateTime } from 'luxon'

export interface InvoiceEntity {
  id?: number
  number?: string | null
  userId: string
  assignId: string
  documentUrl: string
  originalName: string
  mimeType: string
  size: number
  type: string
  status: 'pending' | 'paid' | 'rejected'
  amountHT: number
  amountTTC: number
  vatRate: number
  vatAmount: number
  notes?: string | null
  date?: DateTime | string | null
  dueDate?: DateTime | string | null
  isDoublon?: boolean
  categoryId?: number | null
  vendorId?: number | null
  bankStatementId?: number | null
  category?: {
    id: number
    name: string
  } | null
  vendor?: {
    id: number
    name: string
  } | null
  createdAt?: DateTime | string
  updatedAt?: DateTime | string
}
