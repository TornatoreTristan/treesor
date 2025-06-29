import { cuid } from '@adonisjs/core/helpers'
import drive from '@adonisjs/drive/services/main'
import Document from '#models/document'

export class DriveService {
  /**
   * Upload un fichier dans le système de stockage et enregistre ses métadonnées en base de données
   */
  async uploadDocument(
    file: {
      clientName: string
      tmpPath: string
      size: number
      type: string
    },
    userId: string,
    customName?: string
  ): Promise<Document> {
    // Génération d'un nom de fichier unique
    const fileExtension = file.clientName.split('.').pop() || ''
    const fileName = `${cuid()}.${fileExtension}`

    // Chemin du fichier dans le stockage
    const filePath = `documents/${fileName}`

    // Upload du fichier dans le système de stockage
    const fs = drive.use('fs')
    await fs.put(filePath, file.tmpPath)

    // Génération de l'URL d'accès au fichier
    const fileUrl = await fs.getUrl(filePath)

    // Création de l'entrée en base de données
    const document = await Document.create({
      name: customName || file.clientName,
      fileName: fileName,
      mimeType: file.type,
      fileSize: file.size,
      filePath: filePath,
      fileUrl: fileUrl,
      userId: userId,
      status: 'active',
    })

    return document
  }

  /**
   * Supprime un document du système de stockage et de la base de données
   */
  async deleteDocument(documentId: number): Promise<boolean> {
    const document = await Document.find(documentId)

    if (!document) {
      return false
    }

    // Suppression du fichier du système de stockage
    const fs = drive.use('fs')
    await fs.delete(document.filePath)

    // Suppression de l'entrée en base de données
    await document.delete()

    return true
  }

  /**
   * Récupère un document par son ID
   */
  async getDocument(documentId: number): Promise<Document | null> {
    return Document.find(documentId)
  }

  /**
   * Liste tous les documents d'un utilisateur
   */
  async getUserDocuments(userId: string): Promise<Document[]> {
    return Document.query().where('userId', userId).orderBy('createdAt', 'desc')
  }

  /**
   * Liste tous les documents
   */
  async getAllDocuments(): Promise<Document[]> {
    return Document.query().orderBy('createdAt', 'desc')
  }
}
