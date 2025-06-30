import { InvoiceRepositoryInterface } from '../repositories/invoice_repository_interface.js'

export class DeleteInvoiceUseCase {
  constructor(private invoiceRepository: InvoiceRepositoryInterface) {}

  async execute(id: number): Promise<void> {
    const invoice = await this.invoiceRepository.findById(id)
    if (!invoice) {
      throw new Error(`Invoice with id ${id} not found`)
    }
    
    await this.invoiceRepository.delete(id)
  }
}