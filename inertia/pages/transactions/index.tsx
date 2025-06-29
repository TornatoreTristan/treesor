import DefaultLayout from '~/app/layouts/default-layout'
import HeaderPage from '~/components/header-page'
import TransactionsTable from './components/transactions-table'
import { useState } from 'react'

interface Transaction {
  id: number
  date: string
  description: string
  amount: number
  type: string
  balance: number
  category?: string
  categoryId?: number | null
}

interface CategoryOption {
  id: number
  name: string
}

interface Props {
  transactions: Transaction[]
  categories: CategoryOption[]
}

const Transactions = ({ transactions, categories }: Props) => {
  const [loading, setLoading] = useState(false)
  const [suggestions, setSuggestions] = useState<{ [id: number]: string | null }>({})

  const handleAutoCategorize = async () => {
    setLoading(true)
    const uncategorizedIds = transactions.filter((tx) => !tx.categoryId).map((tx) => tx.id)
    function getCookie(name: string) {
      return document.cookie
        .split('; ')
        .find((row) => row.startsWith(name + '='))
        ?.split('=')[1]
    }
    const csrfToken = getCookie('XSRF-TOKEN') || ''
    const res = await fetch('/transactions/auto-categorize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-TOKEN': csrfToken,
        'x-csrf-token': csrfToken,
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({ transactionIds: uncategorizedIds }),
      credentials: 'same-origin',
    })
    const data = await res.json()
    const map: { [id: number]: string | null } = {}
    for (const s of data.suggestions) {
      map[s.transactionId] = s.suggestedCategory
    }
    setSuggestions(map)
    setLoading(false)
  }

  return (
    <DefaultLayout>
      <HeaderPage title="Transactions" />
      <button
        className="mb-4 px-4 py-2 bg-blue-600 text-white rounded"
        onClick={handleAutoCategorize}
        disabled={loading}
      >
        {loading ? 'Catégorisation en cours...' : 'Catégoriser automatiquement'}
      </button>
      <TransactionsTable
        transactions={transactions}
        categories={categories}
        suggestions={suggestions}
      />
    </DefaultLayout>
  )
}

export default Transactions
