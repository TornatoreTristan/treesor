import { DialogHeader, DialogTitle } from '~/components/ui/dialog'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { useState, FormEvent } from 'react'
import { router } from '@inertiajs/react'

const TAILWIND_COLORS = [
  { name: 'Rouge 500', value: '#ef4444', class: 'bg-red-500' },
  { name: 'Rouge 700', value: '#b91c1c', class: 'bg-red-700' },
  { name: 'Orange 400', value: '#fb923c', class: 'bg-orange-400' },
  { name: 'Orange 600', value: '#ea580c', class: 'bg-orange-600' },
  { name: 'Jaune 400', value: '#facc15', class: 'bg-yellow-400' },
  { name: 'Jaune 600', value: '#ca8a04', class: 'bg-yellow-600' },
  { name: 'Vert 400', value: '#4ade80', class: 'bg-green-400' },
  { name: 'Vert 600', value: '#16a34a', class: 'bg-green-600' },
  { name: 'Bleu 400', value: '#60a5fa', class: 'bg-blue-400' },
  { name: 'Bleu 600', value: '#2563eb', class: 'bg-blue-600' },
  { name: 'Indigo 400', value: '#818cf8', class: 'bg-indigo-400' },
  { name: 'Indigo 700', value: '#4338ca', class: 'bg-indigo-700' },
  { name: 'Violet 400', value: '#a78bfa', class: 'bg-purple-400' },
  { name: 'Violet 700', value: '#7c3aed', class: 'bg-purple-700' },
  { name: 'Rose 400', value: '#f472b6', class: 'bg-pink-400' },
  { name: 'Rose 600', value: '#db2777', class: 'bg-pink-600' },
  { name: 'Gris 300', value: '#d1d5db', class: 'bg-gray-300' },
  { name: 'Gris 500', value: '#6b7280', class: 'bg-gray-500' },
  { name: 'Gris 700', value: '#374151', class: 'bg-gray-700' },
  { name: 'Noir', value: '#000000', class: 'bg-black' },
  { name: 'Blanc', value: '#ffffff', class: 'bg-white border' },
  { name: 'Emerald 400', value: '#34d399', class: 'bg-emerald-400' },
  { name: 'Emerald 600', value: '#059669', class: 'bg-emerald-600' },
  { name: 'Cyan 400', value: '#22d3ee', class: 'bg-cyan-400' },
  { name: 'Cyan 600', value: '#0891b2', class: 'bg-cyan-600' },
  { name: 'Lime 400', value: '#a3e635', class: 'bg-lime-400' },
  { name: 'Lime 600', value: '#65a30d', class: 'bg-lime-600' },
  { name: 'Amber 400', value: '#fbbf24', class: 'bg-amber-400' },
  { name: 'Amber 600', value: '#d97706', class: 'bg-amber-600' },
]

const AddCategories = ({
  onClose,
  categories = [],
}: {
  onClose?: () => void
  categories?: { id: number; name: string }[]
}) => {
  const [name, setName] = useState('')
  const [color, setColor] = useState('')
  const [icon, setIcon] = useState('')
  const [isDefault, setIsDefault] = useState(false)
  const [parentId, setParentId] = useState<number | ''>('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(false)
    setIsSubmitting(true)

    router.post(
      '/categories',
      {
        name,
        color,
        icon,
        isDefault,
        parentId: parentId === '' ? null : parentId,
      },
      {
        onSuccess: () => {
          setSuccess(true)
          setIsSubmitting(false)
          if (onClose) setTimeout(onClose, 1000)
        },
        onError: () => {
          setError('Erreur lors de la création de la catégorie')
          setIsSubmitting(false)
        },
        preserveState: true,
      }
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <DialogHeader>
        <DialogTitle>Ajouter une catégorie</DialogTitle>
      </DialogHeader>
      <div className="space-y-5">
        <div className="space-y-2">
          <label htmlFor="name" className="text-sm font-medium">
            Nom
          </label>
          <Input
            id="name"
            placeholder="Nom de la catégorie"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="color" className="text-sm font-medium">
            Couleur
          </label>
          <div className="flex flex-wrap gap-2 items-center">
            {TAILWIND_COLORS.map((c) => (
              <button
                key={c.value}
                type="button"
                className={`w-8 h-8 rounded-full border-2 flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-offset-2 ${c.class} ${color === c.value ? 'ring-2 ring-black border-black' : 'border-transparent'}`}
                aria-label={c.name}
                onClick={() => setColor(c.value)}
              >
                {color === c.value && <span className="text-white text-xs font-bold">✓</span>}
              </button>
            ))}
            {/* Couleur personnalisée */}
            <label
              className="w-8 h-8 rounded-full border-2 flex items-center justify-center cursor-pointer bg-white border-gray-300 hover:border-black relative"
              title="Couleur personnalisée"
            >
              <input
                type="color"
                value={color && !TAILWIND_COLORS.some((c) => c.value === color) ? color : '#000000'}
                onChange={(e) => setColor(e.target.value)}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                tabIndex={-1}
              />
              <span
                className="block w-5 h-5 rounded-full"
                style={{
                  background:
                    color && !TAILWIND_COLORS.some((c) => c.value === color) ? color : '#000000',
                }}
              />
              {color && !TAILWIND_COLORS.some((c) => c.value === color) && (
                <span className="absolute top-0 right-0 text-xs text-black">★</span>
              )}
            </label>
          </div>
          <input type="hidden" id="color" value={color} readOnly />
        </div>
        <div className="space-y-2">
          <label htmlFor="icon" className="text-sm font-medium">
            Icône
          </label>
          <Input
            id="icon"
            placeholder="emoji ou nom d'icône"
            value={icon}
            onChange={(e) => setIcon(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="parentId" className="text-sm font-medium">
            Catégorie parente (optionnel)
          </label>
          <select
            id="parentId"
            value={parentId}
            onChange={(e) => setParentId(e.target.value === '' ? '' : Number(e.target.value))}
            className="w-full border rounded px-3 py-2"
          >
            <option value="">Aucune (catégorie racine)</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <input
            id="isDefault"
            type="checkbox"
            checked={isDefault}
            onChange={(e) => setIsDefault(e.target.checked)}
            className="h-4 w-4 border-gray-300 rounded"
          />
          <label htmlFor="isDefault" className="text-sm">
            Catégorie par défaut
          </label>
        </div>
        {error && <div className="text-red-500 text-sm">{error}</div>}
        {success && <div className="text-green-500 text-sm">Catégorie ajoutée avec succès</div>}
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

export default AddCategories
