import { Head, useForm } from '@inertiajs/react'
import DefaultLayout from '~/app/layouts/default-layout'
import HeaderPage from '~/components/header-page'
import { Input } from '~/components/ui/input'
import { Button } from '~/components/ui/button'
import { Card, CardContent } from '~/components/ui/card'
import { Label } from '~/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import { useState } from 'react'
import { FormEvent } from 'react'
import { ChevronLeft } from 'lucide-react'
import { Link } from '@inertiajs/react'

interface EditInvoiceProps {
  invoice: {
    id: number
    number: string | null
    amountHT: number
    amountTTC: number
    vatRate: number
    vatAmount: number
    date: string | null
    dueDate: string | null
    notes: string | null
    status: 'pending' | 'paid' | 'rejected'
    categoryId: number | null
    vendorId: number | null
  }
  vendors?: { id: number; name: string }[]
  categories?: { id: number; name: string }[]
}

export default function EditInvoice({ invoice, vendors = [], categories = [] }: EditInvoiceProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [updateError, setUpdateError] = useState<string | null>(null)

  const { data, setData, put, errors } = useForm({
    number: invoice.number || '',
    amountHT: invoice.amountHT?.toString() || '',
    vatRate: invoice.vatRate?.toString() || '20',
    vatAmount: invoice.vatAmount?.toString() || '',
    amountTTC: invoice.amountTTC?.toString() || '',
    date: invoice.date ? invoice.date.split('T')[0] : '',
    dueDate: invoice.dueDate ? invoice.dueDate.split('T')[0] : '',
    notes: invoice.notes || '',
    categoryId: invoice.categoryId?.toString() || '',
    vendorId: invoice.vendorId?.toString() || '',
    status: invoice.status || 'pending',
  })

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    setUpdateError(null)
    setIsSubmitting(true)

    if (!data.amountHT || !data.amountTTC) {
      setUpdateError('Les montants HT et TTC sont requis')
      setIsSubmitting(false)
      return
    }

    put(`/api/invoices/${invoice.id}`, {
      onSuccess: () => {
        setIsSubmitting(false)
        window.location.href = '/invoices'
      },
      onError: () => {
        setUpdateError('Une erreur est survenue lors de la modification')
        setIsSubmitting(false)
      },
    })
  }

  return (
    <DefaultLayout>
      <Head title={`Modifier la facture ${invoice.number || invoice.id}`} />
      <div className="container py-6">
        <Link href="/invoices" className="flex items-center text-sm mb-4 hover:underline">
          <ChevronLeft className="h-4 w-4 mr-1" />
          Retour aux factures
        </Link>

        <HeaderPage title={`Modifier la facture ${invoice.number || invoice.id}`} />

        <Card className="mt-6">
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Informations générales</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="number">Numéro de facture</Label>
                      <Input
                        id="number"
                        value={data.number}
                        onChange={(e) => setData('number', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="status">Statut</Label>
                      <Select
                        value={data.status}
                        onValueChange={(value) =>
                          setData('status', value as 'pending' | 'paid' | 'rejected')
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">À payer</SelectItem>
                          <SelectItem value="paid">Payée</SelectItem>
                          <SelectItem value="rejected">Rejetée</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Montants</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="amountHT">Montant HT</Label>
                      <Input
                        id="amountHT"
                        type="number"
                        step="0.01"
                        value={data.amountHT}
                        onChange={(e) => setData('amountHT', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="amountTTC">Montant TTC</Label>
                      <Input
                        id="amountTTC"
                        type="number"
                        step="0.01"
                        value={data.amountTTC}
                        onChange={(e) => setData('amountTTC', e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {updateError && <div className="text-red-500">{updateError}</div>}

              <div className="flex justify-end space-x-2">
                <Button variant="outline" type="button" asChild>
                  <Link href="/invoices">Annuler</Link>
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Modification...' : 'Modifier la facture'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </DefaultLayout>
  )
}
