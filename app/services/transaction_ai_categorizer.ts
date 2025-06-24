import OpenAI from 'openai'
import Categorie from '#models/categorie'
import Transaction from '#models/transaction'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

interface SimilarTransaction {
  transaction: Transaction
  similarity: number
  matchedKeywords: string[]
}

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

    // Recherche de transactions similaires avec un système de scoring amélioré
    const similarTransactions = await this.findSimilarTransactions(description, type, 5)

    // Si on trouve des transactions très similaires, utilise la catégorie la plus fréquente
    if (similarTransactions.length > 0) {
      const bestMatch = this.selectBestCategoryFromHistory(similarTransactions)
      if (bestMatch.confidence > 0.8) {
        console.log(
          `Catégorie trouvée par similarité (${bestMatch.confidence.toFixed(2)}):`,
          bestMatch.category?.name
        )
        console.log(`Mots-clés matchés: ${bestMatch.matchedKeywords.join(', ')}`)
        return bestMatch.category || null
      }
    }

    // Construit un contexte riche pour l'IA en utilisant l'historique de transactions similaires
    const contextualExamples = await this.buildContextualExamples(
      description,
      type,
      similarTransactions
    )

    // Prépare le prompt enrichi avec le contexte d'historique
    const prompt = this.buildEnhancedPrompt(
      description,
      type,
      categoryNames,
      contextualExamples,
      similarTransactions
    )

    try {
      // Appel à l'API OpenAI avec un contexte enrichi
      const res = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content:
              "Tu es un assistant financier expert qui classe les transactions bancaires en utilisant l'historique des transactions similaires pour faire des choix cohérents et précis.",
          },
          { role: 'user', content: prompt },
        ],
        max_tokens: 30,
        temperature: 0.1, // Plus déterministe avec l'historique
      })

      const suggestion = res.choices[0].message?.content?.trim()
      if (!suggestion) return null

      console.log('Suggestion IA:', suggestion)

      // Trouve la catégorie correspondante avec un matching plus précis
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
   * Trouve plusieurs transactions similaires avec un scoring de similarité
   */
  static async findSimilarTransactions(
    description: string,
    type: 'credit' | 'debit',
    limit: number = 5
  ): Promise<SimilarTransaction[]> {
    // Normalisation et extraction des mots-clés
    const keywords = this.extractKeywords(description)
    if (keywords.length === 0) return []

    try {
      // Récupère un large échantillon de transactions déjà catégorisées du même type
      const candidateTransactions = await Transaction.query()
        .where('type', type)
        .whereNotNull('categoryId')
        .preload('category')
        .orderBy('created_at', 'desc')
        .limit(200) // Plus large échantillon pour meilleure analyse

      const similarTransactions: SimilarTransaction[] = []

      // Évalue la similarité pour chaque transaction candidate
      for (const transaction of candidateTransactions) {
        const similarity = this.calculateSimilarity(keywords, transaction.description)

        if (similarity.score > 0.3) {
          // Seuil de similarité minimum
          similarTransactions.push({
            transaction,
            similarity: similarity.score,
            matchedKeywords: similarity.matchedKeywords,
          })
        }
      }

      // Trie par score de similarité décroissant et retourne les meilleures
      return similarTransactions.sort((a, b) => b.similarity - a.similarity).slice(0, limit)
    } catch (error) {
      console.error('Erreur lors de la recherche de transactions similaires:', error)
      return []
    }
  }

  /**
   * Extrait les mots-clés pertinents d'une description
   */
  static extractKeywords(description: string): string[] {
    const normalizedDesc = description.toLowerCase().trim()

    // Liste des mots vides à ignorer
    const stopWords = new Set([
      'le',
      'la',
      'les',
      'un',
      'une',
      'des',
      'du',
      'de',
      'et',
      'ou',
      'à',
      'au',
      'aux',
      'pour',
      'par',
      'sur',
      'dans',
      'avec',
      'sans',
      'sous',
      'vers',
      'chez',
      'depuis',
      'pendant',
      'avant',
      'après',
      'entre',
      'parmi',
      'selon',
      'malgré',
      'car',
      'donc',
      'mais',
      'cependant',
      'toutefois',
      'néanmoins',
      'pourtant',
    ])

    return normalizedDesc
      .split(/[\s\-_.,;:!?()[\]{}'"]+/) // Split sur plus de délimiteurs
      .filter((word) => word.length >= 3) // Mots d'au moins 3 caractères
      .filter((word) => !stopWords.has(word)) // Enlève les mots vides
      .filter((word) => !/^\d+$/.test(word)) // Enlève les nombres purs
      .map((word) =>
        word.replace(
          /[^a-z0-9àáâäãåąčćęèéêëėįìíîïłńòóôöõøùúûüųūÿýżźñçšžÀÁÂÄÃÅĄĆČĖĘÈÉÊËÌÍÎÏĮŁŃÒÓÔÖÕØÙÚÛÜŲŪŸÝŻŹÑßÇŒÆŠŽ∂ð]/gi,
          ''
        )
      )
      .filter((word) => word.length >= 2) // Re-filtre après nettoyage
  }

  /**
   * Calcule un score de similarité entre les mots-clés et une description
   */
  static calculateSimilarity(
    keywords: string[],
    targetDescription: string
  ): {
    score: number
    matchedKeywords: string[]
  } {
    const targetKeywords = this.extractKeywords(targetDescription)
    const targetSet = new Set(targetKeywords)

    const matchedKeywords: string[] = []
    let exactMatches = 0
    let partialMatches = 0

    for (const keyword of keywords) {
      // Correspondance exacte
      if (targetSet.has(keyword)) {
        exactMatches++
        matchedKeywords.push(keyword)
      } else {
        // Correspondance partielle (inclusion)
        const partialMatch = targetKeywords.find(
          (tk) => tk.includes(keyword) || keyword.includes(tk)
        )
        if (partialMatch) {
          partialMatches++
          matchedKeywords.push(`${keyword}~${partialMatch}`)
        }
      }
    }

    // Score pondéré : correspondances exactes valent plus que partielles
    const score = (exactMatches * 1.0 + partialMatches * 0.5) / keywords.length

    return {
      score,
      matchedKeywords,
    }
  }

  /**
   * Sélectionne la meilleure catégorie basée sur l'historique des transactions similaires
   */
  static selectBestCategoryFromHistory(similarTransactions: SimilarTransaction[]): {
    category: Categorie | null
    confidence: number
    matchedKeywords: string[]
  } {
    if (similarTransactions.length === 0) {
      return { category: null, confidence: 0, matchedKeywords: [] }
    }

    // Groupe par catégorie et calcule un score pondéré
    const categoryScores = new Map<
      number,
      {
        category: Categorie
        totalScore: number
        count: number
        keywords: Set<string>
      }
    >()

    for (const similar of similarTransactions) {
      const categoryId = similar.transaction.categoryId!
      const category = similar.transaction.category!

      if (!categoryScores.has(categoryId)) {
        categoryScores.set(categoryId, {
          category,
          totalScore: 0,
          count: 0,
          keywords: new Set(),
        })
      }

      const categoryData = categoryScores.get(categoryId)!
      categoryData.totalScore += similar.similarity
      categoryData.count += 1
      similar.matchedKeywords.forEach((k) => categoryData.keywords.add(k))
    }

    // Trouve la catégorie avec le meilleur score moyen
    let bestCategory = null
    let bestScore = 0
    let bestKeywords: string[] = []

    for (const [categoryId, data] of categoryScores) {
      const averageScore = data.totalScore / data.count
      const confidence = averageScore * Math.min(data.count / 3, 1) // Bonus pour plusieurs occurrences

      if (confidence > bestScore) {
        bestScore = confidence
        bestCategory = data.category
        bestKeywords = Array.from(data.keywords)
      }
    }

    return {
      category: bestCategory,
      confidence: bestScore,
      matchedKeywords: bestKeywords,
    }
  }

  /**
   * Construit des exemples contextuels pour l'IA
   */
  static async buildContextualExamples(
    description: string,
    type: 'credit' | 'debit',
    similarTransactions: SimilarTransaction[]
  ): Promise<string[]> {
    const examples: string[] = []

    // Ajoute les transactions similaires comme exemples prioritaires
    for (const similar of similarTransactions.slice(0, 5)) {
      const tx = similar.transaction
      examples.push(
        `"${tx.description}" (${tx.type}) -> ${tx.category?.name} [similarité: ${similar.similarity.toFixed(2)}]`
      )
    }

    // Complète avec des exemples récents si besoin
    if (examples.length < 8) {
      const recentExamples = await Transaction.query()
        .where('type', type)
        .whereNotNull('categoryId')
        .preload('category')
        .orderBy('created_at', 'desc')
        .limit(10)

      for (const tx of recentExamples) {
        if (tx.category && examples.length < 8) {
          const exampleText = `"${tx.description}" (${tx.type}) -> ${tx.category.name}`
          if (!examples.includes(exampleText)) {
            examples.push(exampleText)
          }
        }
      }
    }

    return examples
  }

  /**
   * Construit un prompt enrichi avec le contexte d'historique
   */
  static buildEnhancedPrompt(
    description: string,
    type: 'credit' | 'debit',
    categoryNames: string[],
    contextualExamples: string[],
    similarTransactions: SimilarTransaction[]
  ): string {
    let prompt = `Voici la liste des catégories existantes : ${categoryNames.join(', ')}.
Type de la transaction : ${type === 'credit' ? 'crédit' : 'débit'}

`

    // Ajoute le contexte des transactions similaires si disponible
    if (similarTransactions.length > 0) {
      prompt += `TRANSACTIONS SIMILAIRES TROUVÉES DANS L'HISTORIQUE :
${similarTransactions
  .map(
    (s) =>
      `- "${s.transaction.description}" -> ${s.transaction.category?.name} (similarité: ${s.similarity.toFixed(2)}, mots-clés: ${s.matchedKeywords.join(', ')})`
  )
  .join('\n')}

Ces transactions similaires suggèrent fortement une catégorie cohérente. Utilise cet historique pour faire un choix cohérent.

`
    }

    prompt += `EXEMPLES DE CLASSIFICATION RÉCENTE :
${contextualExamples.join('\n')}

Règles métier importantes :
- N'attribue jamais la catégorie "Ventes" à une transaction de type "débit".
- N'attribue jamais la catégorie "Achat" à une transaction de type "crédit".
- Si tu vois "RIT" ou "virement" dans le libellé d'un crédit, c'est probablement une vente.
- Les mots clés comme "LOYER", "ASSURANCE", "TELECOM" sont importants pour la classification.
- PRIORITÉ : Si des transactions similaires existent dans l'historique, utilise la même catégorie pour la cohérence.

À partir de cet historique et de ces règles, à quelle catégorie EXACTE (nom dans la liste) appartient la transaction suivante ? "${description}"
Donne uniquement le nom EXACT d'une catégorie existante, sans rien ajouter d'autre.`

    return prompt
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
          console.log(`Transaction ${transaction.id} catégorisée: ${suggestedCategory.name}`)
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
