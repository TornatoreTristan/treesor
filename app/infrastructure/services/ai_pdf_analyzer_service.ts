import logger from '@adonisjs/core/services/logger'
import { PdfAnalyzerServiceInterface } from '../../domain/core/services/pdf_analyzer_service_interface.js'
// @ts-ignore
import PDFParser from 'pdf2json'

/**
 * ANALYSEUR PDF INTELLIGENT AVEC IA
 * Utilise OpenAI GPT-4o pour analyser intelligemment le contenu des factures
 */
export class AiPdfAnalyzerService implements PdfAnalyzerServiceInterface {
  private openaiApiKey: string

  constructor() {
    this.openaiApiKey = process.env.OPENAI_API_KEY || ''
    if (!this.openaiApiKey) {
      throw new Error("OPENAI_API_KEY manquante dans les variables d'environnement")
    }
  }

  async analyzePdf(filePath: string): Promise<Record<string, any>> {
    try {
      logger.info(`🤖 ANALYSE IA: ${filePath}`)

      // 1. Extraire le texte brut du PDF
      const rawText = await this.extractRawText(filePath)
      logger.info(`📄 Texte extrait: ${rawText.length} caractères`)

      // 2. Analyser avec OpenAI GPT-4o
      const analysisResult = await this.analyzeWithAI(rawText)

      logger.info(`✅ ANALYSE TERMINÉE: ${JSON.stringify(analysisResult, null, 2)}`)
      return analysisResult
    } catch (error) {
      logger.error(`❌ ERREUR ANALYSE IA: ${error}`)
      throw error
    }
  }

  /**
   * Extraire le texte brut du PDF
   */
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
          resolve(textContent.trim())
        } catch (error) {
          reject(error)
        }
      })

      pdfParser.loadPDF(filePath)
    })
  }

  /**
   * Analyser le texte avec OpenAI GPT-4o
   */
  private async analyzeWithAI(textContent: string): Promise<Record<string, any>> {
    const prompt = `
Analyse cette facture et extrait les informations suivantes au format JSON exact.

TEXTE DE LA FACTURE:
${textContent}

INSTRUCTIONS:
- Trouve le numéro de facture (peut être au format 202506-31, 3AF9A171-23856, 2380531851, etc.)
- Trouve les montants HT, TTC, TVA (peut être en €, avec virgule comme 600,00 ou point comme 600.00)
- Trouve le taux de TVA (généralement 20%, 5.5%, 10%, etc.)
- Trouve les dates (format DD/MM/YYYY ou similaire)
- Si un montant manque, calcule-le à partir des autres

RÉPONDS UNIQUEMENT avec ce JSON (sans texte supplémentaire):
{
  "invoiceNumber": "numéro trouvé ou null",
  "amountHT": "montant HT trouvé (format: 123.45)",
  "amountTTC": "montant TTC trouvé (format: 123.45)", 
  "vatAmount": "montant TVA trouvé ou calculé (format: 123.45)",
  "vatRate": "taux TVA trouvé ou calculé (format: 20)",
  "invoiceDate": "date facture (format: DD/MM/YYYY) ou null",
  "dueDate": "date échéance (format: DD/MM/YYYY) ou null"
}
`

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content:
                'Tu es un expert comptable qui analyse des factures. Tu extrais toujours les données au format JSON exact demandé.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0, // Pour des résultats déterministes
          max_tokens: 500,
        }),
      })

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`)
      }

      const data: any = await response.json()
      const aiResponse = data.choices[0].message.content.trim()

      logger.info(`🤖 Réponse IA brute: ${aiResponse}`)

      // Parser la réponse JSON
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error('Réponse IA invalide - pas de JSON trouvé')
      }

      const result = JSON.parse(jsonMatch[0])

      // Validation et nettoyage des données
      return this.validateAndCleanResult(result)
    } catch (error) {
      logger.error(`❌ Erreur OpenAI: ${error}`)
      throw new Error(`Analyse IA échouée: ${error}`)
    }
  }

  /**
   * Valider et nettoyer les résultats de l'IA
   */
  private validateAndCleanResult(result: any): Record<string, any> {
    const cleaned: Record<string, any> = {}

    // Numéro de facture
    if (result.invoiceNumber && result.invoiceNumber !== 'null') {
      cleaned.invoiceNumber = result.invoiceNumber.toString()
    }

    // Montants - convertir en nombres
    if (result.amountHT && result.amountHT !== 'null') {
      cleaned.amountHT = this.parseAmount(result.amountHT)
    }
    if (result.amountTTC && result.amountTTC !== 'null') {
      cleaned.amountTTC = this.parseAmount(result.amountTTC)
    }
    if (result.vatAmount && result.vatAmount !== 'null') {
      cleaned.vatAmount = this.parseAmount(result.vatAmount)
    }
    if (result.vatRate && result.vatRate !== 'null') {
      cleaned.vatRate = this.parseAmount(result.vatRate)
    }

    // Dates
    if (result.invoiceDate && result.invoiceDate !== 'null') {
      cleaned.invoiceDate = result.invoiceDate
    }
    if (result.dueDate && result.dueDate !== 'null') {
      cleaned.dueDate = result.dueDate
    }

    // Calculs de vérification
    this.verifyCalculations(cleaned)

    return cleaned
  }

  /**
   * Parser un montant (gérer virgule/point décimal)
   */
  private parseAmount(value: any): number {
    if (typeof value === 'number') return value
    if (!value) return 0

    const str = value.toString().replace(',', '.')
    const num = Number.parseFloat(str)
    return Number.isNaN(num) ? 0 : num
  }

  /**
   * Vérifier et corriger les calculs
   */
  private verifyCalculations(data: any): void {
    const ht = data.amountHT || 0
    const ttc = data.amountTTC || 0
    const tva = data.vatAmount || 0

    // Si on a HT et TTC, recalculer TVA
    if (ht > 0 && ttc > 0) {
      const calculatedTVA = ttc - ht
      if (Math.abs(calculatedTVA - tva) > 0.02) {
        data.vatAmount = Number.parseFloat(calculatedTVA.toFixed(2))
        data.vatRate = Math.round((calculatedTVA / ht) * 100)
        logger.info(`🔧 TVA recalculée: ${data.vatAmount} (${data.vatRate}%)`)
      }
    }

    // Si on a HT et TVA, recalculer TTC
    else if (ht > 0 && tva > 0 && ttc === 0) {
      data.amountTTC = Number.parseFloat((ht + tva).toFixed(2))
      logger.info(`🔧 TTC recalculé: ${data.amountTTC}`)
    }

    // Si on a TTC et TVA, recalculer HT
    else if (ttc > 0 && tva > 0 && ht === 0) {
      data.amountHT = Number.parseFloat((ttc - tva).toFixed(2))
      logger.info(`🔧 HT recalculé: ${data.amountHT}`)
    }
  }
}
