import type { HttpContext } from '@adonisjs/core/http'

export default class FournisseursComponentsController {
  async show({ inertia }: HttpContext) {
    return inertia.render('fournisseurs/index')
  }
}
