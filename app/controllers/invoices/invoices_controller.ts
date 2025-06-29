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
import { PdfAnalyzerService } from '../../infrastructure/services/pdf_analyzer_service.js'
import { ImprovedPdfAnalyzerService } from 'app/infrastructure/services/improved_pdf_analyzer_service.js'

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
  // API: Récupérer la liste des factures en JSON
  async apiIndex({ response, auth }: HttpContext) {
    try {
      if (!auth.user) {
        return response.status(401).json({
          success: false,
          error: 'Utilisateur non authentifié',
        })
      }

      const invoices = await Invoice.query()
        .preload('category')
        .preload('vendor')
        .orderBy('createdAt', 'desc')

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

      return response.status(200).json({
        success: true,
        data: mappedInvoices,
      })
    } catch (error) {
      return response.status(500).json({
        success: false,
        error: 'Erreur lors de la récupération des factures',
      })
    }
  }

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

  // API SIMPLE: Créer une facture avec les données fournies
  async apiStore({ request, response, auth, session, inertia }: HttpContext) {
    try {
      if (!auth.user) {
        // Si c'est Inertia, rediriger
        if (request.header('x-inertia')) {
          session.flash('error', 'Non authentifié')
          return response.redirect().back()
        }
        return response.status(401).json({ success: false, error: 'Non authentifié' })
      }

      // Récupérer TOUTES les données
      const data = request.all()

      // Créer la facture
      const invoiceData: any = {
        userId: auth.user.id.toString(),
        status: 'pending',
        isDoublon: false,
      }

      // Mapper les données
      if (data.number) invoiceData.number = data.number
      if (data.amountHT) invoiceData.amountHT = Number.parseFloat(data.amountHT.toString())
      if (data.amountTTC) invoiceData.amountTTC = Number.parseFloat(data.amountTTC.toString())
      if (data.vatRate) invoiceData.vatRate = Number.parseFloat(data.vatRate.toString())
      if (data.vatAmount) invoiceData.vatAmount = Number.parseFloat(data.vatAmount.toString())
      if (data.notes) invoiceData.notes = data.notes
      if (data.status) invoiceData.status = data.status

      // Dates
      if (data.date) invoiceData.date = DateTime.fromISO(data.date.toString())
      if (data.dueDate) invoiceData.dueDate = DateTime.fromISO(data.dueDate.toString())

      // Relations
      if (data.categoryId) invoiceData.categoryId = Number.parseInt(data.categoryId.toString())
      if (data.vendorId) invoiceData.vendorId = Number.parseInt(data.vendorId.toString())

      // Créer avec les propriétés camelCase
      const adaptedData = {
        number: invoiceData.number,
        userId: invoiceData.userId,
        assignId: invoiceData.assignId || invoiceData.userId,
        documentUrl: invoiceData.documentUrl,
        originalName: invoiceData.originalName || 'unknown.pdf',
        mimeType: invoiceData.mimeType || 'application/pdf',
        size: invoiceData.size || 0,
        type: invoiceData.type || 'invoice',
        status: invoiceData.status,
        amountHT: invoiceData.amountHT,
        amountTTC: invoiceData.amountTTC,
        vatRate: invoiceData.vatRate,
        vatAmount: invoiceData.vatAmount,
        notes: invoiceData.notes,
        date: invoiceData.date,
        dueDate: invoiceData.dueDate,
        isDoublon: invoiceData.isDoublon,
        categoryId: invoiceData.categoryId,
        vendorId: invoiceData.vendorId,
      }

      // CRÉER EN BDD - AVEC LOGS POUR VOIR CE QUI SE PASSE
      console.log('🔥 TENTATIVE CRÉATION:', adaptedData)
      const invoice = await Invoice.create(adaptedData)
      console.log('✅ CRÉÉ EN BDD:', invoice.toJSON())

      // RÉPONSE SELON TYPE
      if (request.header('x-inertia')) {
        session.flash('success', 'Facture créée !')
        return response.redirect().toRoute('invoices')
      } else {
        return response.status(201).json({
          success: true,
          data: { id: invoice.id, message: 'Facture créée !' },
        })
      }
    } catch (error) {
      console.error('ERREUR:', error)

      if (request.header('x-inertia')) {
        session.flash('error', 'Erreur création')
        return response.redirect().back()
      } else {
        return response.status(500).json({ success: false, error: 'Erreur création' })
      }
    }
  }

  // Traiter la soumission du formulaire de création (API + Web)
  async store({ request, response, auth, inertia, session }: HttpContext) {
    logToFile('========= DÉBUT DE LA MÉTHODE STORE =========')

    try {
      if (!auth.user) {
        const error = 'Utilisateur non authentifié'

        // Si c'est une requête API (JSON), retourner JSON
        if (request.header('accept')?.includes('application/json')) {
          return response.status(401).json({ success: false, error })
        }

        // Sinon, interface web classique
        session.flash('error', error)
        return inertia.render('invoices/create', {
          errors: { auth: error },
        })
      }

      const userId = auth.user.id
      logToFile(`UserId: ${userId}`)

      // Récupération des données du formulaire
      const formData = request.only([
        'number',
        'amountHT',
        'amountTTC',
        'vatRate',
        'vatAmount',
        'date',
        'dueDate',
        'notes',
        'categoryId',
        'vendorId',
      ])

      // Récupération du fichier
      const file = request.file('document', {
        size: '10mb',
        extnames: ['pdf', 'png', 'jpg', 'jpeg'],
      })

      if (!file || !file.isValid) {
        const error = file ? file.errors : 'Aucun fichier fourni'

        if (request.header('accept')?.includes('application/json')) {
          return response.status(400).json({ success: false, error })
        }

        session.flash('error', error)
        return inertia.render('invoices/create', { errors: { document: error } })
      }

      logToFile(`Fichier valide, chemin: ${file.tmpPath}`)

      try {
        // Upload du fichier
        const fs = drive.use('fs')
        const filePath = `invoices/${Date.now()}_${file.clientName}`
        await fs.put(filePath, file.tmpPath!)
        const documentUrl = await fs.getUrl(filePath)

        // Création de la facture avec les données du formulaire
        const invoiceData: any = {
          userId: userId.toString(),
          status: 'pending',
          isDoublon: false,
          documentUrl,
          notes: formData.notes || 'Facture créée via upload',
        }

        // Ajouter les données financières si fournies
        if (formData.number) invoiceData.number = formData.number
        if (formData.amountHT)
          invoiceData.amountHT = Number.parseFloat(formData.amountHT.toString())
        if (formData.amountTTC)
          invoiceData.amountTTC = Number.parseFloat(formData.amountTTC.toString())
        if (formData.vatRate) invoiceData.vatRate = Number.parseFloat(formData.vatRate.toString())
        if (formData.vatAmount)
          invoiceData.vatAmount = Number.parseFloat(formData.vatAmount.toString())

        // Dates
        if (formData.date) {
          invoiceData.date = DateTime.fromISO(formData.date.toString())
        }
        if (formData.dueDate) {
          invoiceData.dueDate = DateTime.fromISO(formData.dueDate.toString())
        }

        // Relations
        if (formData.categoryId)
          invoiceData.categoryId = Number.parseInt(formData.categoryId.toString())
        if (formData.vendorId) invoiceData.vendorId = Number.parseInt(formData.vendorId.toString())

        // Créer la facture avec les données camelCase
        const adaptedStoreData = {
          number: invoiceData.number,
          userId: userId.toString(),
          assignId: userId.toString(), // même utilisateur pour assign
          documentUrl: invoiceData.documentUrl,
          originalName: file.clientName,
          mimeType: file.type,
          size: file.size,
          type: 'invoice',
          status: invoiceData.status,
          amountHT: invoiceData.amountHT,
          amountTTC: invoiceData.amountTTC,
          vatRate: invoiceData.vatRate,
          vatAmount: invoiceData.vatAmount,
          notes: invoiceData.notes,
          date: invoiceData.date,
          dueDate: invoiceData.dueDate,
          isDoublon: invoiceData.isDoublon,
          categoryId: invoiceData.categoryId,
          vendorId: invoiceData.vendorId,
        }

        console.log('🔥 CRÉATION STORE:', adaptedStoreData)
        const invoice = await Invoice.create(adaptedStoreData)
        console.log('✅ CRÉÉ STORE:', invoice.toJSON())

        logToFile(`Invoice créée avec succès, ID: ${invoice.id}`)

        // Réponse selon le type de requête
        if (request.header('accept')?.includes('application/json')) {
          return response.status(201).json({
            success: true,
            data: {
              id: invoice.id,
              message: 'Facture créée avec succès',
            },
          })
        }

        // Interface web
        session.flash('success', 'Facture créée avec succès')
        return response.redirect().toRoute('invoices')
      } catch (createError) {
        logToFile(`ERREUR CRÉATION: ${createError}`)
        throw new Error(`Création échouée: ${createError.message}`)
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
  async analyze({ request, response }: HttpContext) {
    try {
      const { filePath } = request.only(['filePath'])

      if (!filePath) {
        return response.badRequest({ error: 'filePath is required' })
      }

      console.log('🔍 Starting AI analysis for:', filePath)

      const aiAnalyzer = new PdfAnalyzerService()
      const result = await aiAnalyzer.analyzePdf(filePath)

      console.log('🤖 AI Analysis result:', result)

      // Adapter les données de l'AI pour le frontend
      const adaptedData = {
        number: result.invoiceNumber,
        amountHT: result.amountHT,
        amountTTC: result.amountTTC,
        vatRate: result.vatRate,
        vatAmount: result.vatAmount,
        date: result.invoiceDate,
        dueDate: result.dueDate,
        vendorId: result.vendorId,
      }

      console.log('📊 Adapted data for DB:', adaptedData)

      return response.json({
        success: true,
        data: adaptedData,
        originalResult: result,
      })
    } catch (error) {
      console.error('💥 AI Analysis error:', error)
      return response.internalServerError({
        error: 'Analysis failed',
        details: error.message,
      })
    }
  }
}
