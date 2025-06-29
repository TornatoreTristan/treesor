import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'vendors'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')

      table.uuid('user_id').unsigned().references('id').inTable('users').onDelete('CASCADE')
      table.string('name').notNullable()
      table.text('description').nullable()
      table.text('logo_path').nullable()
      table.string('website').nullable()
      table.string('contact_email').nullable()
      table.string('contact_phone').nullable()
      table.text('address').nullable()
      table.boolean('is_favorite').defaultTo(false)
      table.text('notes').nullable()

      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
