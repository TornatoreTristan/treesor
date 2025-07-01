import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'

export class AuthGoogleService {
  /**
   * Redirige l'utilisateur vers la page d'authentification Google
   */
  public async redirect(ctx: HttpContext) {
    return ctx.ally.use('google').redirect()
  }

  /**
   * Traite le callback de Google après authentification
   */
  public async callback(ctx: HttpContext) {
    const google = ctx.ally.use('google')

    // Récupère l'utilisateur de Google
    const googleUser = await google.user()

    // Vérifie si l'utilisateur existe déjà dans la base de données
    let user = await User.findBy('email', googleUser.email)

    // Si l'utilisateur n'existe pas, créez-le
    if (!user) {
      user = await User.create({
        email: googleUser.email,
        fullName: googleUser.name ?? googleUser.nickName,
        googleAccessToken: googleUser.token.token,
        googleId: googleUser.id,
        avatar: googleUser.avatarUrl,
        googleRefreshToken: googleUser.token.refreshToken,
      })
    } else {
      // Mettre à jour les informations de l'utilisateur existant à chaque connexion
      user.merge({
        fullName: googleUser.name ?? googleUser.nickName,
        avatar: googleUser.avatarUrl,
        googleAccessToken: googleUser.token.token,
        googleRefreshToken: googleUser.token.refreshToken,
      })
      await user.save()
    }

    // Connexion de l'utilisateur avec le service de session
    await ctx.auth.use('web').login(user)

    // Rediriger vers le dashboard
    return ctx.response.redirect('/')
  }
}
