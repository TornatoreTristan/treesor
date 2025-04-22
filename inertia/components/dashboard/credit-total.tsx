import { useDateRange } from '~/contexts/daterange-context'
import { useDashboardData } from '~/hooks/use_transactions'

const CreditTotal = () => {
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
    <div className="bg-emerald-50 p-4 rounded-lg border">
      <h3 className="text-lg font-medium text-emerald-800">Total Crédits</h3>
      <p className="text-2xl font-bold text-emerald-600">{formatCurrency(data.totals.credit)}</p>
    </div>
  )
}

export default CreditTotal
