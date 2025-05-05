import { TransactionEntity } from '../entities/transaction_entity.js'
import { TransactionRepositoryInterface } from '../repositories/transaction_repository_interface.js'

export class CreateTransactionUseCase {
  constructor(private transactionRepository: TransactionRepositoryInterface) {}

  async execute(transactionData: TransactionEntity): Promise<TransactionEntity> {
    // Logique métier pour la validation des données
    if (!transactionData.description || transactionData.description.trim() === '') {
      throw new Error('La description est obligatoire')
    }

    if (!transactionData.amount || Number.isNaN(Number(transactionData.amount))) {
      throw new Error('Le montant doit être un nombre valide')
    }

    if (!transactionData.type || !['credit', 'debit'].includes(transactionData.type)) {
      throw new Error('Le type doit être "credit" ou "debit"')
    }

    if (!transactionData.transactionDate) {
      throw new Error('La date de transaction est obligatoire')
    }

    // Par défaut, le statut est "paid" si non spécifié
    if (!transactionData.status) {
      transactionData.status = 'paid'
    }

    // Ajuster le signe du montant en fonction du type
    let amountValue = Math.abs(Number(transactionData.amount))
    if (transactionData.type === 'debit') {
      amountValue = -amountValue // Les débits sont toujours négatifs
    }

    // Pour l'API de création manuelle, on ne vérifie pas bankStatementId et userId
    // Ces champs sont gérés au niveau du repository

    // Ajouter un ID d'une banque existante pour passer les contraintes de clé étrangère
    // Il s'agit d'une solution temporaire pour les tests API uniquement
    // Pour créer des transactions via API, créez d'abord la migration appropriée
    // qui rend bank_statement_id nullable
    const transactionForAPI = {
      ...transactionData,
      amount: amountValue, // Utiliser le montant avec le signe ajusté
      // Les lignes suivantes sont commentées car elles devraient être gérées au niveau de la base de données
      // Créez une migration pour rendre ces champs nullables
      // bankStatementId: null,
    }

    // Appel au repository pour créer la transaction
    return this.transactionRepository.create(transactionForAPI)
  }
}
