import CashFlowChart from '~/components/dashboard/cashflow-charts'
import CreditTotal from '~/components/dashboard/credit-total'
import DateRangeSelector from '~/components/dashboard/date-range-selector'
import DebitTotal from '~/components/dashboard/debit-total'
import { DateRangeProvider } from '~/contexts/daterange-context'

const Dashboard = () => {
  return (
    <>
      <div>
        <DateRangeProvider>
          <DateRangeSelector />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <DebitTotal />
            <CreditTotal />
          </div>
          <div>
            <CashFlowChart />
          </div>
        </DateRangeProvider>
      </div>
    </>
  )
}

export default Dashboard
