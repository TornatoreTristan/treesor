import { Table } from '@tanstack/react-table'
import { CalendarIcon, X } from 'lucide-react'
import React from 'react'

import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'

interface DataTableToolbarProps<TData> {
  table: Table<TData>
  filterableColumns?: {
    id: string
    title: string
    options: { label: string; value: string }[]
  }[]
}

export function DataTableToolbar<TData>({
  table,
  filterableColumns = [],
}: DataTableToolbarProps<TData>) {
  const isFiltered = table.getState().columnFilters.length > 0

  // État pour les filtres de date
  const [dateRange, setDateRange] = React.useState<{
    from?: string
    to?: string
  }>({})

  // Appliquer le filtre de date au changement
  React.useEffect(() => {
    if (dateRange.from || dateRange.to) {
      table.getColumn('date')?.setFilterValue(dateRange)
    } else {
      table.getColumn('date')?.setFilterValue(undefined)
    }
  }, [dateRange, table])

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex flex-1 flex-wrap items-center space-x-2">
        {/* Filtre texte sur la description */}
        <Input
          placeholder="Rechercher..."
          value={(table.getColumn('description')?.getFilterValue() as string) ?? ''}
          onChange={(event) => table.getColumn('description')?.setFilterValue(event.target.value)}
          className="h-8 w-[150px] lg:w-[250px]"
        />

        {/* Filtre par fournisseur */}
        <Input
          placeholder="Fournisseur..."
          value={(table.getColumn('clientName')?.getFilterValue() as string) ?? ''}
          onChange={(event) => table.getColumn('clientName')?.setFilterValue(event.target.value)}
          className="h-8 w-[150px]"
        />

        {/* Filtre par date (de/à) */}
        <div className="flex items-center space-x-2">
          <CalendarIcon className="h-4 w-4 text-muted-foreground" />
          <div className="flex items-center space-x-2">
            <Input
              type="date"
              placeholder="De"
              value={dateRange.from || ''}
              onChange={(e) => setDateRange((prev) => ({ ...prev, from: e.target.value }))}
              className="h-8 w-[120px]"
            />
            <span className="text-muted-foreground">à</span>
            <Input
              type="date"
              placeholder="À"
              value={dateRange.to || ''}
              onChange={(e) => setDateRange((prev) => ({ ...prev, to: e.target.value }))}
              className="h-8 w-[120px]"
            />
          </div>
        </div>

        {/* Filtres par colonne spécifique (statut, catégorie) */}
        {filterableColumns.map((column) =>
          column.options.length > 0 && table.getColumn(column.id) ? (
            <div key={column.id} className="flex items-center space-x-2">
              <select
                className="h-8 rounded-md border border-input bg-background px-2 text-sm"
                value={(table.getColumn(column.id)?.getFilterValue() as string) || ''}
                onChange={(e) => {
                  table.getColumn(column.id)?.setFilterValue(e.target.value || undefined)
                }}
              >
                <option value="">Tous {column.title}</option>
                {column.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          ) : null
        )}

        {/* Bouton pour effacer les filtres */}
        {isFiltered && (
          <Button
            variant="ghost"
            onClick={() => {
              table.resetColumnFilters()
              setDateRange({})
            }}
            className="h-8 px-2 lg:px-3"
          >
            Effacer les filtres
            <X className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  )
}
