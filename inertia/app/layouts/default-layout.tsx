import { SidebarProvider, SidebarTrigger } from '~/components/ui/sidebar'
import UserSidebar from '~/components/user-sidebar'
import { Head } from '@inertiajs/react'

const DefaultLayout = ({ children }: { children: React.ReactNode }) => {
  // Récupère csrfToken depuis les props de la page si présent
  // (children est un ReactElement)
  // @ts-ignore
  const csrfToken = children?.props?.csrfToken
  return (
    <>
      <Head>{csrfToken && <meta name="csrf-token" content={csrfToken} />}</Head>
      <SidebarProvider>
        <UserSidebar />

        <main className="flex flex-col w-full">
          <SidebarTrigger />
          <div className="p-8">{children}</div>
        </main>
      </SidebarProvider>
    </>
  )
}

export default DefaultLayout
