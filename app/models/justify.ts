import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, manyToMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, ManyToMany } from '@adonisjs/lucid/types/relations'
import User from './user.js'
import Transaction from './transaction.js'

export default class Justify extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare userId: string // UUID

  @column()
  declare assignId: string // UUID

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
  declare transactionId: number | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => User, { foreignKey: 'userId' })
  declare user: BelongsTo<typeof User>

  @belongsTo(() => User, { foreignKey: 'assignId' })
  declare assignedTo: BelongsTo<typeof User>

  @belongsTo(() => Transaction, { foreignKey: 'transactionId' })
  declare transaction: BelongsTo<typeof Transaction>

  @manyToMany(() => Transaction, {
    pivotTable: 'transaction_justificatif',
    localKey: 'id',
    pivotForeignKey: 'justificatif_id',
    relatedKey: 'id',
    pivotRelatedForeignKey: 'transaction_id',
  })
  declare transactions: ManyToMany<typeof Transaction>
}
