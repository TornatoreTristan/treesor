import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'invoices'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('number').nullable()
      table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
      table.uuid('assign_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
      table.string('document_url').notNullable()
      table.string('original_name').notNullable()
      table.string('mime_type').notNullable()
      table.integer('size').notNullable()
      table.string('type').notNullable()
      table.enum('status', ['pending', 'paid', 'rejected']).defaultTo('pending')
      table.decimal('amount_ht', 12, 2).nullable()
      table.decimal('amount_ttc', 12, 2).nullable()
      table.decimal('vat_rate', 5, 2).nullable()
      table.decimal('vat_amount', 12, 2).nullable()
      table.text('notes').nullable()
      table.date('date').nullable()
      table.date('due_date').nullable()
      table.boolean('is_doublon').defaultTo(false)
      table.integer('category_id').unsigned().references('id').inTable('categories').nullable()
      table.integer('vendor_id').unsigned().references('id').inTable('vendors').nullable()
      table
        .integer('bank_statement_id')
        .unsigned()
        .references('id')
        .inTable('bank_statements')
        .nullable()

      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
