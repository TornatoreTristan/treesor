// resources/js/contexts/DateRangeContext.tsx
import React, { createContext, useState, useContext, ReactNode } from 'react'

interface DateRange {
  startDate: string
  endDate: string
}

interface DateRangeContextType {
  dateRange: DateRange
  setDateRange: React.Dispatch<React.SetStateAction<DateRange>>
}

const DateRangeContext = createContext<DateRangeContextType | undefined>(undefined)

export function DateRangeProvider({ children }: { children: ReactNode }) {
  // Calculer le premier et dernier jour du mois en cours
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth()

  // Premier jour du mois en cours
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1)

  // Dernier jour du mois en cours
  const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0)

  const [dateRange, setDateRange] = useState({
    startDate: firstDayOfMonth.toISOString().split('T')[0],
    endDate: lastDayOfMonth.toISOString().split('T')[0],
  })

  return (
    <DateRangeContext.Provider value={{ dateRange, setDateRange }}>
      {children}
    </DateRangeContext.Provider>
  )
}

export function useDateRange() {
  const context = useContext(DateRangeContext)
  if (context === undefined) {
    throw new Error('useDateRange must be used within a DateRangeProvider')
  }
  return context
}
