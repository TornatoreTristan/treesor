import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'justificatifs'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
      table.uuid('assign_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
      table.string('document_url').notNullable()
      table.string('original_name').notNullable()
      table.string('mime_type').notNullable()
      table.integer('size').notNullable()
      table.string('type').notNullable()
      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
