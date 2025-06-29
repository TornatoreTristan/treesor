import type { HttpContext } from '@adonisjs/core/http'

export default class InvoicesController {
  async show({ inertia }: HttpContext) {
    return inertia.render('justificatifs/index')
  }
}
