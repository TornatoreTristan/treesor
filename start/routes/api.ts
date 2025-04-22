import router from '@adonisjs/core/services/router'

const ApiTransactionsController = () => import('#controllers/api/transactions_controller')

router
  .group(() => {
    router.get('/transactions/dashboard', [ApiTransactionsController, 'dashboard'])
    router.get('/transactions/cashflow', [ApiTransactionsController, 'cashflowByMonth'])
  })
  .prefix('/api')
