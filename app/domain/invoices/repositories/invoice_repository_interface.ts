import { InvoiceEntity } from '../entities/invoice_entity.js'

export interface CreateInvoiceData {
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
  date?: string | null
  dueDate?: string | null
  isDoublon?: boolean
  categoryId?: number | null
  vendorId?: number | null
  bankStatementId?: number | null
}

export interface UpdateInvoiceData {
  number?: string | null
  assignId?: string
  documentUrl?: string
  originalName?: string
  mimeType?: string
  size?: number
  type?: string
  status?: 'pending' | 'paid' | 'rejected'
  amountHT?: number
  amountTTC?: number
  vatRate?: number
  vatAmount?: number
  notes?: string | null
  date?: string | null
  dueDate?: string | null
  isDoublon?: boolean
  categoryId?: number | null
  vendorId?: number | null
  bankStatementId?: number | null
}

export interface InvoiceRepositoryInterface {
  findById(id: number): Promise<InvoiceEntity | null>
  findAll(): Promise<InvoiceEntity[]>
  findByUserId(userId: string): Promise<InvoiceEntity[]>
  create(data: CreateInvoiceData): Promise<InvoiceEntity>
  update(id: number, data: UpdateInvoiceData): Promise<InvoiceEntity>
  delete(id: number): Promise<void>
}