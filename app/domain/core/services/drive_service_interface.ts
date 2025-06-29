export interface DriveServiceInterface {
  /**
   * Upload un fichier dans le système de stockage
   * @param filePath Chemin où sauvegarder le fichier
   * @param tmpPath Chemin temporaire du fichier uploadé
   * @returns L'URL du fichier uploadé
   */
  uploadFile(filePath: string, tmpPath: string): Promise<string>

  /**
   * Supprime un fichier du système de stockage
   * @param filePath Chemin du fichier à supprimer
   */
  deleteFile(filePath: string): Promise<void>
}
