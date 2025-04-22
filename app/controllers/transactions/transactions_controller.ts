import type { HttpContext } from '@adonisjs/core/http'
import Transaction from '#models/transaction'
import Categorie from '#models/categorie'
import TransactionAICategorizer from '#services/transaction_ai_categorizer'

export default class TransactionsController {
  public async show({ inertia, request }: HttpContext) {
    const transactions = await Transaction.query()
      .preload('category')
      .orderBy('transactionDate', 'desc')

    const categories = await Categorie.query().orderBy('name', 'asc')

    const data = transactions.map((tx) => ({
      id: tx.id,
      date: tx.transactionDate?.toISODate() ?? '',
      description: tx.description,
      amount: Number(tx.amount),
      type: tx.type,
      balance: Number(tx.balanceAfter),
      category: tx.category?.name || '-',
      categoryId: tx.categoryId,
      bankName: tx.bankName,
      accountNumber: tx.accountNumber,
      reference: tx.reference,
      notes: tx.notes,
    }))

    const categoriesList = categories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      color: cat.color,
      icon: cat.icon,
    }))

    return inertia.render('transactions/index', {
      transactions: data,
      categories: categoriesList,
      csrfToken: request.csrfToken,
    })
  }

  public async updateCategory({ request, params, response }: HttpContext) {
    const transactionId = params.id
    const { categoryId } = request.only(['categoryId'])
    console.log('PATCH reçu pour transaction', transactionId, 'nouvelle catégorie', categoryId)
    const transaction = await Transaction.findOrFail(transactionId)
    transaction.categoryId = categoryId
    await transaction.save()
    return response.redirect().back()
  }

  public async autoCategorize({ request, response }: HttpContext) {
    // Récupère les IDs à traiter, ou toutes sans catégorie si non fourni
    const ids: number[] = request.input('transactionIds')
    let transactions
    if (ids && ids.length > 0) {
      transactions = await Transaction.query().whereIn('id', ids)
    } else {
      transactions = await Transaction.query().whereNull('categoryId').limit(10)
    }
    const suggestions = await Promise.all(
      transactions.map(async (tx) => {
        const cat = await TransactionAICategorizer.suggestCategory(tx.description, tx.type)
        return {
          transactionId: tx.id,
          suggestedCategory: cat?.name || null,
        }
      })
    )
    return response.json({ suggestions })
  }
}
