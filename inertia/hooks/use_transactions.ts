import { useQuery } from '@tanstack/react-query'

interface DashboardParams {
  startDate?: string // format ISO 'YYYY-MM-DD'
  endDate?: string // format ISO 'YYYY-MM-DD'
}

interface DashboardData {
  period: {
    start: string
    end: string
  }
  totals: {
    credit: number
    debit: number
    balance: number
  }
}

export function useDashboardData(params: DashboardParams = {}) {
  return useQuery<DashboardData>({
    queryKey: ['transactionsDashboard', params.startDate, params.endDate],
    queryFn: async () => {
      const queryParams = new URLSearchParams()
      if (params.startDate) queryParams.append('startDate', params.startDate)
      if (params.endDate) queryParams.append('endDate', params.endDate)

      const url = `/api/transactions/dashboard${queryParams.toString() ? '?' + queryParams.toString() : ''}`
      const response = await fetch(url)

      if (!response.ok) {
        throw new Error('Erreur lors de la récupération des données du dashboard')
      }

      return response.json()
    },
  })
}
