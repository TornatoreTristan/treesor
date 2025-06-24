import router from '@adonisjs/core/services/router'
const TransactionsController = () => import('#controllers/api/transactions_controller')

router.get('/transactions/category-totals', [TransactionsController, 'categoryTotals'])
router.patch('/transactions/:id/category', [TransactionsController, 'updateCategory'])
router.post('/transactions/auto-categorize', [TransactionsController, 'autoCategorize'])
