import { PdfAnalyzerServiceInterface } from '../../core/services/pdf_analyzer_service_interface.js'
import { InvoiceEntity } from '../entities/invoice_entity.js'
import { DateTime } from 'luxon'

export interface InvoiceAnalysisResult {
  invoiceData: Partial<InvoiceEntity>
  confidenceScore: number
  recognizedFields: string[]
  errors: string[]
}

export class AnalyzeInvoicePdfUseCase {
  constructor(private pdfAnalyzerService: PdfAnalyzerServiceInterface) {}

  /**
   * Analyse un PDF de facture pour en extraire les informations pertinentes
   * @param filePath Chemin du fichier PDF à analyser
   * @returns Les données extraites formatées pour une entité Invoice
   */
  async execute(filePath: string): Promise<InvoiceAnalysisResult> {
    try {
      // Utiliser le service pour extraire les données brutes du PDF
      const rawData = await this.pdfAnalyzerService.analyzePdf(filePath)

      // Initialiser les données d'analyse
      const invoiceData: Partial<InvoiceEntity> = {}
      const recognizedFields: string[] = []
      const errors: string[] = []
      let confidenceScore = 0

      // Traiter le numéro de facture
      if (rawData.invoiceNumber) {
        invoiceData.number = rawData.invoiceNumber
        recognizedFields.push('number')
        confidenceScore += 0.2
      } else {
        errors.push('Numéro de facture non trouvé')
      }

      // Traiter les montants avec une meilleure validation
      try {
        if (rawData.amountHT) {
          const amountHT = this.parseAmount(rawData.amountHT)
          if (amountHT > 0) {
            invoiceData.amountHT = amountHT
            recognizedFields.push('amountHT')
            confidenceScore += 0.25
          } else {
            errors.push('Montant HT invalide')
          }
        }

        if (rawData.amountTTC) {
          const amountTTC = this.parseAmount(rawData.amountTTC)
          if (amountTTC > 0) {
            invoiceData.amountTTC = amountTTC
            recognizedFields.push('amountTTC')
            confidenceScore += 0.25
          } else {
            errors.push('Montant TTC invalide')
          }
        }

        if (rawData.vatRate) {
          const vatRate = this.parseAmount(rawData.vatRate)
          if (vatRate > 0 && vatRate <= 100) {
            invoiceData.vatRate = vatRate
            recognizedFields.push('vatRate')
            confidenceScore += 0.15
          } else {
            errors.push('Taux de TVA invalide')
          }
        }

        if (rawData.vatAmount) {
          const vatAmount = this.parseAmount(rawData.vatAmount)
          if (vatAmount >= 0) {
            invoiceData.vatAmount = vatAmount
            recognizedFields.push('vatAmount')
            confidenceScore += 0.1
          } else {
            errors.push('Montant TVA invalide')
          }
        }

        // Validation et calcul des montants manquants
        this.validateAndCalculateAmounts(invoiceData, errors)
      } catch (error) {
        errors.push(`Erreur lors du traitement des montants: ${error}`)
      }

      // Traiter les dates avec une meilleure validation
      try {
        if (rawData.invoiceDate) {
          const invoiceDate = this.parseDate(rawData.invoiceDate)
          if (invoiceDate && invoiceDate.isValid) {
            invoiceData.date = invoiceDate
            recognizedFields.push('date')
            confidenceScore += 0.15
          } else {
            errors.push('Date de facture invalide')
          }
        }

        if (rawData.dueDate) {
          const dueDate = this.parseDate(rawData.dueDate)
          if (dueDate && dueDate.isValid) {
            invoiceData.dueDate = dueDate
            recognizedFields.push('dueDate')
            confidenceScore += 0.1
          } else {
            errors.push("Date d'échéance invalide")
          }
        }
      } catch (error) {
        errors.push(`Erreur lors du traitement des dates: ${error}`)
      }

      // Traiter les informations sur le fournisseur (si disponibles)
      if (rawData.vendorId) {
        try {
          const vendorId = Number.parseInt(rawData.vendorId.toString())
          if (!Number.isNaN(vendorId) && vendorId > 0) {
            invoiceData.vendorId = vendorId
            recognizedFields.push('vendorId')
            confidenceScore += 0.1
          }
        } catch (error) {
          errors.push('ID fournisseur invalide')
        }
      }

      // Normaliser le score de confiance entre 0 et 1
      confidenceScore = Math.min(confidenceScore, 1)

      // Ajuster le score en fonction des erreurs
      if (errors.length > 0) {
        confidenceScore *= Math.max(0.3, 1 - errors.length * 0.15)
      }

      return {
        invoiceData,
        confidenceScore: Math.round(confidenceScore * 100) / 100,
        recognizedFields,
        errors,
      }
    } catch (error) {
      return {
        invoiceData: {},
        confidenceScore: 0,
        recognizedFields: [],
        errors: [`Erreur fatale lors de l'analyse: ${error}`],
      }
    }
  }

  /**
   * Parse un montant en gérant différents formats
   */
  private parseAmount(value: any): number {
    if (typeof value === 'number') return value
    if (typeof value !== 'string') return 0

    // Nettoyer le string
    const cleaned = value
      .toString()
      .replace(/[^\d.,\-]/g, '') // Garder seulement les chiffres, virgules, points et moins
      .replace(/\s/g, '') // Supprimer les espaces

    if (!cleaned) return 0

    // Gérer les formats français (virgule décimale)
    if (/,\d{2}$/.test(cleaned)) {
      return Number.parseFloat(cleaned.replace(',', '.'))
    }

    // Format anglais/international
    return Number.parseFloat(cleaned) || 0
  }

  /**
   * Parse une date en gérant différents formats
   */
  private parseDate(value: any): DateTime | null {
    if (!value) return null

    try {
      if (typeof value === 'string') {
        // Essayer le format ISO d'abord
        if (value.includes('-')) {
          const isoDate = DateTime.fromISO(value)
          if (isoDate.isValid) return isoDate
        }

        // Essayer les formats français DD/MM/YYYY
        if (value.includes('/')) {
          const parts = value.split('/')
          if (parts.length === 3) {
            const day = Number.parseInt(parts[0], 10)
            const month = Number.parseInt(parts[1], 10)
            const year = Number.parseInt(parts[2], 10)

            const date = DateTime.fromObject({ day, month, year })
            if (date.isValid) return date
          }
        }

        // Essayer d'autres formats
        const luxonDate = DateTime.fromFormat(value, 'dd/MM/yyyy')
        if (luxonDate.isValid) return luxonDate
      }

      // Si c'est déjà un objet DateTime
      if (value instanceof DateTime) {
        return value.isValid ? value : null
      }

      // Si c'est une Date JS
      if (value instanceof Date) {
        return DateTime.fromJSDate(value)
      }
    } catch (error) {
      console.warn(`Erreur lors du parsing de la date: ${value}`, error)
    }

    return null
  }

  /**
   * Valide et calcule les montants manquants
   */
  private validateAndCalculateAmounts(invoiceData: Partial<InvoiceEntity>, errors: string[]): void {
    const { amountHT, amountTTC, vatRate = 20, vatAmount } = invoiceData

    try {
      // Si on a HT et TTC, calculer la TVA
      if (amountHT && amountTTC) {
        if (amountTTC < amountHT) {
          // Probable inversion, corriger
          const temp = amountHT
          invoiceData.amountHT = amountTTC
          invoiceData.amountTTC = temp
          invoiceData.vatAmount = temp - amountTTC
          invoiceData.vatRate = Math.round(((temp - amountTTC) / amountTTC) * 100)
        } else {
          invoiceData.vatAmount = Math.round((amountTTC - amountHT) * 100) / 100
          invoiceData.vatRate = Math.round(((amountTTC - amountHT) / amountHT) * 100)
        }
      }
      // Si on a seulement HT et taux, calculer TTC
      else if (amountHT && vatRate) {
        invoiceData.vatAmount = Math.round(((amountHT * vatRate) / 100) * 100) / 100
        invoiceData.amountTTC = Math.round((amountHT + invoiceData.vatAmount) * 100) / 100
      }
      // Si on a seulement TTC et taux, calculer HT
      else if (amountTTC && vatRate) {
        invoiceData.vatAmount = Math.round(((amountTTC * vatRate) / (100 + vatRate)) * 100) / 100
        invoiceData.amountHT = Math.round((amountTTC - invoiceData.vatAmount) * 100) / 100
      }
      // Si on a HT et montant TVA
      else if (amountHT && vatAmount) {
        invoiceData.amountTTC = Math.round((amountHT + vatAmount) * 100) / 100
        invoiceData.vatRate = Math.round((vatAmount / amountHT) * 100)
      }
      // Si on a TTC et montant TVA
      else if (amountTTC && vatAmount) {
        invoiceData.amountHT = Math.round((amountTTC - vatAmount) * 100) / 100
        invoiceData.vatRate = Math.round((vatAmount / invoiceData.amountHT) * 100)
      }

      // Validation finale des montants
      if (invoiceData.amountHT && invoiceData.amountHT <= 0) {
        errors.push('Montant HT calculé invalide')
        delete invoiceData.amountHT
      }
      if (invoiceData.amountTTC && invoiceData.amountTTC <= 0) {
        errors.push('Montant TTC calculé invalide')
        delete invoiceData.amountTTC
      }
      if (invoiceData.vatRate && (invoiceData.vatRate < 0 || invoiceData.vatRate > 100)) {
        errors.push('Taux de TVA calculé invalide')
        invoiceData.vatRate = 20 // Valeur par défaut
      }
    } catch (error) {
      errors.push(`Erreur lors des calculs de montants: ${error}`)
    }
  }
}
