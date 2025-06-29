import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

export default class Vendors extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare userId: number

  @column()
  declare name: string

  @column()
  declare description: string | null

  @column()
  declare logoPath: string | null

  @column()
  declare website: string | null

  @column()
  declare contactEmail: string | null

  @column()
  declare contactPhone: string | null

  @column()
  declare address: string | null

  @column()
  declare isFavorite: boolean

  @column()
  declare notes: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
