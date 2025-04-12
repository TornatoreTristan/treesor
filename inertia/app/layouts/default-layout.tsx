import { SidebarProvider, SidebarTrigger } from '~/components/ui/sidebar'
import UserSidebar from '~/components/user-sidebar'

const DefaultLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <>
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
