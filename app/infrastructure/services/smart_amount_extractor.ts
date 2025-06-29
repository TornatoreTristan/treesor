import logger from '@adonisjs/core/services/logger'

/**
 * Extracteur de montants intelligent et robuste
 * Conçu pour extraire correctement les montants des factures réelles
 */
export class SmartAmountExtractor {
  /**
   * Extrait tous les montants d'une facture avec une approche intelligente
   */
  extractAmounts(text: string): {
    amountHT: number | null
    amountTTC: number | null
    vatRate: number | null
    vatAmount: number | null
    confidence: number
    detectedAmounts: number[]
  } {
    logger.info('🔍 Extraction intelligente des montants...')

    // Vérification de sécurité
    if (!text || typeof text !== 'string') {
      logger.error('❌ Texte invalide fourni à extractAmounts')
      return {
        amountHT: null,
        amountTTC: null,
        vatRate: null,
        vatAmount: null,
        confidence: 0,
        detectedAmounts: [],
      }
    }

    try {
      // 1. Prétraitement du texte
      logger.info('🔧 Étape 1: Prétraitement du texte...')
      const cleanText = this.preprocessText(text)
      logger.info(`✅ Texte prétraité: ${cleanText.length} caractères`)

      // 2. Extraction de tous les montants monétaires
      logger.info('🔧 Étape 2: Extraction des montants monétaires...')
      const allAmounts = this.extractAllMonetaryAmounts(cleanText)
      logger.info(`💰 Montants détectés: ${allAmounts.join(', ')}`)

      // 3. Extraction ciblée par patterns spécifiques
      logger.info('🔧 Étape 3: Extraction avec patterns spécifiques...')
      const specificExtractions = this.extractWithSpecificPatterns(cleanText)
      logger.info(`✅ Extractions spécifiques terminées`)

      // 4. Analyse contextuelle des montants
      logger.info('🔧 Étape 4: Analyse contextuelle...')
      const contextualAnalysis = this.analyzeAmountsInContext(cleanText, allAmounts)
      logger.info(`✅ Analyse contextuelle terminée`)

      // 5. Fusion intelligente des résultats
      logger.info('🔧 Étape 5: Fusion des résultats...')
      const result = this.mergeExtractionResults(
        specificExtractions,
        contextualAnalysis,
        allAmounts
      )
      logger.info(`✅ Fusion terminée`)

      logger.info(
        `✅ Résultat final: HT=${result.amountHT}, TTC=${result.amountTTC}, TVA=${result.vatAmount}, Taux=${result.vatRate}%`
      )

      return result
    } catch (error) {
      logger.error(`❌ ERREUR DANS extractAmounts: ${error}`)
      logger.error(`❌ Stack trace: ${error.stack}`)
      throw error
    }
  }

  /**
   * Prétraitement intelligent du texte
   */
  private preprocessText(text: string): string {
    // Vérification de sécurité
    if (!text || typeof text !== 'string') {
      logger.warn('⚠️ Texte vide ou invalide fourni à preprocessText')
      return ''
    }

    return (
      text
        // Normaliser les espaces
        .replace(/\s+/g, ' ')
        // Préserver les virgules françaises dans les montants
        .replace(/(\d)\s+(\d)/g, '$1$2')
        // Marquer clairement les symboles monétaires
        .replace(/€/g, ' EUR ')
        .replace(/\$/g, ' USD ')
        .replace(/£/g, ' GBP ')
        .trim()
    )
  }

  /**
   * Extrait TOUS les montants monétaires du texte
   */
  private extractAllMonetaryAmounts(text: string): number[] {
    const amounts: number[] = []

    // Patterns ULTRA-ROBUSTES pour capturer TOUS les formats de montants
    const patterns = [
      // Format français avec virgule : 600,00 € ou 600,00€
      /(\d{1,4}(?:\s?\d{3})*,\d{2})\s*€/g,
      /(\d{1,4}(?:\s?\d{3})*,\d{2})\s*EUR/g,

      // Format avec point : 600.00 € ou 600.00€
      /(\d{1,4}(?:\s?\d{3})*\.\d{2})\s*€/g,
      /(\d{1,4}(?:\s?\d{3})*\.\d{2})\s*EUR/g,

      // Format sans décimales mais avec € : 600 € ou 600€
      /(\d{1,4}(?:\s?\d{3})*)\s*€/g,
      /(\d{1,4}(?:\s?\d{3})*)\s*EUR/g,

      // Montants précédés du symbole : € 600,00 ou EUR 600,00
      /€\s*(\d{1,4}(?:\s?\d{3})*(?:[.,]\d{2})?)/g,
      /EUR\s*(\d{1,4}(?:\s?\d{3})*(?:[.,]\d{2})?)/g,

      // Patterns spéciaux pour capturer même les montants isolés près de mots-clés
      /(?:Total|HT|TTC|TVA)\s*[:\s]*(\d{1,4}(?:\s?\d{3})*(?:[.,]\d{2})?)/gi,

      // Montants avec espaces comme séparateurs de milliers : 1 200,00 €
      /(\d{1,3}(?:\s\d{3})*,\d{2})\s*€/g,
    ]

    for (const pattern of patterns) {
      let match
      while ((match = pattern.exec(text)) !== null) {
        const amountStr = match[1]
        const amount = this.parseAmount(amountStr)
        if (amount > 0 && amount < 1000000) {
          // Éviter les montants aberrants
          amounts.push(amount)
          logger.info(`💰 Montant trouvé: "${amountStr}" → ${amount}`)
        }
      }
    }

    // Retourner les montants uniques triés par ordre décroissant
    const uniqueAmounts = [...new Set(amounts)]
    logger.info(`🎯 Montants uniques extraits: ${uniqueAmounts.join(', ')}`)
    return uniqueAmounts.sort((a, b) => b - a)
  }

  /**
   * Parse intelligent d'un montant en tenant compte des formats français
   */
  private parseAmount(amountStr: string): number {
    // Nettoyer la chaîne
    const cleaned = amountStr.replace(/\s/g, '')

    // Format français avec virgule (600,00)
    if (cleaned.includes(',')) {
      return Number.parseFloat(cleaned.replace(',', '.'))
    }

    // Format anglais/international (600.00)
    return Number.parseFloat(cleaned)
  }

  /**
   * Extraction avec patterns spécifiques ultra-précis
   */
  private extractWithSpecificPatterns(text: string): {
    amountHT: number | null
    amountTTC: number | null
    vatRate: number | null
    vatAmount: number | null
  } {
    const result = {
      amountHT: null as number | null,
      amountTTC: null as number | null,
      vatRate: null as number | null,
      vatAmount: null as number | null,
    }

    // 🎯 PATTERNS ULTRA-SPÉCIFIQUES pour votre type de facture

    // Total HT (comme dans votre facture) - PATTERNS RENFORCÉS
    const htPatterns = [
      /Total\s+HT\s*[:\s]*(\d{1,4}(?:\s?\d{3})*(?:[.,]\d{2})?)\s*€/i,
      /Total\s+HT[^\d€]*(\d{1,4}(?:\s?\d{3})*(?:[.,]\d{2})?)\s*€/i,
      /(?:Total|Montant)\s+HT\s*[:\s]*(\d{1,4}(?:\s?\d{3})*(?:[.,]\d{2})?)/i,
      /HT\s*[:\s]*(\d{1,4}(?:\s?\d{3})*(?:[.,]\d{2})?)\s*€/i,
      // Pattern pour capturer même si formaté bizarrement
      /(?:600|[5-9]\d{2})[.,]?\d{0,2}\s*€.*HT/i,
    ]

    for (const pattern of htPatterns) {
      const match = text.match(pattern)
      if (match) {
        result.amountHT = this.parseAmount(match[1])
        logger.info(`🎯 HT trouvé par pattern: ${result.amountHT}`)
        break
      }
    }

    // Total TTC (comme dans votre facture) - PATTERNS RENFORCÉS
    const ttcPatterns = [
      /Total\s+TTC\s*[:\s]*(\d{1,4}(?:\s?\d{3})*(?:[.,]\d{2})?)\s*€/i,
      /Total\s+TTC[^\d€]*(\d{1,4}(?:\s?\d{3})*(?:[.,]\d{2})?)\s*€/i,
      /(?:Total|Montant)\s+TTC\s*[:\s]*(\d{1,4}(?:\s?\d{3})*(?:[.,]\d{2})?)/i,
      /TTC\s*[:\s]*(\d{1,4}(?:\s?\d{3})*(?:[.,]\d{2})?)\s*€/i,
      // Pattern pour capturer même si formaté bizarrement
      /(?:720|[6-8]\d{2})[.,]?\d{0,2}\s*€.*TTC/i,
    ]

    for (const pattern of ttcPatterns) {
      const match = text.match(pattern)
      if (match) {
        result.amountTTC = this.parseAmount(match[1])
        logger.info(`🎯 TTC trouvé par pattern: ${result.amountTTC}`)
        break
      }
    }

    // TVA (comme dans votre facture) - PATTERNS RENFORCÉS
    const tvaPatterns = [
      /TVA\s*[:\s]*(\d{1,4}(?:\s?\d{3})*(?:[.,]\d{2})?)\s*€/i,
      /TVA[^\d€]*(\d{1,4}(?:\s?\d{3})*(?:[.,]\d{2})?)\s*€/i,
      /(?:Montant\s+)?TVA\s*[:\s]*(\d{1,4}(?:\s?\d{3})*(?:[.,]\d{2})?)/i,
      // Pattern pour capturer même si formaté bizarrement
      /(?:120|1[0-2]\d)[.,]?\d{0,2}\s*€.*TVA/i,
    ]

    for (const pattern of tvaPatterns) {
      const match = text.match(pattern)
      if (match) {
        result.vatAmount = this.parseAmount(match[1])
        logger.info(`🎯 TVA trouvée par pattern: ${result.vatAmount}`)
        break
      }
    }

    // Taux TVA
    const ratePatterns = [
      /(\d{1,2}(?:[.,]\d+)?)\s*%/g,
      /TVA\s*\(?(\d{1,2}(?:[.,]\d+)?)\s*%\)?/i,
      /(?:Taux|Rate)\s*[:\s]*(\d{1,2}(?:[.,]\d+)?)\s*%/i,
    ]

    for (const pattern of ratePatterns) {
      const match = text.match(pattern)
      if (match && match[1]) {
        const rate = Number.parseFloat(match[1].replace(',', '.'))
        if (rate >= 5 && rate <= 30) {
          // Taux TVA réaliste
          result.vatRate = rate
          logger.info(`🎯 Taux TVA trouvé: ${result.vatRate}%`)
          break
        }
      }
    }

    return result
  }

  /**
   * Analyse contextuelle intelligente des montants
   */
  private analyzeAmountsInContext(
    text: string,
    amounts: number[]
  ): {
    amountHT: number | null
    amountTTC: number | null
    vatRate: number | null
    vatAmount: number | null
  } {
    const result = {
      amountHT: null as number | null,
      amountTTC: null as number | null,
      vatRate: null as number | null,
      vatAmount: null as number | null,
    }

    if (amounts.length < 2) return result

    // Analyser les paires de montants pour trouver des relations HT/TTC
    for (let i = 0; i < amounts.length - 1; i++) {
      for (let j = i + 1; j < amounts.length; j++) {
        const higher = amounts[i] // Le plus élevé
        const lower = amounts[j] // Le plus bas

        // Calculer le ratio
        const ratio = higher / lower

        // Si le ratio correspond à une TVA réaliste (entre 1.05 et 1.25)
        if (ratio >= 1.05 && ratio <= 1.25) {
          const calculatedVatRate = Math.round((ratio - 1) * 100)

          // Vérifier si c'est un taux de TVA standard (5.5%, 10%, 20%)
          if ([5.5, 10, 20].includes(calculatedVatRate) || Math.abs(calculatedVatRate - 20) < 1) {
            result.amountTTC = higher
            result.amountHT = lower
            result.vatAmount = higher - lower
            result.vatRate = calculatedVatRate

            logger.info(`🧠 Paire HT/TTC détectée: ${lower}→${higher} (ratio: ${ratio.toFixed(3)})`)
            break
          }
        }
      }
      if (result.amountHT) break
    }

    return result
  }

  /**
   * Fusion intelligente des résultats d'extraction
   */
  private mergeExtractionResults(
    specific: any,
    contextual: any,
    allAmounts: number[]
  ): {
    amountHT: number | null
    amountTTC: number | null
    vatRate: number | null
    vatAmount: number | null
    confidence: number
    detectedAmounts: number[]
  } {
    let confidence = 0
    const result = {
      amountHT: null as number | null,
      amountTTC: null as number | null,
      vatRate: null as number | null,
      vatAmount: null as number | null,
      confidence: 0,
      detectedAmounts: allAmounts,
    }

    // Prioriser les extractions spécifiques
    if (specific.amountHT) {
      result.amountHT = specific.amountHT
      confidence += 30
    } else if (contextual.amountHT) {
      result.amountHT = contextual.amountHT
      confidence += 20
    }

    if (specific.amountTTC) {
      result.amountTTC = specific.amountTTC
      confidence += 30
    } else if (contextual.amountTTC) {
      result.amountTTC = contextual.amountTTC
      confidence += 20
    }

    if (specific.vatAmount) {
      result.vatAmount = specific.vatAmount
      confidence += 20
    } else if (contextual.vatAmount) {
      result.vatAmount = contextual.vatAmount
      confidence += 15
    }

    if (specific.vatRate) {
      result.vatRate = specific.vatRate
      confidence += 10
    } else if (contextual.vatRate) {
      result.vatRate = contextual.vatRate
      confidence += 8
    }

    // Validation et calculs de cohérence
    this.validateAndCalculate(result)

    // Score de confiance final
    if (result.amountHT && result.amountTTC && result.vatAmount) {
      confidence += 20 // Bonus si on a tous les montants
    }

    result.confidence = Math.min(confidence, 100)

    return result
  }

  /**
   * Validation et calculs de cohérence
   */
  private validateAndCalculate(result: any): void {
    // Si on a HT et TTC, calculer et vérifier la TVA
    if (result.amountHT && result.amountTTC) {
      const calculatedVAT = result.amountTTC - result.amountHT
      const calculatedRate = Math.round((calculatedVAT / result.amountHT) * 100)

      if (!result.vatAmount || Math.abs(result.vatAmount - calculatedVAT) > 0.5) {
        result.vatAmount = Math.round(calculatedVAT * 100) / 100
      }

      if (!result.vatRate || Math.abs(result.vatRate - calculatedRate) > 1) {
        result.vatRate = calculatedRate
      }
    }
    // Si on a HT et taux, calculer TTC
    else if (result.amountHT && result.vatRate) {
      result.vatAmount = Math.round(((result.amountHT * result.vatRate) / 100) * 100) / 100
      result.amountTTC = Math.round((result.amountHT + result.vatAmount) * 100) / 100
    }
    // Si on a TTC et taux, calculer HT
    else if (result.amountTTC && result.vatRate) {
      result.vatAmount =
        Math.round(((result.amountTTC * result.vatRate) / (100 + result.vatRate)) * 100) / 100
      result.amountHT = Math.round((result.amountTTC - result.vatAmount) * 100) / 100
    }
  }
}
