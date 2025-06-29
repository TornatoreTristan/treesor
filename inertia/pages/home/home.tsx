import { Head } from '@inertiajs/react'
import DefaultLayout from '~/app/layouts/default-layout'
import HeaderPage from '~/components/header-page'
import Dashboard from './components/dashboard'

export default function Home() {
  return (
    <>
      <DefaultLayout>
        <Head title="Homepage" />
        <div>
          <HeaderPage title="Tableau de bord" />
          <div className="mt-8">
            <Dashboard />
          </div>
        </div>
      </DefaultLayout>
    </>
  )
}
