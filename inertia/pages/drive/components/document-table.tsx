import { useState } from 'react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { router } from '@inertiajs/react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui/table'
import { Button } from '~/components/ui/button'
import { Dialog, DialogContent } from '~/components/ui/dialog'
import { Skeleton } from '~/components/ui/skeleton'
import { FileText } from 'lucide-react'

interface Document {
  id: number
  name: string
  fileName: string
  mimeType: string
  fileSize: number
  fileUrl: string
  status: string
  createdAt: string
  updatedAt: string
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'

  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

function getIconForMimeType(mimeType: string) {
  if (mimeType.startsWith('image/')) {
    return '📷'
  } else if (mimeType.includes('pdf')) {
    return '📄'
  } else if (mimeType.includes('word') || mimeType.includes('doc')) {
    return '📝'
  } else if (mimeType.includes('excel') || mimeType.includes('sheet') || mimeType.includes('csv')) {
    return '📊'
  } else if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) {
    return '📊'
  } else {
    return <FileText className="w-5 h-5" />
  }
}

export default function DocumentTable({ documents, isLoading = false }: any) {
  const [previewDocument, setPreviewDocument] = useState<Document | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  const handlePreview = (document: Document) => {
    setPreviewDocument(document)
    setDialogOpen(true)
  }

  const handleDelete = (id: number) => {
    if (confirm('Êtes-vous sûr de vouloir supprimer ce document ?')) {
      router.delete(`/drive/${id}`)
    }
  }

  const handleDownload = (document: Document) => {
    window.open(document.fileUrl, '_blank')
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-80 w-full" />
      </div>
    )
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[50px]">Type</TableHead>
            <TableHead>Nom</TableHead>
            <TableHead>Taille</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead className="hidden md:table-cell">Date de création</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {documents.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                Aucun document trouvé. Ajoutez votre premier document.
              </TableCell>
            </TableRow>
          ) : (
            documents.map((document: any) => (
              <TableRow key={document.id}>
                <TableCell className="font-medium text-xl">
                  {getIconForMimeType(document.mimeType!)}
                </TableCell>
                <TableCell className="font-medium truncate max-w-[200px]" title={document.name}>
                  {document.name}
                </TableCell>
                <TableCell>{formatFileSize(document.fileSize)}</TableCell>
                <TableCell>
                  <span
                    className={`px-2 py-1 text-xs rounded-full ${
                      document.status === 'active'
                        ? 'bg-green-100 text-green-800'
                        : document.status === 'pending'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {document.status}
                  </span>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  {format(new Date(document.createdAt), 'PPP', { locale: fr })}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => handlePreview(document)}>
                      Voir
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleDownload(document)}>
                      Télécharger
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(document.id)}
                    >
                      Supprimer
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl">
          {previewDocument && (
            <div className="w-full">
              <h2 className="text-lg font-semibold mb-4">{previewDocument.name}</h2>
              {previewDocument.mimeType.startsWith('image/') ? (
                <img
                  src={previewDocument.fileUrl}
                  alt={previewDocument.name}
                  className="max-h-[70vh] object-contain mx-auto"
                />
              ) : previewDocument.mimeType.includes('pdf') ? (
                <iframe
                  src={previewDocument.fileUrl}
                  className="w-full h-[70vh]"
                  title={previewDocument.name}
                />
              ) : (
                <div className="text-center py-12 bg-gray-50 rounded-lg">
                  <p className="text-6xl mb-4">{getIconForMimeType(previewDocument.mimeType)}</p>
                  <p className="text-lg">L'aperçu n'est pas disponible pour ce type de fichier.</p>
                  <Button className="mt-4" onClick={() => handleDownload(previewDocument)}>
                    Télécharger
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
