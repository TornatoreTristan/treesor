import { InvoiceRepositoryInterface } from '../repositories/invoice_repository_interface.js'
import { InvoiceEntity } from '../entities/invoice_entity.js'

export class FetchInvoiceUseCase {
  constructor(private invoiceRepository: InvoiceRepositoryInterface) {}

  async execute(id: number): Promise<InvoiceEntity> {
    const invoice = await this.invoiceRepository.findById(id)
    if (!invoice) {
      throw new Error(`Invoice with id ${id} not found`)
    }
    return invoice
  }
}
