import { DriveService } from '#services/drive_service'
import type { HttpContext } from '@adonisjs/core/http'
// Import du service queue
import queue from '@rlanz/bull-queue/services/main'
import BankStatementsJob from '#jobs/bank_statements_job'
// Import de votre job

export default class DrivesController {
  async show({ inertia }: HttpContext) {
    const driveService = new DriveService()
    const documents = await driveService.getAllDocuments()

    return inertia.render('drive/index', { documents })
  }

  async upload({ request, auth, response }: HttpContext) {
    try {
      if (!auth.user) {
        return response.status(401).json({
          error: 'Utilisateur non authentifié',
        })
      }

      const userId = auth.user.id

      // Récupération du fichier
      const file = request.file('file', {
        size: '20mb',
        extnames: ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png', 'csv', 'xls', 'xlsx'],
      })

      if (!file) {
        return response.status(400).json({
          error: 'Aucun fichier fourni',
        })
      }

      if (!file.isValid) {
        return response.status(400).json({
          error: file.errors,
        })
      }

      // Gestion des erreurs de stream
      file.clientName

      // Upload du fichier
      const driveService = new DriveService()
      const document = await driveService.uploadDocument(
        {
          clientName: file.clientName,
          tmpPath: file.tmpPath!,
          size: file.size,
          type: file.type || 'application/octet-stream',
        },
        userId,
        request.input('name')
      )

      // Dispatch le job avec l'ID du document
      queue.dispatch(BankStatementsJob, { documentId: document.id, userId })

      return response.redirect().back()
    } catch (error) {
      console.error("Erreur lors de l'upload:", error)
      return response.status(500).json({
        error: "Une erreur est survenue lors de l'upload du document",
      })
    }
  }

  async delete({ params, auth, response }: HttpContext) {
    try {
      if (!auth.user) {
        return response.status(401).json({
          error: 'Utilisateur non authentifié',
        })
      }

      const documentId = params.id

      if (!documentId) {
        return response.status(400).json({
          error: 'ID du document non fourni',
        })
      }

      const driveService = new DriveService()
      const result = await driveService.deleteDocument(Number(documentId))

      if (!result) {
        return response.status(404).json({
          error: 'Document non trouvé',
        })
      }

      return response.redirect().back()
    } catch (error) {
      console.error('Erreur lors de la suppression:', error)
      return response.status(500).json({
        error: 'Une erreur est survenue lors de la suppression du document',
      })
    }
  }
}
