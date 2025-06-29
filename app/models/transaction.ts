import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, manyToMany } from '@adonisjs/lucid/orm'
import Categorie from '#models/categorie'
import type { BelongsTo, ManyToMany } from '@adonisjs/lucid/types/relations'
import Justify from './justify.js'
import Invoice from './invoice.js'

export default class Transaction extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare bankStatementId: number

  @column()
  declare userId: string

  @column.date()
  declare transactionDate: DateTime

  @column.date()
  declare valueDate: DateTime | null

  @column()
  declare description: string

  @column()
  declare reference: string

  @column()
  declare amount: number

  @column()
  declare type: 'credit' | 'debit'

  @column()
  declare balanceAfter: number

  @column()
  declare status: 'pending' | 'paid' | 'rejected'

  @column()
  declare categoryId: number | null

  @column()
  declare notes: string | null

  @column()
  declare vendorId: number | null

  @column()
  declare bankName: string | null

  @column()
  declare isDoublon: boolean

  @column()
  declare accountNumber: string | null

  @column()
  declare invoiceId: number | null

  @column()
  declare justificatifId: number | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Categorie, {
    foreignKey: 'categoryId',
  })
  declare category: BelongsTo<typeof Categorie>

  @belongsTo(() => Justify, {
    foreignKey: 'justificatifId',
  })
  declare justificatif: BelongsTo<typeof Justify>

  @belongsTo(() => Invoice, {
    foreignKey: 'invoiceId',
  })
  declare invoice: BelongsTo<typeof Invoice>

  @manyToMany(() => Justify, {
    pivotTable: 'transaction_justificatif',
    localKey: 'id',
    pivotForeignKey: 'transaction_id',
    relatedKey: 'id',
    pivotRelatedForeignKey: 'justificatif_id',
  })
  declare justificatifs: ManyToMany<typeof Justify>
}
