import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, hasMany } from '@adonisjs/lucid/orm'
import User from '#models/user'
import Category from '#models/categorie'
import Vendor from '#models/vendors'
import BankStatement from '#models/bank_statement'
import Transaction from '#models/transaction'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'

export default class Invoice extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare number: string | null

  @column()
  declare userId: string

  @column()
  declare assignId: string

  @column()
  declare documentUrl: string

  @column()
  declare originalName: string

  @column()
  declare mimeType: string

  @column()
  declare size: number

  @column()
  declare type: string

  @column()
  declare status: 'pending' | 'paid' | 'rejected'

  @column()
  declare amountHT: number

  @column()
  declare amountTTC: number

  @column()
  declare vatRate: number

  @column()
  declare vatAmount: number

  @column()
  declare notes: string | null

  @column.date()
  declare date: DateTime | null

  @column.date({ columnName: 'due_date' })
  declare dueDate: DateTime | null

  @column()
  declare isDoublon: boolean

  @column()
  declare categoryId: number | null

  @column()
  declare vendorId: number | null

  @column()
  declare bankStatementId: number | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  // Relations
  @belongsTo(() => User, {
    foreignKey: 'userId',
  })
  declare user: BelongsTo<typeof User>

  @belongsTo(() => User, {
    foreignKey: 'assignId',
  })
  declare assignedUser: BelongsTo<typeof User>

  @belongsTo(() => Category, {
    foreignKey: 'categoryId',
  })
  declare category: BelongsTo<typeof Category>

  @belongsTo(() => Vendor, {
    foreignKey: 'vendorId',
  })
  declare vendor: BelongsTo<typeof Vendor>

  @belongsTo(() => BankStatement, {
    foreignKey: 'bankStatementId',
  })
  declare bankStatement: BelongsTo<typeof BankStatement>

  @hasMany(() => Transaction, {
    foreignKey: 'invoiceId',
  })
  declare transactions: HasMany<typeof Transaction>
}
