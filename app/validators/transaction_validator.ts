import vine from '@vinejs/vine'

/**
 * Validateur pour la création d'une transaction
 */
export const createTransactionValidator = vine.compile(
  vine.object({
    transactionDate: vine.string(),
    valueDate: vine.string().optional(),
    description: vine.string().trim().minLength(1).maxLength(255),
    reference: vine.string().trim().optional(),
    amount: vine.number(),
    type: vine.enum(['credit', 'debit']),
    balanceAfter: vine.number().optional(),
    status: vine.enum(['pending', 'paid', 'rejected']).optional(),
    categoryId: vine.number().optional(),
    notes: vine.string().trim().optional(),
    vendorId: vine.number().optional(),
    bankName: vine.string().trim().optional(),
    accountNumber: vine.string().trim().optional(),
    bankStatementId: vine.number().optional(),
    userId: vine.string().trim().optional(),
  })
)

/**
 * Validateur pour la mise à jour d'une transaction
 */
export const updateTransactionValidator = vine.compile(
  vine.object({
    transactionDate: vine.string().optional(),
    valueDate: vine.string().optional(),
    description: vine.string().trim().minLength(1).maxLength(255).optional(),
    reference: vine.string().trim().optional(),
    amount: vine.number().optional(),
    type: vine.enum(['credit', 'debit']).optional(),
    balanceAfter: vine.number().optional(),
    status: vine.enum(['pending', 'paid', 'rejected']).optional(),
    categoryId: vine.number().optional(),
    notes: vine.string().trim().optional(),
    vendorId: vine.number().optional(),
    bankName: vine.string().trim().optional(),
    accountNumber: vine.string().trim().optional(),
  })
)
