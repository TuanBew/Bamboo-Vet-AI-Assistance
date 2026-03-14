import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { SidebarProvider } from '@/components/ui/sidebar'
import AppSidebar from '@/components/sidebar/AppSidebar'
import Header from '@/components/layout/Header'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export default async function AppLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const svc = createServiceClient()
  const { data: conversations } = await svc
    .from('conversations')
    .select('id, title, updated_at')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full overflow-hidden">
        <AppSidebar conversations={conversations ?? []} />
        <div className="flex flex-col flex-1 overflow-hidden">
          <Header />
          <main className="flex-1 overflow-hidden">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  )
}
