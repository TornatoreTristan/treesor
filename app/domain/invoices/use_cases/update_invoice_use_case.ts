import { InvoiceRepositoryInterface, UpdateInvoiceData } from '../repositories/invoice_repository_interface.js'
import { InvoiceEntity } from '../entities/invoice_entity.js'

export class UpdateInvoiceUseCase {
  constructor(private invoiceRepository: InvoiceRepositoryInterface) {}

  async execute(id: number, data: UpdateInvoiceData): Promise<InvoiceEntity> {
    const invoice = await this.invoiceRepository.findById(id)
    if (!invoice) {
      throw new Error(`Invoice with id ${id} not found`)
    }
    
    return await this.invoiceRepository.update(id, data)
  }
}