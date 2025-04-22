const CategoriesController = () => import('#controllers/categories/categories_controller')

import router from '@adonisjs/core/services/router'

router.post('/categories', [CategoriesController, 'store'])
router.put('/categories/:id', [CategoriesController, 'update'])
