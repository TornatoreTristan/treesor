import { PdfAnalyzerServiceInterface } from '../../domain/core/services/pdf_analyzer_service_interface.js'
import fs from 'node:fs/promises'
import logger from '@adonisjs/core/services/logger'
import { DateTime } from 'luxon'
import PDFParser from 'pdf2json'

/**
 * Types pour les informations extraites
 */
interface ExtractedData {
  invoiceNumber: string | null
  amounts: {
    amountHT: number
    amountTTC: number
    vatRate: number
    vatAmount: number
  } | null
  dates: {
    invoiceDate: string | null
    dueDate: string | null
  } | null
  seller: {
    name: string | null
    address: string | null
    siret: string | null
    vatNumber: string | null
  } | null
  buyer: {
    name: string | null
    address: string | null
    clientId: string | null
  } | null
  documentType: 'invoice' | 'quote' | 'delivery_note' | 'unknown'
}

/**
 * Service d'analyse amélioré de documents PDF
 * Utilise pdf2json pour extraire le texte des PDF de façon fiable en environnement Node.js
 */
export class PdfAnalyzerService implements PdfAnalyzerServiceInterface {
  // Cache pour éviter de reparser les PDF multiples fois
  private extractionCache: Map<string, string> = new Map()

  // Langues supportées
  private supportedLanguages = ['fr', 'en']

  // Montants significatifs extraits
  private significantAmounts: number[] = []

  /**
   * Analyse un fichier PDF pour en extraire les informations pertinentes pour une facture
   * @param filePath Chemin du fichier PDF à analyser
   * @param options Options d'analyse (langue, type de document attendu)
   * @returns Les données extraites du PDF
   */
  async analyzePdf(
    filePath: string,
    options = { language: 'auto', expectedDocType: 'auto', useAiFallback: true }
  ): Promise<Record<string, any>> {
    try {
      const startTime = Date.now()
      logger.info(`Analyse du PDF: ${filePath}`)

      // 1. Extraire le texte avec pdf2json (plus fiable en Node.js)
      const textContent = await this.extractTextFromPdf(filePath)

      // 1.1 Déterminer la langue du document si en auto
      const documentLanguage =
        options.language === 'auto' ? this.detectLanguage(textContent) : options.language

      logger.info(`Langue détectée: ${documentLanguage}`)

      // 1.2 Déterminer le type de document si en auto
      const documentType =
        options.expectedDocType === 'auto'
          ? this.detectDocumentType(textContent, documentLanguage)
          : options.expectedDocType

      logger.info(`Type de document détecté: ${documentType}`)

      // 2. Analyser le texte pour trouver les informations pertinentes
      const extractionResult: Record<string, any> = {
        invoiceNumber: null,
        documentType: documentType,
      }

      let confidenceScore = 0
      let fieldsExtracted = 0
      let fieldsTried = 0

      // Log pour le débogage (limité pour ne pas remplir les logs)
      logger.info(`Contenu du PDF extrait: ${textContent.substring(0, 300)}...`)

      // 3. Extraction des informations avec gestion d'erreurs granulaire et multiples tentatives
      // 3.1 Extraire le numéro de facture (critique)
      try {
        fieldsTried++
        extractionResult.invoiceNumber = this.extractInvoiceNumber(textContent, documentLanguage)
        if (extractionResult.invoiceNumber) {
          fieldsExtracted++
          logger.info(`Numéro de facture extrait: ${extractionResult.invoiceNumber}`)
        } else {
          logger.warn(`Numéro de facture non trouvé`)
        }
      } catch (error) {
        logger.warn(`Erreur lors de l'extraction du numéro de facture: ${error}`)
      }

      // 3.2 Extraire les montants avec plusieurs méthodes en cas d'échec
      try {
        fieldsTried += 4 // HT, TTC, TVA, Taux TVA
        const amounts = this.extractAmounts(textContent, documentLanguage)
        if (amounts) {
          extractionResult.amountHT = amounts.amountHT
          extractionResult.amountTTC = amounts.amountTTC
          extractionResult.vatRate = amounts.vatRate
          extractionResult.vatAmount = amounts.vatAmount

          // Calculer le score de confiance pour les montants
          if (amounts.amountHT > 0) fieldsExtracted++
          if (amounts.amountTTC > 0) fieldsExtracted++
          if (amounts.vatRate > 0) fieldsExtracted++
          if (amounts.vatAmount > 0) fieldsExtracted++

          logger.info(`Montants extraits avec succès: ${JSON.stringify(amounts)}`)
        } else {
          // Si l'extraction globale échoue, tenter les méthodes individuelles
          const amountHT = this.extractAmountHT(textContent, documentLanguage)
          const amountTTC = this.extractAmountTTC(textContent, documentLanguage)

          if (amountHT || amountTTC) {
            // Nous avons au moins un montant, essayons de calculer les autres
            extractionResult.amountHT = amountHT || 0
            extractionResult.amountTTC = amountTTC || 0

            // Détecter le taux de TVA standard selon la langue
            const vatRate = documentLanguage === 'fr' ? 20 : documentLanguage === 'en' ? 20 : 20 // Taux par défaut
            extractionResult.vatRate = vatRate

            // Calculer la TVA manquante
            if (amountHT && amountTTC) {
              extractionResult.vatAmount = amountTTC - amountHT
              fieldsExtracted += 4
            } else if (amountHT) {
              extractionResult.vatAmount = amountHT * (vatRate / 100)
              extractionResult.amountTTC = amountHT + extractionResult.vatAmount
              fieldsExtracted += 2
            } else if (amountTTC) {
              extractionResult.vatAmount = (amountTTC * vatRate) / (100 + vatRate)
              extractionResult.amountHT = amountTTC - extractionResult.vatAmount
              fieldsExtracted += 2
            }

            // Arrondir les valeurs
            extractionResult.amountHT = Math.round(extractionResult.amountHT * 100) / 100
            extractionResult.amountTTC = Math.round(extractionResult.amountTTC * 100) / 100
            extractionResult.vatAmount = Math.round(extractionResult.vatAmount * 100) / 100

            logger.info(
              `Montants recalculés: HT=${extractionResult.amountHT}, TTC=${extractionResult.amountTTC}, TVA=${extractionResult.vatAmount}`
            )
          } else {
            // En dernier recours, extraire les montants significatifs
            const significantAmounts = this.extractSignificantAmounts(textContent)
            if (significantAmounts.length > 0) {
              extractionResult.amountTTC = significantAmounts[0]
              if (significantAmounts.length > 1) {
                // S'il y a un second montant légèrement inférieur, c'est probablement le HT
                if (
                  significantAmounts[0] > significantAmounts[1] &&
                  significantAmounts[0] < significantAmounts[1] * 1.25
                ) {
                  extractionResult.amountHT = significantAmounts[1]
                  extractionResult.vatAmount =
                    extractionResult.amountTTC - extractionResult.amountHT
                  extractionResult.vatRate = Math.round(
                    (extractionResult.vatAmount / extractionResult.amountHT) * 100
                  )
                  fieldsExtracted += 3
                } else {
                  // Sinon, utiliser le taux standard
                  extractionResult.vatRate = 20
                  extractionResult.vatAmount = (extractionResult.amountTTC * 20) / 120
                  extractionResult.amountHT =
                    extractionResult.amountTTC - extractionResult.vatAmount
                  fieldsExtracted += 1
                }
              } else {
                // Un seul montant trouvé, supposer que c'est le TTC et utiliser taux standard
                extractionResult.vatRate = 20
                extractionResult.vatAmount = (extractionResult.amountTTC * 20) / 120
                extractionResult.amountHT = extractionResult.amountTTC - extractionResult.vatAmount
                fieldsExtracted += 1
              }

              // Arrondir les valeurs
              extractionResult.amountHT = Math.round(extractionResult.amountHT * 100) / 100
              extractionResult.amountTTC = Math.round(extractionResult.amountTTC * 100) / 100
              extractionResult.vatAmount = Math.round(extractionResult.vatAmount * 100) / 100

              logger.info(
                `Montants extraits par méthode de secours: ${JSON.stringify({
                  amountHT: extractionResult.amountHT,
                  amountTTC: extractionResult.amountTTC,
                  vatAmount: extractionResult.vatAmount,
                  vatRate: extractionResult.vatRate,
                })}`
              )
            } else {
              logger.warn("Aucun montant n'a pu être extrait du document")
            }
          }
        }
      } catch (error) {
        logger.warn(`Erreur lors de l'extraction des montants: ${error}`)
      }

      // 3.3 Extraire les dates
      try {
        fieldsTried += 2 // Date facture, Date échéance
        const dates = this.extractDates(textContent, documentLanguage)
        if (dates) {
          extractionResult.invoiceDate = dates.invoiceDate
          extractionResult.dueDate = dates.dueDate

          if (dates.invoiceDate) fieldsExtracted++
          if (dates.dueDate) fieldsExtracted++

          logger.info(`Dates extraites: ${JSON.stringify(dates)}`)
        } else {
          // Tentative de secours - rechercher des dates dans le texte
          // Utiliser les régexes directement ici
          const dateRegex = /(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{4})/g
          const extractedDates = []
          let match

          while ((match = dateRegex.exec(textContent)) !== null) {
            try {
              const day = Number.parseInt(match[1], 10)
              const month = Number.parseInt(match[2], 10) - 1 // JS months 0-11
              const year = Number.parseInt(match[3], 10)

              if (day > 0 && day <= 31 && month >= 0 && month < 12 && year >= 2000) {
                const date = new Date(year, month, day)
                if (
                  date.getDate() === day &&
                  date.getMonth() === month &&
                  date.getFullYear() === year
                ) {
                  extractedDates.push(date)
                }
              }
            } catch (e) {
              // Ignorer les dates invalides
            }
          }

          if (extractedDates.length > 0) {
            // Trier les dates chronologiquement
            extractedDates.sort((a, b) => a.getTime() - b.getTime())

            // La première date est probablement la date de facturation
            extractionResult.invoiceDate = DateTime.fromJSDate(extractedDates[0]).toISODate()
            fieldsExtracted++

            // S'il y a une deuxième date plus tardive, c'est peut-être l'échéance
            if (extractedDates.length > 1 && extractedDates[1] > extractedDates[0]) {
              extractionResult.dueDate = DateTime.fromJSDate(extractedDates[1]).toISODate()
              fieldsExtracted++
            } else {
              // Sinon, estimer une date d'échéance à 30 jours
              extractionResult.dueDate = DateTime.fromJSDate(extractedDates[0])
                .plus({ days: 30 })
                .toISODate()
              // Pas de point supplémentaire car c'est une estimation
            }

            logger.info(
              `Dates extraites par méthode de secours: invoice=${extractionResult.invoiceDate}, due=${extractionResult.dueDate}`
            )
          }
        }
      } catch (error) {
        logger.warn(`Erreur lors de l'extraction des dates: ${error}`)
      }

      // 3.4 Extraire les infos du vendeur
      try {
        const sellerFields = 4 // Nom, adresse, SIRET, TVA
        fieldsTried += sellerFields
        const seller = this.extractSellerInfo(textContent, documentLanguage)
        if (seller) {
          extractionResult.sellerName = seller.name
          extractionResult.sellerAddress = seller.address
          extractionResult.sellerSiret = seller.siret
          extractionResult.sellerVatNumber = seller.vatNumber

          // Compter les champs non-nuls
          if (seller.name) fieldsExtracted++
          if (seller.address) fieldsExtracted++
          if (seller.siret) fieldsExtracted++
          if (seller.vatNumber) fieldsExtracted++

          logger.info(`Informations vendeur extraites: ${JSON.stringify(seller)}`)
        }
      } catch (error) {
        logger.warn(`Erreur lors de l'extraction des informations du vendeur: ${error}`)
      }

      // 3.5 Extraire les infos de l'acheteur
      try {
        const buyerFields = 3 // Nom, adresse, ID client
        fieldsTried += buyerFields
        const buyer = this.extractBuyerInfo(textContent, documentLanguage)
        if (buyer) {
          extractionResult.buyerName = buyer.name
          extractionResult.buyerAddress = buyer.address
          extractionResult.buyerClientId = buyer.clientId

          // Compter les champs non-nuls
          if (buyer.name) fieldsExtracted++
          if (buyer.address) fieldsExtracted++
          if (buyer.clientId) fieldsExtracted++

          logger.info(`Informations acheteur extraites: ${JSON.stringify(buyer)}`)
        }
      } catch (error) {
        logger.warn(`Erreur lors de l'extraction des informations de l'acheteur: ${error}`)
      }

      // 4. Calculer le score de confiance
      confidenceScore = fieldsTried > 0 ? (fieldsExtracted / fieldsTried) * 100 : 0
      extractionResult.confidenceScore = Math.round(confidenceScore)

      logger.info(
        `Score de confiance: ${extractionResult.confidenceScore}% (${fieldsExtracted}/${fieldsTried} champs)`
      )

      // 5. Si la confiance est faible et que l'option AI Fallback est activée, utiliser OpenAI
      if (confidenceScore < 80 && options.useAiFallback) {
        try {
          logger.info(`Score de confiance bas (${confidenceScore}%), recours à l'IA`)
          const aiResult = await this.analyzeWithOpenAI(
            textContent,
            extractionResult,
            documentLanguage
          )

          // Fusionner les résultats, en privilégiant ceux de l'IA pour les champs manquants
          for (const key in aiResult) {
            // Ne remplacer que si le champ est vide ou si l'IA a trouvé une valeur
            if (aiResult[key] && (!extractionResult[key] || extractionResult[key] === 0)) {
              extractionResult[key] = aiResult[key]
            }
          }

          extractionResult.aiAssisted = true
          logger.info(`Analyse IA terminée et fusionnée`)
        } catch (error) {
          logger.error(`Erreur lors de l'analyse avec OpenAI: ${error}`)
        }
      }

      // 6. Vérifier les données extraites et compléter les données manquantes si possible
      this.ensureDataConsistency(extractionResult)

      const endTime = Date.now()
      logger.info(
        `Analyse terminée en ${endTime - startTime}ms: ${JSON.stringify(extractionResult)}`
      )

      return extractionResult
    } catch (error) {
      logger.error(`Erreur critique lors de l'analyse du PDF: ${error}`)
      throw new Error(`Impossible d'analyser le PDF: ${error}`)
    }
  }

  /**
   * Utilise l'API OpenAI pour analyser le contenu du PDF et extraire les informations pertinentes
   * @param text Texte extrait du PDF
   * @param partialResults Résultats partiels déjà extraits par les méthodes conventionnelles
   * @param language Langue détectée du document
   * @returns Les données extraites par l'IA
   */
  private async analyzeWithOpenAI(
    text: string,
    partialResults: Record<string, any>,
    language: string
  ): Promise<Record<string, any>> {
    try {
      // Importer dynamiquement OpenAI si disponible
      let openaiModule
      try {
        openaiModule = await import('openai')
      } catch (error) {
        logger.error('Module OpenAI non disponible. Installez-le avec: npm install openai')
        throw new Error('Module OpenAI non disponible')
      }

      // Vérifier si la clé API est configurée
      const apiKey = process.env.OPENAI_API_KEY
      if (!apiKey) {
        throw new Error(
          "Clé API OpenAI non configurée. Définissez OPENAI_API_KEY dans les variables d'environnement"
        )
      }

      // Créer le client OpenAI
      const OpenAI = openaiModule.default || openaiModule.OpenAI
      if (!OpenAI) {
        throw new Error(
          "Impossible d'initialiser le client OpenAI. Version du module incompatible."
        )
      }

      const openai = new OpenAI({ apiKey })

      // Limiter le texte pour éviter de dépasser les limites de tokens
      const truncatedText = text.length > 4000 ? text.substring(0, 4000) : text

      // Construire un prompt qui guide l'IA pour extraire les informations manquantes
      const missingFields = []
      if (!partialResults.invoiceNumber) missingFields.push('numéro de facture')
      if (!partialResults.amountHT && !partialResults.amountTTC)
        missingFields.push('montants (HT/TTC/TVA)')
      if (!partialResults.invoiceDate) missingFields.push('dates (facturation/échéance)')

      const fieldPrompt =
        missingFields.length > 0
          ? `Concentre-toi particulièrement sur l'extraction de : ${missingFields.join(', ')}.`
          : 'Analyse toutes les informations pertinentes.'

      const langHint =
        language === 'fr' ? 'Le document est en français.' : 'Le document est en anglais.'

      const systemPrompt = `Tu es un expert en analyse de documents financiers. 
Extrait les informations suivantes du texte de la facture fournie:
1. Numéro de facture
2. Montant HT
3. Montant TTC
4. Taux de TVA (%)
5. Montant de TVA
6. Date de facture (format YYYY-MM-DD)
7. Date d'échéance (format YYYY-MM-DD)
8. Informations sur le vendeur (nom, SIRET, numéro TVA)
9. Informations sur l'acheteur

${langHint}
${fieldPrompt}

Réponds UNIQUEMENT au format JSON avec les clés suivantes:
{
  "invoiceNumber": string,
  "amountHT": number,
  "amountTTC": number,
  "vatRate": number,
  "vatAmount": number,
  "invoiceDate": string (YYYY-MM-DD),
  "dueDate": string (YYYY-MM-DD),
  "sellerName": string,
  "sellerSiret": string,
  "sellerVatNumber": string,
  "buyerName": string
}`

      const userPrompt = `Voici le texte extrait d'une facture:\n\n${truncatedText}`

      try {
        // Appeler l'API OpenAI
        const response = await openai.chat.completions.create({
          model: 'gpt-4.1', // Utiliser GPT-4 pour une meilleure qualité
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.2, // Faible température pour des réponses plus consistantes
        })

        // Extraire la réponse
        const content = response.choices[0]?.message?.content
        if (!content) throw new Error("Réponse vide de l'API OpenAI")

        // Parser le JSON retourné
        try {
          const result = JSON.parse(content)

          // Normaliser les valeurs numériques
          if (typeof result.amountHT === 'string')
            result.amountHT = Number.parseFloat(result.amountHT)
          if (typeof result.amountTTC === 'string')
            result.amountTTC = Number.parseFloat(result.amountTTC)
          if (typeof result.vatRate === 'string') result.vatRate = Number.parseFloat(result.vatRate)
          if (typeof result.vatAmount === 'string')
            result.vatAmount = Number.parseFloat(result.vatAmount)

          return result
        } catch (error) {
          logger.error(`Erreur lors du parsing de la réponse JSON: ${error}`)
          logger.error(`Contenu reçu: ${content}`)
          throw new Error('Format de réponse invalide')
        }
      } catch (error) {
        // Vérifier si c'est une erreur d'API
        if (error.response?.status) {
          logger.error(
            `Erreur OpenAI API (${error.response.status}): ${error.response.data?.error?.message || 'Erreur inconnue'}`
          )
        } else {
          logger.error(`Erreur lors de l'appel à OpenAI: ${error.message || error}`)
        }
        throw error
      }
    } catch (error) {
      logger.error(`Erreur OpenAI globale: ${error}`)
      // Retourner un objet vide plutôt que de faire échouer tout le processus
      return {}
    }
  }

  /**
   * S'assure que les données extraites sont cohérentes
   * Complète les données manquantes si possible
   */
  private ensureDataConsistency(data: Record<string, any>): void {
    // 1. Vérification et correction des montants
    this.ensureAmountsConsistency(data)

    // 2. Vérification et correction des dates
    this.ensureDatesConsistency(data)
  }

  /**
   * Vérifie la cohérence des montants et complète les données manquantes
   */
  private ensureAmountsConsistency(data: Record<string, any>): void {
    // S'assurer que les montants sont définis
    data.amountHT = data.amountHT || 0
    data.amountTTC = data.amountTTC || 0
    data.vatRate = data.vatRate || 20 // Taux par défaut
    data.vatAmount = data.vatAmount || 0

    // Si le HT est supérieur au TTC, inverser
    if (data.amountHT > data.amountTTC && data.amountTTC > 0) {
      const temp = data.amountHT
      data.amountHT = data.amountTTC
      data.amountTTC = temp
      // Recalculer la TVA
      data.vatAmount = data.amountTTC - data.amountHT
      if (data.amountHT > 0) {
        data.vatRate = Math.round((data.vatAmount / data.amountHT) * 100)
      }
    }

    // Si la TVA semble incohérente, la recalculer
    const calculatedVAT = data.amountHT * (data.vatRate / 100)
    if (Math.abs(calculatedVAT - data.vatAmount) > 1) {
      // Plus d'1€ d'écart
      data.vatAmount = Number((Math.round(calculatedVAT * 100) / 100).toFixed(2))
      data.amountTTC = Number((Math.round((data.amountHT + data.vatAmount) * 100) / 100).toFixed(2))
    }

    // S'assurer que tous les montants sont des nombres valides
    if (Number.isNaN(data.amountHT)) data.amountHT = 0
    if (Number.isNaN(data.amountTTC)) data.amountTTC = 0
    if (Number.isNaN(data.vatAmount)) data.vatAmount = 0
    if (Number.isNaN(data.vatRate)) data.vatRate = 20
  }

  /**
   * Vérifie la cohérence des dates et complète les données manquantes
   */
  private ensureDatesConsistency(data: Record<string, any>): void {
    // Si on a une date de facture mais pas de date d'échéance, estimer à 30 jours
    if (data.invoiceDate && !data.dueDate) {
      data.dueDate = DateTime.fromISO(data.invoiceDate).plus({ days: 30 }).toISODate()
    }

    // Si la date d'échéance est avant la date de facture, corriger
    if (data.invoiceDate && data.dueDate) {
      const invoiceDate = DateTime.fromISO(data.invoiceDate)
      const dueDate = DateTime.fromISO(data.dueDate)

      if (dueDate < invoiceDate) {
        data.dueDate = invoiceDate.plus({ days: 30 }).toISODate()
      }
    }

    // Si pas de date de facture mais une date d'échéance, estimer à -30 jours
    if (!data.invoiceDate && data.dueDate) {
      data.invoiceDate = DateTime.fromISO(data.dueDate).minus({ days: 30 }).toISODate()
    }

    // Si pas de dates du tout, mettre la date actuelle
    if (!data.invoiceDate && !data.dueDate) {
      const now = DateTime.now()
      data.invoiceDate = now.toISODate()
      data.dueDate = now.plus({ days: 30 }).toISODate()
    }
  }

  /**
   * Détecte la langue du document basée sur des mots clés
   */
  private detectLanguage(text: string): string {
    const normalizedText = text.toLowerCase()

    // Mots-clés français
    const frenchKeywords = ['facture', 'montant', "date d'émission", 'tva', 'total ttc', 'échéance']

    // Mots-clés anglais
    const englishKeywords = ['invoice', 'amount', 'issue date', 'vat', 'total amount', 'due date']

    let frenchScore = 0
    let englishScore = 0

    frenchKeywords.forEach((keyword) => {
      if (normalizedText.includes(keyword)) frenchScore++
    })

    englishKeywords.forEach((keyword) => {
      if (normalizedText.includes(keyword)) englishScore++
    })

    return frenchScore >= englishScore ? 'fr' : 'en'
  }

  /**
   * Détecte le type de document
   */
  private detectDocumentType(
    text: string,
    language: string
  ): 'invoice' | 'quote' | 'delivery_note' | 'unknown' {
    const normalizedText = text.toLowerCase()

    // Mots-clés pour les factures
    const invoiceKeywords = {
      fr: ['facture', 'règlement', 'tva', 'total ttc'],
      en: ['invoice', 'payment', 'vat', 'total amount'],
    }

    // Mots-clés pour les devis
    const quoteKeywords = {
      fr: ['devis', 'proposition', 'estimation', 'validité'],
      en: ['quote', 'quotation', 'proposal', 'estimate', 'validity'],
    }

    // Mots-clés pour les bons de livraison
    const deliveryKeywords = {
      fr: ['bon de livraison', 'livré', 'expédition', 'transporteur'],
      en: ['delivery note', 'delivered', 'shipment', 'carrier'],
    }

    // Comptage des occurrences
    let invoiceScore = 0
    let quoteScore = 0
    let deliveryScore = 0

    const lang = language === 'fr' ? 'fr' : 'en'

    invoiceKeywords[lang].forEach((keyword) => {
      if (normalizedText.includes(keyword)) invoiceScore++
    })

    quoteKeywords[lang].forEach((keyword) => {
      if (normalizedText.includes(keyword)) quoteScore++
    })

    deliveryKeywords[lang].forEach((keyword) => {
      if (normalizedText.includes(keyword)) deliveryScore++
    })

    // Déterminer le type basé sur le score le plus élevé
    if (invoiceScore > quoteScore && invoiceScore > deliveryScore) {
      return 'invoice'
    } else if (quoteScore > invoiceScore && quoteScore > deliveryScore) {
      return 'quote'
    } else if (deliveryScore > invoiceScore && deliveryScore > quoteScore) {
      return 'delivery_note'
    } else {
      return 'unknown'
    }
  }

  /**
   * Extrait les informations du vendeur
   */
  private extractSellerInfo(
    text: string,
    language: string
  ): {
    name: string | null
    address: string | null
    siret: string | null
    vatNumber: string | null
  } {
    const result: {
      name: string | null
      address: string | null
      siret: string | null
      vatNumber: string | null
    } = {
      name: null,
      address: null,
      siret: null,
      vatNumber: null,
    }

    // Extraction du nom de l'entreprise
    const companyNamePatterns = {
      fr: [
        /émetteur\s*:?\s*([^\n\r]+)/i,
        /vendeur\s*:?\s*([^\n\r]+)/i,
        /facturé par\s*:?\s*([^\n\r]+)/i,
      ],
      en: [/from\s*:?\s*([^\n\r]+)/i, /seller\s*:?\s*([^\n\r]+)/i, /issued by\s*:?\s*([^\n\r]+)/i],
    }

    const lang = language === 'fr' ? 'fr' : 'en'

    // Recherche du nom de l'entreprise
    for (const pattern of companyNamePatterns[lang]) {
      const match = text.match(pattern)
      if (match && match[1]) {
        result.name = match[1].trim()
        break
      }
    }

    // Extraction du numéro SIRET
    const siretPattern = /SIRET\s*:?\s*(\d{3}\s*\d{3}\s*\d{3}\s*\d{5}|\d{14})/i
    const siretMatch = text.match(siretPattern)
    if (siretMatch && siretMatch[1]) {
      result.siret = siretMatch[1].replace(/\s/g, '')
    }

    // Extraction du numéro de TVA
    const vatPatterns = {
      fr: [
        /N°\s*TVA\s*:?\s*(FR\s*\d{2}\s*\d{3}\s*\d{3}\s*\d{3}|FR\s*[A-Z0-9]{2}\s*\d{9})/i,
        /Numéro\s*TVA\s*:?\s*(FR\s*\d{2}\s*\d{3}\s*\d{3}\s*\d{3}|FR\s*[A-Z0-9]{2}\s*\d{9})/i,
      ],
      en: [
        /VAT\s*Number\s*:?\s*([A-Z]{2}[A-Z0-9]{2}\s*\d{9})/i,
        /VAT\s*ID\s*:?\s*([A-Z]{2}[A-Z0-9]{2}\s*\d{9})/i,
      ],
    }

    for (const pattern of vatPatterns[lang]) {
      const match = text.match(pattern)
      if (match && match[1]) {
        result.vatNumber = match[1].replace(/\s/g, '')
        break
      }
    }

    // Extraction de l'adresse - utilisation d'une approche par proximité
    // Recherche d'un bloc d'adresse après le nom de l'entreprise
    if (result.name) {
      const addressPattern = new RegExp(
        `${result.name}\\s*[,:\\n\\r]?\\s*([^\\n\\r]+(?:\\n\\r?[^\\n\\r]+){0,3})`,
        'i'
      )
      const addressMatch = text.match(addressPattern)
      if (addressMatch && addressMatch[1]) {
        result.address = addressMatch[1]
          .trim()
          .replace(/\n\r?/g, ', ')
          .replace(/\s{2,}/g, ' ')
      }
    }

    return result
  }

  /**
   * Extrait les informations de l'acheteur
   */
  private extractBuyerInfo(
    text: string,
    language: string
  ): {
    name: string | null
    address: string | null
    clientId: string | null
  } {
    const result: {
      name: string | null
      address: string | null
      clientId: string | null
    } = {
      name: null,
      address: null,
      clientId: null,
    }

    // Extraction du nom du client
    const clientNamePatterns = {
      fr: [
        /destinataire\s*:?\s*([^\n\r]+)/i,
        /client\s*:?\s*([^\n\r]+)/i,
        /facturé à\s*:?\s*([^\n\r]+)/i,
        /acheteur\s*:?\s*([^\n\r]+)/i,
      ],
      en: [
        /to\s*:?\s*([^\n\r]+)/i,
        /customer\s*:?\s*([^\n\r]+)/i,
        /billed to\s*:?\s*([^\n\r]+)/i,
        /buyer\s*:?\s*([^\n\r]+)/i,
      ],
    }

    const lang = language === 'fr' ? 'fr' : 'en'

    // Recherche du nom du client
    for (const pattern of clientNamePatterns[lang]) {
      const match = text.match(pattern)
      if (match && match[1]) {
        result.name = match[1].trim()
        break
      }
    }

    // Extraction du numéro de client
    const clientIdPatterns = {
      fr: [
        /Numéro\s*client\s*:?\s*([A-Z0-9-]+)/i,
        /N°\s*client\s*:?\s*([A-Z0-9-]+)/i,
        /Référence\s*client\s*:?\s*([A-Z0-9-]+)/i,
      ],
      en: [
        /Customer\s*ID\s*:?\s*([A-Z0-9-]+)/i,
        /Client\s*number\s*:?\s*([A-Z0-9-]+)/i,
        /Customer\s*reference\s*:?\s*([A-Z0-9-]+)/i,
      ],
    }

    for (const pattern of clientIdPatterns[lang]) {
      const match = text.match(pattern)
      if (match && match[1]) {
        result.clientId = match[1].trim()
        break
      }
    }

    // Extraction de l'adresse du client - approche par proximité
    if (result.name) {
      const addressPattern = new RegExp(
        `${result.name}\\s*[,:\\n\\r]?\\s*([^\\n\\r]+(?:\\n\\r?[^\\n\\r]+){0,3})`,
        'i'
      )
      const addressMatch = text.match(addressPattern)
      if (addressMatch && addressMatch[1]) {
        result.address = addressMatch[1]
          .trim()
          .replace(/\n\r?/g, ', ')
          .replace(/\s{2,}/g, ' ')
      }
    }

    return result
  }

  /**
   * Nettoie le texte extrait pour améliorer la qualité de l'analyse
   */
  private cleanExtractedText(text: string): string {
    // Remplacer les caractères mal encodés courants
    let cleaned = text
      .replace(/\\u[\dA-F]{4}/gi, (match) => {
        try {
          return String.fromCharCode(Number.parseInt(match.replace(/\\u/g, ''), 16))
        } catch (e) {
          return match
        }
      })
      .replace(/\s+/g, ' ') // Normaliser les espaces
      .replace(/\n\s*\n/g, '\n') // Supprimer les lignes vides
      .replace(/€/g, 'EUR') // Normaliser la devise
      .replace(/(\d),(\d)/g, '$1.$2') // Normaliser les nombres (virgule en point)

    return cleaned
  }

  // Autres méthodes existantes...

  /**
   * Extrait le texte d'un PDF avec pdf2json et mise en cache
   */
  private async extractTextFromPdf(filePath: string): Promise<string> {
    // Vérifier si le texte est déjà en cache
    if (this.extractionCache.has(filePath)) {
      logger.debug(`Utilisation du cache pour ${filePath}`)
      return this.extractionCache.get(filePath)!
    }

    return new Promise((resolve, reject) => {
      // Implémentation existante...
      const pdfParser = new PDFParser()

      pdfParser.on('pdfParser_dataError', (errData: any) => {
        reject(errData.parserError || errData)
      })

      pdfParser.on('pdfParser_dataReady', (pdfData: any) => {
        try {
          // Convertir le PDF entier en texte
          let text = ''

          // Parcourir chaque page
          for (const page of pdfData.Pages) {
            // Extraire et organiser le texte par position Y pour reconstituer les lignes
            const textByY: Record<number, Array<{ text: string; x: number }>> = {}

            // Extraire le texte de chaque élément texte dans la page
            for (const textElement of page.Texts) {
              try {
                // Utiliser la position Y comme clé pour regrouper le texte par ligne
                const yPos = Math.round(textElement.y * 10) / 10 // Arrondir pour gérer les petites différences

                if (!textByY[yPos]) {
                  textByY[yPos] = []
                }

                // Décoder les caractères encodés dans le PDF
                for (const r of textElement.R) {
                  const decodedText = decodeURIComponent(r.T).replace(/\+/g, ' ')
                  textByY[yPos].push({
                    text: decodedText,
                    x: textElement.x,
                  })
                }
              } catch (e) {
                logger.error(`Erreur lors du décodage d'un élément texte: ${e}`)
                // Continuer avec les autres éléments
              }
            }

            // Trier les clés Y pour reconstituer l'ordre des lignes
            const sortedYKeys = Object.keys(textByY)
              .map(Number)
              .sort((a, b) => a - b)

            // Pour chaque ligne, trier les éléments de texte par position X et les joindre
            for (const yKey of sortedYKeys) {
              const lineElements = textByY[yKey].sort((a, b) => a.x - b.x)
              const line = lineElements
                .map((el) => el.text)
                .join(' ')
                .trim()

              if (line) {
                text += line + '\n'
              }
            }

            text += '\n--- PAGE BREAK ---\n\n'
          }

          // Nettoyage du texte
          text = this.cleanExtractedText(text)

          // Mettre en cache le résultat
          this.extractionCache.set(filePath, text)

          resolve(text)
        } catch (error) {
          reject(error)
        }
      })

      // Charger le fichier PDF
      pdfParser.loadPDF(filePath)
    })
  }

  // Le reste des méthodes existantes peut être conservé...

  // Méthode pour extraire le numéro de facture - version multilingue
  private extractInvoiceNumber(text: string, language: string): string | null {
    // Élargir les patterns pour capturer plus de formats
    const patterns = {
      fr: [
        // Formats de numéro de facture avec date intégrée
        /Facture\s+n°\s*[:\.\s]*([A-Z0-9][-A-Z0-9\/]{2,20})/i,
        /N°\s+Facture\s*[:\.\s]*([A-Z0-9][-A-Z0-9\/]{2,20})/i,
        /Facture\s+numéro\s*[:\.\s]*([A-Z0-9][-A-Z0-9\/]{2,20})/i,
        /Numéro\s+de\s+facture\s*[:\.\s]*([A-Z0-9][-A-Z0-9\/]{2,20})/i,
        /Référence\s+facture\s*[:\.\s]*([A-Z0-9][-A-Z0-9\/]{2,20})/i,
        /Facture\s+référence\s*[:\.\s]*([A-Z0-9][-A-Z0-9\/]{2,20})/i,
        // Formats préfixés
        /(F[-_]?\d{4}[-_]?\d{3,})/i,
        /(FACT[-_]?\d{4,})/i,
        /(FC[-_]?\d{6,})/i,
        // Formats spécifiques
        /(?:Facture|N°)\s*[:\.\s]*(\d{4,})/i,
        // Formats avec préfixes d'entreprise
        /((?:OVH|SFR|FREE|ORANGE|BOUYGUES|EDF|GDF|ENGIE|TOTAL)[-_\/\s][A-Z0-9]{4,})/i,
        // Format YYYY-XXX comme F-2025-002
        /Numéro\s+de\s+facture\s*[:\.\s]*(F[-_]?\d{4}[-_]?\d{3})/i,
        // Format spécifique avec année
        /(F[-_]?\d{4}[-_]?\d{3})/i,
        // Format spécifique Google Cloud avec préfixe GCFR
        /(?:Numéro\s+de\s+la\s+facture|facture\s*:|N°\s+facture)\s*:?\s*(GCFR[A-Z0-9]+)/i,
        // Autres formats courants
        /(?:facture|n°|no|numéro|ref|reference|référence)\s*[:#]?\s*([A-Z0-9][-A-Z0-9\/]{2,20})/i,
        // Formats numériques simples
        /(?:F|FAC|FACT|FC)[-_\s]?([\d]{4,8})/i,
        // Format plus rare mais connu
        /(?:facture|no|n°).{1,20}?(\d{5,10})/i,
        // Formats avec année
        /(?:20\d{2}|2K\d{2}|19\d{2})[\-_\/\\](\d{3,6})/i,
        // Format préfixé avec F- ou FACTURE-
        /(F-\d{4,10}|FACTURE-\d{4,8})/i,
      ],
      en: [
        // Formats standards anglais
        /Invoice\s+(?:number|num|no|#)\s*[:\.\s]*([A-Z0-9][-A-Z0-9\/]{2,20})/i,
        /Invoice\s+Reference\s*[:\.\s]*([A-Z0-9][-A-Z0-9\/]{2,20})/i,
        // Formats préfixés
        /(INV[-_]?\d{4}[-_]?\d{3,})/i,
        /(INVOICE[-_]?\d{4,})/i,
        // Format simple numérique
        /Invoice\s+(?:#|no|number)?\s*[:\.\s]*(\d{4,})/i,
        // Format avec préfixes d'entreprise internationaux
        /((?:AMZN|MSFT|GOOG|APPL|IBM)[-_\/\s][A-Z0-9]{4,})/i,
        // Format spécifique avec année
        /(INV[-_]?\d{4}[-_]?\d{3})/i,
        // Format spécifique Google Cloud avec préfixe GCEN
        /(?:Invoice\s+number|invoice\s*:|invoice\s+#)\s*:?\s*(GCEN[A-Z0-9]+)/i,
        // Autres formats courants
        /(?:invoice|no|num|number|ref|reference)\s*[:#]?\s*([A-Z0-9][-A-Z0-9\/]{2,20})/i,
        /(?:INV)[-_\s]?([\d]{4,8})/i,
        // Format plus rare mais connu
        /(?:invoice|no).{1,20}?(\d{5,10})/i,
        // Formats avec année
        /(?:20\d{2}|2K\d{2}|19\d{2})[\-_\/\\](\d{3,6})/i,
        // Format préfixé avec INV- ou INVOICE-
        /(INV-\d{4,10}|INVOICE-\d{4,8})/i,
      ],
    }

    const lang = language === 'fr' ? 'fr' : 'en'

    // 1. D'abord chercher dans la langue détectée
    for (const pattern of patterns[lang]) {
      const match = text.match(pattern)
      if (match && match[1]) {
        return match[1].trim()
      }
    }

    // 2. Si rien trouvé, essayer dans l'autre langue
    const otherLang = language === 'fr' ? 'en' : 'fr'
    for (const pattern of patterns[otherLang]) {
      const match = text.match(pattern)
      if (match && match[1]) {
        return match[1].trim()
      }
    }

    // 3. En dernier recours, chercher des numéros à 6+ chiffres qui pourraient être des numéros de facture
    // Cette approche est moins fiable mais peut aider dans certains cas
    const genericNumberPatterns = [
      // Numéros de 6 à 12 chiffres avec éventuel préfixe alphanumérique
      /([A-Z]{0,3}\d{6,12})/i,
      // Format X00000-Y où X et Y sont des lettres/chiffres
      /([A-Z0-9]\d{5,}[-_][A-Z0-9])/i,
    ]

    for (const pattern of genericNumberPatterns) {
      const match = text.match(pattern)
      if (match && match[1]) {
        return match[1].trim()
      }
    }

    return null
  }

  /**
   * Extrait les montants du texte
   */
  private extractAmounts(
    text: string,
    language: string
  ): { amountHT: number; amountTTC: number; vatRate: number; vatAmount: number } | null {
    // Prétraitement pour garantir une cohérence dans les formats de nombres
    const normalizedText = text
      .replace(/(\d)\s+(\d)/g, '$1$2') // Supprimer les espaces dans les nombres
      .replace(/(\d),(\d)/g, '$1.$2') // Convertir les virgules en points

    // Extraction en deux phases
    // 1. D'abord chercher des montants avec leur contexte clair
    let amountHT = this.extractAmountHT(normalizedText, language)
    let amountTTC = this.extractAmountTTC(normalizedText, language)
    let vatRate = this.extractVATRate(normalizedText, language)
    let vatAmount = this.extractVATAmount(normalizedText, language)

    // 2. Si on n'a pas trouvé, chercher des montants significatifs sans contexte
    if (!amountHT && !amountTTC) {
      const significantAmounts = this.extractSignificantAmounts(normalizedText)

      // Le montant le plus élevé est probablement le montant TTC
      if (significantAmounts.length > 0) {
        amountTTC = significantAmounts[0]

        // Si on a trouvé un second montant légèrement inférieur, c'est probablement le montant HT
        if (
          significantAmounts.length > 1 &&
          significantAmounts[0] > significantAmounts[1] &&
          significantAmounts[0] < significantAmounts[1] * 1.25
        ) {
          amountHT = significantAmounts[1]
          vatAmount = amountTTC - amountHT
          vatRate = Math.round((vatAmount / amountHT) * 100)
        } else if (!vatRate) {
          // Utiliser un taux de TVA standard si pas trouvé
          vatRate = 20
          vatAmount = (amountTTC * vatRate) / (100 + vatRate)
          amountHT = amountTTC - vatAmount
        }
      }
    }

    // Vérifications et calculs de cohérence
    if (amountHT && amountTTC && !vatAmount) {
      vatAmount = amountTTC - amountHT
    } else if (amountHT && !amountTTC && vatAmount) {
      amountTTC = amountHT + vatAmount
    } else if (!amountHT && amountTTC && vatAmount) {
      amountHT = amountTTC - vatAmount
    } else if (amountHT && !amountTTC && !vatAmount) {
      vatAmount = amountHT * (vatRate / 100)
      amountTTC = amountHT + vatAmount
    } else if (!amountHT && amountTTC && !vatAmount) {
      vatAmount = (amountTTC * vatRate) / (100 + vatRate)
      amountHT = amountTTC - vatAmount
    }

    // Si on a trouvé au moins l'un des montants, on peut inférer les autres
    if (amountHT || amountTTC) {
      // Arrondir les valeurs pour éviter les problèmes de précision
      amountHT = amountHT ? Math.round(amountHT * 100) / 100 : 0
      amountTTC = amountTTC ? Math.round(amountTTC * 100) / 100 : 0
      vatAmount = vatAmount ? Math.round(vatAmount * 100) / 100 : 0

      return {
        amountHT: amountHT || 0,
        amountTTC: amountTTC || 0,
        vatRate: vatRate,
        vatAmount: vatAmount,
      }
    }

    return null
  }

  /**
   * Extrait le montant HT du texte
   */
  private extractAmountHT(text: string, language: string): number | null {
    const htPatterns = {
      fr: [
        // Format avec "Total HT" suivi d'un montant
        /Total\s+HT\s*[:\.\s]+(\d{1,3}(?:\s*\d{3})*[\.,]\d+|\d{1,3}(?:\s*\d{3})*)(?:\s*[€$£]|\s*EUR|\s*USD|\s*GBP)?/i,
        // Format spécifique Google Cloud
        /Sous-total\s+en\s+EUR\s*[:\.\s]+(\d{1,3}(?:\s*\d{3})*[\.,]\d+|\d{1,3}(?:\s*\d{3})*)/i,
        // Format avec Montant HT
        /Montant\s+HT\s*[:\.\s]+(\d{1,3}(?:\s*\d{3})*[\.,]\d+|\d{1,3}(?:\s*\d{3})*)(?:\s*[€$£]|\s*EUR|\s*USD|\s*GBP)?/i,
        // Formats génériques
        /(?:montant|total|prix|total|net)\s+(?:HT|hors\s+tax[e]?|hors\s+TVA)[\s:]*?(\d{1,3}(?:\s*\d{3})*[\.,]\d+|\d{1,3}(?:\s*\d{3})*)(?:\s*[€$£]|\s*EUR|\s*USD|\s*GBP)?/i,
        /(?:HT|hors\s+tax[e]?|hors\s+TVA|net)[\s:]*?(\d{1,3}(?:\s*\d{3})*[\.,]\d+|\d{1,3}(?:\s*\d{3})*)(?:\s*[€$£]|\s*EUR|\s*USD|\s*GBP)?/i,
        // Format avec "Total" + "TVA en sus" (chercher avant le mot TVA)
        /Total\s*[:\.\s]+(\d{1,3}(?:\s*\d{3})*[\.,]\d+|\d{1,3}(?:\s*\d{3})*)(?:\s*[€$£]|\s*EUR|\s*USD|\s*GBP)?(?=(?:(?!TTC).)*TVA)/i,
      ],
      en: [
        // Format avec "Subtotal" ou "Net amount"
        /(?:Subtotal|Net\s+amount)\s*[:\.\s]+(\d{1,3}(?:\s*\d{3})*[\.,]\d+|\d{1,3}(?:\s*\d{3})*)(?:\s*[€$£]|\s*EUR|\s*USD|\s*GBP)?/i,
        // Formats avec "Total excluding VAT"
        /Total\s+excluding\s+VAT\s*[:\.\s]+(\d{1,3}(?:\s*\d{3})*[\.,]\d+|\d{1,3}(?:\s*\d{3})*)(?:\s*[€$£]|\s*EUR|\s*USD|\s*GBP)?/i,
        // Formats génériques
        /(?:amount|total|price|subtotal)\s+(?:excl|excluding|excl\.)\s+(?:tax|vat)[\s:]*?(\d{1,3}(?:\s*\d{3})*[\.,]\d+|\d{1,3}(?:\s*\d{3})*)(?:\s*[€$£]|\s*EUR|\s*USD|\s*GBP)?/i,
        /(?:net\s+amount|net\s+total|subtotal)[\s:]*?(\d{1,3}(?:\s*\d{3})*[\.,]\d+|\d{1,3}(?:\s*\d{3})*)(?:\s*[€$£]|\s*EUR|\s*USD|\s*GBP)?/i,
        // Format comptage de lignes suivi de "Tax" ou "VAT"
        /^(?:Sub)?Total\s*[:\.\s]+(\d{1,3}(?:\s*\d{3})*[\.,]\d+|\d{1,3}(?:\s*\d{3})*)(?:\s*[€$£]|\s*EUR|\s*USD|\s*GBP)?(?=(?:(?!incl).)*Tax|VAT)/i,
      ],
    }

    const lang = language === 'fr' ? 'fr' : 'en'

    // Recherche des patterns spécifiques à la langue
    for (const pattern of htPatterns[lang]) {
      const match = text.match(pattern)
      if (match && match[1]) {
        const amount = Number.parseFloat(match[1].replace(/\s/g, '').replace(',', '.'))
        if (!Number.isNaN(amount) && amount > 0) {
          return amount
        }
      }
    }

    // Si on n'a pas trouvé, essayer les patterns de l'autre langue
    const otherLang = language === 'fr' ? 'en' : 'fr'
    for (const pattern of htPatterns[otherLang]) {
      const match = text.match(pattern)
      if (match && match[1]) {
        const amount = Number.parseFloat(match[1].replace(/\s/g, '').replace(',', '.'))
        if (!Number.isNaN(amount) && amount > 0) {
          return amount
        }
      }
    }

    return null
  }

  /**
   * Extrait le montant TTC du texte
   */
  private extractAmountTTC(text: string, language: string): number | null {
    const ttcPatterns = {
      fr: [
        // Format avec "Total TTC" suivi d'un montant
        /Total\s+TTC\s*[:\.\s]+(\d{1,3}(?:\s*\d{3})*[\.,]\d+|\d{1,3}(?:\s*\d{3})*)(?:\s*[€$£]|\s*EUR|\s*USD|\s*GBP)?/i,
        // Format spécifique Google Cloud
        /Total\s+en\s+EUR\s*[:\.\s]+(\d{1,3}(?:\s*\d{3})*[\.,]\d+)\s*(?:€|EUR)/i,
        // Total à payer ou montant TTC
        /(?:Total\s+à\s+payer|Montant\s+TTC|À\s+payer)\s*[:\.\s]+(\d{1,3}(?:\s*\d{3})*[\.,]\d+|\d{1,3}(?:\s*\d{3})*)(?:\s*[€$£]|\s*EUR|\s*USD|\s*GBP)?/i,
        // Formats génériques
        /(?:montant|total|prix|somme)\s+(?:TTC|toutes\s+taxes|t\.t\.c\.|ttc)[\s:]*?(\d{1,3}(?:\s*\d{3})*[\.,]\d+|\d{1,3}(?:\s*\d{3})*)(?:\s*[€$£]|\s*EUR|\s*USD|\s*GBP)?/i,
        /(?:TTC|toutes\s+taxes|t\.t\.c\.|ttc)[\s:]*?(\d{1,3}(?:\s*\d{3})*[\.,]\d+|\d{1,3}(?:\s*\d{3})*)(?:\s*[€$£]|\s*EUR|\s*USD|\s*GBP)?/i,
        /(?:total)\s+(?:à\s+payer|due|payable|pay|régler)[\s:]*?(\d{1,3}(?:\s*\d{3})*[\.,]\d+|\d{1,3}(?:\s*\d{3})*)(?:\s*[€$£]|\s*EUR|\s*USD|\s*GBP)?/i,
        // Montant au bas de la page, dernière somme
        /TOTAL\s*[:\.]?\s*(\d{1,3}(?:\s*\d{3})*[\.,]\d+|\d{1,3}(?:\s*\d{3})*)(?:\s*[€$£]|\s*EUR|\s*USD|\s*GBP)?(?!.*TOTAL)/i,
      ],
      en: [
        // Format avec "Total amount" suivi d'un montant
        /(?:Total\s+amount|Grand\s+total|Total\s+due)\s*[:\.\s]+(\d{1,3}(?:\s*\d{3})*[\.,]\d+|\d{1,3}(?:\s*\d{3})*)(?:\s*[€$£]|\s*EUR|\s*USD|\s*GBP)?/i,
        // Format "Total (Including Tax)"
        /Total\s*\(?\s*Including\s+Tax\s*\)?\s*[:\.\s]+(\d{1,3}(?:\s*\d{3})*[\.,]\d+|\d{1,3}(?:\s*\d{3})*)(?:\s*[€$£]|\s*EUR|\s*USD|\s*GBP)?/i,
        // Formats génériques
        /(?:total|amount|sum|grand\s+total)\s+(?:incl|including|inc\.)\s+(?:tax|vat)[\s:]*?(\d{1,3}(?:\s*\d{3})*[\.,]\d+|\d{1,3}(?:\s*\d{3})*)(?:\s*[€$£]|\s*EUR|\s*USD|\s*GBP)?/i,
        /(?:total\s+amount|total\s+due|amount\s+due|to\s+pay)\s*(?:payable)?[\s:]*?(\d{1,3}(?:\s*\d{3})*[\.,]\d+|\d{1,3}(?:\s*\d{3})*)(?:\s*[€$£]|\s*EUR|\s*USD|\s*GBP)?/i,
        // Montant au bas de la page, généralement le dernier montant
        /TOTAL\s*[:\.]?\s*(\d{1,3}(?:\s*\d{3})*[\.,]\d+|\d{1,3}(?:\s*\d{3})*)(?:\s*[€$£]|\s*EUR|\s*USD|\s*GBP)?(?!.*TOTAL)/i,
      ],
    }

    const lang = language === 'fr' ? 'fr' : 'en'

    // Recherche des patterns spécifiques à la langue
    for (const pattern of ttcPatterns[lang]) {
      const match = text.match(pattern)
      if (match && match[1]) {
        const amount = Number.parseFloat(match[1].replace(/\s/g, '').replace(',', '.'))
        if (!Number.isNaN(amount) && amount > 0) {
          return amount
        }
      }
    }

    // Si on n'a pas trouvé, essayer les patterns de l'autre langue
    const otherLang = language === 'fr' ? 'en' : 'fr'
    for (const pattern of ttcPatterns[otherLang]) {
      const match = text.match(pattern)
      if (match && match[1]) {
        const amount = Number.parseFloat(match[1].replace(/\s/g, '').replace(',', '.'))
        if (!Number.isNaN(amount) && amount > 0) {
          return amount
        }
      }
    }

    // Si toujours rien, essayer de trouver le dernier montant avec symbole de devise
    const currencyPattern =
      /(\d{1,3}(?:\s*\d{3})*[\.,]\d+|\d{1,3}(?:\s*\d{3})*)\s*(?:[€$£]|EUR|USD|GBP)/g
    let lastMatch
    let currMatch
    while ((currMatch = currencyPattern.exec(text)) !== null) {
      lastMatch = currMatch
    }

    if (lastMatch && lastMatch[1]) {
      const amount = Number.parseFloat(lastMatch[1].replace(/\s/g, '').replace(',', '.'))
      if (!Number.isNaN(amount) && amount > 0) {
        return amount
      }
    }

    return null
  }

  /**
   * Extrait le taux de TVA du texte
   */
  private extractVATRate(text: string, language: string): number {
    let vatRate = 20 // Taux par défaut

    const vatRatePatterns = {
      fr: [
        // Recherche du taux dans un format tableau avec colonne TVA (%)
        /TVA\s*\(%\)\s*[\n\r\s]*(\d+(?:[.,]\d+)?)\s*%/i,
        // Format spécifique Google Cloud
        /TVA\s*\((\d+)%\)/i,
        // Formats génériques
        /(?:taux|tva|t\.v\.a\.|rate)\s*(?:de\s+TVA|de\s+T\.V\.A\.)?[\s:%]*(\d+(?:[.,]\d+)?)(?:\s*%)?/i,
        /(?:TVA|T\.V\.A\.)\s*(?:\(\s*(\d+(?:[.,]\d+)?)\s*%\s*\)|\s*(\d+(?:[.,]\d+)?)\s*%)/i,
        /(\d+(?:[.,]\d+)?)\s*%\s*(?:TVA|T\.V\.A\.)/i,
      ],
      en: [
        // Recherche du taux dans un format tableau avec colonne VAT (%)
        /VAT\s*\(%\)\s*[\n\r\s]*(\d+(?:[.,]\d+)?)\s*%/i,
        // Format spécifique
        /VAT\s*\((\d+)%\)/i,
        // Formats génériques
        /(?:rate|vat|value\s+added\s+tax)\s*(?:of\s+VAT)?[\s:%]*(\d+(?:[.,]\d+)?)(?:\s*%)?/i,
        /(?:VAT)\s*(?:\(\s*(\d+(?:[.,]\d+)?)\s*%\s*\)|\s*(\d+(?:[.,]\d+)?)\s*%)/i,
        /(\d+(?:[.,]\d+)?)\s*%\s*(?:VAT)/i,
      ],
    }

    const lang = language === 'fr' ? 'fr' : 'en'

    for (const pattern of vatRatePatterns[lang]) {
      const match = text.match(pattern)
      if (match) {
        const rateValue = match[1] || match[2]
        if (rateValue) {
          vatRate = Number.parseFloat(rateValue.replace(',', '.'))
          break
        }
      }
    }

    return vatRate
  }

  /**
   * Extrait le montant de TVA du texte
   */
  private extractVATAmount(text: string, language: string): number | null {
    const vatAmountPatterns = {
      fr: [
        // Format avec "Montant total de la TVA"
        /Montant\s+total\s+de\s+la\s+TVA\s*[:\.\s]+(\d+[\.,]\d+|\d+)(?:\s*[€$£]|\s*EUR|\s*USD|\s*GBP)?/i,
        // Format spécifique Google Cloud
        /TVA\s*\(\d+%\)\s*[:\.\s]+(\d+[\.,]\d+)\s*€/i,
        // Formats génériques
        /(?:montant|total|amount)\s+(?:TVA|T\.V\.A\.|taxe|tax)[\s:]*?(\d+[\.,]\d+|\d+)(?:\s*[€$£]|\s*EUR|\s*USD|\s*GBP)?/i,
        /(?:TVA|T\.V\.A\.|taxe|tax)\s*(?:amount)?[\s:]*?(\d+[\.,]\d+|\d+)(?:\s*[€$£]|\s*EUR|\s*USD|\s*GBP)?/i,
      ],
      en: [
        // Format avec "VAT amount"
        /VAT\s+amount\s*[:\.\s]+(\d+[\.,]\d+|\d+)(?:\s*[€$£]|\s*EUR|\s*USD|\s*GBP)?/i,
        // Format spécifique
        /VAT\s*\(\d+%\)\s*[:\.\s]+(\d+[\.,]\d+)/i,
        // Formats génériques
        /(?:amount|total)\s+(?:VAT|tax)[\s:]*?(\d+[\.,]\d+|\d+)(?:\s*[€$£]|\s*EUR|\s*USD|\s*GBP)?/i,
        /(?:VAT|tax)\s*(?:amount)?[\s:]*?(\d+[\.,]\d+|\d+)(?:\s*[€$£]|\s*EUR|\s*USD|\s*GBP)?/i,
      ],
    }

    const lang = language === 'fr' ? 'fr' : 'en'

    for (const pattern of vatAmountPatterns[lang]) {
      const match = text.match(pattern)
      if (match && match[1]) {
        return Number.parseFloat(match[1].replace(',', '.'))
      }
    }

    return null
  }

  /**
   * Extrait des montants significatifs du texte (sans contexte spécifique)
   * Retourne une liste triée par ordre décroissant
   */
  private extractSignificantAmounts(text: string): number[] {
    const amounts: number[] = []

    // Prétraitement pour normaliser le texte
    const normalizedText = text
      .replace(/(\d)\s+(\d)/g, '$1$2') // Supprimer les espaces dans les nombres
      .replace(/(\d),(\d{1,3})/g, '$1.$2') // Convertir les virgules en points pour format décimal
      .replace(/\s+/g, ' ') // Normaliser les espaces

    // Recherche de montants avec symboles monétaires (prioritaire)
    const currencyPatterns = [
      // Montants avec symbole monétaire avant ou après - étendu pour capturer les formats avec espaces comme séparateurs de milliers
      /(\d{1,3}(?:\s*\d{3})*[\.,]\d{1,2}|\d{1,3}(?:\s*\d{3})*)\s*(?:[€$£]|EUR|USD|GBP)/gi,
      /(?:[€$£]|EUR|USD|GBP)\s*(\d{1,3}(?:\s*\d{3})*[\.,]\d{1,2}|\d{1,3}(?:\s*\d{3})*)/gi,
    ]

    // Parcourir chaque pattern
    for (const pattern of currencyPatterns) {
      let match
      while ((match = pattern.exec(normalizedText)) !== null) {
        if (match && match[1]) {
          // Nettoyer le montant en enlevant les espaces et remplaçant les virgules par des points
          const cleanedAmount = match[1].replace(/\s/g, '').replace(',', '.')
          const amount = Number.parseFloat(cleanedAmount)
          if (!Number.isNaN(amount) && amount > 0) {
            // Arrondir à 2 décimales pour normaliser
            amounts.push(Math.round(amount * 100) / 100)
          }
        }
      }
    }

    // Si pas assez de montants avec symboles, chercher des contextes d'intérêt financier
    if (amounts.length < 2) {
      const contextPatterns = [
        // Montants avec contexte fiscal (HT, TTC, TVA) - amélioré pour les formats avec espaces
        /(\d{1,3}(?:\s*\d{3})*[\.,]\d{1,2}|\d{1,3}(?:\s*\d{3})*)\s*(?:HT|TTC|TVA|tax)/gi,
        /(?:total|amount|montant|somme)\s*[:\.]?\s*(\d{1,3}(?:\s*\d{3})*[\.,]\d{1,2}|\d{1,3}(?:\s*\d{3})*)/gi,
        // Montants près de termes fiscaux
        /(\d{1,3}(?:\s*\d{3})*[\.,]\d{1,2}|\d{1,3}(?:\s*\d{3})*)(?=\s*(?:.{0,15}(?:HT|TTC|TVA|tax)))/gi,
      ]

      for (const pattern of contextPatterns) {
        let match
        while ((match = pattern.exec(normalizedText)) !== null) {
          if (match && match[1]) {
            const cleanedAmount = match[1].replace(/\s/g, '').replace(',', '.')
            const amount = Number.parseFloat(cleanedAmount)
            if (!Number.isNaN(amount) && amount > 0) {
              amounts.push(Math.round(amount * 100) / 100)
            }
          }
        }
      }
    }

    // Si toujours pas assez de montants, chercher des nombres avec 2 décimales (format financier standard)
    if (amounts.length < 2) {
      const decimalPattern = /(\d{1,3}(?:\s*\d{3})*[\.,]\d{2})(?!\d)/g
      let match

      while ((match = decimalPattern.exec(normalizedText)) !== null) {
        if (match && match[1]) {
          const cleanedAmount = match[1].replace(/\s/g, '').replace(',', '.')
          const amount = Number.parseFloat(cleanedAmount)
          if (!Number.isNaN(amount) && amount > 10) {
            amounts.push(Math.round(amount * 100) / 100)
          }
        }
      }
    }

    // Filtrer les montants trop petits ou trop grands pour être des prix
    const filteredAmounts = amounts.filter(
      (amount) =>
        amount >= 5 && // Prix minimum raisonnable
        amount <= 100000 // Prix maximum raisonnable
    )

    // Éliminer les doublons avec une précision de 2 décimales et filtrer les valeurs aberrantes
    const uniqueAmounts = [...new Set(filteredAmounts.map((a) => Math.round(a * 100) / 100))]

    // Si nous avons plusieurs montants, analyser les ratios pour identifier potentiellement
    // des paires HT/TTC (ratio typique entre 1.05 et 1.25)
    if (uniqueAmounts.length >= 2) {
      uniqueAmounts.sort((a, b) => b - a) // Trier par ordre décroissant

      // Vérifier s'il y a des paires qui pourraient représenter HT/TTC
      for (let i = 0; i < uniqueAmounts.length - 1; i++) {
        const ratio = uniqueAmounts[i] / uniqueAmounts[i + 1]
        if (ratio >= 1.05 && ratio <= 1.25) {
          // Si on trouve une paire plausible, la mettre en priorité
          const ttc = uniqueAmounts[i]
          const ht = uniqueAmounts[i + 1]

          // Réarranger pour que la paire soit en tête
          uniqueAmounts.splice(i, 2)
          uniqueAmounts.unshift(ht)
          uniqueAmounts.unshift(ttc)
          break
        }
      }
    }

    // Trier et retourner les montants uniques
    return uniqueAmounts.sort((a, b) => b - a)
  }

  /**
   * Extrait les dates du texte
   */
  private extractDates(
    text: string,
    language: string
  ): { invoiceDate: string | null; dueDate: string | null } | null {
    // 1. Normaliser le texte pour les dates
    const normalizedText = text
      .replace(/(\d{1,2})[\\\/\.-](\d{1,2})[\\\/\.-](\d{4}|\d{2})/g, (match, d, m, y) => {
        // Normaliser en format standard DD/MM/YYYY pour faciliter l'extraction
        if (y.length === 2) {
          y = '20' + y // Assumer les années 2000+
        }
        return `${d}/${m}/${y}`
      })
      // Ajouter des espaces autour des caractères de ponctuation pour faciliter l'extraction
      .replace(/([\.,:;])/g, ' $1 ')

    // 2. Obtenir l'année actuelle pour filtrer les dates improbables
    const currentYear = new Date().getFullYear()

    // 3. Recherche simple des dates au format MM/DD/YYYY ou DD/MM/YYYY
    let potentialInvoiceDate: Date | null = null

    // Pattern pour trouver une date qui serait potentiellement une date de facture
    const simpleInvoiceDatePattern = /(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/g
    const invoiceDatesFound: Date[] = []

    let match
    while ((match = simpleInvoiceDatePattern.exec(normalizedText)) !== null) {
      const day = Number.parseInt(match[1], 10)
      const month = Number.parseInt(match[2], 10) - 1
      const year = Number.parseInt(match[3], 10)

      // Vérifier que c'est une date valide et récente (dans les 5 dernières années)
      if (
        day >= 1 &&
        day <= 31 &&
        month >= 0 &&
        month <= 11 &&
        year >= currentYear - 5 &&
        year <= currentYear + 1
      ) {
        try {
          const date = new Date(year, month, day)
          // Vérifier que la date est valide
          if (date.getFullYear() === year && date.getMonth() === month && date.getDate() === day) {
            invoiceDatesFound.push(date)
          }
        } catch (e) {
          // Ignorer les dates invalides
        }
      }
    }

    // Essayer d'abord les méthodes spécifiques
    const result = this.findSpecificDates(normalizedText, language)

    // Si on a trouvé des dates spécifiques, on les utilise
    if (result.invoiceDate || result.dueDate) {
      const invoiceDate = result.invoiceDate
        ? DateTime.fromJSDate(result.invoiceDate).toISODate()
        : invoiceDatesFound.length > 0
          ? DateTime.fromJSDate(invoiceDatesFound[0]).toISODate()
          : null

      return {
        invoiceDate,
        dueDate: result.dueDate ? DateTime.fromJSDate(result.dueDate).toISODate() : null,
      }
    }

    // Si on a trouvé des dates simples, utiliser la plus ancienne comme date de facture
    if (invoiceDatesFound.length > 0) {
      // Trier par ordre chronologique
      invoiceDatesFound.sort((a, b) => a.getTime() - b.getTime())
      potentialInvoiceDate = invoiceDatesFound[0]

      return {
        invoiceDate: potentialInvoiceDate
          ? DateTime.fromJSDate(potentialInvoiceDate).toISODate()
          : null,
        dueDate: null, // On n'a pas trouvé de date d'échéance explicite
      }
    }

    // Utiliser la méthode générique en dernier recours
    return this.findGenericDates(normalizedText, result.invoiceDate, result.dueDate, language)
  }

  /**
   * Cherche des dates spécifiques dans le texte (émission, échéance, etc.)
   */
  private findSpecificDates(
    text: string,
    language: string
  ): { invoiceDate: Date | null; dueDate: Date | null } {
    let invoiceDate: Date | null = null
    let dueDate: Date | null = null

    const patterns = {
      fr: {
        emission: /Date\s+d['']émission\s*[:\.\s]+(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{4})/i,
        due: /Date\s+d['']échéance\s*[:\.\s]+(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{4})/i,
        googleDate:
          /Date\s+de\s+la\s+facture\s*[:\.\s]+(\d{1,2})\s+(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\s+(\d{4})/i,
      },
      en: {
        emission: /Invoice\s+date\s*[:\.\s]+(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{4})/i,
        due: /Due\s+date\s*[:\.\s]+(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{4})/i,
        googleDate:
          /Invoice\s+date\s*[:\.\s]+(\d{1,2})\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{4})/i,
      },
    }

    const lang = language === 'fr' ? 'fr' : 'en'

    // 1.1 Patterns spécifiques pour la facturation
    const emissionMatch = text.match(patterns[lang].emission)

    if (emissionMatch) {
      const day = Number.parseInt(emissionMatch[1], 10)
      const month = Number.parseInt(emissionMatch[2], 10) - 1 // Mois 0-11 en JS
      const year = Number.parseInt(emissionMatch[3], 10)

      if (day > 0 && day <= 31 && month >= 0 && month < 12 && year > 2000) {
        invoiceDate = new Date(year, month, day)
      }
    }

    // 1.2 Patterns spécifiques pour l'échéance
    const dueMatch = text.match(patterns[lang].due)

    if (dueMatch) {
      const day = Number.parseInt(dueMatch[1], 10)
      const month = Number.parseInt(dueMatch[2], 10) - 1 // Mois 0-11 en JS
      const year = Number.parseInt(dueMatch[3], 10)

      if (day > 0 && day <= 31 && month >= 0 && month < 12 && year > 2000) {
        dueDate = new Date(year, month, day)
      }
    }

    // 1.3 Pattern spécifique pour les factures Google Cloud
    if (!invoiceDate) {
      const googleMatch = text.match(patterns[lang].googleDate)

      if (googleMatch) {
        const day = Number.parseInt(googleMatch[1], 10)
        const monthText = googleMatch[2].toLowerCase()
        const year = Number.parseInt(googleMatch[3], 10)

        const monthMap: Record<string, number> =
          lang === 'fr'
            ? {
                janvier: 0,
                février: 1,
                mars: 2,
                avril: 3,
                mai: 4,
                juin: 5,
                juillet: 6,
                août: 7,
                septembre: 8,
                octobre: 9,
                novembre: 10,
                décembre: 11,
              }
            : {
                january: 0,
                february: 1,
                march: 2,
                april: 3,
                may: 4,
                june: 5,
                july: 6,
                august: 7,
                september: 8,
                october: 9,
                november: 10,
                december: 11,
              }

        const month = monthMap[monthText]

        if (month !== undefined && day > 0 && day <= 31 && year > 2000) {
          invoiceDate = new Date(year, month, day)
        }
      }
    }

    return { invoiceDate, dueDate }
  }

  /**
   * Cherche des dates génériques dans le texte et tente de déterminer leur signification
   */
  private findGenericDates(
    text: string,
    existingInvoiceDate: Date | null,
    existingDueDate: Date | null,
    language: string
  ): { invoiceDate: string | null; dueDate: string | null } {
    // On utilise les dates déjà trouvées si elles existent
    let foundInvoiceDate = existingInvoiceDate
    let foundDueDate = existingDueDate

    // PARTIE 1: Recherche des dates au format DD/MM/YYYY ou YYYY-MM-DD
    const datePatterns = [
      // Format JJ/MM/AAAA ou JJ-MM-AAAA
      { pattern: /(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{4})/g, format: 'DMY' },
      // Format ISO AAAA-MM-JJ
      { pattern: /(\d{4})[\/\.-](\d{1,2})[\/\.-](\d{1,2})/g, format: 'YMD' },
    ]

    // Tableau pour stocker toutes les dates trouvées avec leur contexte
    const datesFound: Array<{
      date: Date
      context: string
      position: number
      isInvoiceDate: boolean
      isDueDate: boolean
    }> = []

    const lang = language === 'fr' ? 'fr' : 'en'
    const invoiceTerms =
      lang === 'fr' ? /(?:date|émis|crée|factur)/ : /(?:date|issued|created|invoice)/
    const dueTerms =
      lang === 'fr'
        ? /(?:échéance|due|paie|règlement|paiement|limite)/
        : /(?:due|payment|deadline|pay\s+by)/

    for (const { pattern, format } of datePatterns) {
      let match
      while ((match = pattern.exec(text)) !== null) {
        try {
          const day = Number.parseInt(format === 'DMY' ? match[1] : match[3], 10)
          const month = Number.parseInt(match[2], 10) - 1 // Mois de 0 à 11 en JS
          const year = Number.parseInt(format === 'DMY' ? match[3] : match[1], 10)

          // Vérifier que la date est valide
          if (day > 0 && day <= 31 && month >= 0 && month < 12 && year > 1900 && year < 2100) {
            const date = new Date(year, month, day)

            // Ne considérer que les dates valides
            if (
              date.getDate() === day &&
              date.getMonth() === month &&
              date.getFullYear() === year
            ) {
              // Extraire le contexte (20 caractères avant et après)
              const start = Math.max(0, match.index - 20)
              const end = Math.min(text.length, match.index + match[0].length + 20)
              const context = text.slice(start, end).toLowerCase()

              // Vérifier si c'est potentiellement une date de facture
              const isInvoiceDate = invoiceTerms.test(context) && !dueTerms.test(context)

              // Vérifier si c'est potentiellement une date d'échéance
              const isDueDate = dueTerms.test(context)

              datesFound.push({
                date,
                context,
                position: match.index,
                isInvoiceDate,
                isDueDate,
              })
            }
          }
        } catch (e) {
          // Ignorer les dates invalides
        }
      }
    }

    // PARTIE 2: Attribuer les dates aux bonnes catégories
    // Si nous avons trouvé des dates
    if (datesFound.length > 0) {
      // Trier les dates par ordre chronologique
      datesFound.sort((a, b) => a.date.getTime() - b.date.getTime())

      // 1. D'abord essayer de trouver des dates avec des indices contextuels clairs
      const invoiceDateCandidates = datesFound.filter((d) => d.isInvoiceDate)
      const dueDateCandidates = datesFound.filter((d) => d.isDueDate)

      if (invoiceDateCandidates.length > 0) {
        // Préférer la date la plus ancienne comme date de facture
        foundInvoiceDate = invoiceDateCandidates[0].date
      }

      if (dueDateCandidates.length > 0) {
        // Préférer la date la plus récente comme date d'échéance
        foundDueDate = dueDateCandidates[dueDateCandidates.length - 1].date
      }

      // 2. Si on n'a pas trouvé l'une des dates par le contexte, utiliser l'heuristique
      if (!foundInvoiceDate && datesFound.length > 0) {
        // La date de facture est généralement la plus ancienne
        foundInvoiceDate = datesFound[0].date
      }

      if (!foundDueDate && datesFound.length > 1) {
        // La date d'échéance est généralement plus récente que la date de facture
        // et est souvent 30 jours après la date de facture
        const possibleDueDates = datesFound.filter(
          (d) => foundInvoiceDate && d.date.getTime() > foundInvoiceDate.getTime()
        )

        if (possibleDueDates.length > 0) {
          // Choisir la date future la plus proche
          foundDueDate = possibleDueDates[0].date
        }
      }
    }

    // Convertir en format ISO pour la sortie
    return {
      invoiceDate: foundInvoiceDate ? DateTime.fromJSDate(foundInvoiceDate).toISODate() : null,
      dueDate: foundDueDate ? DateTime.fromJSDate(foundDueDate).toISODate() : null,
    }
  }

  /**
   * S'assure qu'une valeur est un nombre valide
   */
  private ensureValidNumber(value?: number | null): number {
    if (value === undefined || value === null || Number.isNaN(value)) {
      return 0
    }
    return value
  }

  /**
   * Détermine le taux de TVA le plus probable
   */
  private determineMostLikelyVatRate(tvaPcts?: number[] | null): number {
    // Taux standard par défaut
    const defaultRate = 20

    if (!tvaPcts || !Array.isArray(tvaPcts) || tvaPcts.length === 0) {
      return defaultRate
    }

    // Filtrer les taux valides et les regrouper par occurrences
    const validRates = tvaPcts
      .filter((rate) => !Number.isNaN(rate) && rate > 0 && rate <= 30)
      .map((rate) => Math.round(rate))

    if (validRates.length === 0) {
      return defaultRate
    }

    // Compter les occurrences de chaque taux
    const rateFrequency: Record<number, number> = {}
    validRates.forEach((rate) => {
      rateFrequency[rate] = (rateFrequency[rate] || 0) + 1
    })

    // Trouver le taux le plus fréquent
    let mostFrequentRate = defaultRate
    let highestFrequency = 0

    Object.entries(rateFrequency).forEach(([rate, frequency]) => {
      if (
        frequency > highestFrequency ||
        (frequency === highestFrequency && [5, 10, 20].includes(Number(rate)))
      ) {
        mostFrequentRate = Number(rate)
        highestFrequency = frequency
      }
    })

    return mostFrequentRate
  }
}
