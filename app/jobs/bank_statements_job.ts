// app/jobs/bank_statements_job.ts
import { Job } from '@rlanz/bull-queue'
import { DriveService } from '#services/drive_service'
import * as csv from 'csv-parser'
import * as fs from 'node:fs/promises'
import drive from '@adonisjs/drive/services/main'
import { DateTime } from 'luxon'
import BankStatement from '#models/bank_statement'
import Transaction from '#models/transaction'
import * as chardet from 'chardet'
import iconv from 'iconv-lite'
import { Readable } from 'node:stream'
import * as fsSync from 'node:fs'

interface BankStatementsJobPayload {
  documentId: number
  userId: string
}

export default class BankStatementsJob extends Job {
  static get $$filepath() {
    return import.meta.url
  }

  public async handle(payload: BankStatementsJobPayload) {
    console.log(`Traitement du document ${payload.documentId}`)

    try {
      const driveService = new DriveService()
      const document = await driveService.getDocument(payload.documentId)

      if (!document) {
        throw new Error(`Document ${payload.documentId} non trouvé`)
      }

      console.log(`Document trouvé: ${document.name}`)
      console.log(`Chemin du document: ${document.filePath}`)

      // Accès au fichier via le système de stockage d'Adonis Drive
      const driveDisk = drive.use('fs')

      // Vérification que le fichier existe dans le système de stockage
      const exists = await driveDisk.exists(document.filePath)
      if (!exists) {
        throw new Error(`Le fichier n'existe pas dans le système de stockage: ${document.filePath}`)
      }
      console.log('Le fichier existe dans le système de stockage')

      // Récupérer le chemin réel du fichier source
      const sourcePath = await driveDisk.get(document.filePath)
      console.log('Chemin réel du fichier source:', sourcePath)

      // PATCH DEBUG : Vérification existence et contenu du fichier
      const existsSync = fsSync.existsSync(sourcePath)
      console.log('PATCH DEBUG - Fichier existe-t-il ?', existsSync, 'Chemin:', sourcePath)
      if (!existsSync) {
        console.error('PATCH DEBUG - Fichier INEXISTANT au moment du parsing:', sourcePath)
        return
      }
      try {
        const rawDebug = fsSync.readFileSync(sourcePath, 'utf-8')
        console.log('PATCH DEBUG - Contenu brut (utf-8):', rawDebug)
      } catch (e) {
        console.error('PATCH DEBUG - Erreur lecture brute:', e)
      }

      // Détection de l'encodage
      const encoding = chardet.detectFileSync(sourcePath) || 'utf-8'
      console.log('Encodage détecté:', encoding)

      // Lecture du contenu en encodage natif
      const rawBuffer = await fs.readFile(sourcePath)
      const rawContent = iconv.decode(rawBuffer, encoding)
      console.log('Contenu brut du fichier (auto-detecté):', rawContent)

      // Parsing du CSV à partir du contenu décodé
      const results: Record<string, string>[] = []
      const csvStream = Readable.from(rawContent)
      await new Promise((resolve, reject) => {
        csvStream
          .pipe(csv.default({ separator: ';' }))
          .on('data', (data) => results.push(data))
          .on('end', () => resolve(results))
          .on('error', (error) => reject(error))
      })

      console.log('Première ligne brute:', results[0])
      console.log('Clés de la première ligne:', Object.keys(results[0]))

      console.log('Contenu brut du CSV:', results)
      console.log(`${results.length} lignes lues`)
      if (results.length > 0) {
        console.log('Premier enregistrement:', results[0])
      }

      if (results.length === 0) {
        console.error('Aucune donnée trouvée dans le CSV, arrêt du traitement.')
        return
      }

      // // Fonction utilitaire robuste pour matcher les colonnes sans accent, casse ou caractères spéciaux
      // const getColLoose = (row: Record<string, string>, ...names: string[]) => {
      //   const normalize = (s: string) =>
      //     s
      //       .normalize('NFD')
      //       .replace(/\s+/g, '')
      //       .replace(/[^a-z]/gi, '')
      //       .toLowerCase()
      //   const keys = Object.keys(row).map((k) => ({ orig: k, norm: normalize(k) }))
      //   for (const name of names) {
      //     const normName = normalize(name)
      //     const found = keys.find((k) => k.norm === normName)
      //     if (found) return row[found.orig]
      //   }
      //   return ''
      // }

      // Nouvelle fonction de parsing de date pour le format 'dd-MM-yyyy HH:mm:ss'
      const parseDateNew = (d: string) => {
        if (!d) return DateTime.now()
        try {
          const dt = DateTime.fromFormat(d, 'dd-MM-yyyy HH:mm:ss')
          return dt.isValid ? dt : DateTime.now()
        } catch {
          return DateTime.now()
        }
      }
      // Nouvelle fonction de parsing du montant (gère les espaces et le séparateur virgule)
      const parseAmountNew = (a: string) => {
        const n = a ? Number(a.replace(/\s/g, '').replace(',', '.')) : 0
        return Number.isNaN(n) ? 0 : n
      }

      // Adaptation du bankStatementData (si besoin, à ajuster selon ton modèle)
      const first = results[0]
      const last = results[results.length - 1]
      const bankStatementData = {
        fileId: Number(document.id),
        userId: payload.userId,
        bankName: first['Banque'] || null,
        accountNumber: first['IBAN du compte'] || null,
        statementDate: parseDateNew(first["Date de l'opération (local)"]),
        startDate: parseDateNew(first["Date de l'opération (local)"]),
        endDate: parseDateNew(last["Date de l'opération (local)"]),
        currency: first['Devise'] || 'EUR',
        openingBalance: parseAmountNew(first['Solde']),
        closingBalance: parseAmountNew(last['Solde']),
      }
      console.log('BankStatement à créer :', {
        ...bankStatementData,
        statementDate: bankStatementData.statementDate.toISO(),
        startDate: bankStatementData.startDate.toISO(),
        endDate: bankStatementData.endDate.toISO(),
      })

      const bankStatement = await BankStatement.create(bankStatementData)
      console.log('BankStatement créé:', bankStatement)

      // Création des transactions associées
      for (const row of results) {
        // Règle : ignorer les transactions dont la banque est 'Stripe'
        const bankName = (row['Banque'] || '').trim().toLowerCase()
        if (bankName === 'stripe') {
          continue
        }
        const debit = row['Débit'] || ''
        const credit = row['Crédit'] || ''
        let amount = 0
        let type: 'credit' | 'debit' = 'debit'
        if (debit && debit.trim() !== '') {
          amount = -parseAmountNew(debit)
          type = 'debit'
        } else if (credit && credit.trim() !== '') {
          amount = parseAmountNew(credit)
          type = 'credit'
        }

        // Détection des doublons : même montant, date et référence
        const referenceValue =
          (row['Référence'] && row['Référence'].trim() !== ''
            ? row['Référence']
            : row['Nom de la contrepartie']) || ''
        const transactionDateISO = parseDateNew(row["Date de l'opération (local)"]).toISODate()
        const existing = await Transaction.query()
          .where('amount', amount)
          .where('transactionDate', transactionDateISO)
          .where('reference', referenceValue)
          .first()
        const isDoublon = !!existing
        await Transaction.create({
          bankStatementId: bankStatement.id,
          userId: payload.userId,
          transactionDate: parseDateNew(row["Date de l'opération (local)"]),
          valueDate: row['Date de la valeur (local)']
            ? parseDateNew(row['Date de la valeur (local)'])
            : null,
          description: '',
          reference: referenceValue,
          amount,
          type,
          balanceAfter: parseAmountNew(row['Solde']),
          status: 'pending',
          categoryId: null,
          notes: row['Note'] || null,
          vendorId: null,
          bankName: row['Banque'] || null,
          accountNumber: row['IBAN du compte'] || null,
          isDoublon,
        })
      }
      console.log(`Transactions créées pour le relevé bancaire ${bankStatement.id}`)

      console.log(`Traitement terminé pour le document ${payload.documentId}`)
    } catch (error) {
      console.error(`Erreur lors du traitement: ${error.message}`)
      throw error
    }
  }

  public async rescue(payload: BankStatementsJobPayload, error: Error) {
    console.log(
      `Échec définitif du traitement pour le document ${payload.documentId}: ${error.message}`
    )
  }
}
