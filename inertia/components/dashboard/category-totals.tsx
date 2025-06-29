import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { useDateRange } from '~/contexts/daterange-context'
import { useQuery } from '@tanstack/react-query'

interface CategoryChild {
  categoryId: number
  categoryName: string
  total: number
  color?: string
  icon?: string
}

interface CategoryTotal {
  categoryId: number
  categoryName: string
  total: number
  color?: string
  icon?: string
  children: CategoryChild[]
}

interface CategoryTotalsResponse {
  period: {
    start: string
    end: string
  }
  totals: CategoryTotal[]
}

export function CategoryTotals() {
  const { dateRange } = useDateRange()

  const { data, isLoading } = useQuery({
    queryKey: ['categoryTotals', dateRange],
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
      })

      const response = await fetch(`/api/transactions/category-totals?${params}`)
      if (!response.ok) {
        throw new Error('Erreur lors de la récupération des totaux')
      }
      const data = await response.json()
      console.log('Category totals data:', data) // Debug pour comprendre le problème NaN
      return data as CategoryTotalsResponse
    },
  })

  // Trouver le montant maximum pour calculer les pourcentages relatifs
  const maxAmount = data?.totals.reduce((max, item) => Math.max(max, Math.abs(item.total)), 0) ?? 0

  console.log('Debug totals:', { data: data?.totals, maxAmount }) // Debug temporaire

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Totaux par catégorie</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8">
            <div className="animate-pulse space-y-2">
              <div className="h-4 bg-gray-200 rounded w-3/4 mx-auto"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2 mx-auto"></div>
              <div className="h-4 bg-gray-200 rounded w-2/3 mx-auto"></div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Liste des catégories */}
            <div className="space-y-4">
              {data?.totals.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground">
                  Aucune donnée pour cette période
                </div>
              ) : (
                data?.totals
                  .sort((a, b) => Math.abs(b.total) - Math.abs(a.total)) // Trier par montant décroissant
                  .map((item) => (
                    <div key={item.categoryId} className="bg-muted/30 rounded-lg p-3">
                      {/* Catégorie parente */}
                      <div className="flex justify-between items-center">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            {item.color && (
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: item.color }}
                              />
                            )}
                            {item.icon && <span className="text-sm">{item.icon}</span>}
                            <span className="font-medium text-base">{item.categoryName}</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full transition-all duration-300 ${
                                item.total >= 0 ? 'bg-green-500' : 'bg-red-500'
                              }`}
                              style={{
                                width: `${maxAmount > 0 ? Math.min(100, (Math.abs(item.total) / maxAmount) * 100) : 0}%`,
                              }}
                            ></div>
                          </div>
                        </div>
                        <div className="ml-4 text-right">
                          <span
                            className={`font-bold text-lg ${item.total >= 0 ? 'text-green-600' : 'text-red-600'}`}
                          >
                            {new Intl.NumberFormat('fr-FR', {
                              style: 'currency',
                              currency: 'EUR',
                            }).format(item.total)}
                          </span>
                          <div className="text-xs text-muted-foreground">
                            {maxAmount > 0
                              ? ((Math.abs(item.total) / maxAmount) * 100).toFixed(1)
                              : '0'}
                            %
                          </div>
                        </div>
                      </div>

                      {/* Catégories enfants */}
                      {item.children && item.children.length > 0 && (
                        <div className="mt-3 ml-6 space-y-2">
                          {item.children.map((child) => (
                            <div
                              key={child.categoryId}
                              className="flex justify-between items-center py-2 px-3 bg-white/50 rounded-md"
                            >
                              <div className="flex items-center gap-2 flex-1">
                                {child.color && (
                                  <div
                                    className="w-2 h-2 rounded-full"
                                    style={{ backgroundColor: child.color }}
                                  />
                                )}
                                {child.icon && <span className="text-xs">{child.icon}</span>}
                                <span className="font-medium text-sm text-muted-foreground">
                                  {child.categoryName}
                                </span>
                                <div className="flex-1 mx-2">
                                  <div className="w-full bg-gray-100 rounded-full h-1">
                                    <div
                                      className={`h-1 rounded-full transition-all duration-300 ${
                                        child.total >= 0 ? 'bg-green-400' : 'bg-red-400'
                                      }`}
                                      style={{
                                        width: `${maxAmount > 0 ? Math.min(100, (Math.abs(child.total) / maxAmount) * 100) : 0}%`,
                                      }}
                                    ></div>
                                  </div>
                                </div>
                              </div>
                              <div className="text-right">
                                <span
                                  className={`font-medium text-sm ${child.total >= 0 ? 'text-green-600' : 'text-red-600'}`}
                                >
                                  {new Intl.NumberFormat('fr-FR', {
                                    style: 'currency',
                                    currency: 'EUR',
                                  }).format(child.total)}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
