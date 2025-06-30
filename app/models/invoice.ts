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

  @column({ columnName: 'user_id' })
  declare userId: string

  @column({ columnName: 'assign_id' })
  declare assignId: string

  @column({ columnName: 'document_url' })
  declare documentUrl: string

  @column({ columnName: 'original_name' })
  declare originalName: string

  @column({ columnName: 'mime_type' })
  declare mimeType: string

  @column()
  declare size: number

  @column()
  declare type: string

  @column()
  declare status: 'pending' | 'paid' | 'rejected'

  @column({ columnName: 'amountHT' })
  declare amountHT: number

  @column({ columnName: 'amountTTC' })
  declare amountTTC: number

  @column({ columnName: 'vatRate' })
  declare vatRate: number

  @column({ columnName: 'vatAmount' })
  declare vatAmount: number

  @column()
  declare notes: string | null

  @column.date()
  declare date: DateTime | null

  @column.date({ columnName: 'due_date' })
  declare dueDate: DateTime | null

  @column({ columnName: 'is_doublon' })
  declare isDoublon: boolean

  @column({ columnName: 'category_id' })
  declare categoryId: number | null

  @column({ columnName: 'vendor_id' })
  declare vendorId: number | null

  @column({ columnName: 'bank_statement_id' })
  declare bankStatementId: number | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  // Relations
  @belongsTo(() => User, {
    foreignKey: 'user_id',
  })
  declare user: BelongsTo<typeof User>

  @belongsTo(() => User, {
    foreignKey: 'assign_id',
  })
  declare assignedUser: BelongsTo<typeof User>

  @belongsTo(() => Category, {
    foreignKey: 'category_id',
  })
  declare category: BelongsTo<typeof Category>

  @belongsTo(() => Vendor, {
    foreignKey: 'vendor_id',
  })
  declare vendor: BelongsTo<typeof Vendor>

  @belongsTo(() => BankStatement, {
    foreignKey: 'bank_statement_id',
  })
  declare bankStatement: BelongsTo<typeof BankStatement>

  @hasMany(() => Transaction, {
    foreignKey: 'invoice_id',
  })
  declare transactions: HasMany<typeof Transaction>
}
