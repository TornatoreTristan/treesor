import Transaction from '#models/transaction'
import { TransactionRepositoryInterface } from '../../domain/transactions/repositories/transaction_repository_interface.js'
import { TransactionEntity } from '../../domain/transactions/entities/transaction_entity.js'
import { DateTime } from 'luxon'

export class TransactionRepository implements TransactionRepositoryInterface {
  async create(transactionData: TransactionEntity): Promise<TransactionEntity> {
    const transaction = new Transaction()

    // Conversion des dates
    if (transactionData.transactionDate) {
      transaction.transactionDate =
        transactionData.transactionDate instanceof DateTime
          ? transactionData.transactionDate
          : DateTime.fromJSDate(new Date(transactionData.transactionDate as string))
    }

    if (transactionData.valueDate) {
      transaction.valueDate =
        transactionData.valueDate instanceof DateTime
          ? transactionData.valueDate
          : DateTime.fromJSDate(new Date(transactionData.valueDate as string))
    }

    // Affectation des autres propriétés
    transaction.description = transactionData.description
    transaction.reference = transactionData.reference || ''
    transaction.amount = transactionData.amount
    transaction.type = transactionData.type
    transaction.balanceAfter = transactionData.balanceAfter || 0
    transaction.status = transactionData.status || 'paid'
    transaction.categoryId = transactionData.categoryId || null
    transaction.notes = transactionData.notes || null
    transaction.vendorId = transactionData.vendorId || null
    transaction.bankName = transactionData.bankName || null
    transaction.isDoublon = transactionData.isDoublon || false
    transaction.accountNumber = transactionData.accountNumber || null

    // Ne pas assigner bankStatementId s'il n'est pas fourni
    if (transactionData.bankStatementId) {
      transaction.bankStatementId = transactionData.bankStatementId
    }

    // Ne pas assigner userId s'il est vide (pour utiliser la valeur par défaut de la DB ou null)
    if (transactionData.userId && transactionData.userId.trim() !== '') {
      transaction.userId = transactionData.userId
    }

    await transaction.save()

    return this.modelToEntity(transaction)
  }

  async findById(id: number): Promise<TransactionEntity | null> {
    const transaction = await Transaction.find(id)
    if (!transaction) return null

    return this.modelToEntity(transaction)
  }

  async update(
    id: number,
    transactionData: Partial<TransactionEntity>
  ): Promise<TransactionEntity | null> {
    const transaction = await Transaction.find(id)
    if (!transaction) return null

    // Update only provided fields
    if (transactionData.description !== undefined)
      transaction.description = transactionData.description
    if (transactionData.reference !== undefined) transaction.reference = transactionData.reference
    if (transactionData.amount !== undefined) transaction.amount = transactionData.amount
    if (transactionData.type !== undefined) transaction.type = transactionData.type
    if (transactionData.balanceAfter !== undefined)
      transaction.balanceAfter = transactionData.balanceAfter
    if (transactionData.status !== undefined) transaction.status = transactionData.status
    if (transactionData.categoryId !== undefined)
      transaction.categoryId = transactionData.categoryId
    if (transactionData.notes !== undefined) transaction.notes = transactionData.notes
    if (transactionData.vendorId !== undefined) transaction.vendorId = transactionData.vendorId
    if (transactionData.bankName !== undefined) transaction.bankName = transactionData.bankName
    if (transactionData.isDoublon !== undefined) transaction.isDoublon = transactionData.isDoublon
    if (transactionData.accountNumber !== undefined)
      transaction.accountNumber = transactionData.accountNumber

    // Handle date conversions
    if (transactionData.transactionDate !== undefined) {
      transaction.transactionDate =
        transactionData.transactionDate instanceof DateTime
          ? transactionData.transactionDate
          : DateTime.fromJSDate(new Date(transactionData.transactionDate as string))
    }

    if (transactionData.valueDate !== undefined) {
      transaction.valueDate =
        transactionData.valueDate === null
          ? null
          : transactionData.valueDate instanceof DateTime
            ? transactionData.valueDate
            : DateTime.fromJSDate(new Date(transactionData.valueDate as string))
    }

    await transaction.save()

    return this.modelToEntity(transaction)
  }

  async delete(id: number): Promise<boolean> {
    const transaction = await Transaction.find(id)
    if (!transaction) return false

    await transaction.delete()
    return true
  }

  async list(options: { page?: number; limit?: number } = {}): Promise<any> {
    const page = options.page || 1
    const limit = options.limit || 20

    const transactions = await Transaction.query()
      .preload('category')
      .orderBy('transactionDate', 'desc')
      .paginate(page, limit)

    return transactions
  }

  private modelToEntity(model: Transaction): TransactionEntity {
    return {
      id: model.id,
      bankStatementId: model.bankStatementId,
      userId: model.userId,
      transactionDate: model.transactionDate,
      valueDate: model.valueDate,
      description: model.description,
      reference: model.reference,
      amount: model.amount,
      type: model.type,
      balanceAfter: model.balanceAfter,
      status: model.status,
      categoryId: model.categoryId,
      notes: model.notes,
      vendorId: model.vendorId,
      bankName: model.bankName,
      isDoublon: model.isDoublon,
      accountNumber: model.accountNumber,
    }
  }
}
