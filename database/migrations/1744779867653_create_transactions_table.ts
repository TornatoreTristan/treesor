import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'transactions'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')

      table
        .integer('bank_statement_id')
        .unsigned()
        .references('id')
        .inTable('bank_statements')
        .onDelete('CASCADE')
      table.uuid('user_id').unsigned().references('id').inTable('users').onDelete('CASCADE')
      table.integer('vendor_id').unsigned().references('id').inTable('vendors').nullable()
      table.date('transaction_date').notNullable()
      table.date('value_date').nullable()
      table.text('description').notNullable()
      table.string('reference').notNullable()
      table.decimal('amount', 12, 2).notNullable()
      table.enum('type', ['credit', 'debit']).notNullable()
      table.decimal('balance_after', 12, 2).notNullable()
      table.enum('status', ['pending', 'paid', 'rejected']).defaultTo('pending')
      table.integer('category_id').unsigned().references('id').inTable('categories').nullable()
      table.text('notes').nullable()
      table.string('bank_name').nullable()
      table.string('account_number').nullable()
      table.boolean('is_doublon').defaultTo(false)

      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
