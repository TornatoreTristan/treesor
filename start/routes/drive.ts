import { middleware } from '#start/kernel'
import router from '@adonisjs/core/services/router'

const DriveController = () => import('#controllers/drive/drives_controller')

// Routes protégées par authentification
router
  .group(() => {
    // Route pour uploader un document
    router.post('/drive/upload', [DriveController, 'upload'])

    // Route pour supprimer un document
    router.delete('/drive/:id', [DriveController, 'delete'])
  })
  .use(middleware.auth())
