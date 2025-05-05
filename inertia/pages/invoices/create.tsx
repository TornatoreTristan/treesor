import { Head, useForm } from '@inertiajs/react'
import DefaultLayout from '~/app/layouts/default-layout'
import HeaderPage from '~/components/header-page'
import { Input } from '~/components/ui/input'
import { Button } from '~/components/ui/button'
import { Card, CardContent } from '~/components/ui/card'
import { Label } from '~/components/ui/label'
import { Textarea } from '~/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import { useRef, useState } from 'react'
import { FormEvent } from 'react'
import { ChevronLeft, FileTextIcon, Loader2 } from 'lucide-react'
import { Link } from '@inertiajs/react'
import axios from 'axios'

interface CreateInvoiceProps {
  vendors?: { id: number; name: string }[]
  categories?: { id: number; name: string }[]
}

export default function CreateInvoice({ vendors = [], categories = [] }: CreateInvoiceProps) {
  const [fileName, setFileName] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analyzingSuccess, setAnalyzingSuccess] = useState(false)
  const [confidencePercentage, setConfidencePercentage] = useState(0)
  const [extractedFields, setExtractedFields] = useState<string[]>([])
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  const { data, setData, post, errors } = useForm({
    number: '',
    amountHT: '',
    vatRate: '20',
    vatAmount: '',
    amountTTC: '',
    date: new Date().toISOString().split('T')[0],
    dueDate: '',
    notes: '',
    categoryId: '',
    vendorId: '',
    status: 'pending',
    document: null as File | null,
  })

  // Gestion du calcul automatique des montants
  const calculateVat = (ht: string, rate: string) => {
    const htAmount = parseFloat(ht || '0')
    const vatRate = parseFloat(rate || '0')
    if (!isNaN(htAmount) && !isNaN(vatRate)) {
      const vatAmount = (htAmount * vatRate) / 100
      const ttc = htAmount + vatAmount
      setData({
        ...data,
        vatAmount: vatAmount.toFixed(2),
        amountTTC: ttc.toFixed(2),
      })
    }
  }

  // Gestionnaires pour le drag & drop
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
      setData('document', file)
      analyzeDocument(file)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0]
      setFileName(file.name)
      setData('document', file)
      analyzeDocument(file)
    }
  }

  // Analyse automatique du document PDF
  const analyzeDocument = async (file: File) => {
    // Ne traiter que les fichiers PDF
    if (!file.type.includes('pdf')) {
      return
    }

    setIsAnalyzing(true)
    setAnalyzingSuccess(false)
    setUploadError(null)
    setExtractedFields([])

    try {
      const formData = new FormData()
      formData.append('document', file)

      const response = await axios.post('/invoices/analyze', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })

      if (response.data.success) {
        const { invoiceData, confidenceScore } = response.data.data

        // Mettre à jour les champs du formulaire avec les données extraites
        const updates: Record<string, any> = {}
        const fieldsUpdated: string[] = []

        if (invoiceData.number && !data.number) {
          updates.number = invoiceData.number
          fieldsUpdated.push('Numéro de facture')
        }

        if (invoiceData.amountHT) {
          updates.amountHT = invoiceData.amountHT.toString()
          fieldsUpdated.push('Montant HT')

          // Recalculer la TVA si on a le taux mais pas le montant total
          if (invoiceData.vatRate && !invoiceData.amountTTC) {
            const vatAmount = invoiceData.amountHT * (invoiceData.vatRate / 100)
            updates.vatAmount = vatAmount.toFixed(2)
            updates.amountTTC = (invoiceData.amountHT + vatAmount).toFixed(2)
          }
        }

        if (invoiceData.amountTTC) {
          updates.amountTTC = invoiceData.amountTTC.toString()
          fieldsUpdated.push('Montant TTC')
        }

        if (invoiceData.vatRate) {
          updates.vatRate = invoiceData.vatRate.toString()
          fieldsUpdated.push('Taux de TVA')
        }

        if (invoiceData.vatAmount) {
          updates.vatAmount = invoiceData.vatAmount.toString()
          fieldsUpdated.push('Montant TVA')
        }

        if (invoiceData.date) {
          updates.date = invoiceData.date
          fieldsUpdated.push('Date de facture')
        }

        if (invoiceData.dueDate) {
          updates.dueDate = invoiceData.dueDate
          fieldsUpdated.push("Date d'échéance")
        }

        if (invoiceData.vendorId) {
          updates.vendorId = invoiceData.vendorId.toString()
          fieldsUpdated.push('Fournisseur')
        }

        // Appliquer toutes les mises à jour
        if (Object.keys(updates).length > 0) {
          // Préserver explicitement le document lors de la mise à jour
          setData((prevData) => ({
            ...prevData,
            ...updates,
            document: prevData.document, // S'assurer que le document ne soit pas perdu
          }))
          setAnalyzingSuccess(true)
          setConfidencePercentage(Math.round(confidenceScore * 100))
          setExtractedFields(fieldsUpdated)

          // Vérifier si le document est toujours présent après mise à jour
          console.log('Document après mise à jour:', data.document ? 'Présent' : 'Absent')

          // Afficher un message de succès avec les champs mis à jour
          console.log(`Analyse réussie! Champs mis à jour: ${fieldsUpdated.join(', ')}`)
          console.log(`Score de confiance: ${Math.round(confidenceScore * 100)}%`)
        }
      } else {
        console.warn("L'analyse n'a pas trouvé de données pertinentes dans le document")
      }
    } catch (error) {
      console.error("Erreur lors de l'analyse du document:", error)
      // Ne pas montrer d'erreur à l'utilisateur car c'est une fonctionnalité bonus
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleClick = () => {
    fileInputRef.current?.click()
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    setUploadError(null)
    setIsSubmitting(true)

    // Ajout d'un log pour déboguer
    console.log(
      'État du document avant validation:',
      data.document ? 'Présent' : 'Absent',
      data.document
    )

    // Validation basique côté client
    if (!data.document) {
      setUploadError('Le document de la facture est requis')
      setIsSubmitting(false)
      return
    }

    if (!data.amountHT || !data.amountTTC) {
      setUploadError('Les montants HT et TTC sont requis')
      setIsSubmitting(false)
      return
    }

    // Conversion des valeurs "none" en valeurs vides
    const processedData = {
      ...data,
      vendorId: data.vendorId === 'none' ? '' : data.vendorId,
      categoryId: data.categoryId === 'none' ? '' : data.categoryId,
    }

    // Création d'un FormData pour l'envoi du fichier
    const formData = new FormData()
    Object.entries(processedData).forEach(([key, value]) => {
      if (value !== null) {
        if (key === 'document' && value instanceof File) {
          formData.append('document', value)
        } else {
          formData.append(key, String(value))
        }
      }
    })

    // Soumission du formulaire
    post('/api/invoices', {
      forceFormData: true,
      onSuccess: () => {
        setIsSubmitting(false)
        window.location.href = '/invoices'
      },
      onError: (errors: Record<string, string>) => {
        console.error('Erreur lors de la création de la facture:', errors)
        setUploadError('Une erreur est survenue lors de la création de la facture')
        setIsSubmitting(false)
      },
    })
  }

  return (
    <DefaultLayout>
      <Head title="Nouvelle facture" />
      <div className="container py-6">
        <Link href="/invoices" className="flex items-center text-sm mb-4 hover:underline">
          <ChevronLeft className="h-4 w-4 mr-1" />
          Retour aux factures
        </Link>

        <HeaderPage title="Nouvelle facture" />

        <Card className="mt-6">
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Section Document */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Document</h3>
                  <div
                    onClick={handleClick}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`border-2 border-dashed rounded-lg p-8 flex flex-col items-center justify-center cursor-pointer transition-colors ${
                      isDragging
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-300 hover:border-blue-400'
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      accept=".pdf,.png,.jpg,.jpeg"
                      onChange={handleFileChange}
                    />

                    {isAnalyzing ? (
                      <div className="flex flex-col items-center">
                        <Loader2 className="h-10 w-10 text-blue-500 animate-spin mb-3" />
                        <p className="text-sm font-medium text-gray-700">Analyse en cours...</p>
                      </div>
                    ) : (
                      <>
                        {analyzingSuccess ? (
                          <div className="flex flex-col items-center">
                            <FileTextIcon className="h-10 w-10 text-green-500 mb-3" />
                            <p className="text-sm font-medium text-green-700">
                              Document analysé avec succès
                            </p>
                            <p className="text-xs text-gray-700 mt-1">
                              Score de confiance:{' '}
                              <span className="font-semibold">{confidencePercentage}%</span>
                            </p>
                            {extractedFields.length > 0 && (
                              <div className="mt-2 text-xs text-gray-600">
                                <p className="font-medium">Informations extraites:</p>
                                <p>{extractedFields.join(', ')}</p>
                              </div>
                            )}
                          </div>
                        ) : (
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
                        )}

                        {fileName ? (
                          <p className="text-sm text-gray-700 font-medium">{fileName}</p>
                        ) : (
                          <>
                            <p className="text-sm font-medium text-gray-700">
                              Glissez votre facture ici ou cliquez pour parcourir
                            </p>
                            <p className="text-xs text-gray-500 mt-1">PDF, JPG, PNG (max. 10 Mo)</p>
                            <p className="text-xs text-blue-500 mt-1">
                              Les PDF seront analysés automatiquement
                            </p>
                          </>
                        )}
                      </>
                    )}
                  </div>
                  {errors.document && <p className="text-red-500 text-sm">{errors.document}</p>}
                </div>

                {/* Section Informations générales */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Informations générales</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="number">Numéro de facture</Label>
                      <Input
                        id="number"
                        placeholder="FAC-001"
                        value={data.number}
                        onChange={(e) => setData('number', e.target.value)}
                      />
                      {errors.number && <p className="text-red-500 text-sm">{errors.number}</p>}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="status">Statut</Label>
                      <Select
                        value={data.status}
                        onValueChange={(value) => setData('status', value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner un statut" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">À payer</SelectItem>
                          <SelectItem value="paid">Payée</SelectItem>
                          <SelectItem value="rejected">Rejetée</SelectItem>
                        </SelectContent>
                      </Select>
                      {errors.status && <p className="text-red-500 text-sm">{errors.status}</p>}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="date">Date de facture</Label>
                      <Input
                        id="date"
                        type="date"
                        value={data.date}
                        onChange={(e) => setData('date', e.target.value)}
                      />
                      {errors.date && <p className="text-red-500 text-sm">{errors.date}</p>}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="dueDate">Date d'échéance</Label>
                      <Input
                        id="dueDate"
                        type="date"
                        value={data.dueDate}
                        onChange={(e) => setData('dueDate', e.target.value)}
                      />
                      {errors.dueDate && <p className="text-red-500 text-sm">{errors.dueDate}</p>}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="vendorId">Fournisseur</Label>
                      <Select
                        value={data.vendorId}
                        onValueChange={(value) => setData('vendorId', value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner un fournisseur" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Non spécifié</SelectItem>
                          {vendors.map((vendor) => (
                            <SelectItem key={vendor.id} value={String(vendor.id)}>
                              {vendor.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {errors.vendorId && <p className="text-red-500 text-sm">{errors.vendorId}</p>}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="categoryId">Catégorie</Label>
                      <Select
                        value={data.categoryId}
                        onValueChange={(value) => setData('categoryId', value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner une catégorie" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Non catégorisé</SelectItem>
                          {categories.map((category) => (
                            <SelectItem key={category.id} value={String(category.id)}>
                              {category.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {errors.categoryId && (
                        <p className="text-red-500 text-sm">{errors.categoryId}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Section Montants */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Montants</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="amountHT">Montant HT</Label>
                    <Input
                      id="amountHT"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={data.amountHT}
                      onChange={(e) => {
                        setData('amountHT', e.target.value)
                        calculateVat(e.target.value, data.vatRate)
                      }}
                    />
                    {errors.amountHT && <p className="text-red-500 text-sm">{errors.amountHT}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="vatRate">Taux de TVA (%)</Label>
                    <Input
                      id="vatRate"
                      type="number"
                      step="0.1"
                      placeholder="20"
                      value={data.vatRate}
                      onChange={(e) => {
                        setData('vatRate', e.target.value)
                        calculateVat(data.amountHT, e.target.value)
                      }}
                    />
                    {errors.vatRate && <p className="text-red-500 text-sm">{errors.vatRate}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="vatAmount">Montant TVA</Label>
                    <Input
                      id="vatAmount"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={data.vatAmount}
                      onChange={(e) => setData('vatAmount', e.target.value)}
                      readOnly
                    />
                    {errors.vatAmount && <p className="text-red-500 text-sm">{errors.vatAmount}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="amountTTC">Montant TTC</Label>
                    <Input
                      id="amountTTC"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={data.amountTTC}
                      onChange={(e) => setData('amountTTC', e.target.value)}
                      readOnly
                    />
                    {errors.amountTTC && <p className="text-red-500 text-sm">{errors.amountTTC}</p>}
                  </div>
                </div>
              </div>

              {/* Section Notes */}
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  placeholder="Informations complémentaires sur la facture..."
                  value={data.notes}
                  onChange={(e) => setData('notes', e.target.value)}
                  rows={3}
                />
                {errors.notes && <p className="text-red-500 text-sm">{errors.notes}</p>}
              </div>

              {uploadError && <div className="text-red-500">{uploadError}</div>}

              <div className="flex justify-end space-x-2">
                <Button variant="outline" type="button" asChild>
                  <Link href="/invoices">Annuler</Link>
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Enregistrement...' : 'Enregistrer la facture'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </DefaultLayout>
  )
}
