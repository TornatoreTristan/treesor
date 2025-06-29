import { CategoryTotals } from '~/components/dashboard/category-totals'
import CreditTotal from '~/components/dashboard/credit-total'
import DateRangeSelector from '~/components/dashboard/date-range-selector'
import DebitTotal from '~/components/dashboard/debit-total'
import { DateRangeProvider } from '~/contexts/daterange-context'

const Dashboard = () => {
  return (
    <>
      <div className="space-y-6">
        <DateRangeProvider>
          <div className="flex justify-between items-center">
            <DateRangeSelector />
          </div>

          {/* Vue d'ensemble des totaux - Débits et Crédits sur une ligne */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <DebitTotal />
            <CreditTotal />
          </div>

          {/* Totaux par catégorie en pleine largeur */}
          <div className="w-full">
            <CategoryTotals />
          </div>
        </DateRangeProvider>
      </div>
    </>
  )
}

export default Dashboard
