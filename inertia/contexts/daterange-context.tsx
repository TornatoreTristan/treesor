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
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
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
