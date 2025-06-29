import type { HttpContext } from '@adonisjs/core/http'

export default class IncomesController {
  async incomes({ inertia }: HttpContext) {
    const test = 'Je suis le test'
    return inertia.render('home/components/income', { test })
  }
}
