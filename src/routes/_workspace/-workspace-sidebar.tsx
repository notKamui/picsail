import { Link } from '@tanstack/react-router'
import { ImagePlus, Images, ShieldCheck } from 'lucide-react'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'

export function WorkspaceSidebar({
  active,
  isAdmin,
}: {
  active: 'files' | 'upload' | 'admin'
  isAdmin: boolean
}) {
  const { setOpenMobile } = useSidebar()
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="h-16 shrink-0 justify-center overflow-hidden px-3 py-0">
        <Link
          to="/files"
          aria-label="Picsail home"
          onClick={() => setOpenMobile(false)}
          className="flex items-baseline overflow-hidden font-serif text-2xl font-semibold tracking-tight whitespace-nowrap"
        >
          <span>P</span>
          <span className="inline-block max-w-24 overflow-hidden opacity-100 transition-[max-width,opacity] duration-200 ease-linear group-data-[collapsible=icon]:max-w-0 group-data-[collapsible=icon]:opacity-0 motion-reduce:transition-none">
            icsail
          </span>
          <span>.</span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <nav aria-label="Workspace" className="px-2">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={active === 'files'} tooltip="My files" size="lg">
                <Link
                  to="/files"
                  aria-label="My files"
                  aria-current={active === 'files' ? 'page' : undefined}
                  onClick={() => setOpenMobile(false)}
                >
                  <Images aria-hidden="true" />
                  <span className="shrink-0 transition-opacity duration-200 group-data-[collapsible=icon]:opacity-0 motion-reduce:transition-none">
                    My files
                  </span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={active === 'upload'} tooltip="Upload" size="lg">
                <Link
                  to="/upload"
                  aria-label="Upload"
                  aria-current={active === 'upload' ? 'page' : undefined}
                  onClick={() => setOpenMobile(false)}
                >
                  <ImagePlus aria-hidden="true" />
                  <span className="shrink-0 transition-opacity duration-200 group-data-[collapsible=icon]:opacity-0 motion-reduce:transition-none">
                    Upload
                  </span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            {isAdmin && (
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={active === 'admin'}
                  tooltip="Administration"
                  size="lg"
                >
                  <Link
                    to="/admin"
                    aria-label="Administration"
                    aria-current={active === 'admin' ? 'page' : undefined}
                    onClick={() => setOpenMobile(false)}
                  >
                    <ShieldCheck aria-hidden="true" />
                    <span className="shrink-0 transition-opacity duration-200 group-data-[collapsible=icon]:opacity-0 motion-reduce:transition-none">
                      Administration
                    </span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )}
          </SidebarMenu>
        </nav>
      </SidebarContent>
      <SidebarFooter className="overflow-hidden border-t border-sidebar-border p-4">
        <p className="w-48 text-sm leading-6 text-muted-foreground transition-opacity duration-200 group-data-[collapsible=icon]:opacity-0 motion-reduce:transition-none">
          A home for the images you share.
        </p>
      </SidebarFooter>
    </Sidebar>
  )
}
