import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'

export default class Categorie extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare userId: number | null

  @column()
  declare name: string

  @column()
  declare color: string

  @column()
  declare icon: string

  @column()
  declare isDefault: boolean

  @column()
  declare parentId: number | null

  @belongsTo(() => Categorie, { foreignKey: 'parentId' })
  declare parent: BelongsTo<typeof Categorie>

  @hasMany(() => Categorie, { foreignKey: 'parentId' })
  declare children: HasMany<typeof Categorie>

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
