import router from '@adonisjs/core/services/router'

const LoginController = () => import('#controllers/auth/login_controller')

// Navigation to login page
router.get('/login', [LoginController, 'show'])

// Routes pour l'authentification Google
router.get('/auth/google', [LoginController, 'googleRedirect'])
router.get('/auth/google/callback', [LoginController, 'googleCallback'])

// Route de logout
router.post('/logout', [LoginController, 'logout'])
