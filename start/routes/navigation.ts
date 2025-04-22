import { middleware } from '#start/kernel'
import router from '@adonisjs/core/services/router'
const DriveController = () => import('#controllers/drive/drives_controller')
const VendorsController = () => import('#controllers/vendors/vendors_controller')
const CategoriesController = () => import('#controllers/categories/categories_controller')
const HomeController = () => import('#controllers/home/home_controller')
const TransactionsController = () => import('#controllers/transactions/transactions_controller')

router
  .group(() => {
    router.get('/', [HomeController, 'show'])
    router.get('/dashboard', [HomeController, 'show'])
    router.get('/transactions', [TransactionsController, 'show'])
    router.get('/drive', [DriveController, 'show'])
    router.get('/fournisseurs', [VendorsController, 'show'])
    router.get('/categories', [CategoriesController, 'show'])
  })
  .use(middleware.auth())
