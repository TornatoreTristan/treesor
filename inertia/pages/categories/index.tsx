import { Head } from '@inertiajs/react'
import { Dialog, DialogContent } from '~/components/ui/dialog'
import { useState } from 'react'
import DefaultLayout from '~/app/layouts/default-layout'
import HeaderPage from '~/components/header-page'
import AddCategories from './components/add-categories'
import EditCategory from './components/edit-category'
import { LucideEdit } from 'lucide-react'

interface Categorie {
  id: number
  name: string
  color: string
  icon: string
  isDefault: boolean
  createdAt: string
  parentId?: number | null
  children?: Categorie[]
}

interface Props {
  categories: Categorie[]
}

function buildTree(categories: Categorie[]): Categorie[] {
  const map = new Map<number, Categorie & { children: Categorie[] }>()
  categories.forEach((cat) => map.set(cat.id, { ...cat, children: [] }))
  const roots: (Categorie & { children: Categorie[] })[] = []
  map.forEach((cat) => {
    if (cat.parentId && map.has(cat.parentId)) {
      map.get(cat.parentId)!.children.push(cat)
    } else {
      roots.push(cat)
    }
  })
  return roots
}

// Helper pour déterminer la couleur du texte (noir ou blanc) selon la couleur de fond
function getContrastTextColor(bgColor: string) {
  // bgColor format: #rrggbb
  if (!bgColor || !bgColor.startsWith('#') || bgColor.length !== 7) return 'black'
  const r = parseInt(bgColor.slice(1, 3), 16)
  const g = parseInt(bgColor.slice(3, 5), 16)
  const b = parseInt(bgColor.slice(5, 7), 16)
  // Calcul de la luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.5 ? 'black' : 'white'
}

// Helper pour générer un fond pâle à partir d'une couleur hex
function getPaleBgColor(hex: string) {
  if (!hex || !hex.startsWith('#') || (hex.length !== 7 && hex.length !== 4)) return '#f3f4f6'
  // Support #rgb
  let r, g, b
  if (hex.length === 7) {
    r = parseInt(hex.slice(1, 3), 16)
    g = parseInt(hex.slice(3, 5), 16)
    b = parseInt(hex.slice(5, 7), 16)
  } else {
    r = parseInt(hex[1] + hex[1], 16)
    g = parseInt(hex[2] + hex[2], 16)
    b = parseInt(hex[3] + hex[3], 16)
  }
  return `rgba(${r},${g},${b},0.10)`
}

const CategoryTree = ({
  nodes,
  level = 0,
  onEdit,
}: {
  nodes: Categorie[]
  level?: number
  onEdit: (cat: Categorie) => void
}) => (
  <ul className={level === 0 ? 'space-y-2' : 'ml-6 space-y-1'}>
    {nodes.map((cat) => (
      <li key={cat.id} className="flex items-center gap-2 py-1">
        <span style={{ marginLeft: level * 12 }} className="flex items-center gap-2 min-w-0">
          <span
            className="inline-block w-4 h-4 rounded-full border mr-2 align-middle"
            style={{ background: cat.color || '#eee' }}
          />
          <span className="font-medium truncate max-w-xs">{cat.name}</span>
          {cat.icon && <span className="ml-1">{cat.icon}</span>}
          {cat.isDefault && (
            <span className="ml-2 text-xs text-green-600 bg-green-100 rounded px-1">Défaut</span>
          )}
        </span>
        <span className="text-xs text-gray-500 ml-2">
          {new Date(cat.createdAt).toLocaleDateString()}
        </span>
        <button
          className="ml-2 px-2 py-1 text-xs rounded bg-blue-100 text-blue-700 hover:bg-blue-200 transition"
          onClick={() => onEdit(cat)}
          type="button"
        >
          Modifier
        </button>
        {cat.children && cat.children.length > 0 && (
          <CategoryTree nodes={cat.children} level={level + 1} onEdit={onEdit} />
        )}
      </li>
    ))}
  </ul>
)

const CategoryTreeFlat = ({
  nodes,
  level = 0,
  onEdit,
}: {
  nodes: Categorie[]
  level?: number
  onEdit: (cat: Categorie) => void
}) => (
  <>
    {nodes.map((cat) => (
      <>
        <div
          key={cat.id}
          className="flex items-center gap-2 py-1"
          style={{ marginLeft: level * 24 }}
        >
          <span className="flex items-center gap-2 min-w-0">
            <span
              className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-semibold border align-middle"
              style={{
                background: getPaleBgColor(cat.color || '#eee'),
                color: cat.color || '#333',
                borderColor: getPaleBgColor(cat.color || '#eee'),
              }}
            >
              {cat.icon && <span>{cat.icon}</span>}
              {cat.name}
            </span>
            {cat.isDefault && (
              <span className="ml-2 text-xs text-green-600 bg-green-100 rounded px-1">Défaut</span>
            )}
          </span>
          <button
            className="ml-2 p-1 rounded hover:bg-gray-200 text-black transition"
            onClick={() => onEdit(cat)}
            type="button"
            title="Modifier"
          >
            <LucideEdit size={18} />
          </button>
        </div>
        {cat.children && cat.children.length > 0 && (
          <CategoryTreeFlat nodes={cat.children} level={level + 1} onEdit={onEdit} />
        )}
      </>
    ))}
  </>
)

const Index = ({ categories = [] }: Props) => {
  const [open, setOpen] = useState(false)
  const [editCategory, setEditCategory] = useState<Categorie | null>(null)

  const handleEdit = (cat: Categorie) => {
    setEditCategory(cat)
    setOpen(true)
  }

  return (
    <>
      <DefaultLayout>
        <Head title="Categories" />
        <div>
          <HeaderPage
            title="Categories"
            button="Ajouter une catégorie"
            action={() => {
              setEditCategory(null)
              setOpen(true)
            }}
          />
        </div>

        <Dialog
          open={open}
          onOpenChange={(v) => {
            setOpen(v)
            if (!v) setEditCategory(null)
          }}
        >
          <DialogContent>
            {editCategory ? (
              <EditCategory
                category={editCategory}
                categories={categories}
                onClose={() => {
                  setOpen(false)
                  setEditCategory(null)
                }}
              />
            ) : (
              <AddCategories onClose={() => setOpen(false)} categories={categories} />
            )}
          </DialogContent>
        </Dialog>

        <div className="rounded-md border mt-8 p-4 bg-white">
          <h2 className="font-semibold mb-4">Arborescence des catégories</h2>
          {categories.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">Aucune catégorie trouvée.</div>
          ) : (
            <CategoryTreeFlat nodes={buildTree(categories)} onEdit={handleEdit} />
          )}
        </div>
      </DefaultLayout>
    </>
  )
}

export default Index
