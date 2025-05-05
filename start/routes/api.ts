import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const ApiTransactionsController = () => import('#controllers/api/transactions_controller')
const InvoicesController = () => import('#controllers/invoices/invoices_controller')

// Routes API générales sans authentification
router
  .group(() => {
    router.get('/transactions/dashboard', [ApiTransactionsController, 'dashboard'])
    router.get('/transactions/cashflow', [ApiTransactionsController, 'cashflowByMonth'])
    router.post('/transactions/create', [ApiTransactionsController, 'create'])
    router.post('/transactions/auto-categorize', [ApiTransactionsController, 'autoCategorize'])
  })
  .prefix('/api')

// Routes des factures avec authentification
router
  .group(() => {
    router.post('/invoices/', [InvoicesController, 'store'])
  })
  .prefix('/api')
  .use(middleware.auth())
