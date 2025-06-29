import { useQuery } from '@tanstack/react-query'

interface CashflowParams {
  months?: number
  startDate?: string
  endDate?: string
}

export function useCashFlowData(params: CashflowParams = {}) {
  return useQuery({
    queryKey: ['transactionsCashflow', params.months, params.startDate, params.endDate],
    queryFn: async () => {
      const queryParams = new URLSearchParams()
      if (params.months) queryParams.append('months', params.months.toString())
      if (params.startDate) queryParams.append('startDate', params.startDate)
      if (params.endDate) queryParams.append('endDate', params.endDate)

      const url = `/api/transactions/cashflow${queryParams.toString() ? '?' + queryParams.toString() : ''}`
      const response = await fetch(url)

      if (!response.ok) {
        throw new Error('Erreur lors de la récupération des données de flux de trésorerie')
      }

      return response.json()
    },
  })
}
