import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

export default class BankStatement extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare fileId: number

  @column()
  declare userId: string

  @column()
  declare bankName: string | null

  @column()
  declare accountNumber: string | null

  @column.date()
  declare statementDate: DateTime

  @column.date()
  declare startDate: DateTime

  @column.date()
  declare endDate: DateTime

  @column()
  declare currency: string

  @column()
  declare openingBalance: number

  @column()
  declare closingBalance: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
