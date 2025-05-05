import OpenAI from 'openai'
import Categorie from '#models/categorie'
import Transaction from '#models/transaction'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export default class TransactionAICategorizer {
  /**
   * Suggère une catégorie pour une transaction en se basant sur sa description et son type
   */
  static async suggestCategory(
    description: string,
    type: 'credit' | 'debit'
  ): Promise<Categorie | null> {
    // Récupère toutes les catégories existantes (id + nom)
    const categories = await Categorie.query().select('id', 'name')
    const categoryNames = categories.map((c) => c.name)

    // Avant d'utiliser l'IA, vérifions s'il existe des transactions similaires déjà catégorisées
    const similarTransaction = await this.findSimilarTransaction(description, type)

    if (similarTransaction && similarTransaction.categoryId) {
      // Une transaction similaire a été trouvée avec une catégorie!
      console.log('Catégorie trouvée par similarité:', similarTransaction.category?.name)
      return similarTransaction.category || null
    }

    // Récupère plusieurs exemples récents de transactions déjà catégorisées pour l'apprentissage
    const examples = await Transaction.query()
      .whereNotNull('categoryId')
      .preload('category')
      .orderBy('created_at', 'desc')
      .limit(10)

    const exampleLines = examples
      .filter((tx) => tx.category)
      .map((tx) => `"${tx.description}" (${tx.type}) -> ${tx.category.name}`)
      .join('\n')

    // Prépare le prompt avec contexte et règles métier
    const prompt = `Voici la liste des catégories existantes : ${categoryNames.join(', ')}.
Type de la transaction : ${type === 'credit' ? 'crédit' : 'débit'}
Voici des exemples récents de classification :
${exampleLines}

Règles métier importantes :
- N'attribue jamais la catégorie "Ventes" à une transaction de type "débit".
- N'attribue jamais la catégorie "Achat" à une transaction de type "crédit".
- Si tu vois "RIT" ou "virement" dans le libellé d'un crédit, c'est probablement une vente.
- Les mots clés comme "LOYER", "ASSURANCE", "TELECOM" sont importants pour la classification.
- Cherche des mots-clés pertinents dans la description.

À partir de ces exemples et règles, à quelle catégorie EXACTE (nom dans la liste) appartient la transaction suivante ? "${description}"
Donne uniquement le nom EXACT d'une catégorie existante, sans rien ajouter d'autre.`

    try {
      // Appel à l'API OpenAI (format chat)
      const res = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content:
              'Tu es un assistant financier expert qui classe les transactions bancaires dans la bonne catégorie avec précision.',
          },
          { role: 'user', content: prompt },
        ],
        max_tokens: 20,
        temperature: 0.3, // Un peu de diversité peut aider à trouver la bonne catégorie
      })

      const suggestion = res.choices[0].message?.content?.trim()
      if (!suggestion) return null

      console.log('Suggestion IA:', suggestion)
      console.log(
        'Catégories existantes:',
        categories.map((c) => c.name)
      )

      // Trouve la catégorie correspondante avec un matching plus précis
      // D'abord essayer une correspondance exacte, puis une correspondance partielle
      let found = categories.find((c) => c.name.toLowerCase() === suggestion.toLowerCase())

      if (!found) {
        found = categories.find(
          (c) =>
            c.name.toLowerCase().includes(suggestion.toLowerCase()) ||
            suggestion.toLowerCase().includes(c.name.toLowerCase())
        )
      }

      if (!found) {
        console.log('Aucune catégorie trouvée pour la suggestion IA:', suggestion)
      }
      return found || null
    } catch (error) {
      console.error('Erreur OpenAI:', error?.message || error)
      return null
    }
  }

  /**
   * Trouve une transaction similaire déjà catégorisée
   */
  static async findSimilarTransaction(
    description: string,
    type: 'credit' | 'debit'
  ): Promise<Transaction | null> {
    // Normalisation de la description pour la recherche
    const normalizedDesc = description.toLowerCase().trim()

    // Extraction des mots clés importants (enlève les articles, nombres, etc.)
    const keyWords = normalizedDesc
      .split(/\s+/)
      .filter((word) => word.length > 3) // Mots significatifs seulement
      .map((word) =>
        word.replace(
          /[^a-z0-9àáâäãåąčćęèéêëėįìíîïłńòóôöõøùúûüųūÿýżźñçšžÀÁÂÄÃÅĄĆČĖĘÈÉÊËÌÍÎÏĮŁŃÒÓÔÖÕØÙÚÛÜŲŪŸÝŻŹÑßÇŒÆŠŽ∂ð]/gi,
          ''
        )
      )
      .filter((word) => word.length > 2) // Après nettoyage, garde que les mots significatifs

    if (keyWords.length === 0) return null

    // Construction de la requête pour chercher des transactions similaires
    try {
      // Chercher des transactions déjà catégorisées avec des mots clés similaires
      const query = Transaction.query()
        .where('type', type)
        .whereNotNull('categoryId')
        .preload('category')
        .orderBy('created_at', 'desc')
        .limit(1)

      // Ajouter des conditions pour chaque mot clé
      keyWords.forEach((keyword) => {
        if (keyword) {
          query.andWhere('description', 'ilike', `%${keyword}%`)
        }
      })

      const similarTransaction = await query.first()
      return similarTransaction
    } catch (error) {
      console.error('Erreur lors de la recherche de transactions similaires:', error)
      return null
    }
  }

  /**
   * Catégorise automatiquement un lot de transactions
   */
  static async bulkCategorize(
    transactionIds?: number[]
  ): Promise<{ updated: number; errors: number }> {
    let query = Transaction.query().whereNull('categoryId')

    if (transactionIds && transactionIds.length > 0) {
      query = query.whereIn('id', transactionIds)
    }

    // Limite le nombre de transactions à traiter à la fois
    const transactions = await query.limit(50)

    let updated = 0
    let errors = 0

    for (const transaction of transactions) {
      try {
        const suggestedCategory = await this.suggestCategory(
          transaction.description,
          transaction.type
        )

        if (suggestedCategory) {
          transaction.categoryId = suggestedCategory.id
          await transaction.save()
          updated++
        } else {
          errors++
        }
      } catch (error) {
        console.error(
          `Erreur lors de la catégorisation de la transaction ${transaction.id}:`,
          error
        )
        errors++
      }
    }

    return { updated, errors }
  }
}
