import { PdfAnalyzerServiceInterface } from '../../core/services/pdf_analyzer_service_interface.js'
import { InvoiceEntity } from '../entities/invoice_entity.js'
import { DateTime } from 'luxon'

export interface InvoiceAnalysisResult {
  invoiceData: Partial<InvoiceEntity>
  confidenceScore: number
  recognizedFields: string[]
}

export class AnalyzeInvoicePdfUseCase {
  constructor(private pdfAnalyzerService: PdfAnalyzerServiceInterface) {}

  /**
   * Analyse un PDF de facture pour en extraire les informations pertinentes
   * @param filePath Chemin du fichier PDF à analyser
   * @returns Les données extraites formatées pour une entité Invoice
   */
  async execute(filePath: string): Promise<InvoiceAnalysisResult> {
    // Utiliser le service pour extraire les données brutes du PDF
    const rawData = await this.pdfAnalyzerService.analyzePdf(filePath)

    // Initialiser les données d'analyse
    const invoiceData: Partial<InvoiceEntity> = {}
    const recognizedFields: string[] = []
    let confidenceScore = 0

    // Traiter le numéro de facture
    if (rawData.invoiceNumber) {
      invoiceData.number = rawData.invoiceNumber
      recognizedFields.push('number')
      confidenceScore += 0.1
    }

    // Traiter les montants
    if (rawData.amountHT) {
      invoiceData.amountHT = Number.parseFloat(rawData.amountHT)
      recognizedFields.push('amountHT')
      confidenceScore += 0.15
    }

    if (rawData.amountTTC) {
      invoiceData.amountTTC = Number.parseFloat(rawData.amountTTC)
      recognizedFields.push('amountTTC')
      confidenceScore += 0.15
    }

    if (rawData.vatRate) {
      invoiceData.vatRate = Number.parseFloat(rawData.vatRate)
      recognizedFields.push('vatRate')
      confidenceScore += 0.1
    }

    if (rawData.vatAmount) {
      invoiceData.vatAmount = Number.parseFloat(rawData.vatAmount)
      recognizedFields.push('vatAmount')
      confidenceScore += 0.1
    }

    // Traiter les dates
    if (rawData.invoiceDate) {
      invoiceData.date = DateTime.fromISO(rawData.invoiceDate)
      recognizedFields.push('date')
      confidenceScore += 0.15
    }

    if (rawData.dueDate) {
      invoiceData.dueDate = DateTime.fromISO(rawData.dueDate)
      recognizedFields.push('dueDate')
      confidenceScore += 0.1
    }

    // Traiter les informations sur le fournisseur (si disponibles)
    if (rawData.vendorId) {
      invoiceData.vendorId = Number.parseInt(rawData.vendorId)
      recognizedFields.push('vendorId')
      confidenceScore += 0.15
    }

    // Normaliser le score de confiance entre 0 et 1
    confidenceScore = Math.min(confidenceScore, 1)

    return {
      invoiceData,
      confidenceScore,
      recognizedFields,
    }
  }
}
