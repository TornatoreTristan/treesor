import router from '@adonisjs/core/services/router'
const DriveController = () => import('#controllers/drive/drives_controller')
const FournisseursController = () => import('#controllers/fournisseurs/fournisseurs_controller')

router.on('/').renderInertia('home')
router.get('/drive', [DriveController, 'show'])
router.get('/fournisseurs', [FournisseursController, 'show'])
