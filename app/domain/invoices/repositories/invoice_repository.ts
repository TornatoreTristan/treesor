import Invoice from '#models/invoice'
import { DateTime } from 'luxon'
import { InvoiceEntity } from '#entities/invoice_entity'
import { InvoiceRepositoryInterface } from '#domain/invoices/repositories/invoice_repository_interface'

export class InvoiceRepository implements InvoiceRepositoryInterface {
  async findAll(): Promise<InvoiceEntity[]> {
    const invoices = await Invoice.query()
      .preload('category')
      .preload('vendor')
      .orderBy('createdAt', 'desc')

    return invoices.map((invoice) => this.mapToEntity(invoice))
  }

  async findById(id: number): Promise<InvoiceEntity | null> {
    const invoice = await Invoice.query()
      .where('id', id)
      .preload('category')
      .preload('vendor')
      .first()

    if (!invoice) return null

    return this.mapToEntity(invoice)
  }

  async create(invoiceData: InvoiceEntity): Promise<InvoiceEntity> {
    const adaptedData = { ...invoiceData }

    if (typeof adaptedData.date === 'string') {
      adaptedData.date = DateTime.fromISO(adaptedData.date)
    }

    if (typeof adaptedData.dueDate === 'string') {
      adaptedData.dueDate = DateTime.fromISO(adaptedData.dueDate)
    }

    const invoice = await Invoice.create(adaptedData as any)
    return this.mapToEntity(invoice)
  }

  async update(id: number, invoiceData: Partial<InvoiceEntity>): Promise<InvoiceEntity> {
    const invoice = await Invoice.findOrFail(id)

    const adaptedData = { ...invoiceData }

    if (typeof adaptedData.date === 'string') {
      adaptedData.date = DateTime.fromISO(adaptedData.date)
    }

    if (typeof adaptedData.dueDate === 'string') {
      adaptedData.dueDate = DateTime.fromISO(adaptedData.dueDate)
    }

    invoice.merge(adaptedData as any)
    await invoice.save()
    await invoice.refresh()
    return this.mapToEntity(invoice)
  }

  async delete(id: number): Promise<void> {
    const invoice = await Invoice.findOrFail(id)
    await invoice.delete()
  }

  private mapToEntity(invoice: Invoice): InvoiceEntity {
    return {
      id: invoice.id,
      number: invoice.number,
      userId: invoice.userId,
      assignId: invoice.assignId,
      documentUrl: invoice.documentUrl,
      originalName: invoice.originalName,
      mimeType: invoice.mimeType,
      size: invoice.size,
      type: invoice.type,
      status: invoice.status,
      amountHT: invoice.amountHT,
      amountTTC: invoice.amountTTC,
      vatRate: invoice.vatRate,
      vatAmount: invoice.vatAmount,
      notes: invoice.notes,
      date: invoice.date,
      dueDate: invoice.dueDate,
      isDoublon: invoice.isDoublon,
      categoryId: invoice.categoryId,
      vendorId: invoice.vendorId,
      bankStatementId: invoice.bankStatementId,
      category: invoice.category
        ? {
            id: invoice.category.id,
            name: invoice.category.name,
          }
        : null,
      vendor: invoice.vendor
        ? {
            id: invoice.vendor.id,
            name: invoice.vendor.name,
          }
        : null,
      createdAt: invoice.createdAt,
      updatedAt: invoice.updatedAt,
    }
  }
}
