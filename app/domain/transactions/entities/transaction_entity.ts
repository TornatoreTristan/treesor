import { DateTime } from 'luxon'

export interface TransactionEntity {
  id?: number
  bankStatementId?: number
  userId?: string
  transactionDate: Date | string | DateTime
  valueDate?: Date | string | DateTime | null
  description: string
  reference?: string
  amount: number
  type: 'credit' | 'debit'
  balanceAfter?: number
  status?: 'pending' | 'paid' | 'rejected'
  categoryId?: number | null
  notes?: string | null
  vendorId?: number | null
  bankName?: string | null
  isDoublon?: boolean
  accountNumber?: string | null
}
