import type { HttpContext } from '@adonisjs/core/http'

import { FetchInvoiceUseCase } from '#domain/invoices/use_cases/fetch_invoice_use_case'
import { FetchAllInvoicesUseCase } from '#domain/invoices/use_cases/fetch_all_invoices_use_case'
import { CreateInvoiceUseCase } from '#domain/invoices/use_cases/create_invoice_use_case'
import { UpdateInvoiceUseCase } from '#domain/invoices/use_cases/update_invoice_use_case'
import { DeleteInvoiceUseCase } from '#domain/invoices/use_cases/delete_invoice_use_case'
import { InvoiceRepository } from '../../infrastructure/repositories/invoice_repository.js'
import { AiPdfAnalyzerService } from '../../infrastructure/services/ai_pdf_analyzer_service.js'
import User from '#models/user'

export default class InvoicesController {
  private invoiceRepository: InvoiceRepository
  private fetchInvoiceUseCase: FetchInvoiceUseCase
  private fetchAllInvoicesUseCase: FetchAllInvoicesUseCase
  private createInvoiceUseCase: CreateInvoiceUseCase
  private updateInvoiceUseCase: UpdateInvoiceUseCase
  private deleteInvoiceUseCase: DeleteInvoiceUseCase
  private aiPdfAnalyzerService: AiPdfAnalyzerService

  constructor() {
    this.invoiceRepository = new InvoiceRepository()
    this.fetchInvoiceUseCase = new FetchInvoiceUseCase(this.invoiceRepository)
    this.fetchAllInvoicesUseCase = new FetchAllInvoicesUseCase(this.invoiceRepository)
    this.createInvoiceUseCase = new CreateInvoiceUseCase(this.invoiceRepository)
    this.updateInvoiceUseCase = new UpdateInvoiceUseCase(this.invoiceRepository)
    this.deleteInvoiceUseCase = new DeleteInvoiceUseCase(this.invoiceRepository)
    this.aiPdfAnalyzerService = new AiPdfAnalyzerService()
  }

  /**
   * Get all invoices - Render Inertia page
   */
  async index({ inertia, auth }: HttpContext) {
    try {
      auth.user!
      const invoiceEntities = await this.fetchAllInvoicesUseCase.execute()

      // Récupérer tous les userId uniques des factures
      const userIds = [...new Set(invoiceEntities.map((entity) => entity.userId))]

      // Récupérer les utilisateurs correspondants
      const users = await User.query().whereIn('id', userIds)

      // Créer un map pour un accès rapide aux utilisateurs
      const userMap = new Map(users.map((u) => [u.id, u]))

      // Mapper les entités vers le format attendu par le frontend
      const invoices = invoiceEntities.map((entity) => {
        const createdByUser = userMap.get(entity.userId)

        return {
          id: entity.id!,
          invoiceNumber: entity.number || `INV-${entity.id}`,
          date: this.formatDate(entity.date) || this.formatDate(entity.createdAt) || '',
          dueDate: this.formatDate(entity.dueDate) || '',
          clientName: entity.vendor?.name || `Vendor ${entity.vendorId || 'Unknown'}`,
          amount: entity.amountHT,
          vatRate: entity.vatRate,
          vatAmount: entity.vatAmount,
          totalAmount: entity.amountTTC,
          status: this.mapStatus(entity.status),
          description: entity.type,
          notes: entity.notes || '',
          createdAt: this.formatDateTime(entity.createdAt) || '',
          updatedAt: this.formatDateTime(entity.updatedAt) || '',
          category: entity.category?.name || '',
          createdBy: createdByUser
            ? {
                id: createdByUser.id,
                fullName: createdByUser.fullName,
                firstName: createdByUser.firstName,
                lastName: createdByUser.lastName,
                avatar: createdByUser.avatar,
                email: createdByUser.email,
              }
            : null,
        }
      })

      return inertia.render('invoices/index', {
        invoices,
      })
    } catch (error) {
      return inertia.render('errors/server_error', {
        message: 'Failed to fetch invoices',
        error: error.message,
      })
    }
  }

  /**
   * Map backend status to frontend status
   */
  private mapStatus(
    backendStatus: 'pending' | 'paid' | 'rejected'
  ): 'draft' | 'pending' | 'paid' | 'cancelled' | 'overdue' {
    switch (backendStatus) {
      case 'pending':
        return 'pending'
      case 'paid':
        return 'paid'
      case 'rejected':
        return 'cancelled'
      default:
        return 'draft'
    }
  }

  /**
   * Format date for frontend (YYYY-MM-DD)
   */
  private formatDate(date: any): string | null {
    if (!date) return null
    if (typeof date === 'string') return date.split('T')[0] // Prend seulement la partie date
    if (date.toISODate) return date.toISODate() // DateTime object
    return null
  }

  /**
   * Format datetime for frontend (ISO string)
   */
  private formatDateTime(date: any): string | null {
    if (!date) return null
    if (typeof date === 'string') return date
    if (date.toISO) return date.toISO() // DateTime object
    return null
  }

  /**
   * Show create form
   */
  async create({ inertia }: HttpContext) {
    try {
      // Pour le moment, on passe des tableaux vides
      // Tu pourras ajouter plus tard les use cases pour récupérer vendors et categories
      const vendors: any[] = []
      const categories: any[] = []

      return inertia.render('invoices/create', {
        vendors,
        categories,
      })
    } catch (error) {
      return inertia.render('errors/server_error', {
        message: 'Failed to load create form',
        error: error.message,
      })
    }
  }

  /**
   * Show edit form
   */
  async edit({ params, inertia }: HttpContext) {
    try {
      const invoice = await this.fetchInvoiceUseCase.execute(params.id)

      // Pour le moment, on passe des tableaux vides
      const vendors: any[] = []
      const categories: any[] = []

      return inertia.render('invoices/edit', {
        invoice,
        vendors,
        categories,
      })
    } catch (error) {
      if (error.message.includes('not found')) {
        return inertia.render('errors/not_found', {
          message: 'Invoice not found',
        })
      }

      return inertia.render('errors/server_error', {
        message: 'Failed to load edit form',
        error: error.message,
      })
    }
  }

  /**
   * View PDF file
   */
  async viewPdf({ params, response }: HttpContext) {
    try {
      const invoice = await this.fetchInvoiceUseCase.execute(params.id)
      console.log('📄 Invoice documentUrl:', invoice.documentUrl)

      // Construire le chemin absolu vers le fichier PDF
      const filePath = invoice.documentUrl
      console.log('📂 Chemin fichier:', filePath)

      // Vérifier si le fichier existe
      const fs = await import('node:fs')
      if (!fs.existsSync(filePath)) {
        console.log('❌ Fichier introuvable:', filePath)
        return response.notFound('Fichier PDF introuvable')
      }

      // Configurer les headers et servir le fichier
      response.type('application/pdf')
      response.header('Content-Disposition', 'inline')
      return response.stream(fs.createReadStream(filePath))
    } catch (error) {
      console.log('❌ Erreur PDF:', error)
      if (error.message.includes('not found')) {
        return response.notFound('Facture introuvable')
      }

      return response.internalServerError('Erreur lors du chargement du PDF')
    }
  }

  /**
   * Get a single invoice
   */
  async show({ params, response }: HttpContext) {
    try {
      const invoice = await this.fetchInvoiceUseCase.execute(params.id)

      return response.ok({
        success: true,
        data: invoice,
      })
    } catch (error) {
      if (error.message.includes('not found')) {
        return response.notFound({
          success: false,
          message: 'Invoice not found',
        })
      }

      return response.internalServerError({
        success: false,
        message: 'Failed to fetch invoice',
        error: error.message,
      })
    }
  }

  /**
   * Create a new invoice
   */
  async store({ request, response, auth }: HttpContext) {
    try {
      const user = auth.user!

      // Gestion de l'upload de fichier
      const document = request.file('document')
      if (!document) {
        return response.badRequest({
          success: false,
          message: 'Le document est requis',
        })
      }

      // Déplacer le fichier vers le dossier storage/invoices
      const fileName = `${Date.now()}_${document.clientName}`
      await document.move('storage/invoices', {
        name: fileName,
      })

      // Récupérer les données du formulaire
      const formData = request.only([
        'number',
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
      ])

      // 🤖 ANALYSE IA AUTOMATIQUE pour les fichiers PDF
      let aiExtractedData: any = {}
      if (document.type?.includes('pdf')) {
        try {
          console.log("🔍 ANALYSE IA AUTO: Début de l'analyse du PDF uploadé")
          const filePath = `storage/invoices/${fileName}`
          const analysisResult = await this.aiPdfAnalyzerService.analyzePdf(filePath)
          aiExtractedData = this.mapAnalysisToInvoiceData(analysisResult)
          console.log('✅ ANALYSE IA AUTO: Données extraites:', aiExtractedData)
        } catch (analyzeError) {
          console.warn(
            "⚠️ ANALYSE IA AUTO: Échec de l'analyse automatique, continuons sans:",
            analyzeError.message
          )
          // On continue même si l'analyse échoue
        }
      }

      // Préparer les données pour la création
      // Les données du formulaire ont priorité sur les données IA extraites
      const invoiceData = {
        number: formData.number || aiExtractedData.number || null,
        userId: user.id,
        assignId: user.id,
        documentUrl: `storage/invoices/${fileName}`,
        originalName: document.clientName || '',
        mimeType: document.type || '',
        size: document.size || 0,
        type: document.extname || '',
        status: (formData.status as 'pending' | 'paid' | 'rejected') || 'pending',
        amountHT: Number.parseFloat(formData.amountHT) || aiExtractedData.amountHT || 0,
        amountTTC: Number.parseFloat(formData.amountTTC) || aiExtractedData.amountTTC || 0,
        vatRate: Number.parseFloat(formData.vatRate) || aiExtractedData.vatRate || 0,
        vatAmount: Number.parseFloat(formData.vatAmount) || aiExtractedData.vatAmount || 0,
        notes: formData.notes || null,
        date: formData.date || aiExtractedData.date || null,
        dueDate: formData.dueDate || aiExtractedData.dueDate || null,
        isDoublon: false,
        categoryId: formData.categoryId ? Number.parseInt(formData.categoryId) : null,
        vendorId: formData.vendorId ? Number.parseInt(formData.vendorId) : null,
        bankStatementId: null,
      }

      await this.createInvoiceUseCase.execute(invoiceData)

      // Pour Inertia, retourner une redirection au lieu de JSON
      return response.redirect('/invoices')
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: 'Failed to create invoice',
        error: error.message,
      })
    }
  }

  /**
   * Update an invoice
   */
  async update({ params, request, response }: HttpContext) {
    try {
      const data = request.only([
        'number',
        'assignId',
        'documentUrl',
        'originalName',
        'mimeType',
        'size',
        'type',
        'status',
        'amountHT',
        'amountTTC',
        'vatRate',
        'vatAmount',
        'notes',
        'date',
        'dueDate',
        'isDoublon',
        'categoryId',
        'vendorId',
        'bankStatementId',
      ])

      await this.updateInvoiceUseCase.execute(params.id, data)

      // Pour Inertia, retourner une redirection au lieu de JSON
      return response.redirect('/invoices')
    } catch (error) {
      if (error.message.includes('not found')) {
        return response.notFound({
          success: false,
          message: 'Invoice not found',
        })
      }

      return response.internalServerError({
        success: false,
        message: 'Failed to update invoice',
        error: error.message,
      })
    }
  }

  /**
   * Delete an invoice
   */
  async destroy({ params, response }: HttpContext) {
    try {
      await this.deleteInvoiceUseCase.execute(params.id)

      // Pour Inertia, retourner une redirection au lieu de JSON
      return response.redirect('/invoices')
    } catch (error) {
      if (error.message.includes('not found')) {
        return response.notFound({
          success: false,
          message: 'Invoice not found',
        })
      }

      return response.internalServerError({
        success: false,
        message: 'Failed to delete invoice',
        error: error.message,
      })
    }
  }

  /**
   * Analyze PDF invoice with AI to extract data
   */
  async analyze({ request, response }: HttpContext) {
    try {
      console.log("🔍 ANALYSE: Début de l'analyse")
      console.log('📁 Files reçus:', request.allFiles())
      console.log('🔑 OpenAI Key configurée:', process.env.OPENAI_API_KEY ? '✅ OUI' : '❌ NON')

      // Récupérer le fichier uploadé
      const document = request.file('document')
      console.log(
        '📄 Document:',
        document ? `${document.clientName} (${document.size} bytes)` : 'AUCUN'
      )

      if (!document) {
        console.log('❌ ERREUR: Aucun document reçu')
        return response.badRequest({
          success: false,
          message: "Document requis pour l'analyse",
        })
      }

      // Si pas de clé OpenAI, retourner des données factices pour le test
      if (!process.env.OPENAI_API_KEY) {
        console.log('⚠️ OPENAI_API_KEY manquante - Mode test avec données factices')
        const mockData = {
          number: 'INV-2024-001',
          amountHT: 100.0,
          amountTTC: 120.0,
          vatRate: 20,
          vatAmount: 20.0,
          date: '2024-01-15',
          dueDate: '2024-02-15',
        }

        return response.ok({
          success: true,
          data: {
            invoiceData: mockData,
            confidenceScore: 0.8,
            extractedFields: Object.keys(mockData),
          },
          message: 'Analyse terminée avec succès (mode test)',
        })
      }

      // Vérifier que c'est un PDF
      const isPdf =
        document.subtype === 'pdf' ||
        document.extname === 'pdf' ||
        document.clientName?.toLowerCase().endsWith('.pdf')

      if (!isPdf) {
        console.log('❌ Type de fichier invalide:', {
          type: document.type,
          subtype: document.subtype,
          extname: document.extname,
          clientName: document.clientName,
        })
        return response.badRequest({
          success: false,
          message: 'Seuls les fichiers PDF peuvent être analysés',
        })
      }

      console.log('✅ Fichier PDF validé:', document.subtype)

      // Sauvegarder temporairement le fichier
      console.log('💾 Sauvegarde temporaire du fichier...')
      const tempFileName = `temp_${Date.now()}_${document.clientName}`
      await document.move('tmp', {
        name: tempFileName,
      })
      console.log('✅ Fichier sauvegardé:', tempFileName)

      // Analyser avec OpenAI
      console.log("🤖 Début de l'analyse OpenAI...")
      const filePath = `tmp/${tempFileName}`
      const analysisResult = await this.aiPdfAnalyzerService.analyzePdf(filePath)
      console.log('✅ Analyse OpenAI terminée:', analysisResult)

      // Mapper les résultats vers le format attendu par le frontend
      const invoiceData = this.mapAnalysisToInvoiceData(analysisResult)

      // Calculer un score de confiance basé sur le nombre de champs trouvés
      const totalFields = 7 // number, amountHT, amountTTC, vatRate, vatAmount, date, dueDate
      const foundFields = Object.values(invoiceData).filter(
        (value) => value !== null && value !== ''
      ).length
      const confidenceScore = foundFields / totalFields

      // Nettoyer le fichier temporaire
      try {
        const fs = await import('node:fs/promises')
        await fs.unlink(filePath)
      } catch (cleanupError) {
        console.warn('Erreur lors du nettoyage du fichier temporaire:', cleanupError)
      }

      return response.ok({
        success: true,
        data: {
          invoiceData,
          confidenceScore,
          extractedFields: Object.keys(invoiceData).filter(
            (key) => invoiceData[key] !== null && invoiceData[key] !== ''
          ),
        },
        message: 'Analyse terminée avec succès',
      })
    } catch (error) {
      console.log('❌ ERREUR ANALYSE:', error)
      return response.internalServerError({
        success: false,
        message: "Erreur lors de l'analyse du document",
        error: error.message,
      })
    }
  }

  /**
   * Map AI analysis results to invoice data format expected by frontend
   */
  private mapAnalysisToInvoiceData(analysisResult: any): any {
    return {
      number: analysisResult.invoiceNumber || null,
      amountHT: analysisResult.amountHT || null,
      amountTTC: analysisResult.amountTTC || null,
      vatRate: analysisResult.vatRate || null,
      vatAmount: analysisResult.vatAmount || null,
      date: this.formatDateForFrontend(analysisResult.invoiceDate) || null,
      dueDate: this.formatDateForFrontend(analysisResult.dueDate) || null,
    }
  }

  /**
   * Convert DD/MM/YYYY to YYYY-MM-DD for HTML date inputs
   */
  private formatDateForFrontend(dateString: string | null): string | null {
    if (!dateString) return null

    // Si déjà au format YYYY-MM-DD
    if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return dateString
    }

    // Si au format DD/MM/YYYY
    if (dateString.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
      const [day, month, year] = dateString.split('/')
      return `${year}-${month}-${day}`
    }

    return null
  }
}
