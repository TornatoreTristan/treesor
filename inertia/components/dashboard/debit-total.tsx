import { useDateRange } from '~/contexts/daterange-context'
import { useDashboardData } from '~/hooks/use_transactions'

const DebitTotal = () => {
  const { dateRange } = useDateRange()
  const { data, isLoading, error } = useDashboardData(dateRange)

  if (isLoading) return <div className="animate-pulse bg-gray-200 h-24 rounded-md"></div>
  if (error) return <div className="text-red-500">Erreur de chargement</div>
  if (!data) return null

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
    }).format(Math.abs(amount))
  }

  return (
    <div className="bg-red-50 p-4 rounded-lg border border-red-200">
      <h3 className="text-lg font-medium text-red-800">Total Débits</h3>
      <p className="text-2xl font-bold text-red-600">{formatCurrency(data.totals.debit)}</p>
    </div>
  )
}

export default DebitTotal
