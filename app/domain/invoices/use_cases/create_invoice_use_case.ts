import { InvoiceRepositoryInterface, CreateInvoiceData } from '../repositories/invoice_repository_interface.js'
import { InvoiceEntity } from '../entities/invoice_entity.js'

export class CreateInvoiceUseCase {
  constructor(private invoiceRepository: InvoiceRepositoryInterface) {}

  async execute(data: CreateInvoiceData): Promise<InvoiceEntity> {
    return await this.invoiceRepository.create(data)
  }
}