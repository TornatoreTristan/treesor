import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'transaction_justificatif'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')

      // Clé étrangère vers transactions
      table
        .integer('transaction_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('transactions')
        .onDelete('CASCADE')

      // Clé étrangère vers justificatifs
      table
        .integer('justificatif_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('justificatifs')
        .onDelete('CASCADE')

      // Unicité pour éviter les doublons
      table.unique(['transaction_id', 'justificatif_id'])

      table.timestamp('created_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
