import OpenAI from 'openai'
import Categorie from '#models/categorie'
import Transaction from '#models/transaction'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export default class TransactionAICategorizer {
  static async suggestCategory(
    description: string,
    type: 'credit' | 'debit'
  ): Promise<Categorie | null> {
    // Récupère toutes les catégories existantes (id + nom)
    const categories = await Categorie.query().select('id', 'name')
    const categoryNames = categories.map((c) => c.name)

    // Récupère quelques exemples de transactions déjà catégorisées
    const examples = await Transaction.query()
      .whereNotNull('categoryId')
      .preload('category')
      .limit(5)
    const exampleLines = examples
      .filter((tx) => tx.category)
      .map((tx) => `"${tx.description}" (${tx.type}) -> ${tx.category.name}`)
      .join('\n')

    // Prépare le prompt avec contexte et règles métier
    const prompt = `Voici la liste des catégories existantes : ${categoryNames.join(', ')}.
Type de la transaction : ${type === 'credit' ? 'crédit' : 'débit'}
Voici quelques exemples de classification :
${exampleLines}
Règles métier importantes :
- N'attribue jamais la catégorie "Ventes" à une transaction de type "débit".
- N'attribue jamais la catégorie "Achat" à une transaction de type "crédit".
À partir de ces exemples et règles, à quelle catégorie EXACTE (nom dans la liste) appartient la transaction suivante ? "${description}"
Donne uniquement le nom EXACT d'une catégorie existante, sans rien ajouter d'autre. Si jamais tu retrouve "RIT dans le libélé, alors la catégores la plus probable est vente.`

    try {
      // Appel à l'API OpenAI (format chat)
      const res = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content:
              'Tu es un assistant qui classe les transactions bancaires dans la bonne catégorie.',
          },
          { role: 'user', content: prompt },
        ],
        max_tokens: 20,
        temperature: 0,
      })

      const suggestion = res.choices[0].message?.content?.trim()
      if (!suggestion) return null

      console.log('Suggestion IA:', suggestion)
      console.log(
        'Catégories existantes:',
        categories.map((c) => c.name)
      )

      // Trouve la catégorie correspondante (matching souple)
      const found = categories.find(
        (c) =>
          c.name.toLowerCase().includes(suggestion.toLowerCase()) ||
          suggestion.toLowerCase().includes(c.name.toLowerCase())
      )
      if (!found) {
        console.log('Aucune catégorie trouvée pour la suggestion IA:', suggestion)
      }
      return found || null
    } catch (error) {
      console.error('Erreur OpenAI:', error?.message || error)
      return null
    }
  }
}
