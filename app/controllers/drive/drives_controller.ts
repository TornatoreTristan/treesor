import type { HttpContext } from '@adonisjs/core/http'

export default class DrivesController {
  async show({ inertia }: HttpContext) {
    return inertia.render('drive/index')
  }
}
