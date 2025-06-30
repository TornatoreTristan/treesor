import { ColumnDef } from '@tanstack/react-table'
import { ArrowUpDown, Edit, Trash2, Eye } from 'lucide-react'
import { Button } from '~/components/ui/button'
import { Invoice, InvoiceStatus } from '~/types/invoice'
import { Link, router } from '@inertiajs/react'

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

// Fonction de suppression avec confirmation
function deleteInvoice(invoice: Invoice) {
  const confirmed = window.confirm(
    `Êtes-vous sûr de vouloir supprimer la facture ${invoice.invoiceNumber || invoice.id} ?\n\nCette action est irréversible.`
  )

  if (confirmed) {
    router.delete(`/api/invoices/${invoice.id}`, {
      onSuccess: () => {
        // Recharger la page pour voir les changements
        window.location.reload()
      },
      onError: () => {
        alert('Erreur lors de la suppression de la facture')
      },
    })
  }
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
    accessorKey: 'createdBy',
    header: 'Créé par',
    cell: ({ row }) => {
      const createdBy = row.getValue('createdBy') as Invoice['createdBy']

      if (!createdBy) {
        return <div className="text-gray-400">-</div>
      }

      const displayName =
        createdBy.fullName ||
        `${createdBy.firstName || ''} ${createdBy.lastName || ''}`.trim() ||
        createdBy.email

      return (
        <div className="flex items-center space-x-2">
          {createdBy.avatar ? (
            <img
              src={createdBy.avatar}
              alt={displayName}
              className="w-8 h-8 rounded-full object-cover"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 text-sm font-medium">
              {displayName.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
      )
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
    id: 'actions',
    header: 'Actions',
    cell: ({ row }) => {
      const invoice = row.original

      return (
        <div className="text-right space-x-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.open(`/invoices/${invoice.id}/view`, '_blank')}
          >
            <Eye className="h-4 w-4" />
            <span className="sr-only">Voir le PDF</span>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/invoices/${invoice.id}/edit`}>
              <Edit className="h-4 w-4" />
              <span className="sr-only">Modifier</span>
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-red-600 hover:text-red-800"
            onClick={() => deleteInvoice(invoice)}
          >
            <Trash2 className="h-4 w-4" />
            <span className="sr-only">Supprimer</span>
          </Button>
        </div>
      )
    },
  },
]
