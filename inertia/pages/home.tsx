import { Head } from '@inertiajs/react'
import DefaultLayout from '~/app/layouts/default-layout'

export default function Home() {
  return (
    <>
      <DefaultLayout>
        <Head title="Homepage" />
        <div>
          <h1>Tableau de bord</h1>
        </div>
      </DefaultLayout>
    </>
  )
}
