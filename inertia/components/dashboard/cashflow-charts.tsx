// resources/js/components/dashboard/CashFlowChart.tsx
import React, { useState } from 'react'
import {
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { useCashFlowData } from '~/hooks/use_cashflow'

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(amount)
}

const CashFlowChart = () => {
  const [monthsToShow, setMonthsToShow] = useState(12)
  const { data, isLoading, error } = useCashFlowData({ months: monthsToShow })

  const handleMonthsChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setMonthsToShow(Number(e.target.value))
  }

  if (isLoading) return <div className="h-96 bg-gray-100 animate-pulse rounded-md"></div>
  if (error) return <div className="text-red-500">Erreur lors du chargement des données</div>
  if (!data) return null

  // Calculer la valeur maximale pour l'axe Y (pour assurer un bon affichage)
  const yMax = Math.max(
    ...data.data.map((item: any) => Math.max(item.credits, item.debits, item.balance))
  )

  // Arrondir à la centaine supérieure pour un affichage propre
  const yMaxRounded = Math.ceil(yMax / 50000) * 50000

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold">Flux de trésorerie</h3>
        <select
          value={monthsToShow}
          onChange={handleMonthsChange}
          className="border rounded-md px-3 py-1"
        >
          <option value={6}>6 derniers mois</option>
          <option value={12}>12 derniers mois</option>
          <option value={24}>24 derniers mois</option>
        </select>
      </div>

      <div className="h-96">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data.data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" scale="point" padding={{ left: 20, right: 20 }} />
            <YAxis domain={[0, yMaxRounded]} tickFormatter={(value) => `${value / 1000}k`} />
            <Tooltip
              formatter={(value) => formatCurrency(Number(value))}
              labelFormatter={(label) => `Période: ${label}`}
            />
            <Legend />
            <Bar dataKey="credits" name="Entrées" fill="#82ca9d" />
            <Bar dataKey="debits" name="Sorties" fill="#ff8086" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export default CashFlowChart
