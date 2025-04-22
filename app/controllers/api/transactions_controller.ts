import type { HttpContext } from '@adonisjs/core/http'
import Transaction from '#models/transaction'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'

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
}
