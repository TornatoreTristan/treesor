import { PdfAnalyzerServiceInterface } from '../../domain/core/services/pdf_analyzer_service_interface.js'
import logger from '@adonisjs/core/services/logger'
import { DateTime } from 'luxon'
import PDFParser from 'pdf2json'
import { SmartAmountExtractor } from './smart_amount_extractor.js'

/**
 * Service d'analyse PDF amélioré avec extracteur intelligent
 */
export class ImprovedPdfAnalyzerService implements PdfAnalyzerServiceInterface {
  private extractionCache: Map<string, string> = new Map()
  private smartExtractor = new SmartAmountExtractor()

  /**
   * Analyse un fichier PDF pour en extraire les informations pertinentes
   */
  async analyzePdf(filePath: string): Promise<Record<string, any>> {
    try {
      logger.info(`🚀 Analyse PDF améliorée: ${filePath}`)

      // 1. Extraire le texte du PDF
      const textContent = await this.extractTextFromPdf(filePath)
      logger.info(`📄 Texte extrait (${textContent?.length || 0} caractères)`)

      // Vérifier que le texte a été extrait
      if (!textContent || textContent.trim().length === 0) {
        throw new Error("Impossible d'extraire le texte du PDF")
      }

      // 2. Normaliser le texte pour améliorer l'extraction
      const normalizedText = this.normalizeText(textContent)

      // 3. Détecter la langue du document
      const language = this.detectLanguage(normalizedText)
      logger.info(`🌍 Langue détectée: ${language}`)

      // 4. Extraction INTELLIGENTE des montants avec le nouvel extracteur
      logger.info("💰 Utilisation de l'extracteur intelligent...")
      const smartAmountResult = this.smartExtractor.extractAmounts(normalizedText)

      // 5. Extraction des autres informations
      const extractionResult: Record<string, any> = {}

      // Montants (utiliser les résultats de l'extracteur intelligent)
      if (smartAmountResult.amountHT) {
        extractionResult.amountHT = smartAmountResult.amountHT.toString()
      }
      if (smartAmountResult.amountTTC) {
        extractionResult.amountTTC = smartAmountResult.amountTTC.toString()
      }
      if (smartAmountResult.vatRate) {
        extractionResult.vatRate = smartAmountResult.vatRate.toString()
      }
      if (smartAmountResult.vatAmount) {
        extractionResult.vatAmount = smartAmountResult.vatAmount.toString()
      }

      // Numéro de facture
      extractionResult.invoiceNumber = this.extractInvoiceNumber(normalizedText, language)

      // Dates
      const dates = this.extractDates(normalizedText, language)
      if (dates) {
        extractionResult.invoiceDate = dates.invoiceDate
        extractionResult.dueDate = dates.dueDate
      }

      // Informations de confiance
      extractionResult.confidence = smartAmountResult.confidence
      extractionResult.detectedAmounts = smartAmountResult.detectedAmounts

      logger.info(`✅ Extraction terminée avec confiance: ${smartAmountResult.confidence}%`)
      logger.info(`📊 Résultat: ${JSON.stringify(extractionResult, null, 2)}`)

      return extractionResult
    } catch (error) {
      logger.error(`❌ Erreur lors de l'analyse du PDF: ${error}`)
      throw error
    }
  }

  /**
   * Extraction de texte du PDF avec pdf2json
   */
  private async extractTextFromPdf(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const pdfParser = new PDFParser()

      pdfParser.on('pdfParser_dataError', (errData: any) => {
        logger.error(`Erreur lors du parsing PDF: ${errData.parserError}`)
        reject(new Error(`Erreur de parsing PDF: ${errData.parserError}`))
      })

      pdfParser.on('pdfParser_dataReady', (pdfData: any) => {
        try {
          let text = ''

          if (pdfData.Pages) {
            for (const page of pdfData.Pages) {
              if (page.Texts) {
                for (const textItem of page.Texts) {
                  if (textItem.R) {
                    for (const textRun of textItem.R) {
                      if (textRun.T) {
                        text += decodeURIComponent(textRun.T) + ' '
                      }
                    }
                  }
                }
              }
            }
          }

          resolve(text.trim())
        } catch (error) {
          reject(new Error(`Erreur lors de l'extraction du texte: ${error}`))
        }
      })

      pdfParser.loadPDF(filePath)
    })
  }

  /**
   * Normalise le texte pour améliorer l'extraction
   */
  private normalizeText(text: string): string {
    // Vérification de sécurité
    if (!text || typeof text !== 'string') {
      logger.warn('⚠️ Texte vide ou invalide fourni à normalizeText')
      return ''
    }

    return (
      text
        // Normaliser les espaces
        .replace(/\s+/g, ' ')
        // Normaliser les séparateurs de nombres
        .replace(/(\d)\s+(\d)/g, '$1$2')
        // Normaliser les virgules et points décimaux
        .replace(/(\d),(\d{2})(?!\d)/g, '$1.$2')
        // Normaliser les devises
        .replace(/€/g, ' EUR ')
        .replace(/\$/g, ' USD ')
        .replace(/£/g, ' GBP ')
        .trim()
    )
  }

  /**
   * Détecte la langue du document
   */
  private detectLanguage(text: string): 'fr' | 'en' {
    const frenchKeywords = [
      'facture',
      'montant',
      'tva',
      'total',
      'ht',
      'ttc',
      'émission',
      'échéance',
    ]
    const englishKeywords = ['invoice', 'amount', 'vat', 'total', 'subtotal', 'tax', 'due', 'date']

    const textLower = text.toLowerCase()
    const frenchScore = frenchKeywords.reduce(
      (score, keyword) => score + (textLower.includes(keyword) ? 1 : 0),
      0
    )
    const englishScore = englishKeywords.reduce(
      (score, keyword) => score + (textLower.includes(keyword) ? 1 : 0),
      0
    )

    return frenchScore >= englishScore ? 'fr' : 'en'
  }

  /**
   * Extraction améliorée du numéro de facture
   */
  private extractInvoiceNumber(text: string, language: 'fr' | 'en'): string | null {
    const patterns =
      language === 'fr'
        ? [
            // Patterns français optimisés pour votre facture
            /Facture\s+(\d{6}-\d{2})/i, // Facture 202506-30
            /(?:Facture|N°)\s*(?:n°|numéro|num)?\s*[:\-\s]*([A-Z0-9\-\/]{3,20})/i,
            /Numéro\s+(?:de\s+)?facture\s*[:\-\s]*([A-Z0-9\-\/]{3,20})/i,
            /Référence\s*[:\-\s]*([A-Z0-9\-\/]{3,20})/i,
            /Invoice\s*[:\-\s]*([A-Z0-9\-\/]{3,20})/i, // Fallback anglais
          ]
        : [
            // Patterns anglais optimisés
            /Invoice\s*(?:Number|No|#)?\s*[:\-\s]*([A-Z0-9\-\/]{3,20})/i,
            /Invoice\s+Reference\s*[:\-\s]*([A-Z0-9\-\/]{3,20})/i,
            /Reference\s*[:\-\s]*([A-Z0-9\-\/]{3,20})/i,
            /Facture\s*[:\-\s]*([A-Z0-9\-\/]{3,20})/i, // Fallback français
          ]

    for (const pattern of patterns) {
      const match = text.match(pattern)
      if (match && match[1]) {
        const invoiceNumber = match[1].trim()
        // Valider que ce n'est pas une date ou un autre nombre
        if (!/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/.test(invoiceNumber)) {
          logger.info(`🎯 Numéro de facture trouvé: ${invoiceNumber}`)
          return invoiceNumber
        }
      }
    }

    return null
  }

  /**
   * Extraction des dates améliorée pour votre type de facture
   */
  private extractDates(
    text: string,
    language: 'fr' | 'en'
  ): {
    invoiceDate: string | null
    dueDate: string | null
  } | null {
    const result = {
      invoiceDate: null as string | null,
      dueDate: null as string | null,
    }

    // Patterns pour les dates françaises (comme dans votre facture)
    const datePatterns =
      language === 'fr'
        ? [
            /Émise?\s+le\s+(\d{1,2})\/(\d{1,2})\/(\d{4})/i, // Émise le 24/06/2025
            /Date\s+(?:de\s+)?facture\s*[:\s]*(\d{1,2})\/(\d{1,2})\/(\d{4})/i,
            /Date\s+d['']émission\s*[:\s]*(\d{1,2})\/(\d{1,2})\/(\d{4})/i,
            /(\d{1,2})\/(\d{1,2})\/(\d{4})/g, // Format simple DD/MM/YYYY
          ]
        : [
            /Invoice\s+Date\s*[:\s]*(\d{1,2})\/(\d{1,2})\/(\d{4})/i,
            /Date\s*[:\s]*(\d{1,2})\/(\d{1,2})\/(\d{4})/i,
            /Issued\s+on\s*[:\s]*(\d{1,2})\/(\d{1,2})\/(\d{4})/i,
          ]

    // Extraire la première date trouvée comme date de facture
    for (const pattern of datePatterns) {
      const match = text.match(pattern)
      if (match) {
        const day = Number.parseInt(match[1], 10)
        const month = Number.parseInt(match[2], 10)
        const year = Number.parseInt(match[3], 10)

        if (this.isValidDate(day, month, year)) {
          const date = DateTime.fromObject({ day, month, year })
          result.invoiceDate = date.toISODate()
          logger.info(`🗓️ Date de facture trouvée: ${result.invoiceDate}`)
          break
        }
      }
    }

    // Chercher date d'échéance
    const dueDatePatterns = [
      /(?:Date\s+d[''])?échéance[^\d]*(\d{1,2})\/(\d{1,2})\/(\d{4})/i,
      /Due\s+date[^\d]*(\d{1,2})\/(\d{1,2})\/(\d{4})/i,
    ]

    for (const pattern of dueDatePatterns) {
      const match = text.match(pattern)
      if (match) {
        const day = Number.parseInt(match[1], 10)
        const month = Number.parseInt(match[2], 10)
        const year = Number.parseInt(match[3], 10)

        if (this.isValidDate(day, month, year)) {
          const date = DateTime.fromObject({ day, month, year })
          result.dueDate = date.toISODate()
          logger.info(`📅 Date d'échéance trouvée: ${result.dueDate}`)
          break
        }
      }
    }

    return result.invoiceDate ? result : null
  }

  /**
   * Valide si une date est correcte
   */
  private isValidDate(day: number, month: number, year: number): boolean {
    if (day < 1 || day > 31 || month < 1 || month > 12 || year < 2000 || year > 2030) {
      return false
    }

    const date = new Date(year, month - 1, day)
    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
  }
}
