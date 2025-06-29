import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'bank_statements'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')

      table.integer('file_id').unsigned().references('id').inTable('documents').onDelete('CASCADE')
      table.uuid('user_id').unsigned().references('id').inTable('users').onDelete('CASCADE')
      table.string('bank_name').nullable()
      table.string('account_number').nullable()
      table.date('statement_date').notNullable()
      table.date('start_date').notNullable()
      table.date('end_date').notNullable()
      table.string('currency').notNullable()
      table.decimal('opening_balance', 12, 2).notNullable()
      table.decimal('closing_balance', 12, 2).notNullable()

      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
