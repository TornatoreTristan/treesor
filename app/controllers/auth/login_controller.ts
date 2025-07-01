import type { HttpContext } from '@adonisjs/core/http'
import { AuthGoogleService } from '#services/auth_google_service'

export default class LoginController {
  async show({ inertia }: HttpContext) {
    return inertia.render('login/index')
  }

  async googleRedirect(ctx: HttpContext) {
    return new AuthGoogleService().redirect(ctx)
  }

  async googleCallback(ctx: HttpContext) {
    return new AuthGoogleService().callback(ctx)
  }

  async logout({ auth, response }: HttpContext) {
    await auth.use('web').logout()
    return response.redirect('/login')
  }
}
