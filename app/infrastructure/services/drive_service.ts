import drive from '@adonisjs/drive/services/main'
import { DriveServiceInterface } from '../../domain/core/services/drive_service_interface.js'

export class DriveService implements DriveServiceInterface {
  async uploadFile(filePath: string, tmpPath: string): Promise<string> {
    // Utilisation du disque par défaut (filesystem)
    const fs = drive.use('fs')

    // Upload du fichier
    await fs.put(filePath, tmpPath)

    // Récupération de l'URL du fichier
    const fileUrl = await fs.getUrl(filePath)

    return fileUrl
  }

  async deleteFile(filePath: string): Promise<void> {
    // Utilisation du disque par défaut (filesystem)
    const fs = drive.use('fs')

    // Vérification si le fichier existe
    const exists = await fs.exists(filePath)

    // Suppression du fichier s'il existe
    if (exists) {
      await fs.delete(filePath)
    }
  }
}
