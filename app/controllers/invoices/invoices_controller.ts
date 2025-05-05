import { HttpContext } from '@adonisjs/core/http'
import Invoice from '#models/invoice'
import {
  UploadInvoiceFileUseCase,
  InvoiceFileData,
} from '../../domain/invoices/use_cases/upload_invoice_file_use_case.js'
import { InvoiceRepository } from '../../infrastructure/repositories/invoice_repository.js'
import { DriveService as InfrastructureDriveService } from '../../infrastructure/services/drive_service.js'
import { DriveService as AppDriveService } from '#services/drive_service'
import { DriveServiceInterface } from '../../domain/core/services/drive_service_interface.js'
import { DateTime } from 'luxon'
import Vendor from '#models/vendors'
import Category from '#models/categorie'
import router from '@adonisjs/core/services/router'
import drive from '@adonisjs/drive/services/main'
import * as nodeFs from 'node:fs'
import { appendFileSync } from 'node:fs'

// Fonction pour enregistrer les logs dans un fichier
function logToFile(message: string) {
  try {
    const logMessage = `${new Date().toISOString()} - ${message}\n`
    console.log(logMessage)
    appendFileSync('logs/invoice_debug.log', logMessage)
  } catch (error) {
    console.error("Erreur lors de l'écriture du log:", error)
  }
}

// Adaptateur qui permet d'utiliser le service DriveService standard avec l'interface DriveServiceInterface
class DriveServiceAdapter implements DriveServiceInterface {
  constructor(private appDriveService: AppDriveService) {}

  async uploadFile(filePath: string, tmpPath: string): Promise<string> {
    // Utilisation directe de drive pour contourner le problème
    const fs = drive.use('fs')
    await fs.put(filePath, tmpPath)
    return await fs.getUrl(filePath)
  }

  async deleteFile(filePath: string): Promise<void> {
    const fs = drive.use('fs')
    if (await fs.exists(filePath)) {
      await fs.delete(filePath)
    }
  }
}

export default class InvoicesController {
  // Afficher la liste des factures
  async index({ inertia }: HttpContext) {
    const invoices = await Invoice.query()
      .preload('category')
      .preload('vendor')
      .orderBy('createdAt', 'desc')

    // Mapper les factures pour l'affichage frontend
    const mappedInvoices = invoices.map((invoice) => ({
      id: invoice.id,
      invoiceNumber: invoice.number || `INV-${invoice.id}`,
      date: invoice.date ? invoice.date.toISODate() : null,
      dueDate: invoice.dueDate ? invoice.dueDate.toISODate() : null,
      clientName: invoice.vendor?.name || 'Non spécifié',
      amount: invoice.amountHT,
      vatRate: invoice.vatRate,
      vatAmount: invoice.vatAmount,
      totalAmount: invoice.amountTTC,
      status: this.mapInvoiceStatus(invoice.status),
      description: invoice.notes || 'Aucune description',
      category: invoice.category?.name || 'Non catégorisé',
      createdAt: invoice.createdAt.toISO(),
      updatedAt: invoice.updatedAt.toISO(),
      documentUrl: invoice.documentUrl,
    }))

    return inertia.render('invoices/index', { invoices: mappedInvoices })
  }

  // Afficher le formulaire de création de facture
  async create({ inertia }: HttpContext) {
    // Charger les fournisseurs et les catégories pour les menus déroulants
    const vendors = await Vendor.all()
    const categories = await Category.all()

    // Simplifier les données pour le frontend
    const vendorsData = vendors.map((vendor) => ({
      id: vendor.id,
      name: vendor.name,
    }))

    const categoriesData = categories.map((category) => ({
      id: category.id,
      name: category.name,
    }))

    return inertia.render('invoices/create', {
      vendors: vendorsData,
      categories: categoriesData,
    })
  }

  // Traiter la soumission du formulaire de création
  async store({ request, response, auth, inertia, session }: HttpContext) {
    logToFile('========= DÉBUT DE LA MÉTHODE STORE =========')

    try {
      logToFile(`Auth user: ${!!auth.user}`)

      if (!auth.user) {
        logToFile("Pas d'utilisateur authentifié")
        session.flash('error', 'Utilisateur non authentifié')
        return inertia.render('invoices/create', {
          errors: { auth: 'Utilisateur non authentifié' },
        })
      }

      const userId = auth.user.id
      logToFile(`UserId: ${userId}`)

      // Récupération du fichier - point critique potentiel
      logToFile('Avant récupération du fichier')
      const file = request.file('document', {
        size: '10mb',
        extnames: ['pdf', 'png', 'jpg', 'jpeg'],
      })
      logToFile(`Fichier récupéré: ${!!file}`)
      logToFile(`Fichier valide: ${file?.isValid}`)

      if (!file || !file.isValid) {
        logToFile('Fichier invalide ou absent')
        session.flash('error', file ? file.errors : 'Aucun fichier fourni')
        return inertia.render('invoices/create', {
          errors: { document: file ? file.errors : 'Aucun fichier fourni' },
        })
      }

      logToFile(`Fichier valide, chemin: ${file.tmpPath}`)

      // Test simple sans utiliser les cas d'utilisation et services complexes
      try {
        logToFile('Test de connexion à la base de données')
        // Créer une entrée minimaliste dans la base de données
        const testInvoice = await Invoice.create({
          userId: userId.toString(),
          amountHT: 100,
          amountTTC: 120,
          vatRate: 20,
          vatAmount: 20,
          status: 'pending',
          isDoublon: false,
          notes: 'Test création',
        })

        logToFile(`Invoice créée avec succès, ID: ${testInvoice.id}`)

        // Test simple d'upload de fichier sans utiliser le service complexe
        logToFile("Test simple d'upload de fichier")
        const fs = drive.use('fs')
        const testFilePath = `test_invoices/${Date.now()}_${file.clientName}`
        await fs.put(testFilePath, file.tmpPath!)

        logToFile('Fichier uploadé avec succès')

        // Message de succès
        session.flash('success', 'Facture créée avec succès')

        // Rediriger vers la page d'index des factures
        return response.redirect().toRoute('invoices')
      } catch (simpleTestError) {
        logToFile(`ERREUR TEST SIMPLE: ${simpleTestError}`)
        throw new Error(`Test simple échoué: ${simpleTestError.message}`)
      }
    } catch (error) {
      logToFile('======= ERREUR PRINCIPALE =======')
      logToFile(`Type d'erreur: ${error instanceof Error ? 'Error' : typeof error}`)
      logToFile(`Message: ${error instanceof Error ? error.message : 'Erreur sans message'}`)

      if (error instanceof Error && error.stack) {
        logToFile(`Stack: ${error.stack}`)
      }

      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Une erreur est survenue lors de la création de la facture'

      logToFile(`Message d'erreur final: ${errorMessage}`)

      // Récupérer les données minimales pour le formulaire
      const vendors = await Vendor.all()
      const categories = await Category.all()

      const vendorsData = vendors.map((vendor) => ({
        id: vendor.id,
        name: vendor.name,
      }))

      const categoriesData = categories.map((category) => ({
        id: category.id,
        name: category.name,
      }))

      logToFile("Préparation de la réponse d'erreur")
      session.flash('error', errorMessage)

      return inertia.render('invoices/create', {
        errors: { general: errorMessage },
        vendors: vendorsData,
        categories: categoriesData,
        formData: request.only([
          'number',
          'type',
          'status',
          'amountHT',
          'amountTTC',
          'vatRate',
          'vatAmount',
          'notes',
          'date',
          'dueDate',
          'categoryId',
          'vendorId',
        ]),
      })
    } finally {
      logToFile('========= FIN DE LA MÉTHODE STORE =========')
    }
  }

  // Mappage des statuts pour l'interface utilisateur
  private mapInvoiceStatus(status: string): string {
    const statusMap: Record<string, string> = {
      pending: 'pending',
      paid: 'paid',
      rejected: 'cancelled',
    }

    return statusMap[status] || status
  }

  // Analyse préliminaire d'un PDF de facture
  async analyze({ request, response, auth, inertia, session }: HttpContext) {
    try {
      if (!auth.user) {
        // Comme c'est probablement une requête AJAX, on peut garder la réponse JSON
        // mais s'assurer qu'elle est bien formatée pour Inertia
        return response.status(401).json({
          success: false,
          error: 'Utilisateur non authentifié',
        })
      }

      // Récupération du fichier
      const file = request.file('document', {
        size: '10mb',
        extnames: ['pdf'],
      })

      if (!file || !file.isValid) {
        return response.status(400).json({
          success: false,
          error: file ? file.errors : 'Aucun fichier fourni ou fichier invalide',
        })
      }

      // Configurer l'environnement Node.js pour pdfjs-dist
      process.env.PDFJS_WORKER_SRC = new URL(
        '../../node_modules/pdfjs-dist/build/pdf.worker.js',
        import.meta.url
      ).pathname
      process.env.PDFJS_CMAP_URL = new URL(
        '../../node_modules/pdfjs-dist/cmaps/',
        import.meta.url
      ).pathname

      // Import dynamique pour éviter les dépendances circulaires
      const { PdfAnalyzerService } = await import(
        '../../infrastructure/services/pdf_analyzer_service.js'
      )
      const { AnalyzeInvoicePdfUseCase } = await import(
        '../../domain/invoices/use_cases/analyze_invoice_pdf_use_case.js'
      )

      // Instanciation des dépendances
      const pdfAnalyzerService = new PdfAnalyzerService()
      const analyzeInvoicePdfUseCase = new AnalyzeInvoicePdfUseCase(pdfAnalyzerService)

      // Exécution du cas d'utilisation
      const result = await analyzeInvoicePdfUseCase.execute(file.tmpPath!)

      return response.status(200).json({
        success: true,
        data: {
          ...result,
          // Convertir les dates DateTime en ISO pour la transmission
          invoiceData: {
            ...result.invoiceData,
            date: result.invoiceData.date ? (result.invoiceData.date as any).toISODate() : null,
            dueDate: result.invoiceData.dueDate
              ? (result.invoiceData.dueDate as any).toISODate()
              : null,
          },
        },
      })
    } catch (error) {
      console.error("Erreur lors de l'analyse de la facture:", error)
      return response.status(500).json({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Une erreur est survenue lors de l'analyse de la facture",
      })
    }
  }
}
