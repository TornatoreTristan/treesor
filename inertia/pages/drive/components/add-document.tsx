import { DialogHeader, DialogTitle } from '~/components/ui/dialog'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { useState, useRef, FormEvent } from 'react'
import { router } from '@inertiajs/react'

const AddDocument = ({ onClose }: { onClose?: () => void }) => {
  const [fileName, setFileName] = useState<string | null>(null)
  const [documentName, setDocumentName] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadSuccess, setUploadSuccess] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0]
      setFileName(file.name)
      setSelectedFile(file)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0]
      setFileName(file.name)
      setSelectedFile(file)
    }
  }

  const handleClick = () => {
    fileInputRef.current?.click()
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    setUploadError(null)
    setUploadSuccess(false)

    if (!selectedFile) {
      setUploadError('Veuillez sélectionner un fichier')
      return
    }

    setIsSubmitting(true)

    const formData = new FormData()
    formData.append('file', selectedFile)
    formData.append('name', documentName || selectedFile.name)

    router.post('/drive/upload', formData, {
      onSuccess: () => {
        setUploadSuccess(true)
        setIsSubmitting(false)
        if (onClose) setTimeout(onClose, 1000)
      },
      onError: (errors) => {
        console.error("Erreur lors de l'upload:", errors)
        setUploadError("Erreur lors de l'upload du document")
        setIsSubmitting(false)
      },
      preserveState: true,
      forceFormData: true,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <DialogHeader>
        <DialogTitle>Ajouter un document</DialogTitle>
      </DialogHeader>

      <div className="space-y-5">
        <div className="space-y-2">
          <label htmlFor="name" className="text-sm font-medium">
            Nom du document
          </label>
          <Input
            id="name"
            placeholder="Entrez le nom du document"
            value={documentName}
            onChange={(e) => setDocumentName(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">Fichier</p>
          <div
            onClick={handleClick}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg p-8 flex flex-col items-center justify-center cursor-pointer transition-colors ${
              isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400'
            }`}
          >
            <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} />

            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-10 w-10 text-gray-400 mb-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>

            {fileName ? (
              <p className="text-sm text-gray-700 font-medium">{fileName}</p>
            ) : (
              <>
                <p className="text-sm font-medium text-gray-700">
                  Glissez votre document ici ou cliquez pour parcourir
                </p>
                <p className="text-xs text-gray-500 mt-1">PDF, DOCX, JPG, PNG (max. 10 Mo)</p>
              </>
            )}
          </div>
        </div>

        {uploadError && <div className="text-red-500 text-sm">{uploadError}</div>}

        {uploadSuccess && <div className="text-green-500 text-sm">Document ajouté avec succès</div>}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" type="button" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Envoi en cours...' : 'Ajouter'}
          </Button>
        </div>
      </div>
    </form>
  )
}

export default AddDocument
