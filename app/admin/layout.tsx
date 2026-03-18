import { AdminSidebar } from '@/components/admin/AdminSidebar'
import { AdminTopBar } from '@/components/admin/AdminTopBar'

export const metadata = {
  title: 'Bamboo Vet Admin',
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  // NO auth check here — trust proxy middleware (SHELL-05)
  // NO LanguageProvider — admin is Vietnamese only (SHELL-05)
  return (
    <div className="dark">
      <div className="flex h-screen bg-gray-900">
        <AdminSidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <AdminTopBar />
          <main className="flex-1 overflow-auto p-6 bg-gray-900">
            {children}
          </main>
        </div>
      </div>
    </div>
  )
}
