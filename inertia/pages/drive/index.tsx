import DefaultLayout from '~/app/layouts/default-layout'
import HeaderPage from '~/components/header-page'
import { useState } from 'react'
import { Dialog, DialogContent } from '~/components/ui/dialog'
import AddDocument from './components/add-document'
import DocumentTable from './components/document-table'

const Drive = ({ documents }: { documents: Document[] }) => {
  const [open, setOpen] = useState(false)

  const openDialog = () => {
    setOpen(true)
  }

  return (
    <DefaultLayout>
      <HeaderPage title="Base de documents" button="Ajouter un document" action={openDialog} />

      <div className="mt-6">
        <DocumentTable documents={documents} />
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <AddDocument onClose={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </DefaultLayout>
  )
}

export default Drive
