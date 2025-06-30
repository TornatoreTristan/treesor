import { BookUser, CircleDollarSign, LayoutDashboard, LayoutList, ReceiptEuro } from 'lucide-react'
import {
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  Sidebar,
} from './ui/sidebar'

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
      </Sidebar>
    </>
  )
}

export default UserSidebar
