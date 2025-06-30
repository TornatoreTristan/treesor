import { InvoiceRepositoryInterface } from '../repositories/invoice_repository_interface.js'
import { InvoiceEntity } from '../entities/invoice_entity.js'

export class FetchAllInvoicesUseCase {
  constructor(private invoiceRepository: InvoiceRepositoryInterface) {}

  async execute(userId?: string): Promise<InvoiceEntity[]> {
    if (userId) {
      return await this.invoiceRepository.findByUserId(userId)
    }
    return await this.invoiceRepository.findAll()
  }
}