import type { HttpContext } from '@adonisjs/core/http'
import Transaction from '#models/transaction'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import { CreateTransactionUseCase } from '../../domain/transactions/use_cases/create_transaction_use_case.js'
import { TransactionRepository } from '../../infrastructure/repositories/transaction_repository.js'
import { createTransactionValidator } from '../../validators/transaction_validator.js'
import TransactionAICategorizer from '../../services/transaction_ai_categorizer.js'

export default class TransactionsController {
  // Liste des transactions avec pagination
  async index({ request, response }: HttpContext) {
    const page = request.input('page', 1)
    const limit = request.input('limit', 20)

    const transactions = await Transaction.query()
      .preload('category')
      .orderBy('transactionDate', 'desc')
      .paginate(page, limit)

    return response.json(transactions)
  }

  // Données agrégées pour le dashboard
  async dashboard({ request, response }: HttpContext) {
    // Paramètres optionnels pour filtrer par période
    const startDate = request.input('startDate')
      ? DateTime.fromISO(request.input('startDate'))
      : DateTime.now().minus({ months: 1 })

    const endDate = request.input('endDate')
      ? DateTime.fromISO(request.input('endDate'))
      : DateTime.now()

    // Totaux par type (crédit/débit)
    const totals = await Transaction.query()
      .whereHas('category', (query) => {
        query.whereNot('name', 'Trésorerie')
      })
      .whereRaw('transaction_date BETWEEN ? AND ?', [
        startDate.toSQLDate() ?? DateTime.now().toSQLDate()!,
        endDate.toSQLDate() ?? DateTime.now().toSQLDate()!,
      ])
      .select('type')
      .sum('amount as total')
      .groupBy('type')

    // Reformater les résultats pour plus de clarté
    const totalCredit = (totals as any[]).find((t) => t.type === 'credit')?.$extras.total || 0
    const totalDebit = (totals as any[]).find((t) => t.type === 'debit')?.$extras.total || 0

    return response.json({
      period: {
        start: startDate.toISODate(),
        end: endDate.toISODate(),
      },
      totals: {
        credit: totalCredit,
        debit: totalDebit,
        balance: totalCredit - totalDebit,
      },
    })
  }

  async cashflowByMonth({ request, response }: HttpContext) {
    const months = request.input('months', 12) // Nombre de mois à afficher (par défaut 12)

    // Date de fin (aujourd'hui par défaut)
    const endDate = request.input('endDate')
      ? DateTime.fromISO(request.input('endDate'))
      : DateTime.now()

    // Date de début (X mois avant la date de fin)
    const startDate = request.input('startDate')
      ? DateTime.fromISO(request.input('startDate'))
      : endDate.minus({ months: months - 1 }).startOf('month')

    // Requête pour obtenir les données groupées par mois et type
    const monthlyData = await Transaction.query()
      .whereHas('category', (query) => {
        query.whereNot('name', 'Trésorerie')
      })
      .where('transaction_date', '>=', startDate.toJSDate())
      .where('transaction_date', '<=', endDate.toJSDate())
      .select('type')
      .select(db.raw('to_char("transaction_date", \'YYYY-MM\') as month'))
      .sum('amount as total')
      .groupBy('month', 'type')
      .orderBy('month')

    // Transformez les données en format utilisable pour le graphique
    const formattedData = []

    // Générer un tableau de tous les mois dans la plage
    let currentMonth = startDate.startOf('month')
    const lastMonth = endDate.endOf('month')

    while (currentMonth <= lastMonth) {
      const monthKey = currentMonth.toFormat('yyyy-MM')
      const monthLabel = currentMonth.toFormat('MMM yyyy')

      // Trouver les transactions pour ce mois
      const creditsForMonth = monthlyData.find(
        (item: any) =>
          item.$extras.month === monthKey && (item.type === 'credit' || item.type === 'Credit')
      )
      const debitsForMonth = monthlyData.find(
        (item: any) =>
          item.$extras.month === monthKey && (item.type === 'debit' || item.type === 'Debit')
      )

      // Calculer les totaux pour ce mois
      const credits = creditsForMonth?.$extras.total || 0
      const debits = debitsForMonth?.$extras.total || 0

      // Ne plus mettre à jour le solde cumulé
      // runningBalance += credits - debits

      formattedData.push({
        month: monthLabel,
        credits,
        debits: Math.abs(debits), // Valeur absolue pour l'affichage
        // balance: runningBalance, // Suppression du solde
      })

      // Passer au mois suivant
      currentMonth = currentMonth.plus({ months: 1 })
    }

    return response.json({
      period: {
        start: startDate.toFormat('yyyy-MM-dd'),
        end: endDate.toFormat('yyyy-MM-dd'),
      },
      data: formattedData,
    })
  }

  // Méthode pour créer une nouvelle transaction
  async create({ request, response }: HttpContext) {
    try {
      // Valider les données d'entrée
      const payload = await request.validateUsing(createTransactionValidator)

      // Initialiser le repository et le use case
      const transactionRepository = new TransactionRepository()
      const createTransactionUseCase = new CreateTransactionUseCase(transactionRepository)

      // 1. Créer la transaction
      const createdTransaction = await createTransactionUseCase.execute(payload)

      // 2. Tentative de catégorisation automatique si aucune catégorie n'est spécifiée
      let categorized = false
      if (!payload.categoryId && createdTransaction.id) {
        try {
          // Récupérer la transaction créée pour la compléter
          const transaction = await Transaction.findOrFail(createdTransaction.id)

          // Utiliser le service de catégorisation automatique
          const suggestedCategory = await TransactionAICategorizer.suggestCategory(
            transaction.description,
            transaction.type
          )

          if (suggestedCategory) {
            transaction.categoryId = suggestedCategory.id
            await transaction.save()
            categorized = true

            // Mettre à jour l'entité retournée
            createdTransaction.categoryId = suggestedCategory.id
          }
        } catch (categorizationError) {
          console.error('Erreur lors de la catégorisation automatique:', categorizationError)
          // On continue même si la catégorisation échoue
        }
      }

      // Retourner la transaction créée avec un statut 201 (Created)
      return response.status(201).json({
        success: true,
        data: createdTransaction,
        autoCategorized: categorized,
      })
    } catch (error) {
      // Gérer les erreurs de validation spécifiquement
      if (error.messages) {
        return response.status(422).json({
          success: false,
          errors: error.messages,
        })
      }

      // Gérer les autres erreurs
      return response.status(400).json({
        success: false,
        message: error.message || 'Une erreur est survenue lors de la création de la transaction',
      })
    }
  }

  /**
   * Mettre à jour la catégorie d'une transaction
   */
  async updateCategory({ request, params, response }: HttpContext) {
    try {
      const transactionId = params.id
      const { categoryId } = request.only(['categoryId'])

      console.log('PATCH reçu pour transaction', transactionId, 'nouvelle catégorie', categoryId)

      const transaction = await Transaction.findOrFail(transactionId)
      transaction.categoryId = categoryId
      await transaction.save()

      return response.json({
        success: true,
        message: 'Catégorie mise à jour avec succès',
        data: transaction,
      })
    } catch (error) {
      console.error('Erreur lors de la mise à jour de la catégorie:', error)
      return response.status(400).json({
        success: false,
        message: error.message || 'Une erreur est survenue lors de la mise à jour de la catégorie',
      })
    }
  }

  /**
   * Catégoriser automatiquement une ou plusieurs transactions
   */
  async autoCategorize({ request, response }: HttpContext) {
    try {
      // Récupérer les IDs des transactions à catégoriser (optionnel)
      const transactionIds = request.input('transactionIds', [])

      // Exécuter la catégorisation automatique
      const result = await TransactionAICategorizer.bulkCategorize(
        Array.isArray(transactionIds) && transactionIds.length > 0 ? transactionIds : undefined
      )

      return response.json({
        success: true,
        results: result,
      })
    } catch (error) {
      console.error("Erreur lors de l'auto-catégorisation:", error)
      return response.status(500).json({
        success: false,
        message: error.message || 'Une erreur est survenue lors de la catégorisation automatique',
      })
    }
  }

  async categoryTotals({ request, response }: HttpContext) {
    const startDate = request.input('startDate')
      ? DateTime.fromISO(request.input('startDate'))
      : DateTime.now().minus({ months: 1 })

    const endDate = request.input('endDate')
      ? DateTime.fromISO(request.input('endDate'))
      : DateTime.now()

    const categoryIds = request.input('categoryIds', [])
    const type = request.input('type') // 'credit', 'debit' ou undefined pour les deux

    // Requête simplifiée qui inclut toutes les transactions avec des catégories
    let query = Transaction.query()
      .preload('category', (categoryBuilder) => {
        categoryBuilder.preload('parent')
      })
      .whereNotNull('category_id') // Inclure seulement les transactions avec catégorie
      .whereRaw('transaction_date BETWEEN ? AND ?', [
        startDate.toSQLDate() ?? DateTime.now().toSQLDate()!,
        endDate.toSQLDate() ?? DateTime.now().toSQLDate()!,
      ])

    if (type) {
      query.where('type', type)
    }

    if (categoryIds.length > 0) {
      query.whereIn('category_id', categoryIds)
    }

    const transactions = await query

    console.log(`Found ${transactions.length} transactions for category totals`)

    // Map pour regrouper par catégorie parente
    const parentCategoryTotals = new Map<
      number,
      {
        categoryId: number
        categoryName: string
        total: number
        color?: string
        icon?: string
        children: Array<{
          categoryId: number
          categoryName: string
          total: number
          color?: string
          icon?: string
        }>
      }
    >()

    // Map pour les catégories enfants individuelles
    const childCategoryTotals = new Map<
      number,
      {
        categoryId: number
        categoryName: string
        total: number
        color?: string
        icon?: string
        parentId: number
      }
    >()

    // Traiter chaque transaction
    for (const transaction of transactions) {
      if (!transaction.category) continue

      // Si la transaction est exclue de Trésorerie et que c'est Trésorerie, on skip
      if (transaction.category.name === 'Trésorerie') {
        continue
      }

      const amount = Number(transaction.amount)
      const category = transaction.category

      // Déterminer la catégorie parente
      const parentCategory = category.parentId && category.parent ? category.parent : category

      const parentId = parentCategory.id
      const parentName = parentCategory.name

      // Ajouter au total de la catégorie parente
      if (parentCategoryTotals.has(parentId)) {
        const existing = parentCategoryTotals.get(parentId)!
        existing.total += amount
      } else {
        parentCategoryTotals.set(parentId, {
          categoryId: parentId,
          categoryName: parentName,
          total: amount,
          color: parentCategory.color,
          icon: parentCategory.icon,
          children: [],
        })
      }

      // Si c'est une catégorie enfant, ajouter aussi au détail des enfants
      if (category.parentId && category.parent) {
        const childId = category.id
        const childName = category.name

        if (childCategoryTotals.has(childId)) {
          const existing = childCategoryTotals.get(childId)!
          existing.total += amount
        } else {
          childCategoryTotals.set(childId, {
            categoryId: childId,
            categoryName: childName,
            total: amount,
            color: category.color,
            icon: category.icon,
            parentId: parentId,
          })
        }
      }
    }

    // Regrouper les enfants sous leurs parents
    for (const [childId, childData] of childCategoryTotals.entries()) {
      const parent = parentCategoryTotals.get(childData.parentId)
      if (parent) {
        parent.children.push({
          categoryId: childData.categoryId,
          categoryName: childData.categoryName,
          total: childData.total,
          color: childData.color,
          icon: childData.icon,
        })
      }
    }

    // Trier les enfants par montant décroissant pour chaque parent
    for (const [parentId, parentData] of parentCategoryTotals.entries()) {
      parentData.children.sort((a, b) => Math.abs(b.total) - Math.abs(a.total))
    }

    const formattedTotals = Array.from(parentCategoryTotals.values())

    console.log(
      `Returning ${formattedTotals.length} category totals with children:`,
      formattedTotals.map((t) => ({
        name: t.categoryName,
        total: t.total,
        childrenCount: t.children.length,
      }))
    )

    return response.json({
      period: {
        start: startDate.toISODate(),
        end: endDate.toISODate(),
      },
      totals: formattedTotals,
    })
  }
}
