import { TransactionEntity } from '../entities/transaction_entity.js'

export interface TransactionRepositoryInterface {
  create(transaction: TransactionEntity): Promise<TransactionEntity>
  findById(id: number): Promise<TransactionEntity | null>
  update(id: number, transaction: Partial<TransactionEntity>): Promise<TransactionEntity | null>
  delete(id: number): Promise<boolean>
  list(options?: { page?: number; limit?: number }): Promise<any>
}
