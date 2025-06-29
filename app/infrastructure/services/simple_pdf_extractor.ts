import logger from '@adonisjs/core/services/logger'
import { PdfAnalyzerServiceInterface } from '../../domain/core/services/pdf_analyzer_service_interface.js'
// @ts-ignore
import PDFParser from 'pdf2json'

/**
 * Extracteur PDF SIMPLE et ADAPTATIF qui marche pour tous les formats !
 */
export class SimplePdfExtractor implements PdfAnalyzerServiceInterface {
  async analyzePdf(filePath: string): Promise<Record<string, any>> {
    try {
      logger.info(`🚀 EXTRACTION SIMPLE: ${filePath}`)

      // 1. Extraire le texte brut
      const rawText = await this.extractRawText(filePath)
      logger.info(`📄 Texte brut extrait: ${rawText.length} caractères`)

      // 2. Afficher le texte pour debug
      logger.info(`🔍 TEXTE COMPLET:\n${rawText}`)

      // 3. Chercher TOUS les nombres qui ressemblent à des montants
      const allNumbers = this.findAllNumbers(rawText)
      logger.info(`🔢 TOUS LES NOMBRES TROUVÉS: ${allNumbers.join(', ')}`)

      // 4. Extraction intelligente et adaptative
      const result = this.extractIntelligently(rawText, allNumbers)

      logger.info(`✅ RÉSULTAT FINAL: ${JSON.stringify(result, null, 2)}`)
      return result
    } catch (error) {
      logger.error(`❌ ERREUR: ${error}`)
      throw error
    }
  }

  private async extractRawText(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const pdfParser = new PDFParser()

      pdfParser.on('pdfParser_dataError', (errData: any) => {
        reject(new Error(`Erreur PDF: ${errData.parserError}`))
      })

      pdfParser.on('pdfParser_dataReady', (pdfData: any) => {
        try {
          let textContent = ''
          if (pdfData.Pages) {
            for (const page of pdfData.Pages) {
              if (page.Texts) {
                for (const textItem of page.Texts) {
                  if (textItem.R) {
                    for (const textRun of textItem.R) {
                      if (textRun.T) {
                        textContent += decodeURIComponent(textRun.T) + ' '
                      }
                    }
                  }
                }
              }
            }
          }
          resolve(textContent)
        } catch (error) {
          reject(error)
        }
      })

      pdfParser.loadPDF(filePath)
    })
  }

  private findAllNumbers(textContent: string): number[] {
    const numbers: number[] = []

    // Patterns pour capturer TOUS les formats de montants
    const patterns = [
      // Format avec espaces entre chaque caractère: "6 0 0 , 0 0"
      /(\d)\s(\d)\s(\d)\s?,\s?(\d)\s(\d)/g,
      // Format avec espaces partiels: "600 , 00"
      /(\d{1,4})\s?,\s?(\d{2})/g,
      // Format normal: 600,00
      /(\d{1,4}),(\d{2})/g,
      // Format anglais: 600.00
      /(\d{1,4})\.(\d{2})/g,
      // Entiers simples
      /\b(\d{2,4})\b/g,
    ]

    for (const pattern of patterns) {
      let match
      while ((match = pattern.exec(textContent)) !== null) {
        let number: number

        if (match[5] !== undefined) {
          // Format: "6 0 0 , 0 0" -> 600.00
          number = Number.parseFloat(`${match[1]}${match[2]}${match[3]}.${match[4]}${match[5]}`)
        } else if (match[2] !== undefined) {
          // Format: "600,00" -> 600.00 ou "600.00" -> 600.00
          const integerPart = match[1]
          const decimalPart = match[2]
          number = Number.parseFloat(`${integerPart}.${decimalPart}`)
        } else {
          // Format: "600"
          number = Number.parseInt(match[1])
        }

        if (number > 0 && number < 100000) {
          numbers.push(number)
          logger.info(
            `🔢 Nombre trouvé: "${match[0]}" → ${number} (précision: ${number.toFixed(2)})`
          )
        }
      }
    }

    // Retourner les nombres uniques triés
    return [...new Set(numbers)].sort((a, b) => b - a)
  }

  private extractIntelligently(textContent: string, allNumbers: number[]): Record<string, any> {
    const result: Record<string, any> = {}

    logger.info(`🔍 ANALYSE INTELLIGENTE DU TEXTE`)
    logger.info(`📊 Nombres disponibles: ${allNumbers.join(', ')}`)

    // FALLBACK INTELLIGENT DIRECT - ANALYSER TOUS LES NOMBRES !
    logger.info(`🧠 ANALYSE INTELLIGENTE DIRECTE DE TOUS LES NOMBRES`)
    this.handleFallbackExtraction(result, allNumbers)

    // Si le fallback n'a rien trouvé, essayer l'extraction par mots-clés
    if (!result.amountHT && !result.amountTTC && !result.vatAmount) {
      logger.info(`⚠️ Fallback échoué, tentative extraction par mots-clés`)
      result.amountHT = this.extractExactAmount(textContent, [
        'TOTAL DE LA FACTURE HT',
        'HT',
        'Total hors taxes',
      ])
      result.amountTTC = this.extractExactAmount(textContent, [
        'SOMME À PAYER TTC',
        'PAYER TTC',
        'Total',
      ])
      result.vatAmount = this.extractExactAmount(textContent, ['TVA \\[', 'TVA'])
    }

    // Calculer les montants manquants si on en a au moins 2
    if (
      (result.amountHT && result.amountTTC) ||
      (result.amountHT && result.vatAmount) ||
      (result.amountTTC && result.vatAmount)
    ) {
      this.calculateRemainingAmounts(result)
    }

    // EXTRACTION PRÉCISE DU NUMÉRO DE FACTURE
    result.invoiceNumber = this.extractInvoiceNumber(textContent)
    logger.info(`🔍 Numéro de facture extrait: ${result.invoiceNumber}`)

    // Chercher les dates (format: 24/06/2025)
    const dateMatches = textContent.match(/(\d{2}\/\d{2}\/\d{4})/g)
    if (dateMatches && dateMatches.length > 0) {
      result.invoiceDate = dateMatches[0]
      if (dateMatches.length > 1) {
        result.dueDate = dateMatches[1]
      }
    }

    logger.info(
      `✅ Montants extraits: HT=${result.amountHT}, TTC=${result.amountTTC}, TVA=${result.vatAmount}, Taux=${result.vatRate}%`
    )

    return result
  }

  private findAmountByKeywords(
    textContent: string,
    keywords: string[],
    allNumbers: number[]
  ): string | null {
    const textUpper = textContent.toUpperCase()

    for (const keyword of keywords) {
      const keywordIndex = textUpper.indexOf(keyword)
      if (keywordIndex !== -1) {
        const contextStart = Math.max(0, keywordIndex - 50)
        const contextEnd = Math.min(textContent.length, keywordIndex + 100)
        const context = textContent.substring(contextStart, contextEnd)

        logger.info(`🔍 Mot-clé "${keyword}" trouvé, contexte: "${context}"`)

        // Chercher un montant dans ce contexte - PATTERNS RENFORCÉS
        const amountPatterns = [
          /(\d{1,4})[.,](\d{2})\s*€/i, // 19,99 €
          /(\d{1,4})[.,](\d{2})/i, // 19,99
          /€\s*(\d{1,4})[.,](\d{2})/i, // € 19,99
        ]

        for (const pattern of amountPatterns) {
          const amountMatch = context.match(pattern)
          if (amountMatch) {
            const amount = Number.parseFloat(`${amountMatch[1]}.${amountMatch[2]}`)
            if (allNumbers.includes(amount)) {
              logger.info(
                `✅ Montant EXACT trouvé pour "${keyword}": ${amount} (contexte: "${context.trim()}")`
              )
              return amount.toFixed(2) // GARDER LA PRÉCISION EXACTE
            }
          }
        }
      }
    }

    return null
  }

  private extractExactAmount(textContent: string, keywords: string[]): string | null {
    const textUpper = textContent.toUpperCase()

    for (const keyword of keywords) {
      const keywordIndex = textUpper.indexOf(keyword)
      if (keywordIndex !== -1) {
        // Prendre 200 caractères après le mot-clé pour être sûr
        const contextStart = keywordIndex
        const contextEnd = Math.min(textContent.length, keywordIndex + 200)
        const context = textContent.substring(contextStart, contextEnd)

        logger.info(`🎯 EXTRACTION EXACTE pour "${keyword}": "${context}"`)

        // Chercher le PREMIER montant après le mot-clé
        const exactMatch = context.match(/(\d{1,4})[,.](\d{2})\s*€?/)
        if (exactMatch) {
          // GARDER LE FORMAT EXACT TROUVÉ
          const rawAmount = exactMatch[0]
          const integerPart = exactMatch[1]
          const decimalPart = exactMatch[2]

          logger.info(`🔥 MONTANT EXACT TROUVÉ: "${rawAmount}" → ${integerPart}.${decimalPart}`)

          // Retourner EXACTEMENT avec 2 décimales
          return `${integerPart}.${decimalPart}`
        }
      }
    }

    return null
  }

  private extractInvoiceNumber(textContent: string): string | null {
    logger.info(`🔍 RECHERCHE DU NUMÉRO DE FACTURE`)

    // Patterns spécifiques avec contexte pour éviter les faux positifs
    const patterns = [
      // VOTRE FORMAT: "Facture 202506-31" (PRIORITÉ ABSOLUE)
      { pattern: /Facture\s+(\d{6}-\d{2})/i, description: 'Format business: Facture 202506-31' },

      // Free: "Facture n° 2380531851"
      { pattern: /Facture\s+n°?\s*(\d{10})/i, description: 'Format Free: Facture n° 2380531851' },

      // Free sans espace: "Facture n°2380531851"
      { pattern: /Facture\s*n°(\d{10})/i, description: 'Format Free sans espace' },

      // Format standard isolé: "202506-31"
      { pattern: /(\d{6}-\d{2})/, description: 'Format standard isolé: 202506-31' },

      // Numéro de 10 chiffres près du mot "Facture"
      { pattern: /Facture[^0-9]*(\d{10})/i, description: 'Numéro 10 chiffres près de Facture' },

      // Numéro isolé de 10 chiffres (spécifique Free)
      { pattern: /\b(\d{10})\b/, description: 'Numéro isolé 10 chiffres' },

      // Autres formats avec contexte
      {
        pattern: /(?:Facture|Invoice)\s+(?:n°|number|#)?\s*(\d{8,15})/i,
        description: 'Format général avec contexte',
      },
    ]

    for (const { pattern, description } of patterns) {
      const match = textContent.match(pattern)
      if (match) {
        const number = match[1]

        // Vérifications pour éviter les faux positifs
        if (this.isValidInvoiceNumber(number, textContent)) {
          logger.info(`✅ Numéro trouvé avec "${description}": ${number}`)
          return number
        } else {
          logger.info(`❌ Numéro rejeté "${description}": ${number} (validation échouée)`)
        }
      }
    }

    logger.warn(`⚠️ Aucun numéro de facture trouvé`)
    return null
  }

  private isValidInvoiceNumber(number: string, textContent: string): boolean {
    // Ne pas prendre les numéros de téléphone (commencent par 06, 07, 01, etc.)
    if (/^0[1-9]/.test(number)) {
      return false
    }

    // Ne pas prendre les codes postaux (5 chiffres)
    if (number.length === 5) {
      return false
    }

    // Ne pas prendre les SIRET (14 chiffres) sauf si c'est vraiment dans le contexte facture
    if (number.length === 14 && !textContent.toUpperCase().includes('FACTURE')) {
      return false
    }

    // Accepter les numéros de 6 à 15 chiffres qui semblent être des factures
    return number.length >= 6 && number.length <= 15
  }

  private analyzeAmountRelationships(result: any, allNumbers: number[]): void {
    logger.info(`🧠 ANALYSE DES RELATIONS ENTRE MONTANTS`)

    // Si on a déjà HT mais pas TTC/TVA, chercher les relations
    if (result.amountHT && (!result.amountTTC || !result.vatAmount)) {
      const ht = Number.parseFloat(result.amountHT)
      logger.info(`💡 HT trouvé: ${ht}, cherche TTC et TVA correspondants`)

      // Chercher dans les autres montants celui qui pourrait être TTC
      for (const amount of allNumbers) {
        if (amount > ht && amount < ht * 1.3) {
          // TTC doit être > HT mais pas trop
          const potentialTVA = amount - ht
          const vatRate = (potentialTVA / ht) * 100

          // Si le taux TVA est réaliste (5%, 10%, 20%)
          if (
            Math.abs(vatRate - 20) < 1 ||
            Math.abs(vatRate - 10) < 1 ||
            Math.abs(vatRate - 5.5) < 1
          ) {
            logger.info(
              `✅ Relation trouvée: HT=${ht}, TTC=${amount}, TVA=${potentialTVA.toFixed(2)}, Taux=${vatRate.toFixed(1)}%`
            )
            result.amountTTC = amount.toString()
            result.vatAmount = potentialTVA.toFixed(2)
            break
          }
        }
      }
    }

    // Si on a TTC mais pas HT/TVA, chercher les relations inverses
    if (result.amountTTC && (!result.amountHT || !result.vatAmount)) {
      const ttc = Number.parseFloat(result.amountTTC)
      logger.info(`💡 TTC trouvé: ${ttc}, cherche HT et TVA correspondants`)

      for (const amount of allNumbers) {
        if (amount < ttc && amount > ttc * 0.7) {
          // HT doit être < TTC mais pas trop petit
          const potentialTVA = ttc - amount
          const vatRate = (potentialTVA / amount) * 100

          if (
            Math.abs(vatRate - 20) < 1 ||
            Math.abs(vatRate - 10) < 1 ||
            Math.abs(vatRate - 5.5) < 1
          ) {
            logger.info(
              `✅ Relation trouvée: TTC=${ttc}, HT=${amount}, TVA=${potentialTVA.toFixed(2)}, Taux=${vatRate.toFixed(1)}%`
            )
            result.amountHT = amount.toString()
            result.vatAmount = potentialTVA.toFixed(2)
            break
          }
        }
      }
    }
  }

  private forceCalculateMissingAmounts(result: any, allNumbers: number[]): void {
    logger.info(`🔧 CALCUL FORCÉ DES MONTANTS MANQUANTS`)

    const ht = result.amountHT ? Number.parseFloat(result.amountHT) : null
    const ttc = result.amountTTC ? Number.parseFloat(result.amountTTC) : null
    const tva = result.vatAmount ? Number.parseFloat(result.vatAmount) : null

    logger.info(`📊 État actuel: HT=${ht}, TTC=${ttc}, TVA=${tva}`)

    // Si on a HT mais pas TTC/TVA, chercher TTC dans les autres montants
    if (ht && (!ttc || ttc === ht || !tva || tva === 0)) {
      logger.info(`💡 On a HT=${ht}, cherchons TTC dans les montants: ${allNumbers.join(', ')}`)

      // Chercher le montant le plus proche qui pourrait être TTC
      for (const amount of allNumbers) {
        if (amount > ht && amount <= ht * 1.3) {
          // TTC doit être > HT mais raisonnable
          const calculatedTVA = amount - ht
          const vatRate = (calculatedTVA / ht) * 100

          logger.info(
            `🧮 Test: ${amount} - ${ht} = ${calculatedTVA.toFixed(2)} TVA (${vatRate.toFixed(1)}%)`
          )

          // Accepter tout taux entre 5% et 25%
          if (vatRate >= 5 && vatRate <= 25) {
            logger.info(
              `✅ TROUVÉ! TTC=${amount}, TVA=${calculatedTVA.toFixed(2)}, Taux=${vatRate.toFixed(1)}%`
            )
            // GARDER LA PRÉCISION EXACTE des montants
            result.amountTTC = amount.toFixed(2)
            result.vatAmount = calculatedTVA.toFixed(2)
            result.vatRate = Math.round(vatRate).toString()
            logger.info(`🔍 Résultat assigné: TTC=${result.amountTTC}, TVA=${result.vatAmount}`)
            return
          }
        }
      }

      // Si on n'a pas trouvé de TTC, calculer avec 20% par défaut
      if (!result.amountTTC || result.amountTTC === result.amountHT) {
        logger.info(`⚠️ Pas de TTC trouvé, calcul avec 20% de TVA par défaut`)
        const calculatedTVA = ht * 0.2
        const calculatedTTC = ht + calculatedTVA

        result.vatAmount = calculatedTVA.toFixed(2)
        result.amountTTC = calculatedTTC.toFixed(2)
        result.vatRate = '20'
      }
    }

    // Calculs standards si on a déjà certains montants
    if (ht && ttc && (!tva || tva === 0)) {
      const calculatedTVA = ttc - ht
      result.vatAmount = calculatedTVA.toFixed(2)
      result.vatRate = Math.round((calculatedTVA / ht) * 100).toString()
      logger.info(`✅ Calculé TVA: ${calculatedTVA.toFixed(2)} (${result.vatRate}%)`)
    } else if (ht && tva && (!ttc || ttc === ht)) {
      result.amountTTC = (ht + tva).toFixed(2)
      logger.info(`✅ Calculé TTC: ${result.amountTTC}`)
    } else if (ttc && tva && !ht) {
      result.amountHT = (ttc - tva).toFixed(2)
      logger.info(`✅ Calculé HT: ${result.amountHT}`)
    }
  }

  /**
   * FALLBACK INTELLIGENT UNIVERSEL - ANALYSE PURE DES NOMBRES
   */
  private handleFallbackExtraction(result: any, allNumbers: number[]): void {
    logger.info(`🔄 FALLBACK UNIVERSEL: analyse de ${allNumbers.length} nombres`)
    logger.info(`📊 Tous les nombres: ${allNumbers.join(', ')}`)

    if (allNumbers.length < 2) {
      logger.warn(`❌ Pas assez de nombres (${allNumbers.length})`)
      return
    }

    // Trier par ordre décroissant
    const sorted = [...allNumbers].sort((a, b) => b - a)
    logger.info(`📈 Nombres triés: ${sorted.join(', ')}`)

    // STRATÉGIE 1: Chercher des triplets parfaits (TTC, HT, TVA)
    for (let i = 0; i < sorted.length; i++) {
      const ttc = sorted[i]
      for (let j = i + 1; j < sorted.length; j++) {
        const ht = sorted[j]
        const calculatedTVA = ttc - ht

        // Vérifier si la TVA calculée existe dans les nombres
        const tvaExists = sorted.some((num) => Math.abs(num - calculatedTVA) < 0.01)

        if (tvaExists && calculatedTVA > 0) {
          const ratio = ttc / ht
          if (ratio >= 1.05 && ratio <= 1.3) {
            result.amountTTC = ttc.toFixed(2)
            result.amountHT = ht.toFixed(2)
            result.vatAmount = calculatedTVA.toFixed(2)
            result.vatRate = Math.round((calculatedTVA / ht) * 100).toString()

            logger.info(`🎯 TRIPLET PARFAIT: TTC=${ttc}, HT=${ht}, TVA=${calculatedTVA.toFixed(2)}`)
            return
          }
        }
      }
    }

    // STRATÉGIE 2: Paires HT/TTC avec ratio logique
    for (let i = 0; i < sorted.length - 1; i++) {
      const higher = sorted[i]
      for (let j = i + 1; j < sorted.length; j++) {
        const lower = sorted[j]
        const ratio = higher / lower

        if (ratio >= 1.05 && ratio <= 1.3) {
          const calculatedTVA = higher - lower
          const vatRate = Math.round((calculatedTVA / lower) * 100)

          // Accepter les taux de TVA réalistes
          if ([5, 6, 10, 20, 21, 25].includes(vatRate)) {
            result.amountTTC = higher.toFixed(2)
            result.amountHT = lower.toFixed(2)
            result.vatAmount = calculatedTVA.toFixed(2)
            result.vatRate = vatRate.toString()

            logger.info(
              `✅ PAIRE LOGIQUE: TTC=${higher}, HT=${lower}, TVA=${calculatedTVA.toFixed(2)} (${vatRate}%)`
            )
            return
          }
        }
      }
    }

    // STRATÉGIE 3: Si on a que 2-3 nombres, prendre les plus gros
    if (sorted.length >= 2) {
      const biggest = sorted[0]
      const second = sorted[1]
      const ratio = biggest / second

      if (ratio >= 1.05 && ratio <= 2.0) {
        result.amountTTC = biggest.toFixed(2)
        result.amountHT = second.toFixed(2)
        result.vatAmount = (biggest - second).toFixed(2)
        result.vatRate = Math.round(((biggest - second) / second) * 100).toString()

        logger.info(`🔧 STRATÉGIE BASIQUE: TTC=${biggest}, HT=${second}`)
        return
      }
    }

    logger.warn(`⚠️ FALLBACK ÉCHOUÉ - Aucune logique trouvée`)
  }

  /**
   * Calcule les montants manquants à partir des montants existants
   */
  private calculateRemainingAmounts(result: any): void {
    const ht = result.amountHT ? Number.parseFloat(result.amountHT) : null
    const ttc = result.amountTTC ? Number.parseFloat(result.amountTTC) : null
    const vatAmount = result.vatAmount ? Number.parseFloat(result.vatAmount) : null

    // HT + TTC => calculer TVA
    if (ht && ttc && !vatAmount) {
      const calculatedVAT = ttc - ht
      result.vatAmount = calculatedVAT.toFixed(2)
      result.vatRate = Math.round((calculatedVAT / ht) * 100).toString()
      logger.info(`💰 TVA calculée: ${result.vatAmount} (${result.vatRate}%)`)
    }

    // HT + VAT => calculer TTC
    else if (ht && vatAmount && !ttc) {
      const calculatedTTC = ht + vatAmount
      result.amountTTC = calculatedTTC.toFixed(2)
      result.vatRate = Math.round((vatAmount / ht) * 100).toString()
      logger.info(`💰 TTC calculé: ${result.amountTTC}`)
    }

    // TTC + VAT => calculer HT
    else if (ttc && vatAmount && !ht) {
      const calculatedHT = ttc - vatAmount
      result.amountHT = calculatedHT.toFixed(2)
      result.vatRate = Math.round((vatAmount / calculatedHT) * 100).toString()
      logger.info(`💰 HT calculé: ${result.amountHT}`)
    }
  }
}
