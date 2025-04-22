import router from '@adonisjs/core/services/router'
const TransactionsController = () => import('#controllers/transactions/transactions_controller')

router.patch('/transactions/:id/category', [TransactionsController, 'updateCategory'])
router.post('/transactions/auto-categorize', [TransactionsController, 'autoCategorize'])
