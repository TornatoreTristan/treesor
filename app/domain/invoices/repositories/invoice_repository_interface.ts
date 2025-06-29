import { InvoiceEntity } from '#entities/invoice_entity'

export interface InvoiceRepositoryInterface {
  findAll(): Promise<InvoiceEntity[]>
  findById(id: number): Promise<InvoiceEntity | null>
  create(invoice: InvoiceEntity): Promise<InvoiceEntity>
  update(id: number, invoice: Partial<InvoiceEntity>): Promise<InvoiceEntity>
  delete(id: number): Promise<void>
}
