import { Head } from '@inertiajs/react'
import HeaderPage from '~/components/header-page'
import { DataTable } from '~/components/invoices/data-table'
import { columns } from '~/components/invoices/columns'
import { Invoice } from '~/types/invoice'
import DefaultLayout from '~/app/layouts/default-layout'
import { Button } from '~/components/ui/button'
import { Link } from '@inertiajs/react'
import { Plus } from 'lucide-react'

// Options de filtre pour le statut
const invoiceStatusOptions = [
  { label: 'Brouillon', value: 'draft' },
  { label: 'À payer', value: 'pending' },
  { label: 'Payée', value: 'paid' },
  { label: 'Annulée', value: 'cancelled' },
  { label: 'En retard', value: 'overdue' },
]

// Options de filtre pour les catégories
const categoryOptions = [
  { label: 'Énergie', value: 'Énergie' },
  { label: 'Télécom', value: 'Télécom' },
  { label: 'Services', value: 'Services' },
  { label: 'Informatique', value: 'Informatique' },
  { label: 'Fournitures', value: 'Fournitures' },
]

interface InvoicesPageProps {
  invoices: Invoice[]
}

export default function InvoicesPage({ invoices }: InvoicesPageProps) {
  return (
    <>
      <Head title="Factures fournisseurs" />
      <DefaultLayout>
        <div className="container mx-auto py-6">
          <div className="flex justify-between items-center">
            <HeaderPage title="Factures fournisseurs" />
            <Button asChild>
              <Link href="/invoices/create" className="flex items-center gap-1">
                <Plus className="h-4 w-4" />
                Nouvelle facture
              </Link>
            </Button>
          </div>

          <div className="mt-8 text-xs">
            <DataTable
              columns={columns}
              data={invoices}
              filterableColumns={[
                {
                  id: 'status',
                  title: 'statuts',
                  options: invoiceStatusOptions,
                },
                {
                  id: 'category',
                  title: 'catégories',
                  options: categoryOptions,
                },
              ]}
            />
          </div>
        </div>
      </DefaultLayout>
    </>
  )
}
