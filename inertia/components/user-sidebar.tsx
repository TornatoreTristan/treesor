import {
  BookUser,
  CircleDollarSign,
  LayoutDashboard,
  LayoutList,
  ReceiptEuro,
  LogOut,
} from 'lucide-react'
import {
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  Sidebar,
  SidebarFooter,
} from './ui/sidebar'
import { Button } from './ui/button'

const items = [
  {
    title: 'Dashboard',
    url: '/',
    icon: LayoutDashboard,
  },
  {
    title: 'Transactions',
    url: '/transactions',
    icon: CircleDollarSign,
  },
  {
    title: 'Catégories',
    url: '/categories',
    icon: LayoutList,
  },
  {
    title: 'Factures',
    url: '/invoices',
    icon: ReceiptEuro,
  },
  {
    title: 'Fournisseurs',
    url: '/fournisseurs',
    icon: BookUser,
  },
]

const UserSidebar = () => {
  const handleLogout = () => {
    const form = document.createElement('form')
    form.method = 'POST'
    form.action = '/logout'

    // Ajouter le token CSRF si disponible
    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content')
    if (csrfToken) {
      const csrfInput = document.createElement('input')
      csrfInput.type = 'hidden'
      csrfInput.name = '_token'
      csrfInput.value = csrfToken
      form.appendChild(csrfInput)
    }

    document.body.appendChild(form)
    form.submit()
  }

  return (
    <>
      <Sidebar>
        <SidebarContent className="px-4">
          <SidebarGroup>
            <SidebarGroupLabel className="mb-8">Treesor</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <a href={item.url}>
                        <item.icon />
                        <span>{item.title}</span>
                      </a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="px-4 pb-4">
          <Button
            variant="outline"
            onClick={handleLogout}
            className="w-full flex items-center gap-2"
          >
            <LogOut className="h-4 w-4" />
            Se déconnecter
          </Button>
        </SidebarFooter>
      </Sidebar>
    </>
  )
}

export default UserSidebar
