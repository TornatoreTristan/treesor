import { ColumnDef } from '@tanstack/react-table'
import { ArrowUpDown, MoreHorizontal } from 'lucide-react'
import { Button } from '~/components/ui/button'
import { Invoice, InvoiceStatus } from '~/types/invoice'

// Fonction pour formatter les montants en euros
function formatCurrency(amount: number | undefined): string {
  if (amount === undefined) return '-'
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount)
}

// Fonction pour formatter les dates
function formatDate(dateString: string | undefined): string {
  if (!dateString) return '-'
  return new Intl.DateTimeFormat('fr-FR').format(new Date(dateString))
}

// Badge de statut stylisé selon le statut
function StatusBadge({ status }: { status: InvoiceStatus }) {
  const statusStyles: Record<InvoiceStatus, string> = {
    draft: 'bg-gray-100 text-gray-800',
    pending: 'bg-yellow-100 text-yellow-800',
    paid: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800',
    overdue: 'bg-orange-100 text-orange-800',
  }

  const statusLabels: Record<InvoiceStatus, string> = {
    draft: 'Brouillon',
    pending: 'À payer',
    paid: 'Payée',
    cancelled: 'Annulée',
    overdue: 'En retard',
  }

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusStyles[status]}`}
    >
      {statusLabels[status]}
    </span>
  )
}

export const columns: ColumnDef<Invoice>[] = [
  {
    accessorKey: 'invoiceNumber',
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        className="p-0 hover:bg-transparent"
      >
        N° Facture
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => <div>{row.getValue('invoiceNumber')}</div>,
  },
  {
    accessorKey: 'date',
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        className="p-0 hover:bg-transparent"
      >
        Date
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => <div>{formatDate(row.getValue('date'))}</div>,
  },
  {
    accessorKey: 'dueDate',
    header: 'Échéance',
    cell: ({ row }) => <div>{formatDate(row.getValue('dueDate'))}</div>,
  },
  {
    accessorKey: 'clientName',
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        className="p-0 hover:bg-transparent"
      >
        Fournisseur
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => <div>{row.getValue('clientName')}</div>,
  },
  {
    accessorKey: 'category',
    header: 'Catégorie',
    cell: ({ row }) => <div>{row.getValue('category') || '-'}</div>,
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id))
    },
  },
  {
    accessorKey: 'amount',
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        className="p-0 hover:bg-transparent"
      >
        Montant HT
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => <div className="text-right">{formatCurrency(row.getValue('amount'))}</div>,
  },
  {
    accessorKey: 'totalAmount',
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        className="p-0 hover:bg-transparent"
      >
        Montant TTC
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => (
      <div className="text-right">{formatCurrency(row.getValue('totalAmount'))}</div>
    ),
  },
  {
    accessorKey: 'status',
    header: 'Statut',
    cell: ({ row }) => <StatusBadge status={row.getValue('status')} />,
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id))
    },
  },
  {
    accessorKey: 'paymentDate',
    header: 'Date de paiement',
    cell: ({ row }) => <div>{formatDate(row.getValue('paymentDate'))}</div>,
  },
  {
    accessorKey: 'description',
    header: 'Description',
    cell: ({ row }) => <div className="line-clamp-1">{row.getValue('description') || '-'}</div>,
  },
  {
    id: 'actions',
    cell: ({ row }) => {
      const invoice = row.original

      return (
        <div className="text-right">
          <Button variant="ghost" className="h-8 w-8 p-0">
            <span className="sr-only">Ouvrir le menu</span>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </div>
      )
    },
  },
]
