// Types pour les factures fournisseurs dans une architecture clean
export type InvoiceStatus = 'draft' | 'pending' | 'paid' | 'cancelled' | 'overdue'

export interface Invoice {
  id: number
  invoiceNumber: string
  date: string
  dueDate: string
  clientName: string // Nom du fournisseur (garde le même nom de prop pour compatibilité)
  amount: number // Montant HT
  vatRate?: number // Taux de TVA
  vatAmount?: number // Montant de TVA
  totalAmount?: number // Montant TTC
  status: InvoiceStatus
  description?: string
  notes?: string
  paymentMethod?: string
  paymentDate?: string
  createdAt: string
  updatedAt: string
  category?: string // Catégorie de dépense
  accountingCode?: string // Code comptable
  createdBy?: {
    id: string
    fullName: string | null
    firstName: string | null
    lastName: string | null
    avatar: string | null
    email: string
  } | null
}

// Types pour la requête de création d'une facture fournisseur
export interface CreateInvoiceRequest {
  invoiceNumber: string
  date: string
  dueDate: string
  clientName: string // Nom du fournisseur
  amount: number // Montant HT
  vatRate?: number // Taux de TVA
  vatAmount?: number // Montant de TVA
  totalAmount?: number // Montant TTC
  status: InvoiceStatus
  description?: string
  notes?: string
  paymentMethod?: string
  paymentDate?: string
  category?: string
  accountingCode?: string
}

// Types pour la mise à jour d'une facture fournisseur
export interface UpdateInvoiceRequest {
  invoiceNumber?: string
  date?: string
  dueDate?: string
  clientName?: string // Nom du fournisseur
  amount?: number // Montant HT
  vatRate?: number // Taux de TVA
  vatAmount?: number // Montant de TVA
  totalAmount?: number // Montant TTC
  status?: InvoiceStatus
  description?: string
  notes?: string
  paymentMethod?: string
  paymentDate?: string
  category?: string
  accountingCode?: string
}

// Type pour les données de filtre du tableau
export interface InvoiceFilterOptions {
  status: { label: string; value: InvoiceStatus }[]
  category?: { label: string; value: string }[]
}
