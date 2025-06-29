import type { HttpContext } from '@adonisjs/core/http'

export default class VendorsComponentsController {
  async show({ inertia }: HttpContext) {
    return inertia.render('vendors/index')
  }
}
