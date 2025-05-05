import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'transactions'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.integer('invoice_id').unsigned().references('id').inTable('invoices').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('invoice_id')
    })
  }
}
