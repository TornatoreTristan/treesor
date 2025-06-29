import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui/table'
import { Combobox } from './combobox'
import { useState, useRef, useEffect } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  ColumnDef,
  getSortedRowModel,
  SortingState,
  getPaginationRowModel,
  getFilteredRowModel,
} from '@tanstack/react-table'
import { Input } from '~/components/ui/input'
import { Button } from '~/components/ui/button'
import { table } from 'console'

interface CategoryOption {
  id: number
  name: string
  color?: string
  icon?: string
}

interface Transaction {
  id: number
  date: string
  description: string
  category?: string
  categoryId?: number | null
  amount: number
  type: string
  balance: number
  suggestedCategory?: string | null
  bankName?: string | null
  accountNumber?: string | null
  reference?: string | null
  notes?: string | null
}

interface Props {
  transactions: Transaction[]
  categories: CategoryOption[]
  suggestions?: { [id: number]: string | null }
}

// Helper pour générer un fond pâle à partir d'une couleur hex
function getPaleBgColor(hex: string) {
  if (!hex || !hex.startsWith('#') || (hex.length !== 7 && hex.length !== 4)) return '#f3f4f6'
  let r, g, b
  if (hex.length === 7) {
    r = parseInt(hex.slice(1, 3), 16)
    g = parseInt(hex.slice(3, 5), 16)
    b = parseInt(hex.slice(5, 7), 16)
  } else {
    r = parseInt(hex[1] + hex[1], 16)
    g = parseInt(hex[2] + hex[2], 16)
    b = parseInt(hex[3] + hex[3], 16)
  }
  return `rgba(${r},${g},${b},0.10)`
}

export default function TransactionsTable({
  transactions: initialTransactions = [],
  categories = [],
  suggestions = {},
}: Props) {
  const [transactions, setTransactions] = useState(initialTransactions)
  const [hiddenSuggestions, setHiddenSuggestions] = useState<{ [id: number]: boolean }>({})
  const [savingIds, setSavingIds] = useState<number[]>([])
  const [sorting, setSorting] = useState<SortingState>([{ id: 'date', desc: true }])
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(20)
  const pageIndexRef = useRef(pageIndex)
  const pageSizeRef = useRef(pageSize)
  // Sync refs with state
  useEffect(() => {
    pageIndexRef.current = pageIndex
  }, [pageIndex])
  useEffect(() => {
    pageSizeRef.current = pageSize
  }, [pageSize])
  const [globalFilter, setGlobalFilter] = useState('')
  const [columnFilters, setColumnFilters] = useState<any[]>([])
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [bulkCategoryId, setBulkCategoryId] = useState<number | undefined>(undefined)
  const [bulkSaving, setBulkSaving] = useState(false)
  const [showUncategorized, setShowUncategorized] = useState(false)

  const handleCategoryChange = async (transactionId: number, categoryId: number) => {
    // Optimistic update
    setTransactions((prev) => {
      const updated = prev.map((tx) =>
        tx.id === transactionId
          ? {
              ...tx,
              categoryId,
              category: categories.find((c) => c.id === categoryId)?.name || '-',
            }
          : tx
      )
      // Réapplique la page courante
      setTimeout(() => {
        setPageIndex(pageIndexRef.current)
        setPageSize(pageSizeRef.current)
      }, 0)
      return updated
    })
    setSavingIds((prev) => [...prev, transactionId])
    try {
      const csrfToken =
        document.querySelector('meta[name=csrf-token]')?.getAttribute('content') ||
        document.querySelector('meta[name=csrfToken]')?.getAttribute('content') ||
        ''
      await fetch(`/transactions/${transactionId}/category`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-TOKEN': csrfToken,
          'x-csrf-token': csrfToken,
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({ categoryId }),
        credentials: 'same-origin',
      })
    } finally {
      setSavingIds((prev) => prev.filter((id) => id !== transactionId))
    }
  }

  const handleBulkCategoryChange = async () => {
    if (!bulkCategoryId || selectedIds.length === 0) return
    setBulkSaving(true)
    // Optimistic update
    setTransactions((prev) => {
      const updated = prev.map((tx) =>
        selectedIds.includes(tx.id)
          ? {
              ...tx,
              categoryId: bulkCategoryId,
              category: categories.find((c) => c.id === bulkCategoryId)?.name || '-',
            }
          : tx
      )
      setTimeout(() => {
        setPageIndex(pageIndexRef.current)
        setPageSize(pageSizeRef.current)
      }, 0)
      return updated
    })
    setSavingIds((prev) => [...prev, ...selectedIds])
    try {
      const csrfToken =
        document.querySelector('meta[name=csrf-token]')?.getAttribute('content') ||
        document.querySelector('meta[name=csrfToken]')?.getAttribute('content') ||
        ''
      await Promise.all(
        selectedIds.map((id) =>
          fetch(`/transactions/${id}/category`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'X-CSRF-TOKEN': csrfToken,
              'x-csrf-token': csrfToken,
              'X-Requested-With': 'XMLHttpRequest',
            },
            body: JSON.stringify({ categoryId: bulkCategoryId }),
            credentials: 'same-origin',
          })
        )
      )
    } finally {
      setSavingIds((prev) => prev.filter((id) => !selectedIds.includes(id)))
      setSelectedIds([])
      setBulkCategoryId(undefined)
      setBulkSaving(false)
    }
  }

  const columns = [
    {
      id: 'select',
      header: ({ table }: { table: any }) => {
        const ref = useRef<HTMLInputElement>(null)
        const allChecked =
          table.getRowModel().rows.length > 0 &&
          table.getRowModel().rows.every((row: any) => selectedIds.includes(row.original.id))
        const someChecked =
          table.getRowModel().rows.some((row: any) => selectedIds.includes(row.original.id)) &&
          !allChecked
        useEffect(() => {
          if (ref.current) ref.current.indeterminate = someChecked
        }, [someChecked])
        return (
          <input
            ref={ref}
            type="checkbox"
            checked={allChecked}
            onChange={(e) => {
              if (e.target.checked) {
                setSelectedIds(table.getRowModel().rows.map((row: any) => row.original.id))
              } else {
                setSelectedIds([])
              }
            }}
          />
        )
      },
      cell: ({ row }: { row: any }) => (
        <input
          type="checkbox"
          checked={selectedIds.includes(row.original.id)}
          onChange={(e) => {
            if (e.target.checked) {
              setSelectedIds((prev) => [...prev, row.original.id])
            } else {
              setSelectedIds((prev) => prev.filter((id) => id !== row.original.id))
            }
          }}
        />
      ),
      size: 24,
      enableSorting: false,
      enableColumnFilter: false,
    },
    {
      accessorKey: 'date',
      header: ({ column }: any) => (
        <button
          type="button"
          className="flex items-center gap-1 group"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Date
          {column.getIsSorted() === 'asc' && <span>▲</span>}
          {column.getIsSorted() === 'desc' && <span>▼</span>}
        </button>
      ),
      cell: (info: any) => <span>{info.getValue()}</span>,
      enableSorting: true,
      sortingFn: 'alphanumeric',
    },
    {
      accessorKey: 'bankName',
      header: ({ column }: any) => (
        <button
          type="button"
          className="flex items-center gap-1 group"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Banque
          {column.getIsSorted() === 'asc' && <span>▲</span>}
          {column.getIsSorted() === 'desc' && <span>▼</span>}
        </button>
      ),
      cell: (info: any) => <span title={info.getValue() || ''}>{info.getValue() || '-'}</span>,
      enableSorting: true,
      sortingFn: 'alphanumeric',
      enableColumnFilter: true,
      filterFn: (row, columnId, filterValue) => {
        if (!filterValue) return true
        return row.original.bankName === filterValue
      },
    },
    {
      accessorKey: 'reference',
      header: ({ column }: any) => (
        <button
          type="button"
          className="flex items-center gap-1 group"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Référence
          {column.getIsSorted() === 'asc' && <span>▲</span>}
          {column.getIsSorted() === 'desc' && <span>▼</span>}
        </button>
      ),
      cell: (info: any) => <span title={info.getValue() || ''}>{info.getValue() || '-'}</span>,
      enableSorting: true,
      sortingFn: 'alphanumeric',
    },
    {
      accessorKey: 'type',
      header: ({ column }: any) => (
        <button
          type="button"
          className="flex items-center gap-1 group"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Type
          {column.getIsSorted() === 'asc' && <span>▲</span>}
          {column.getIsSorted() === 'desc' && <span>▼</span>}
        </button>
      ),
      cell: (info: any) => {
        const tx = info.row.original as Transaction
        return (
          <span
            className={
              (tx.type === 'credit'
                ? 'bg-green-50 text-green-800 font-semibold'
                : 'bg-red-50 text-red-800 font-semibold') + ' px-2 py-1'
            }
          >
            {tx.type === 'credit' ? 'Crédit' : 'Débit'}
          </span>
        )
      },
      enableSorting: true,
      sortingFn: 'alphanumeric',
      enableColumnFilter: true,
      filterFn: (row, columnId, filterValue) => {
        if (!filterValue) return true
        return row.original.type === filterValue
      },
    },
    {
      accessorKey: 'categoryId',
      header: ({ column }: any) => (
        <button
          type="button"
          className="flex items-center gap-1 group"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Catégorie
          {column.getIsSorted() === 'asc' && <span>▲</span>}
          {column.getIsSorted() === 'desc' && <span>▼</span>}
        </button>
      ),
      cell: (info: any) => {
        const tx = info.row.original as Transaction
        const suggestedCategory = suggestions[tx.id]
        return (
          <Combobox
            options={categories.map((cat) => ({
              value: cat.id,
              label: cat.name,
              color: cat.color,
              icon: cat.icon,
            }))}
            value={tx.categoryId ?? undefined}
            onChange={(value: number) => handleCategoryChange(tx.id, value)}
            placeholder="Choisir..."
          />
        )
      },
      enableSorting: true,
      sortingFn: (rowA, rowB, columnId) => {
        // Trie par nom de catégorie
        const catA = categories.find((c) => c.id === rowA.original.categoryId)?.name || ''
        const catB = categories.find((c) => c.id === rowB.original.categoryId)?.name || ''
        return catA.localeCompare(catB)
      },
      enableColumnFilter: true,
      filterFn: (row, columnId, filterValue) => {
        if (!filterValue) return true
        return row.original.categoryId === filterValue
      },
    },
    {
      accessorKey: 'amount',
      header: ({ column }: any) => (
        <button
          type="button"
          className="flex items-center gap-1 group"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Montant
          {column.getIsSorted() === 'asc' && <span>▲</span>}
          {column.getIsSorted() === 'desc' && <span>▼</span>}
        </button>
      ),
      cell: (info: any) => {
        const tx = info.row.original as Transaction
        return (
          <span
            className={
              'text-right whitespace-nowrap ' +
              (tx.type === 'credit'
                ? 'text-green-800 bg-green-50 font-semibold'
                : 'text-red-800 bg-red-50 font-semibold')
            }
          >
            {tx.amount.toFixed(2)} €
          </span>
        )
      },
      enableSorting: true,
      sortingFn: 'basic',
    },
  ] as ColumnDef<Transaction>[]

  const filteredTransactions = showUncategorized
    ? transactions.filter((tx) => !tx.categoryId)
    : transactions

  const table = useReactTable({
    data: filteredTransactions,
    columns,
    state: { sorting, globalFilter, columnFilters, pagination: { pageIndex, pageSize } },
    onSortingChange: setSorting,
    onGlobalFilterChange: (value) => {
      setGlobalFilter(value)
      setPageIndex(0)
    },
    onColumnFiltersChange: (value) => {
      setColumnFilters(value)
      setPageIndex(0)
    },
    onPaginationChange: (updater) => {
      if (typeof updater === 'function') {
        setPageIndex((prev) => {
          const next = updater({ pageIndex, pageSize }).pageIndex
          return next
        })
      } else if (typeof updater === 'object' && updater !== null) {
        setPageIndex(updater.pageIndex)
      }
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    manualSorting: false,
    debugTable: false,
    initialState: { pagination: { pageSize: 20 } },
    globalFilterFn: (row, columnId, filterValue) => {
      if (!filterValue) return true
      const v = filterValue.toLowerCase()
      return (
        (row.original.description || '').toLowerCase().includes(v) ||
        (row.original.reference || '').toLowerCase().includes(v) ||
        (row.original.bankName || '').toLowerCase().includes(v) ||
        (row.original.notes || '').toLowerCase().includes(v)
      )
    },
    autoResetPageIndex: false,
  })

  return (
    <div className="border border-gray-200 overflow-x-auto">
      <div className="flex items-center gap-2 p-2">
        <Button
          variant={showUncategorized ? 'default' : 'outline'}
          className={showUncategorized ? 'bg-blue-600 text-white' : ''}
          onClick={() => setShowUncategorized((v) => !v)}
        >
          Sans catégorie
        </Button>
      </div>
      {/* Bulk category action */}
      {selectedIds.length > 0 && (
        <div className="flex items-center gap-2 p-2 bg-blue-50 border-b border-blue-200 mb-2">
          <span className="text-xs">{selectedIds.length} sélectionnée(s)</span>
          <Combobox
            options={categories.map((cat) => ({ value: cat.id, label: cat.name }))}
            value={bulkCategoryId}
            onChange={setBulkCategoryId}
            placeholder="Catégorie à appliquer"
          />
          <Button
            size="sm"
            className="text-xs"
            disabled={!bulkCategoryId || bulkSaving}
            onClick={handleBulkCategoryChange}
          >
            Appliquer à la sélection
          </Button>
        </div>
      )}
      <div className="flex flex-wrap gap-2 p-2 items-end">
        <div>
          <Input
            className="text-xs"
            placeholder="Recherche globale..."
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            style={{ minWidth: 180 }}
          />
        </div>
        <div>
          <select
            className="border rounded px-1 py-0.5 text-xs"
            value={
              typeof table.getColumn('categoryId')?.getFilterValue() === 'number'
                ? String(table.getColumn('categoryId')?.getFilterValue())
                : ''
            }
            onChange={(e) =>
              table
                .getColumn('categoryId')
                ?.setFilterValue(e.target.value ? Number(e.target.value) : undefined)
            }
          >
            <option value="">Toutes catégories</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <select
            className="border rounded px-1 py-0.5 text-xs"
            value={
              typeof table.getColumn('type')?.getFilterValue() === 'string'
                ? String(table.getColumn('type')?.getFilterValue())
                : ''
            }
            onChange={(e) => table.getColumn('type')?.setFilterValue(e.target.value || undefined)}
          >
            <option value="">Tous types</option>
            <option value="credit">Crédit</option>
            <option value="debit">Débit</option>
          </select>
        </div>
        <div>
          <select
            className="border rounded px-1 py-0.5 text-xs"
            value={
              typeof table.getColumn('bankName')?.getFilterValue() === 'string'
                ? String(table.getColumn('bankName')?.getFilterValue())
                : ''
            }
            onChange={(e) =>
              table.getColumn('bankName')?.setFilterValue(e.target.value || undefined)
            }
          >
            <option value="">Toutes banques</option>
            {Array.from(new Set(transactions.map((tx) => tx.bankName).filter(Boolean))).map((b) => (
              <option key={b} value={b as string}>
                {b}
              </option>
            ))}
          </select>
        </div>
      </div>
      <Table className="min-w-full text-xs">
        <TableHeader className="bg-white">
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id} className="px-2 py-1 font-semibold">
                  {flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={columns.length}
                className="text-center py-8 text-muted-foreground text-sm"
              >
                Aucune transaction trouvée.
              </TableCell>
            </TableRow>
          ) : (
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                className="hover:bg-gray-50 transition border-b border-gray-100"
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id} className="px-2 py-1 max-w-[120px] truncate">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      {/* Pagination controls */}
      <div className="flex items-center justify-between px-2 py-3 text-xs">
        <div>
          Page {table.getState().pagination.pageIndex + 1} sur {table.getPageCount()}
        </div>
        <div className="flex gap-1">
          <button
            className="px-2 py-1 border rounded disabled:opacity-50"
            onClick={() => {
              setPageIndex(0)
              table.setPageIndex(0)
            }}
            disabled={!table.getCanPreviousPage()}
          >
            «
          </button>
          <button
            className="px-2 py-1 border rounded disabled:opacity-50"
            onClick={() => {
              setPageIndex(table.getState().pagination.pageIndex - 1)
              table.previousPage()
            }}
            disabled={!table.getCanPreviousPage()}
          >
            Précédent
          </button>
          {(() => {
            const pageCount = table.getPageCount()
            const pageIndex = table.getState().pagination.pageIndex
            const pages = []
            const delta = 2
            for (let i = 0; i < pageCount; i++) {
              if (
                i === 0 ||
                i === pageCount - 1 ||
                (i >= pageIndex - delta && i <= pageIndex + delta)
              ) {
                pages.push(i)
              }
            }
            let last = -1
            return pages.map((i, idx) => {
              if (i - last > 1) {
                last = i
                return [
                  <span key={`ellipsis-${i}`}>...</span>,
                  <button
                    key={i}
                    className={`px-2 py-1 border rounded ${pageIndex === i ? 'bg-gray-200 font-bold' : ''}`}
                    onClick={() => {
                      setPageIndex(i)
                      table.setPageIndex(i)
                    }}
                  >
                    {i + 1}
                  </button>,
                ]
              } else {
                last = i
                return (
                  <button
                    key={i}
                    className={`px-2 py-1 border rounded ${pageIndex === i ? 'bg-gray-200 font-bold' : ''}`}
                    onClick={() => {
                      setPageIndex(i)
                      table.setPageIndex(i)
                    }}
                  >
                    {i + 1}
                  </button>
                )
              }
            })
          })()}
          <button
            className="px-2 py-1 border rounded disabled:opacity-50"
            onClick={() => {
              setPageIndex(table.getState().pagination.pageIndex + 1)
              table.nextPage()
            }}
            disabled={!table.getCanNextPage()}
          >
            Suivant
          </button>
          <button
            className="px-2 py-1 border rounded disabled:opacity-50"
            onClick={() => {
              setPageIndex(table.getPageCount() - 1)
              table.setPageIndex(table.getPageCount() - 1)
            }}
            disabled={!table.getCanNextPage()}
          >
            »
          </button>
        </div>
        <div>
          <span>Afficher </span>
          <select
            className="border rounded px-1 py-0.5"
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value))
              table.setPageSize(Number(e.target.value))
            }}
          >
            {[10, 20, 50, 100].map((pageSize) => (
              <option key={pageSize} value={pageSize}>
                {pageSize}
              </option>
            ))}
          </select>
          <span> lignes</span>
        </div>
      </div>
    </div>
  )
}
