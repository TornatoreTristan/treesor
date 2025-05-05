import { InvoiceEntity } from '../entities/invoice_entity.js'
import { InvoiceRepositoryInterface } from '../repositories/invoice_repository_interface.js'
import { DriveServiceInterface } from '../../core/services/drive_service_interface.js'

export interface InvoiceFileData {
  clientName: string
  tmpPath: string
  size: number
  type: string
}

export class UploadInvoiceFileUseCase {
  constructor(
    private invoiceRepository: InvoiceRepositoryInterface,
    private driveService: DriveServiceInterface
  ) {}

  async execute(
    fileData: InvoiceFileData,
    invoiceData: Partial<InvoiceEntity> & { amountHT: number; amountTTC: number },
    userId: string
  ): Promise<InvoiceEntity> {
    // Validation des données
    if (!fileData.clientName || !fileData.tmpPath) {
      throw new Error('Les informations du fichier sont incomplètes')
    }

    if (!invoiceData.amountHT || !invoiceData.amountTTC) {
      throw new Error('Les montants HT et TTC sont obligatoires')
    }

    // Génération d'un nom de fichier unique pour la facture
    const uniquePrefix = new Date().getTime()
    const fileName = `${uniquePrefix}_${fileData.clientName}`
    const filePath = `invoices/${fileName}`

    // Upload du fichier
    const fileUrl = await this.driveService.uploadFile(filePath, fileData.tmpPath)

    // Création de l'entité de facture avec les informations du fichier
    const invoice: InvoiceEntity = {
      userId: userId,
      assignId: invoiceData.assignId || userId,
      documentUrl: fileUrl,
      originalName: fileData.clientName,
      mimeType: fileData.type,
      size: fileData.size,
      type: invoiceData.type || 'invoice',
      status: invoiceData.status || 'pending',
      amountHT: invoiceData.amountHT,
      amountTTC: invoiceData.amountTTC,
      vatRate: invoiceData.vatRate || 0,
      vatAmount: invoiceData.vatAmount || 0,
      isDoublon: false,
      // Ajout des autres propriétés optionnelles
      number: invoiceData.number,
      notes: invoiceData.notes,
      date: invoiceData.date,
      dueDate: invoiceData.dueDate,
      categoryId: invoiceData.categoryId,
      vendorId: invoiceData.vendorId,
      bankStatementId: invoiceData.bankStatementId,
    }

    // Enregistrement en BDD
    return await this.invoiceRepository.create(invoice)
  }
}
