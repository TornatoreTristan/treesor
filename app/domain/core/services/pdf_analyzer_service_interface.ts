/**
 * Interface pour un service d'analyse de documents PDF
 */
export interface PdfAnalyzerServiceInterface {
  /**
   * Analyse un fichier PDF pour en extraire des informations structurées
   * @param filePath Chemin du fichier PDF à analyser
   * @returns Un objet contenant les données extraites du PDF
   */
  analyzePdf(filePath: string): Promise<Record<string, any>>
}
