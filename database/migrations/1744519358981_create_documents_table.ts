import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'documents'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')

      table.text('name').notNullable()
      table.text('file_name').notNullable()
      table.text('mime_type').notNullable()
      table.integer('file_size').notNullable()
      table.text('file_path').notNullable()
      table.text('file_url').notNullable()
      table.uuid('user_id').unsigned().references('id').inTable('users').onDelete('CASCADE')
      table.string('status').defaultTo('pending')

      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
