import React from 'react'
import { useDateRange } from '~/contexts/daterange-context'
import { useQueryClient } from '@tanstack/react-query'

const DateRangeSelector = () => {
  const { dateRange, setDateRange } = useDateRange()
  const queryClient = useQueryClient()

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDateRange({
      ...dateRange,
      [e.target.name]: e.target.value,
    })
  }

  const handleApplyFilter = () => {
    // Invalidate queries to trigger refetch with new date range
    queryClient.invalidateQueries({ queryKey: ['transactionsDashboard'] })
  }

  return (
    <div className="flex flex-wrap gap-4 mb-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Date de début</label>
        <input
          type="date"
          name="startDate"
          value={dateRange.startDate}
          onChange={handleDateChange}
          className="px-3 py-2 border border-gray-300 rounded-md shadow-sm"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Date de fin</label>
        <input
          type="date"
          name="endDate"
          value={dateRange.endDate}
          onChange={handleDateChange}
          className="px-3 py-2 border border-gray-300 rounded-md shadow-sm"
        />
      </div>
      <div className="flex items-end">
        <button
          onClick={handleApplyFilter}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Appliquer
        </button>
      </div>
    </div>
  )
}

export default DateRangeSelector
