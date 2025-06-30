import { InvoiceRepositoryInterface, CreateInvoiceData, UpdateInvoiceData } from '#domain/invoices/repositories/invoice_repository_interface'
import { InvoiceEntity } from '#domain/invoices/entities/invoice_entity'
import Invoice from '#models/invoice'
import { DateTime } from 'luxon'

export class InvoiceRepository implements InvoiceRepositoryInterface {
  async findById(id: number): Promise<InvoiceEntity | null> {
    const invoice = await Invoice.find(id)

    if (!invoice) {
      return null
    }

    return this.toEntity(invoice)
  }

  async findAll(): Promise<InvoiceEntity[]> {
    const invoices = await Invoice.all()

    return invoices.map(invoice => this.toEntity(invoice))
  }

  async findByUserId(userId: string): Promise<InvoiceEntity[]> {
    const invoices = await Invoice.query()
      .where('userId', userId)

    return invoices.map(invoice => this.toEntity(invoice))
  }

  async create(data: CreateInvoiceData): Promise<InvoiceEntity> {
    const invoice = await Invoice.create({
      number: data.number,
      userId: data.userId,
      assignId: data.assignId,
      documentUrl: data.documentUrl,
      originalName: data.originalName,
      mimeType: data.mimeType,
      size: data.size,
      type: data.type,
      status: data.status,
      amountHT: data.amountHT,
      amountTTC: data.amountTTC,
      vatRate: data.vatRate,
      vatAmount: data.vatAmount,
      notes: data.notes,
      date: data.date ? DateTime.fromISO(data.date) : null,
      dueDate: data.dueDate ? DateTime.fromISO(data.dueDate) : null,
      isDoublon: data.isDoublon,
      categoryId: data.categoryId,
      vendorId: data.vendorId,
      bankStatementId: data.bankStatementId,
    })

    return this.toEntity(invoice)
  }

  async update(id: number, data: UpdateInvoiceData): Promise<InvoiceEntity> {
    const invoice = await Invoice.findOrFail(id)
    
    // Mapper explicitement les propriétés pour éviter les problèmes de noms
    const updateData: any = {}
    if (data.number !== undefined) updateData.number = data.number
    if (data.assignId !== undefined) updateData.assignId = data.assignId
    if (data.documentUrl !== undefined) updateData.documentUrl = data.documentUrl
    if (data.originalName !== undefined) updateData.originalName = data.originalName
    if (data.mimeType !== undefined) updateData.mimeType = data.mimeType
    if (data.size !== undefined) updateData.size = data.size
    if (data.type !== undefined) updateData.type = data.type
    if (data.status !== undefined) updateData.status = data.status
    if (data.amountHT !== undefined) updateData.amountHT = data.amountHT
    if (data.amountTTC !== undefined) updateData.amountTTC = data.amountTTC
    if (data.vatRate !== undefined) updateData.vatRate = data.vatRate
    if (data.vatAmount !== undefined) updateData.vatAmount = data.vatAmount
    if (data.notes !== undefined) updateData.notes = data.notes
    if (data.date !== undefined) updateData.date = data.date ? DateTime.fromISO(data.date) : null
    if (data.dueDate !== undefined) updateData.dueDate = data.dueDate ? DateTime.fromISO(data.dueDate) : null
    if (data.isDoublon !== undefined) updateData.isDoublon = data.isDoublon
    if (data.categoryId !== undefined) updateData.categoryId = data.categoryId
    if (data.vendorId !== undefined) updateData.vendorId = data.vendorId
    if (data.bankStatementId !== undefined) updateData.bankStatementId = data.bankStatementId

    invoice.merge(updateData)
    await invoice.save()

    return this.toEntity(invoice)
  }

  async delete(id: number): Promise<void> {
    const invoice = await Invoice.findOrFail(id)
    await invoice.delete()
  }

  private toEntity(invoice: Invoice): InvoiceEntity {
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
      category: null, // Relations désactivées pour simplifier
      vendor: null,   // Relations désactivées pour simplifier
      createdAt: invoice.createdAt,
      updatedAt: invoice.updatedAt,
    }
  }
}