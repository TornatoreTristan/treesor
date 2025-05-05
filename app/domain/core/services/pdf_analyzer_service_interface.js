/**
 * Interface pour le service d'analyse de PDF
 */
export class PdfAnalyzerServiceInterface {
  /**
   * Analyse un fichier PDF pour en extraire les informations pertinentes pour une facture
   * @param filePath Chemin du fichier PDF à analyser
   * @param options Options d'analyse (langue, type de document attendu)
   * @returns Les données extraites du PDF
   */
  async analyzePdf(filePath, options = {}) {
    throw new Error('Not implemented')
  }
}
