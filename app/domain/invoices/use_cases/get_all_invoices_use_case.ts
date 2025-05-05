import { InvoiceEntity } from '../entities/invoice_entity.js'
import { InvoiceRepositoryInterface } from '../repositories/invoice_repository_interface.js'

export class GetAllInvoicesUseCase {
  constructor(private invoiceRepository: InvoiceRepositoryInterface) {}

  async execute(): Promise<InvoiceEntity[]> {
    return await this.invoiceRepository.findAll()
  }
}
