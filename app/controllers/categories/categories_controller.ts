import type { HttpContext } from '@adonisjs/core/http'
import Categorie from '#models/categorie'

export default class CategoriesController {
  async show({ inertia }: HttpContext) {
    const categories = await Categorie.query().preload('parent').preload('children')
    return inertia.render('categories/index', { categories })
  }

  async store({ request, response }: HttpContext) {
    const data = request.only(['name', 'color', 'icon', 'isDefault', 'parentId'])

    if (!data.name) {
      return response.badRequest({ error: 'Le nom est requis' })
    }

    await Categorie.create({
      name: data.name,
      color: data.color || '',
      icon: data.icon || '',
      isDefault: !!data.isDefault,
      parentId: data.parentId || null,
    })

    return response.redirect().back()
  }

  async update({ request, response, params }: HttpContext) {
    const id = params.id
    const data = request.only(['name', 'color', 'icon', 'isDefault', 'parentId'])

    const categorie = await Categorie.find(id)
    if (!categorie) {
      return response.notFound({ error: 'Catégorie non trouvée' })
    }

    categorie.name = data.name
    categorie.color = data.color || ''
    categorie.icon = data.icon || ''
    categorie.isDefault = !!data.isDefault
    categorie.parentId = data.parentId || null
    await categorie.save()

    return response.redirect().back()
  }
}
