import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'users'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.db.rawQuery('gen_random_uuid()').knexQuery)
      table.string('full_name').nullable()
      table.string('first_name').nullable()
      table.string('last_name').nullable()
      table.string('avatar').nullable()
      table.string('email', 254).notNullable().unique()
      table.string('password').nullable()

      table.text('provider').nullable()
      table.text('google_id').nullable()
      table.text('google_access_token').nullable()
      table.text('google_refresh_token').nullable()
      table.text('google_token_expires_at').nullable()

      table.timestamp('last_login_at').nullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
