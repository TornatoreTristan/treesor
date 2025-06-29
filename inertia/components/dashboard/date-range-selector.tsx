import React, { useEffect } from 'react'
import { useDateRange } from '~/contexts/daterange-context'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '~/components/ui/button'

const DateRangeSelector = () => {
  const { dateRange, setDateRange } = useDateRange()
  const queryClient = useQueryClient()

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDateRange({
      ...dateRange,
      [e.target.name]: e.target.value,
    })
  }

  // Auto-refresh all dashboard queries when date range changes
  useEffect(() => {
    // Invalidate all dashboard-related queries
    queryClient.invalidateQueries({ queryKey: ['transactionsDashboard'] })
    queryClient.invalidateQueries({ queryKey: ['categoryTotals'] })
    queryClient.invalidateQueries({ queryKey: ['transactionsCashflow'] })
  }, [dateRange, queryClient])

  // Fonctions pour calculer les plages de dates
  const setCurrentMonth = () => {
    const now = new Date()
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)

    setDateRange({
      startDate: firstDay.toISOString().split('T')[0],
      endDate: lastDay.toISOString().split('T')[0],
    })
  }

  const setLastMonth = () => {
    const now = new Date()
    const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const lastDay = new Date(now.getFullYear(), now.getMonth(), 0)

    setDateRange({
      startDate: firstDay.toISOString().split('T')[0],
      endDate: lastDay.toISOString().split('T')[0],
    })
  }

  const setCurrentQuarter = () => {
    const now = new Date()
    const currentQuarter = Math.floor(now.getMonth() / 3)
    const firstDay = new Date(now.getFullYear(), currentQuarter * 3, 1)
    const lastDay = new Date(now.getFullYear(), (currentQuarter + 1) * 3, 0)

    setDateRange({
      startDate: firstDay.toISOString().split('T')[0],
      endDate: lastDay.toISOString().split('T')[0],
    })
  }

  const setLastQuarter = () => {
    const now = new Date()
    const currentQuarter = Math.floor(now.getMonth() / 3)
    const lastQuarter = currentQuarter === 0 ? 3 : currentQuarter - 1
    const year = currentQuarter === 0 ? now.getFullYear() - 1 : now.getFullYear()

    const firstDay = new Date(year, lastQuarter * 3, 1)
    const lastDay = new Date(year, (lastQuarter + 1) * 3, 0)

    setDateRange({
      startDate: firstDay.toISOString().split('T')[0],
      endDate: lastDay.toISOString().split('T')[0],
    })
  }

  const setCurrentYear = () => {
    const now = new Date()
    const firstDay = new Date(now.getFullYear(), 0, 1)
    const lastDay = new Date(now.getFullYear(), 11, 31)

    setDateRange({
      startDate: firstDay.toISOString().split('T')[0],
      endDate: lastDay.toISOString().split('T')[0],
    })
  }

  const setLastYear = () => {
    const now = new Date()
    const year = now.getFullYear() - 1
    const firstDay = new Date(year, 0, 1)
    const lastDay = new Date(year, 11, 31)

    setDateRange({
      startDate: firstDay.toISOString().split('T')[0],
      endDate: lastDay.toISOString().split('T')[0],
    })
  }

  return (
    <div className="w-full">
      <div className="space-y-4 flex justify-between items-center">
        {/* Boutons de raccourci */}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={setCurrentMonth} className="text-xs">
            Mois en cours
          </Button>
          <Button variant="outline" size="sm" onClick={setLastMonth} className="text-xs">
            Mois dernier
          </Button>
          <Button variant="outline" size="sm" onClick={setCurrentQuarter} className="text-xs">
            Trimestre
          </Button>
          <Button variant="outline" size="sm" onClick={setLastQuarter} className="text-xs">
            Trimestre dernier
          </Button>
          <Button variant="outline" size="sm" onClick={setCurrentYear} className="text-xs">
            Année en cours
          </Button>
          <Button variant="outline" size="sm" onClick={setLastYear} className="text-xs">
            Année dernière
          </Button>
        </div>

        {/* Sélecteurs de date manuels */}
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date de début</label>
            <input
              type="date"
              name="startDate"
              value={dateRange.startDate}
              onChange={handleDateChange}
              className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date de fin</label>
            <input
              type="date"
              name="endDate"
              value={dateRange.endDate}
              onChange={handleDateChange}
              className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default DateRangeSelector
