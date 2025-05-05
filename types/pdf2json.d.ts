/**
 * Type definitions for pdf2json
 */

declare module 'pdf2json' {
  export default class PDFParser {
    constructor()

    on(event: 'pdfParser_dataError', callback: (errData: Record<string, Error>) => void): void
    on(event: 'pdfParser_dataReady', callback: (pdfData: any) => void): void

    loadPDF(pdfFilePath: string): void
  }
}
